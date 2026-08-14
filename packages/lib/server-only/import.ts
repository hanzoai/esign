import { PDF, StandardFonts, layoutText } from '@libpdf/core';
import { lookup } from 'node:dns/promises';
import { match } from 'ts-pattern';

import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '../constants/app';
import { AppError } from '../errors/app-error';
import type { TImportSource } from '../universal/import';
import { ImportError, isBlocked, isPdf, parseUrl } from '../universal/import';
import { megabytesToBytes } from '../universal/unit-convertions';

/**
 * Turn an import source into PDF bytes.
 *
 * This is the only place a source is read. Whatever it was — a pasted note, a
 * link, later a file picked out of a drive — it leaves here as bytes and is
 * created by `envelope.create`, exactly like a browser upload.
 */

const LIMIT = megabytesToBytes(APP_DOCUMENT_UPLOAD_SIZE_LIMIT);
const TIMEOUT = 15_000;
const REDIRECTS = 4;

const failed = (message: string) => new AppError(ImportError.fetch, { message, statusCode: 400 });

/** Refuse a host that resolves inside the cluster, whatever it is called. */
const resolveHost = async (url: URL) => {
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true }).catch(
    () => [],
  );

  if (addresses.length === 0) {
    throw failed(`Cannot resolve ${url.hostname}`);
  }

  if (addresses.some(({ address }) => isBlocked(address))) {
    throw new AppError(ImportError.url, {
      message: `Unreachable host: ${url.hostname}`,
      statusCode: 400,
    });
  }
};

/** Read a response body, stopping at the limit rather than after it. */
const read = async (response: Response): Promise<Uint8Array<ArrayBuffer>> => {
  const declared = Number(response.headers.get('content-length'));

  if (Number.isFinite(declared) && declared > LIMIT) {
    throw new AppError(ImportError.size, { statusCode: 400 });
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw failed('The response carried no body');
  }

  const chunks: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    size += value.length;

    if (size > LIMIT) {
      await reader.cancel();

      throw new AppError(ImportError.size, { statusCode: 400 });
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let at = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }

  return bytes;
};

/** The GitHub contents API answers with JSON unless asked for the file itself. */
const accept = (url: URL) =>
  url.hostname === 'api.github.com' ? 'application/vnd.github.raw' : 'application/pdf, */*';

const filename = (url: URL): string => {
  const last = decodeURIComponent(url.pathname.split('/').pop() ?? '').trim();
  const name = last.replace(/[/\\]/g, '').slice(0, 200);

  if (!name) {
    return 'document.pdf';
  }

  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
};

const fromUrl = async ({ url: address }: { url: string }) => {
  let url = parseUrl(address);
  let response: Response;

  for (let hop = 0; ; hop += 1) {
    await resolveHost(url);

    const dialled = url;

    response = await fetch(dialled, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { accept: accept(dialled) },
    }).catch(() => {
      throw failed(`Could not reach ${dialled.hostname}`);
    });

    if (response.status < 300 || response.status > 399) {
      break;
    }

    const location = response.headers.get('location');

    if (!location || hop === REDIRECTS) {
      throw failed('The address redirects too many times');
    }

    url = parseUrl(new URL(location, dialled).toString());
  }

  if (!response.ok) {
    throw failed(`The server answered ${response.status}`);
  }

  const bytes = await read(response);

  if (!isPdf(bytes)) {
    throw new AppError(ImportError.pdf, { statusCode: 400 });
  }

  return { name: filename(url), bytes };
};

const PAGE = { width: 612, height: 792 } as const;
const MARGIN = 56;
const BODY = 11;
const LEADING = 1.45;

/** Standard 14 fonts speak WinAnsi. Fold the typography a paste usually carries
 *  into it, and drop what it cannot say. */
const FOLD: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '“': '"',
  '”': '"',
  '–': '-',
  '—': '--',
  '•': '-',
  '…': '...',
  '\u00a0': ' ',
  '\t': '    ',
};

const encodable = (text: string) =>
  text.replace(/[‘’‚“”–—•…\u00a0\t]/g, (c) => FOLD[c]).replace(/[^\x20-\x7e\xa1-\xff]/g, '');

/** Markdown emphasis reads as noise once it is no longer being rendered. */
const plain = (text: string) =>
  text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/`([^`]*)`/g, '$1');

type Block = { text: string; size: number; bold: boolean; indent: number; marker: string };

const parse = (line: string): Block => {
  const heading = /^(#{1,3})\s+(.*)$/.exec(line);

  if (heading) {
    return {
      text: heading[2],
      size: [18, 14, 12][heading[1].length - 1],
      bold: true,
      indent: 0,
      marker: '',
    };
  }

  const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);

  if (bullet) {
    return { text: bullet[1], size: BODY, bold: false, indent: 16, marker: '-' };
  }

  const ordered = /^\s*(\d{1,3}[.)])\s+(.*)$/.exec(line);

  if (ordered) {
    return { text: ordered[2], size: BODY, bold: false, indent: 22, marker: ordered[1] };
  }

  return { text: line, size: BODY, bold: false, indent: 0, marker: '' };
};

const fromText = async ({ title, text }: { title: string; text: string }) => {
  const pdf = PDF.create();

  let page = pdf.addPage({ size: 'letter' });
  let y = PAGE.height - MARGIN;

  const turn = () => {
    page = pdf.addPage({ size: 'letter' });
    y = PAGE.height - MARGIN;
  };

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const block = parse(line);
    const body = encodable(plain(block.text)).trimEnd();

    if (!body) {
      y -= BODY;
      continue;
    }

    const font = block.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
    const leading = block.size * LEADING;
    const width = PAGE.width - MARGIN * 2 - block.indent;
    const { lines } = layoutText(body, font, block.size, width, leading);

    lines.forEach(({ text: run }, index) => {
      if (y - leading < MARGIN) {
        turn();
      }

      if (index === 0 && block.marker) {
        page.drawText(block.marker, { x: MARGIN, y: y - block.size, font, size: block.size });
      }

      page.drawText(run, {
        x: MARGIN + block.indent,
        y: y - block.size,
        font,
        size: block.size,
      });

      y -= leading;
    });

    if (block.bold) {
      y -= block.size * 0.4;
    }
  }

  const name = title.replace(/\.pdf$/i, '').trim() || 'document';

  // A copy the caller owns: `save` writes into a pooled buffer, and a view over
  // a pool is not the document.
  return { name: `${name}.pdf`, bytes: new Uint8Array(await pdf.save()) };
};

/**
 * Resolve a source to the bytes an envelope is made from.
 *
 * A new source is one more case here and one more member of ZImportSourceSchema
 * — nothing else moves. Google Drive is the next one and needs an OAuth client
 * id plus a Picker API key before it can be written: the picker hands back a
 * file id, this function exchanges it for bytes.
 */
export const resolve = async (
  source: TImportSource,
): Promise<{ name: string; bytes: Uint8Array<ArrayBuffer> }> =>
  match(source).with({ kind: 'url' }, fromUrl).with({ kind: 'text' }, fromText).exhaustive();

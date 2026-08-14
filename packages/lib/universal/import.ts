import { z } from 'zod';

import { AppError } from '../errors/app-error';

/**
 * Where a document can come from, and which URLs the server may dial to get it.
 *
 * Every source resolves to PDF bytes and is created through `envelope.create`,
 * so nothing downstream knows which one it was. Only the resolver (server-only/
 * import.ts) turns a source into bytes; this module is the contract and the
 * policy, and holds no IO so it can be read the same way on both sides.
 */

/** Why an import failed. `uploadErrorMessage` words each one for the user. */
export const ImportError = {
  url: 'IMPORT_URL_INVALID',
  fetch: 'IMPORT_FETCH_FAILED',
  pdf: 'IMPORT_NOT_PDF',
  size: 'IMPORT_TOO_LARGE',
} as const;

/** A pasted document longer than this is a paste accident, not a contract. */
export const TEXT_LIMIT = 500_000;

export const ZImportSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('url'),
    url: z.string().trim().min(1).max(2048),
  }),
  z.object({
    kind: z.literal('text'),
    title: z.string().trim().min(1).max(255),
    text: z.string().min(1).max(TEXT_LIMIT),
  }),
]);

export type TImportSource = z.infer<typeof ZImportSourceSchema>;

const invalid = (message: string) => new AppError(ImportError.url, { message, statusCode: 400 });

/** Names that only resolve inside a cluster, however they are spelled. */
const PRIVATE_NAME = /(^|\.)(localhost|local|internal|home\.arpa)$/;

/** Dotted-quad, or null when the host is not an IPv4 literal. `URL` has already
 *  canonicalised the octal/hex/integer spellings by the time we see it. */
const ipv4 = (host: string): number[] | null => {
  const parts = host.split('.');

  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : -1));

  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
};

/** Eight hextets, or null when the host is not an IPv6 literal. */
const ipv6 = (host: string): number[] | null => {
  if (!host.includes(':')) {
    return null;
  }

  const [head, tail, ...rest] = host.split('::');

  if (rest.length > 0) {
    return null;
  }

  const read = (part: string) =>
    part === ''
      ? []
      : part.split(':').map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : -1));

  const left = read(head);
  const right = tail === undefined ? [] : read(tail);
  const gap = 8 - left.length - right.length;

  if (gap < 0 || (tail === undefined && gap !== 0)) {
    return null;
  }

  const hextets = [...left, ...Array(gap).fill(0), ...right];

  return hextets.every((hextet) => hextet >= 0) ? hextets : null;
};

const privateIpv4 = ([a, b]: number[]): boolean =>
  a === 0 || // this network
  a === 10 || // private
  a === 127 || // loopback
  (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
  (a === 169 && b === 254) || // link-local, incl. the cloud metadata address
  (a === 172 && b >= 16 && b <= 31) || // private
  (a === 192 && b === 0) || // IETF protocol assignments
  (a === 192 && b === 168) || // private
  (a === 198 && b >= 18 && b <= 19) || // benchmarking
  a >= 224; // multicast and reserved

/** Whether a host is one the server must not reach out to. Read twice: once for
 *  the hostname in the URL, once for every address that hostname resolves to. */
export const isBlocked = (host: string): boolean => {
  const name = host.toLowerCase().replace(/^\[|\]$/g, '');

  if (name === '' || PRIVATE_NAME.test(name)) {
    return true;
  }

  const v4 = ipv4(name);

  if (v4) {
    return privateIpv4(v4);
  }

  const v6 = ipv6(name);

  if (!v6) {
    return false;
  }

  // IPv4-mapped (::ffff:a.b.c.d) carries a v4 address in the last two hextets.
  if (v6.slice(0, 5).every((hextet) => hextet === 0) && v6[5] === 0xffff) {
    return privateIpv4([v6[6] >> 8, v6[6] & 0xff, v6[7] >> 8, v6[7] & 0xff]);
  }

  return (
    v6.every((hextet) => hextet === 0) || // unspecified
    (v6.slice(0, 7).every((hextet) => hextet === 0) && v6[7] === 1) || // loopback
    (v6[0] & 0xfe00) === 0xfc00 || // unique local
    (v6[0] & 0xffc0) === 0xfe80 // link local
  );
};

/** A GitHub page URL points at HTML; the same file is served raw one host over.
 *  Pasting the address from the browser is the natural thing to do, so accept
 *  it and read the bytes GitHub would have shown. */
const github = (url: URL): URL => {
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
    return url;
  }

  const [owner, repo, kind, ...path] = url.pathname.replace(/^\//, '').split('/');

  if (!owner || !repo || (kind !== 'blob' && kind !== 'raw') || path.length < 2) {
    return url;
  }

  return new URL(`https://raw.githubusercontent.com/${owner}/${repo}/${path.join('/')}`);
};

/** Parse a URL the server is allowed to fetch, refusing everything else. */
export const parseUrl = (raw: string): URL => {
  let url: URL;

  try {
    url = new URL(raw.trim());
  } catch {
    throw invalid('The address is not a URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw invalid(`Unsupported scheme: ${url.protocol}`);
  }

  if (url.username || url.password) {
    throw invalid('The address carries credentials');
  }

  if (isBlocked(url.hostname)) {
    throw invalid(`Unreachable host: ${url.hostname}`);
  }

  return github(url);
};

/** Whether bytes are a PDF. A reader tolerates a little junk before the header,
 *  so look for it the same way rather than only at offset zero. */
export const isPdf = (bytes: Uint8Array): boolean => {
  const head = bytes.subarray(0, 1024);

  for (let i = 0; i + 5 <= head.length; i += 1) {
    if (
      head[i] === 0x25 && // %
      head[i + 1] === 0x50 && // P
      head[i + 2] === 0x44 && // D
      head[i + 3] === 0x46 && // F
      head[i + 4] === 0x2d // -
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Importing a document from somewhere other than a file picker.
 *
 * Two things have to hold. The URL policy decides which addresses the server
 * will dial on a caller's behalf, so it is the boundary between "fetch a public
 * PDF" and "read something that only exists inside the cluster" — every refusal
 * below is an address the server must never reach. And a pasted note has to come
 * back as a real PDF, since it is handed to `envelope.create` as if it had been
 * uploaded.
 *
 * Run:  npx tsx --test packages/lib/__tests__/import.test.ts
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, test } from 'node:test';

import { AppError } from '../errors/app-error';
import { resolve } from '../server-only/import';
import { ImportError, isBlocked, isPdf, parseUrl } from '../universal/import';

const refused = (address: string) => {
  const err = (() => {
    try {
      parseUrl(address);
      return null;
    } catch (caught) {
      return AppError.parseError(caught);
    }
  })();

  assert.ok(err, `${address} was accepted`);
  assert.equal(err.code, ImportError.url);
};

describe('import url policy', () => {
  test('only http(s) is fetchable', () => {
    for (const address of [
      'file:///etc/passwd',
      'ftp://example.com/a.pdf',
      'gopher://example.com/a.pdf',
      'data:application/pdf;base64,JVBERi0=',
      'not a url',
      '',
    ]) {
      refused(address);
    }

    assert.equal(parseUrl('https://example.com/a.pdf').protocol, 'https:');
    assert.equal(parseUrl('http://example.com/a.pdf').protocol, 'http:');
  });

  test('an address inside the cluster is refused', () => {
    for (const address of [
      'http://localhost:3000/a.pdf',
      'http://app.localhost/a.pdf',
      'http://sign.internal/a.pdf',
      'http://printer.local/a.pdf',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://127.0.0.1/a.pdf',
      'http://127.1.2.3/a.pdf',
      'http://10.0.0.1/a.pdf',
      'http://172.16.0.1/a.pdf',
      'http://172.31.255.254/a.pdf',
      'http://192.168.1.1/a.pdf',
      'http://169.254.169.254/latest/meta-data/',
      'http://100.64.0.1/a.pdf',
      'http://0.0.0.0/a.pdf',
      'http://[::1]/a.pdf',
      'http://[::]/a.pdf',
      'http://[fd00::1]/a.pdf',
      'http://[fe80::1]/a.pdf',
      'http://[::ffff:127.0.0.1]/a.pdf',
    ]) {
      refused(address);
    }
  });

  test('the spellings a URL normalises away are refused too', () => {
    // Every one of these is 127.0.0.1 by the time the URL parser is done.
    for (const address of [
      'http://2130706433/a.pdf',
      'http://0177.0.0.1/a.pdf',
      'http://0x7f.0.0.1/a.pdf',
      'http://LOCALHOST/a.pdf',
    ]) {
      refused(address);
    }
  });

  test('credentials in the address are refused', () => {
    refused('https://user:pass@example.com/a.pdf');
  });

  test('a public address is accepted, 172.32 and 172.15 among them', () => {
    for (const address of [
      'https://example.com/a.pdf',
      'https://raw.githubusercontent.com/o/r/main/a.pdf',
      'http://172.32.0.1/a.pdf',
      'http://172.15.0.1/a.pdf',
      'http://8.8.8.8/a.pdf',
      'http://[2001:db8::1]/a.pdf',
    ]) {
      assert.ok(parseUrl(address) instanceof URL, `${address} was refused`);
    }
  });

  test('the same predicate reads a resolved address', () => {
    assert.equal(isBlocked('169.254.169.254'), true);
    assert.equal(isBlocked('::1'), true);
    assert.equal(isBlocked('93.184.216.34'), false);
  });

  test('a GitHub page URL is read as the file it shows', () => {
    assert.equal(
      parseUrl('https://github.com/hanzoai/sign/blob/main/docs/terms.pdf').toString(),
      'https://raw.githubusercontent.com/hanzoai/sign/main/docs/terms.pdf',
    );

    assert.equal(
      parseUrl('https://github.com/hanzoai/sign/raw/v1.2.3/a/b/terms.pdf').toString(),
      'https://raw.githubusercontent.com/hanzoai/sign/v1.2.3/a/b/terms.pdf',
    );

    // A repo page carries no file, so it is left alone and answers as HTML —
    // which the PDF check then refuses.
    assert.equal(
      parseUrl('https://github.com/hanzoai/sign').toString(),
      'https://github.com/hanzoai/sign',
    );
  });
});

describe('import url fetch', () => {
  test('the resolver applies the policy, not just the parser', async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/pdf' });
      res.end('%PDF-1.7\nnot yours\n%%EOF\n');
    });

    await new Promise<void>((ready) => {
      server.listen(0, '127.0.0.1', ready);
    });

    const { port } = server.address() as AddressInfo;
    let reached = false;

    server.on('request', () => {
      reached = true;
    });

    try {
      const err = await resolve({ kind: 'url', url: `http://127.0.0.1:${port}/a.pdf` }).then(
        () => null,
        (caught: unknown) => AppError.parseError(caught),
      );

      assert.ok(err, 'a loopback address was fetched');
      assert.equal(err.code, ImportError.url);
      assert.equal(reached, false, 'the server was dialled anyway');
    } finally {
      server.close();
    }
  });
});

describe('pdf recognition', () => {
  const bytes = (s: string) => new TextEncoder().encode(s);

  test('a PDF is recognised by its header, junk in front of it or not', () => {
    assert.equal(isPdf(bytes('%PDF-1.7\n...')), true);
    assert.equal(isPdf(bytes(`${'\n'.repeat(40)}%PDF-1.4`)), true);
  });

  test('anything else is not a PDF', () => {
    assert.equal(isPdf(bytes('<!doctype html><html>404</html>')), false);
    assert.equal(isPdf(bytes('')), false);
    assert.equal(isPdf(bytes('%PDF')), false);
    assert.equal(isPdf(bytes(`${'x'.repeat(2000)}%PDF-1.7`)), false);
  });
});

describe('pasted content', () => {
  test('text becomes a PDF named after its title', async () => {
    const { name, bytes } = await resolve({
      kind: 'text',
      title: 'Mutual NDA',
      text: '# Mutual NDA\n\nBoth parties agree.\n\n- One\n- Two\n',
    });

    assert.equal(name, 'Mutual NDA.pdf');
    assert.equal(isPdf(bytes), true);
    assert.ok(bytes.length > 500, `only ${bytes.length} bytes`);
  });

  test('a long paste runs onto further pages', async () => {
    const one = await resolve({ kind: 'text', title: 'One', text: 'A single line.' });
    const many = await resolve({
      kind: 'text',
      title: 'Many',
      text: Array.from({ length: 400 }, (_, i) => `Clause ${i + 1}. The parties agree.`).join('\n'),
    });

    const pages = (bytes: Uint8Array) =>
      (Buffer.from(bytes).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

    assert.equal(pages(one.bytes), 1);
    assert.ok(pages(many.bytes) > 5, `expected several pages, got ${pages(many.bytes)}`);
  });

  test('typography a paste carries does not break the render', async () => {
    const { bytes } = await resolve({
      kind: 'text',
      title: 'Odd',
      text: 'A “quoted” em—dash, an ellipsis… a 🙂 and a tab\there.',
    });

    assert.equal(isPdf(bytes), true);
  });

  test('a title that already ends in .pdf is not doubled', async () => {
    const { name } = await resolve({ kind: 'text', title: 'terms.pdf', text: 'Hello.' });

    assert.equal(name, 'terms.pdf');
  });
});

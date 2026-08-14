/**
 * The upload wire: a callsite's FormData -> the ZAP payload -> the route schema.
 *
 * Every upload route takes a FormData carrying a JSON `payload` entry and one
 * or more `files` entries. The transport serialises a call input with SuperJSON,
 * which carries typed values but not bytes — a FormData has no enumerable
 * properties, so it serialised to `{}` and the route saw no payload at all.
 * These tests drive the REAL encode/decode pair, and parse the result with a
 * REAL route schema, so they fail if either end stops carrying the bytes.
 *
 * Run:  npx tsx --test packages/trpc/__tests__/file.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import SuperJSON from 'superjson';

import { ZCreateEnvelopeItemsRequestSchema } from '../server/envelope-router/create-envelope-items.types';
import { pack, unpack } from '../zap/runtime/file';

const PDF = '%PDF-1.7\nhanzo sign\n%%EOF\n';

/** The FormData every upload callsite builds. */
const upload = (payload: unknown, ...names: string[]): FormData => {
  const form = new FormData();

  form.append('payload', JSON.stringify(payload));

  for (const name of names) {
    form.append('files', new File([`${PDF}${name}`], name, { type: 'application/pdf' }));
  }

  return form;
};

/** Exactly what the client sends, and what the server decodes from it. */
const wire = async (input: unknown): Promise<{ payload: string; decoded: unknown }> => {
  const payload = SuperJSON.stringify(await pack(input));

  return { payload, decoded: unpack(SuperJSON.parse(payload)) };
};

describe('upload wire', () => {
  test('envelope.create reaches the server with its payload and file', async () => {
    const sent = {
      type: 'DOCUMENT',
      title: 'contract.pdf',
      meta: { timezone: 'Etc/UTC' },
    };

    const { payload, decoded } = await wire(upload(sent, 'contract.pdf'));

    // The defect: a FormData serialised to an empty object, so the route
    // rejected the call with `path: ["payload"], Required`.
    assert.notEqual(payload, '{"json":{}}');

    assert.ok(decoded instanceof FormData);
    assert.deepEqual(JSON.parse(String(decoded.get('payload'))), sent);

    const file = decoded.get('files');

    assert.ok(file instanceof File);
    assert.equal(file.name, 'contract.pdf');
    assert.equal(file.type, 'application/pdf');
    assert.equal(await file.text(), `${PDF}contract.pdf`);
  });

  test('envelope.create carries every file of a multi-file envelope', async () => {
    const { decoded } = await wire(
      upload({ type: 'TEMPLATE', title: 'pack.pdf' }, 'one.pdf', 'two.pdf'),
    );

    assert.ok(decoded instanceof FormData);

    const files = decoded.getAll('files').filter((entry) => entry instanceof File);

    assert.deepEqual(
      files.map((file) => file.name),
      ['one.pdf', 'two.pdf'],
    );
    assert.equal(await files[1].text(), `${PDF}two.pdf`);
  });

  test('envelope.item.createMany parses under its own route schema', async () => {
    const { decoded } = await wire(upload({ envelopeId: 'envelope_1' }, 'added.pdf'));

    const input = ZCreateEnvelopeItemsRequestSchema.parse(decoded);

    assert.equal(input.payload.envelopeId, 'envelope_1');
    assert.equal(input.files.length, 1);
    assert.equal(await input.files[0].text(), `${PDF}added.pdf`);
  });

  test('an empty input is still rejected by the route schema', async () => {
    const { decoded } = await wire(new FormData());

    assert.throws(() => ZCreateEnvelopeItemsRequestSchema.parse(decoded));
  });

  test('bytes survive the round trip for every byte value', async () => {
    const bytes = new Uint8Array(1024);

    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = i % 256;
    }

    const form = new FormData();
    form.append('files', new File([bytes], 'bytes.bin'));

    const { decoded } = await wire(form);

    assert.ok(decoded instanceof FormData);

    const file = decoded.get('files');

    assert.ok(file instanceof File);
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
  });

  test('a plain input is untouched and its typed values still ride SuperJSON', async () => {
    const at = new Date('2026-08-13T00:00:00.000Z');
    const { decoded } = await wire({ id: 'envelope_1', at, tags: ['a', 'b'], nested: { n: 1 } });

    assert.deepEqual(decoded, { id: 'envelope_1', at, tags: ['a', 'b'], nested: { n: 1 } });
  });
});

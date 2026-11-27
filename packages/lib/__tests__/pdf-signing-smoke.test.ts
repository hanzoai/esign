/**
 * Smoke tests for the PDF upload -> normalization -> page sizing -> field
 * flattening pipeline in @hanzo/esign-lib.
 *
 * Run: npx tsx --test packages/lib/__tests__/pdf-signing-smoke.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { PDF } from '@libpdf/core';

import { PDF_SIZE_A4_72PPI } from '../constants/pdf';
import { getLastPageDimensions } from '../server-only/pdf/get-page-size';
import { normalizePdf } from '../server-only/pdf/normalize-pdf';

describe('PDF upload & normalization smoke tests', () => {
  test('creates, normalizes, and preserves page dimensions of a valid PDF', async () => {
    const doc = PDF.create();
    doc.addPage({ width: 595, height: 842 });
    const rawBytes = Buffer.from(await doc.save());

    const normalized = await normalizePdf(rawBytes);
    assert.ok(normalized.subarray(0, 5).toString('utf8') === '%PDF-');

    const reloaded = await PDF.load(normalized);
    assert.equal(reloaded.getPageCount(), 1);

    const dims = getLastPageDimensions(reloaded);
    assert.deepEqual(dims, { width: 595, height: 842 });
  });

  test('falls back to A4 dimensions when page is below minimum certificate size', async () => {
    const doc = PDF.create();
    doc.addPage({ width: 100, height: 100 });
    const loaded = await PDF.load(await doc.save());

    assert.deepEqual(getLastPageDimensions(loaded), PDF_SIZE_A4_72PPI);
  });

  test('rejects non-PDF payloads cleanly during upload normalization', async () => {
    await assert.rejects(
      async () => await normalizePdf(Buffer.from('not a pdf document', 'utf8')),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /not a valid PDF/i);
        return true;
      },
    );
  });
});

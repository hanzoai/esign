/**
 * Which store a document's bytes go to.
 *
 * The value that decides it arrives as a string from the environment, so the
 * interesting cases are the wrong ones. A wrong value used to select the
 * database silently, which is indistinguishable from object storage being
 * configured and ignored — so every case below that is not a transport has to
 * throw rather than pick one.
 *
 * Run:  npx tsx --test packages/lib/__tests__/upload.test.ts
 */
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { uploadTransport } from '../universal/upload/transport';

const set = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT;
    return;
  }

  process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT = value;
};

afterEach(() => set(undefined));

describe('upload transport', () => {
  test('unset is the database', () => {
    set(undefined);
    assert.equal(uploadTransport(), 'database');

    set('');
    assert.equal(uploadTransport(), 'database');
  });

  test('the two transports read as themselves', () => {
    set('database');
    assert.equal(uploadTransport(), 'database');

    set('s3');
    assert.equal(uploadTransport(), 's3');
  });

  test('anything else throws instead of picking a store', () => {
    for (const value of ['S3', 's3 ', ' s3', 'minio', 'S3_PATH', 'true', 'bytes_64']) {
      set(value);

      assert.throws(
        () => uploadTransport(),
        (err: Error) => err.message.includes(value),
        `"${value}" was accepted as a transport`,
      );
    }
  });
});

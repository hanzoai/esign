import { match } from 'ts-pattern';

import { env } from '@hanzo/esign-lib/utils/env';

export type UploadTransport = 'database' | 's3';

/**
 * Where document bytes live: `database` inlines them as base64 on the
 * DocumentData row, `s3` stores an object key and streams from the bucket.
 *
 * Unset reads as `database`, the default every example config ships. Anything
 * else throws, because the alternative is worse than a crash: an unrecognised
 * value used to route to `database`, so a misspelled variable — or the right
 * value under the wrong variable name — stored every PDF inline while the
 * config claimed object storage, with nothing logged either way.
 */
export const uploadTransport = (): UploadTransport => {
  const transport = env('NEXT_PUBLIC_UPLOAD_TRANSPORT') || 'database';

  return match(transport)
    .with('database', 's3', (value) => value)
    .otherwise(() => {
      throw new Error(
        `NEXT_PUBLIC_UPLOAD_TRANSPORT is "${transport}", which is not a transport. Use "database" or "s3".`,
      );
    });
};

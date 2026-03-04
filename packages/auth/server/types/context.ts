import type { RequestMetadata } from '@hanzo/sign-lib/universal/extract-request-metadata';

export type HonoAuthContext = {
  Variables: {
    requestMetadata: RequestMetadata;
  };
};

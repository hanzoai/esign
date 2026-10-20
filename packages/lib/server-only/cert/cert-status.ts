import * as fs from 'node:fs';

import { env } from '@hanzo/esign-lib/utils/env';

export const getCertificateStatus = () => {
  // The same default the signer takes (packages/signing): an unset transport is
  // local, so it needs the certificate as much as an explicit one does.
  if ((env('NEXT_PRIVATE_SIGNING_TRANSPORT') || 'local') !== 'local') {
    return { isAvailable: true };
  }

  if (env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS')) {
    return { isAvailable: true };
  }

  const defaultPath =
    env('NODE_ENV') === 'production' ? '/opt/hanzo-sign/cert.p12' : './example/cert.p12';

  const filePath = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH') || defaultPath;

  try {
    fs.accessSync(filePath, fs.constants.F_OK | fs.constants.R_OK);

    const stats = fs.statSync(filePath);

    return { isAvailable: stats.size > 0 };
  } catch {
    return { isAvailable: false };
  }
};

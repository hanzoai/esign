import { env } from '../utils/env';

export const SIGN_ENCRYPTION_KEY = env('NEXT_PRIVATE_ENCRYPTION_KEY');

export const SIGN_ENCRYPTION_SECONDARY_KEY = env('NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY');

// if (typeof window === 'undefined') {
//   if (!SIGN_ENCRYPTION_KEY || !SIGN_ENCRYPTION_SECONDARY_KEY) {
//     throw new Error('Missing SIGN_ENCRYPTION_KEY or SIGN_ENCRYPTION_SECONDARY_KEY keys');
//   }

//   if (SIGN_ENCRYPTION_KEY === SIGN_ENCRYPTION_SECONDARY_KEY) {
//     throw new Error(
//       'SIGN_ENCRYPTION_KEY and SIGN_ENCRYPTION_SECONDARY_KEY cannot be equal',
//     );
//   }
// }

// if (SIGN_ENCRYPTION_KEY === 'CAFEBABE') {
//   console.warn('*********************************************************************');
//   console.warn('*');
//   console.warn('*');
//   console.warn('Please change the encryption key from the default value of "CAFEBABE"');
//   console.warn('*');
//   console.warn('*');
//   console.warn('*********************************************************************');
// }

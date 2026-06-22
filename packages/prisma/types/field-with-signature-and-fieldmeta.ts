import type { Field, Signature } from '@prisma/client';

import { type TFieldMetaSchema as FieldMeta } from '@hanzo/esign-lib/types/field-meta';

export type FieldWithSignatureAndFieldMeta = Field & {
  signature?: Signature | null;
  fieldMeta: FieldMeta | null;
};

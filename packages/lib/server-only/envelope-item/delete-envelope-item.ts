import { DOCUMENT_AUDIT_LOG_TYPE } from '@hanzo/sign-lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@hanzo/sign-lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@hanzo/sign-lib/utils/document-audit-logs';
import { prisma } from '@hanzo/sign-prisma';

type UnsafeDeleteEnvelopeItemOptions = {
  envelopeId: string;
  envelopeItemId: string;
  user: {
    id: number;
    name: string | null;
    email: string;
  };
  apiRequestMetadata: ApiRequestMetadata;
};

export const UNSAFE_deleteEnvelopeItem = async ({
  envelopeId,
  envelopeItemId,
  user,
  apiRequestMetadata,
}: UnsafeDeleteEnvelopeItemOptions) => {
  const result = await prisma.$transaction(async (tx) => {
    const deletedEnvelopeItem = await tx.envelopeItem.delete({
      where: {
        id: envelopeItemId,
        envelopeId,
      },
      select: {
        id: true,
        title: true,
        documentData: {
          select: {
            id: true,
          },
        },
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.ENVELOPE_ITEM_DELETED,
        envelopeId,
        data: {
          envelopeItemId: deletedEnvelopeItem.id,
          envelopeItemTitle: deletedEnvelopeItem.title,
        },
        user: {
          name: user.name,
          email: user.email,
        },
        requestMetadata: apiRequestMetadata.requestMetadata,
      }),
    });

    return deletedEnvelopeItem;
  });

  await prisma.documentData.delete({
    where: {
      id: result.documentData.id,
      envelopeItem: {
        is: null,
      },
    },
  });
};

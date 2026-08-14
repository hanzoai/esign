import { prisma } from '@hanzo/esign-prisma';

import { mapDocumentIdToSecondaryId, mapTemplateIdToSecondaryId } from '../../utils/envelope';

export const incrementDocumentId = async () => {
  const documentIdCounter = await prisma.counter.upsert({
    where: {
      id: 'document',
    },
    create: {
      id: 'document',
      value: 1,
    },
    update: {
      value: {
        increment: 1,
      },
    },
  });

  return {
    documentId: documentIdCounter.value,
    formattedDocumentId: mapDocumentIdToSecondaryId(documentIdCounter.value),
  };
};

export const incrementTemplateId = async () => {
  const templateIdCounter = await prisma.counter.upsert({
    where: {
      id: 'template',
    },
    create: {
      id: 'template',
      value: 1,
    },
    update: {
      value: {
        increment: 1,
      },
    },
  });

  return {
    templateId: templateIdCounter.value,
    formattedTemplateId: mapTemplateIdToSecondaryId(templateIdCounter.value),
  };
};

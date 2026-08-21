// The public v2 REST contract: one row per published endpoint.
//
// A row names the HTTP method and path integrators call, and the ZAP procedure
// that answers it (a key in @hanzo/esign-trpc/zap/server/routes). The path is
// written in OpenAPI form so this table is also what the published document
// describes; ./index.ts converts `{param}` to Hono's `:param` when registering.
//
// `form: true` marks the five endpoints whose body is multipart/form-data
// because they carry PDFs; every other POST body is JSON.
//
// Rows are ordered so a literal segment is registered before a parameter that
// could match it — `/envelope/attachment` before `/envelope/{envelopeId}`.
//
// Two GET endpoints are absent on purpose — `/document/{documentId}/download`
// and `/envelope/item/{envelopeItemId}/download` stream the file itself and are
// served by ../download/download.ts, which is mounted ahead of this. The third,
// `download-beta`, answers with a presigned URL as JSON, so it belongs here.

export interface Route {
  method: 'GET' | 'POST';
  path: string;
  call: string;
  form?: true;
}

export const routes: Route[] = [
  { method: 'GET', path: '/document', call: 'document.find' },
  { method: 'GET', path: '/document/attachment', call: 'document.attachment.find' },
  { method: 'POST', path: '/document/attachment/create', call: 'document.attachment.create' },
  { method: 'POST', path: '/document/attachment/delete', call: 'document.attachment.delete' },
  { method: 'POST', path: '/document/attachment/update', call: 'document.attachment.update' },
  { method: 'POST', path: '/document/create', call: 'document.create', form: true },
  { method: 'POST', path: '/document/create/beta', call: 'document.createDocumentTemporary' },
  { method: 'POST', path: '/document/delete', call: 'document.delete' },
  { method: 'POST', path: '/document/distribute', call: 'document.distribute' },
  { method: 'GET', path: '/document/{documentId}/download-beta', call: 'document.downloadBeta' },
  { method: 'POST', path: '/document/duplicate', call: 'document.duplicate' },
  { method: 'POST', path: '/document/field/create', call: 'field.createDocumentField' },
  { method: 'POST', path: '/document/field/create-many', call: 'field.createDocumentFields' },
  { method: 'POST', path: '/document/field/delete', call: 'field.deleteDocumentField' },
  { method: 'POST', path: '/document/field/update', call: 'field.updateDocumentField' },
  { method: 'POST', path: '/document/field/update-many', call: 'field.updateDocumentFields' },
  { method: 'GET', path: '/document/field/{fieldId}', call: 'field.getDocumentField' },
  { method: 'POST', path: '/document/get-many', call: 'document.getMany' },
  { method: 'POST', path: '/document/recipient/create', call: 'recipient.createDocumentRecipient' },
  {
    method: 'POST',
    path: '/document/recipient/create-many',
    call: 'recipient.createDocumentRecipients',
  },
  { method: 'POST', path: '/document/recipient/delete', call: 'recipient.deleteDocumentRecipient' },
  { method: 'POST', path: '/document/recipient/update', call: 'recipient.updateDocumentRecipient' },
  {
    method: 'POST',
    path: '/document/recipient/update-many',
    call: 'recipient.updateDocumentRecipients',
  },
  {
    method: 'GET',
    path: '/document/recipient/{recipientId}',
    call: 'recipient.getDocumentRecipient',
  },
  { method: 'POST', path: '/document/redistribute', call: 'document.redistribute' },
  { method: 'POST', path: '/document/update', call: 'document.update' },
  { method: 'GET', path: '/document/{documentId}', call: 'document.get' },
  {
    method: 'POST',
    path: '/embedding/create-presign-token',
    call: 'embeddingPresign.createEmbeddingPresignToken',
  },
  {
    method: 'POST',
    path: '/embedding/verify-presign-token',
    call: 'embeddingPresign.verifyEmbeddingPresignToken',
  },
  { method: 'GET', path: '/envelope', call: 'envelope.find' },
  { method: 'GET', path: '/envelope/attachment', call: 'envelope.attachment.find' },
  { method: 'POST', path: '/envelope/attachment/create', call: 'envelope.attachment.create' },
  { method: 'POST', path: '/envelope/attachment/delete', call: 'envelope.attachment.delete' },
  { method: 'POST', path: '/envelope/attachment/update', call: 'envelope.attachment.update' },
  { method: 'POST', path: '/envelope/create', call: 'envelope.create', form: true },
  { method: 'POST', path: '/envelope/delete', call: 'envelope.delete' },
  { method: 'POST', path: '/envelope/distribute', call: 'envelope.distribute' },
  { method: 'POST', path: '/envelope/duplicate', call: 'envelope.duplicate' },
  { method: 'POST', path: '/envelope/field/create-many', call: 'envelope.field.createMany' },
  { method: 'POST', path: '/envelope/field/delete', call: 'envelope.field.delete' },
  { method: 'POST', path: '/envelope/field/update-many', call: 'envelope.field.updateMany' },
  { method: 'GET', path: '/envelope/field/{fieldId}', call: 'envelope.field.get' },
  { method: 'POST', path: '/envelope/get-many', call: 'envelope.getMany' },
  {
    method: 'POST',
    path: '/envelope/item/create-many',
    call: 'envelope.item.createMany',
    form: true,
  },
  { method: 'POST', path: '/envelope/item/delete', call: 'envelope.item.delete' },
  { method: 'POST', path: '/envelope/item/update-many', call: 'envelope.item.updateMany' },
  {
    method: 'POST',
    path: '/envelope/recipient/create-many',
    call: 'envelope.recipient.createMany',
  },
  { method: 'POST', path: '/envelope/recipient/delete', call: 'envelope.recipient.delete' },
  {
    method: 'POST',
    path: '/envelope/recipient/update-many',
    call: 'envelope.recipient.updateMany',
  },
  { method: 'GET', path: '/envelope/recipient/{recipientId}', call: 'envelope.recipient.get' },
  { method: 'POST', path: '/envelope/redistribute', call: 'envelope.redistribute' },
  { method: 'POST', path: '/envelope/update', call: 'envelope.update' },
  { method: 'POST', path: '/envelope/use', call: 'envelope.use', form: true },
  { method: 'GET', path: '/envelope/{envelopeId}', call: 'envelope.get' },
  { method: 'GET', path: '/envelope/{envelopeId}/audit-log', call: 'envelope.auditLog.find' },
  { method: 'GET', path: '/folder', call: 'folder.findFolders' },
  { method: 'POST', path: '/folder/create', call: 'folder.createFolder' },
  { method: 'POST', path: '/folder/delete', call: 'folder.deleteFolder' },
  { method: 'POST', path: '/folder/update', call: 'folder.updateFolder' },
  { method: 'GET', path: '/template', call: 'template.findTemplates' },
  { method: 'POST', path: '/template/create', call: 'template.createTemplate', form: true },
  { method: 'POST', path: '/template/create/beta', call: 'template.createTemplateTemporary' },
  { method: 'POST', path: '/template/delete', call: 'template.deleteTemplate' },
  { method: 'POST', path: '/template/direct/create', call: 'template.createTemplateDirectLink' },
  { method: 'POST', path: '/template/direct/delete', call: 'template.deleteTemplateDirectLink' },
  { method: 'POST', path: '/template/direct/toggle', call: 'template.toggleTemplateDirectLink' },
  { method: 'POST', path: '/template/duplicate', call: 'template.duplicateTemplate' },
  { method: 'POST', path: '/template/field/create', call: 'field.createTemplateField' },
  { method: 'POST', path: '/template/field/create-many', call: 'field.createTemplateFields' },
  { method: 'POST', path: '/template/field/delete', call: 'field.deleteTemplateField' },
  { method: 'POST', path: '/template/field/update', call: 'field.updateTemplateField' },
  { method: 'POST', path: '/template/field/update-many', call: 'field.updateTemplateFields' },
  { method: 'GET', path: '/template/field/{fieldId}', call: 'field.getTemplateField' },
  { method: 'POST', path: '/template/get-many', call: 'template.getMany' },
  { method: 'POST', path: '/template/recipient/create', call: 'recipient.createTemplateRecipient' },
  {
    method: 'POST',
    path: '/template/recipient/create-many',
    call: 'recipient.createTemplateRecipients',
  },
  { method: 'POST', path: '/template/recipient/delete', call: 'recipient.deleteTemplateRecipient' },
  { method: 'POST', path: '/template/recipient/update', call: 'recipient.updateTemplateRecipient' },
  {
    method: 'POST',
    path: '/template/recipient/update-many',
    call: 'recipient.updateTemplateRecipients',
  },
  {
    method: 'GET',
    path: '/template/recipient/{recipientId}',
    call: 'recipient.getTemplateRecipient',
  },
  { method: 'POST', path: '/template/update', call: 'template.updateTemplate' },
  { method: 'POST', path: '/template/use', call: 'template.createDocumentFromTemplate' },
  { method: 'GET', path: '/template/{templateId}', call: 'template.getTemplateById' },
];

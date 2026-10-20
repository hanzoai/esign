// esign ZAP RPC — the routes an anonymous connection may call.

/**
 * The routes a connection without a session may call: the ones tRPC served as
 * public procedures, each authorised by the token its input carries (a
 * recipient's signing token, a direct template link). Each is written against
 * ZapConnectionContext, so its body handles a null user. Every other route
 * answers an anonymous connection 401.
 */
export const publicRoutes: ReadonlySet<string> = new Set([
  'document.accessAuth.request2FAEmail',
  'document.share',
  'envelope.attachment.find',
  'envelope.field.sign',
  'envelope.item.getManyByToken',
  'envelope.signingStatus',
  'field.removeSignedFieldWithToken',
  'field.signFieldWithToken',
  'recipient.completeDocumentWithToken',
  'recipient.rejectDocumentWithToken',
  'template.createDocumentFromDirectTemplate',
]);

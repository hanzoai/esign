# recipient-router ZAP interface schema.
#
# Declares the recipient router surface as a ZAP `interface` (one method per
# tRPC procedure, method ordinals auto-assigned in declaration order). The wire
# payloads ride the shared ZapRequest/ZapReply envelope (../../zap/schema/
# transport.zap) as superjson — the same dataTransformer tRPC used — so the
# interface here is the typed CONTRACT, and the route key carried on the
# envelope ("recipient.getDocumentRecipient", ...) selects the handler. Inputs
# are still validated by the SAME Zod schemas the tRPC procedures used. The two
# token-based signing flows were unauthenticated `procedure`s in tRPC.
#
# Route keys (dotted, matching the tRPC nested router shape):
#   recipient.suggestions.find
#   recipient.getDocumentRecipient / createDocumentRecipient /
#     createDocumentRecipients / updateDocumentRecipient /
#     updateDocumentRecipients / deleteDocumentRecipient / setDocumentRecipients
#   recipient.getTemplateRecipient / createTemplateRecipient /
#     createTemplateRecipients / updateTemplateRecipient /
#     updateTemplateRecipients / deleteTemplateRecipient / setTemplateRecipients
#   recipient.completeDocumentWithToken / rejectDocumentWithToken

package esign

# Opaque superjson-encoded request/response bodies. The strongly-typed scalar
# views live alongside each procedure's Zod schema; the interface documents the
# method set + ordinal stability.
struct Req  { Body text @0 }   # superjson(input)  ("" = void)
struct Resp { Body text @0 }   # superjson(output) ("" = void)

interface Recipient {
    suggestionsFind(req: Req) returns (resp: Resp)

    getDocumentRecipient(req: Req) returns (resp: Resp)
    createDocumentRecipient(req: Req) returns (resp: Resp)
    createDocumentRecipients(req: Req) returns (resp: Resp)
    updateDocumentRecipient(req: Req) returns (resp: Resp)
    updateDocumentRecipients(req: Req) returns (resp: Resp)
    deleteDocumentRecipient(req: Req) returns (resp: Resp)
    setDocumentRecipients(req: Req) returns (resp: Resp)

    getTemplateRecipient(req: Req) returns (resp: Resp)
    createTemplateRecipient(req: Req) returns (resp: Resp)
    createTemplateRecipients(req: Req) returns (resp: Resp)
    updateTemplateRecipient(req: Req) returns (resp: Resp)
    updateTemplateRecipients(req: Req) returns (resp: Resp)
    deleteTemplateRecipient(req: Req) returns (resp: Resp)
    setTemplateRecipients(req: Req) returns (resp: Resp)

    completeDocumentWithToken(req: Req) returns (resp: Resp)
    rejectDocumentWithToken(req: Req) returns (resp: Resp)
}

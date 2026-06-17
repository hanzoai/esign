# webhook-router ZAP interface schema.
#
# Declares the webhook router surface as a ZAP `interface` (one method per tRPC
# procedure, method ordinals auto-assigned in declaration order). The wire
# payloads ride the shared ZapRequest/ZapReply envelope (../../zap/schema/
# transport.zap) as superjson — the same dataTransformer tRPC used — so the
# interface here is the typed CONTRACT, and the route key carried on the
# envelope ("webhook.calls.find", "webhook.getTeamWebhooks", ...) selects the
# handler. Inputs are still validated by the SAME Zod schemas the tRPC
# procedures used.
#
# Route keys (dotted, matching the tRPC nested router shape):
#   webhook.calls.find / calls.resend
#   webhook.getTeamWebhooks / getWebhookById
#   webhook.createWebhook / deleteWebhook / editWebhook / testWebhook

package esign

# Opaque superjson-encoded request/response bodies. The strongly-typed scalar
# views live alongside each procedure's Zod schema; the interface documents the
# method set + ordinal stability.
struct Req  { Body text @0 }   # superjson(input)  ("" = void)
struct Resp { Body text @0 }   # superjson(output) ("" = void)

interface Webhook {
    callsFind(req: Req) returns (resp: Resp)
    callsResend(req: Req) returns (resp: Resp)

    getTeamWebhooks(req: Req) returns (resp: Resp)
    getWebhookById(req: Req) returns (resp: Resp)

    createWebhook(req: Req) returns (resp: Resp)
    deleteWebhook(req: Req) returns (resp: Resp)
    editWebhook(req: Req) returns (resp: Resp)
    testWebhook(req: Req) returns (resp: Resp)
}

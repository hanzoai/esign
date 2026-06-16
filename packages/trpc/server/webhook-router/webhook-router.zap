# webhook-router ZAP schema — STUB.
#
# Placeholder for the 8-procedure webhook router. These routes are not yet
# ported to typed ZAP structs; their calls currently resolve through the
# generic ZapRequest/ZapReply envelope (transport.zap) with superjson payloads,
# and the server dispatcher returns methodError("not-yet-migrated") for any
# webhook.* route that has no handler registered. Replace this marker with
# per-procedure typed structs (see folder.zap / profile.zap / api_token.zap)
# as each webhook procedure is migrated.

package esign

struct WebhookRouterStub {
    Router text @0    # always "webhook"
}

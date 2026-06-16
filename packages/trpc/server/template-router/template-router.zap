# template-router ZAP schema — STUB.
#
# Placeholder for the 14-procedure template router. These routes are not yet
# ported to typed ZAP structs; their calls currently resolve through the
# generic ZapRequest/ZapReply envelope (transport.zap) with superjson payloads,
# and the server dispatcher returns methodError("not-yet-migrated") for any
# template.* route that has no handler registered. Replace this marker with
# per-procedure typed structs (see folder.zap / profile.zap / api_token.zap)
# as each template procedure is migrated.

package esign

struct TemplateRouterStub {
    Router text @0    # always "template"
}

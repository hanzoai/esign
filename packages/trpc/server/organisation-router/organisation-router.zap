# organisation-router ZAP schema — STUB.
#
# Placeholder for the 36-procedure organisation router. These routes are not yet
# ported to typed ZAP structs; their calls currently resolve through the
# generic ZapRequest/ZapReply envelope (transport.zap) with superjson payloads,
# and the server dispatcher returns methodError("not-yet-migrated") for any
# organisation.* route that has no handler registered. Replace this marker with
# per-procedure typed structs (see folder.zap / profile.zap / api_token.zap)
# as each organisation procedure is migrated.

package esign

struct OrganisationRouterStub {
    Router text @0    # always "organisation"
}

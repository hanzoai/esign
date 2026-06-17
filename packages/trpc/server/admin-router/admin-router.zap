# admin-router ZAP interface schema.
#
# Declares the admin router surface as a ZAP `interface` (one method per tRPC
# procedure, method ordinals auto-assigned in declaration order). The wire
# payloads ride the shared ZapRequest/ZapReply envelope (../../zap/schema/
# transport.zap) as superjson — the same dataTransformer tRPC used — so the
# interface here is the typed CONTRACT, and the route key carried on the
# envelope ("admin.organisation.find", "admin.user.get", ...) selects the
# handler. Inputs are still validated by the SAME Zod schemas the tRPC
# procedures used, and every handler re-asserts the admin boundary (the ZAP
# analogue of tRPC's adminMiddleware) before running.
#
# Route keys (dotted, matching the tRPC nested router shape):
#   admin.organisation.find / get / create / update / swapSubscription
#   admin.organisationMember.promoteToOwner / updateRole
#   admin.claims.find / create / update / delete
#   admin.license.resync
#   admin.user.get / update / delete / enable / disable / resetTwoFactor / findTeams
#   admin.document.find / findUnsealed / delete / reseal / findJobs / findAuditLogs
#   admin.recipient.update
#   admin.emailDomain.find / get / reregister
#   admin.updateSiteSetting

package esign

# Opaque superjson-encoded request/response bodies. The strongly-typed scalar
# views live alongside each procedure's Zod schema; the interface documents the
# method set + ordinal stability.
struct Req  { Body text @0 }   # superjson(input)  ("" = void)
struct Resp { Body text @0 }   # superjson(output) ("" = void)

interface Admin {
    organisationFind(req: Req) returns (resp: Resp)
    organisationGet(req: Req) returns (resp: Resp)
    organisationCreate(req: Req) returns (resp: Resp)
    organisationUpdate(req: Req) returns (resp: Resp)
    organisationSwapSubscription(req: Req) returns (resp: Resp)

    organisationMemberPromoteToOwner(req: Req) returns (resp: Resp)
    organisationMemberUpdateRole(req: Req) returns (resp: Resp)

    claimsFind(req: Req) returns (resp: Resp)
    claimsCreate(req: Req) returns (resp: Resp)
    claimsUpdate(req: Req) returns (resp: Resp)
    claimsDelete(req: Req) returns (resp: Resp)

    licenseResync(req: Req) returns (resp: Resp)

    userGet(req: Req) returns (resp: Resp)
    userUpdate(req: Req) returns (resp: Resp)
    userDelete(req: Req) returns (resp: Resp)
    userEnable(req: Req) returns (resp: Resp)
    userDisable(req: Req) returns (resp: Resp)
    userResetTwoFactor(req: Req) returns (resp: Resp)
    userFindTeams(req: Req) returns (resp: Resp)

    documentFind(req: Req) returns (resp: Resp)
    documentFindUnsealed(req: Req) returns (resp: Resp)
    documentDelete(req: Req) returns (resp: Resp)
    documentReseal(req: Req) returns (resp: Resp)
    documentFindJobs(req: Req) returns (resp: Resp)
    documentFindAuditLogs(req: Req) returns (resp: Resp)

    recipientUpdate(req: Req) returns (resp: Resp)

    emailDomainFind(req: Req) returns (resp: Resp)
    emailDomainGet(req: Req) returns (resp: Resp)
    emailDomainReregister(req: Req) returns (resp: Resp)

    updateSiteSetting(req: Req) returns (resp: Resp)
}

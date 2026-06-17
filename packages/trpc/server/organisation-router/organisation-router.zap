# organisation-router ZAP interface schema.
#
# Declares the organisation router surface as a ZAP `interface` (one method per
# tRPC procedure, method ordinals auto-assigned in declaration order). The wire
# payloads ride the shared ZapRequest/ZapReply envelope (../../zap/schema/
# transport.zap) as superjson — the same dataTransformer tRPC used — so the
# interface here is the typed CONTRACT, and the route key carried on the
# envelope ("organisation.get", "organisation.member.invite.find", ...) selects
# the handler. Inputs are still validated by the SAME Zod schemas the tRPC
# procedures used.
#
# Route keys (dotted, matching the tRPC nested router shape):
#   organisation.get / getMany / create / update / delete / leave
#   organisation.member.find / update / delete / deleteMany
#   organisation.member.invite.find / getMany / createMany / deleteMany / accept / decline / resend
#   organisation.group.find / create / update / delete
#   organisation.settings.update
#   organisation.email.find / create / update / delete
#   organisation.emailDomain.get / find / create / delete / verify
#   organisation.authenticationPortal.get / update / linkAccount / declineLinkAccount
#   organisation.internal.getOrganisationSession

package esign

# Opaque superjson-encoded request/response bodies. The strongly-typed scalar
# views live alongside each procedure's Zod schema; the interface documents the
# method set + ordinal stability.
struct Req  { Body text @0 }   # superjson(input)  ("" = void)
struct Resp { Body text @0 }   # superjson(output) ("" = void)

interface Organisation {
    get(req: Req) returns (resp: Resp)
    getMany(req: Req) returns (resp: Resp)
    create(req: Req) returns (resp: Resp)
    update(req: Req) returns (resp: Resp)
    delete(req: Req) returns (resp: Resp)
    leave(req: Req) returns (resp: Resp)

    memberFind(req: Req) returns (resp: Resp)
    memberUpdate(req: Req) returns (resp: Resp)
    memberDelete(req: Req) returns (resp: Resp)
    memberDeleteMany(req: Req) returns (resp: Resp)

    memberInviteFind(req: Req) returns (resp: Resp)
    memberInviteGetMany(req: Req) returns (resp: Resp)
    memberInviteCreateMany(req: Req) returns (resp: Resp)
    memberInviteDeleteMany(req: Req) returns (resp: Resp)
    memberInviteAccept(req: Req) returns (resp: Resp)
    memberInviteDecline(req: Req) returns (resp: Resp)
    memberInviteResend(req: Req) returns (resp: Resp)

    groupFind(req: Req) returns (resp: Resp)
    groupCreate(req: Req) returns (resp: Resp)
    groupUpdate(req: Req) returns (resp: Resp)
    groupDelete(req: Req) returns (resp: Resp)

    settingsUpdate(req: Req) returns (resp: Resp)

    emailFind(req: Req) returns (resp: Resp)
    emailCreate(req: Req) returns (resp: Resp)
    emailUpdate(req: Req) returns (resp: Resp)
    emailDelete(req: Req) returns (resp: Resp)

    emailDomainGet(req: Req) returns (resp: Resp)
    emailDomainFind(req: Req) returns (resp: Resp)
    emailDomainCreate(req: Req) returns (resp: Resp)
    emailDomainDelete(req: Req) returns (resp: Resp)
    emailDomainVerify(req: Req) returns (resp: Resp)

    authenticationPortalGet(req: Req) returns (resp: Resp)
    authenticationPortalUpdate(req: Req) returns (resp: Resp)
    authenticationPortalLinkAccount(req: Req) returns (resp: Resp)
    authenticationPortalDeclineLinkAccount(req: Req) returns (resp: Resp)

    internalGetOrganisationSession(req: Req) returns (resp: Resp)
}

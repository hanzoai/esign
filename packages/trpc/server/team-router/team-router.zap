# team-router ZAP interface schema.
#
# Declares the team router surface as a ZAP `interface` (one method per tRPC
# procedure, method ordinals auto-assigned in declaration order). The wire
# payloads ride the shared ZapRequest/ZapReply envelope (../../zap/schema/
# transport.zap) as superjson — the same dataTransformer tRPC used — so the
# interface here is the typed CONTRACT, and the route key carried on the
# envelope ("team.find", "team.member.find", ...) selects the handler. Inputs
# are still validated by the SAME Zod schemas the tRPC procedures used.
#
# Route keys (dotted, matching the tRPC nested router shape):
#   team.find / get / create / update / delete
#   team.member.find / getMany / createMany / update / delete
#   team.group.find / createMany / update / delete
#   team.settings.update
#   team.email.get / update / delete
#   team.email.verification.send / resend / delete

package esign

# Opaque superjson-encoded request/response bodies. The strongly-typed scalar
# views live alongside each procedure's Zod schema; the interface documents the
# method set + ordinal stability.
struct Req  { Body text @0 }   # superjson(input)  ("" = void)
struct Resp { Body text @0 }   # superjson(output) ("" = void)

interface Team {
    find(req: Req) returns (resp: Resp)
    get(req: Req) returns (resp: Resp)
    create(req: Req) returns (resp: Resp)
    update(req: Req) returns (resp: Resp)
    delete(req: Req) returns (resp: Resp)

    memberFind(req: Req) returns (resp: Resp)
    memberGetMany(req: Req) returns (resp: Resp)
    memberCreateMany(req: Req) returns (resp: Resp)
    memberUpdate(req: Req) returns (resp: Resp)
    memberDelete(req: Req) returns (resp: Resp)

    groupFind(req: Req) returns (resp: Resp)
    groupCreateMany(req: Req) returns (resp: Resp)
    groupUpdate(req: Req) returns (resp: Resp)
    groupDelete(req: Req) returns (resp: Resp)

    settingsUpdate(req: Req) returns (resp: Resp)

    emailGet(req: Req) returns (resp: Resp)
    emailUpdate(req: Req) returns (resp: Resp)
    emailDelete(req: Req) returns (resp: Resp)
    emailVerificationSend(req: Req) returns (resp: Resp)
    emailVerificationResend(req: Req) returns (resp: Resp)
    emailVerificationDelete(req: Req) returns (resp: Resp)
}

# auth-router ZAP interface schema.
#
# Declares the auth router surface as a ZAP `interface` (one method per tRPC
# procedure, method ordinals auto-assigned in declaration order). The wire
# payloads ride the shared ZapRequest/ZapReply envelope (../../zap/schema/
# transport.zap) as superjson — the same dataTransformer tRPC used — so the
# interface here is the typed CONTRACT, and the route key carried on the
# envelope ("auth.passkey.create", ...) selects the handler. Inputs are still
# validated by the SAME Zod schemas the tRPC procedures used.
#
# Route keys (dotted, matching the tRPC nested router shape):
#   auth.passkey.create
#   auth.passkey.createAuthenticationOptions
#   auth.passkey.createRegistrationOptions
#   auth.passkey.createSigninOptions
#   auth.passkey.delete
#   auth.passkey.find
#   auth.passkey.update

package esign

# Opaque superjson-encoded request/response bodies. The strongly-typed scalar
# views live alongside each procedure's Zod schema; the interface documents the
# method set + ordinal stability.
struct Req  { Body text @0 }   # superjson(input)  ("" = void)
struct Resp { Body text @0 }   # superjson(output) ("" = void)

interface Auth {
    passkeyCreate(req: Req) returns (resp: Resp)
    passkeyCreateAuthenticationOptions(req: Req) returns (resp: Resp)
    passkeyCreateRegistrationOptions(req: Req) returns (resp: Resp)
    passkeyCreateSigninOptions(req: Req) returns (resp: Resp)
    passkeyDelete(req: Req) returns (resp: Resp)
    passkeyFind(req: Req) returns (resp: Resp)
    passkeyUpdate(req: Req) returns (resp: Resp)
}

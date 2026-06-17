# api-token-router ZAP interface schema.
#
# Route keys: apiToken.create / getMany / delete
# Wire payloads ride the shared ZapRequest/ZapReply envelope as superjson;
# inputs validated by the SAME Zod schemas the tRPC procedures used.

package esign

struct Req  { Body text @0 }
struct Resp { Body text @0 }

interface ApiToken {
    create(req: Req) returns (resp: Resp)
    getMany(req: Req) returns (resp: Resp)
    delete(req: Req) returns (resp: Resp)
}

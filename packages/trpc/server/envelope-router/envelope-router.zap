# envelope-router ZAP interface schema.
#
# Declares the envelope router surface as a single ZAP `interface` (one method
# per tRPC procedure, method ordinals auto-assigned in declaration order). The
# wire payloads ride the shared ZapRequest/ZapReply envelope (../../zap/schema/
# transport.zap) as superjson — the same dataTransformer tRPC used — so the
# interface here is the typed CONTRACT, and the route key carried on the
# envelope ("envelope.find", "envelope.attachment.find", ...) selects the
# handler. Inputs are still validated by the SAME Zod schemas the tRPC
# procedures used. The attachment / item / recipient / field / bulk / auditLog
# / editor subtrees are folded into this one interface (camelCased nested keys).
#
# Route keys (dotted, matching the tRPC nested router shape):
#   envelope.attachment.find / create / update / delete
#   envelope.item.getMany / getManyByToken / createMany / updateMany / delete / download
#   envelope.recipient.get / createMany / updateMany / delete / set
#   envelope.field.get / createMany / updateMany / delete / set / sign
#   envelope.find
#   envelope.auditLog.find
#   envelope.bulk.move / delete
#   envelope.editor.get
#   envelope.get / getMany / create / use / update / delete / duplicate
#   envelope.distribute / redistribute / signingStatus

package esign

# Opaque superjson-encoded request/response bodies. The strongly-typed scalar
# views live alongside each procedure's Zod schema; the interface documents the
# method set + ordinal stability.
struct Req  { Body text @0 }   # superjson(input)  ("" = void)
struct Resp { Body text @0 }   # superjson(output) ("" = void)

interface Envelope {
    attachmentFind(req: Req) returns (resp: Resp)
    attachmentCreate(req: Req) returns (resp: Resp)
    attachmentUpdate(req: Req) returns (resp: Resp)
    attachmentDelete(req: Req) returns (resp: Resp)

    itemGetMany(req: Req) returns (resp: Resp)
    itemGetManyByToken(req: Req) returns (resp: Resp)
    itemCreateMany(req: Req) returns (resp: Resp)
    itemUpdateMany(req: Req) returns (resp: Resp)
    itemDelete(req: Req) returns (resp: Resp)
    itemDownload(req: Req) returns (resp: Resp)

    recipientGet(req: Req) returns (resp: Resp)
    recipientCreateMany(req: Req) returns (resp: Resp)
    recipientUpdateMany(req: Req) returns (resp: Resp)
    recipientDelete(req: Req) returns (resp: Resp)
    recipientSet(req: Req) returns (resp: Resp)

    fieldGet(req: Req) returns (resp: Resp)
    fieldCreateMany(req: Req) returns (resp: Resp)
    fieldUpdateMany(req: Req) returns (resp: Resp)
    fieldDelete(req: Req) returns (resp: Resp)
    fieldSet(req: Req) returns (resp: Resp)
    fieldSign(req: Req) returns (resp: Resp)

    find(req: Req) returns (resp: Resp)

    auditLogFind(req: Req) returns (resp: Resp)

    bulkMove(req: Req) returns (resp: Resp)
    bulkDelete(req: Req) returns (resp: Resp)

    editorGet(req: Req) returns (resp: Resp)

    get(req: Req) returns (resp: Resp)
    getMany(req: Req) returns (resp: Resp)
    create(req: Req) returns (resp: Resp)
    use(req: Req) returns (resp: Resp)
    update(req: Req) returns (resp: Resp)
    delete(req: Req) returns (resp: Resp)
    duplicate(req: Req) returns (resp: Resp)
    distribute(req: Req) returns (resp: Resp)
    redistribute(req: Req) returns (resp: Resp)
    signingStatus(req: Req) returns (resp: Resp)
}

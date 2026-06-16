# document-router ZAP interface schema.
#
# Declares the document router surface (incl. the attachment sub-router) as a
# ZAP `interface` — one flattened camelCase method per tRPC procedure, method
# ordinals auto-assigned in declaration order. The wire payloads ride the shared
# ZapRequest/ZapReply envelope (../../zap/schema/transport.zap) as superjson —
# the same dataTransformer tRPC used — so the interface here is the typed
# CONTRACT, and the route key carried on the envelope ("document.get",
# "document.attachment.create", ...) selects the handler. Inputs are still
# validated by the SAME Zod schemas the tRPC procedures used.
#
# Route keys (dotted, matching the tRPC nested router shape):
#   document.get / getMany / find / create / update / delete
#   document.duplicate / downloadCertificate / distribute / redistribute
#   document.search / share / download / downloadBeta / createDocumentTemporary
#   document.getDocumentByToken / findDocumentsInternal
#   document.accessAuth.request2FAEmail
#   document.auditLog.find / download
#   document.inbox.find / getCount
#   document.attachment.create / update / delete / find

package esign

# Opaque superjson-encoded request/response bodies. The strongly-typed scalar
# views live alongside each procedure's Zod schema; the interface documents the
# method set + ordinal stability.
struct Req  { Body text @0 }   # superjson(input)  ("" = void)
struct Resp { Body text @0 }   # superjson(output) ("" = void)

interface Document {
    get(req: Req) returns (resp: Resp)
    getMany(req: Req) returns (resp: Resp)
    find(req: Req) returns (resp: Resp)
    create(req: Req) returns (resp: Resp)
    update(req: Req) returns (resp: Resp)
    delete(req: Req) returns (resp: Resp)
    duplicate(req: Req) returns (resp: Resp)
    downloadCertificate(req: Req) returns (resp: Resp)
    distribute(req: Req) returns (resp: Resp)
    redistribute(req: Req) returns (resp: Resp)
    search(req: Req) returns (resp: Resp)
    share(req: Req) returns (resp: Resp)

    download(req: Req) returns (resp: Resp)

    downloadBeta(req: Req) returns (resp: Resp)
    createDocumentTemporary(req: Req) returns (resp: Resp)

    getDocumentByToken(req: Req) returns (resp: Resp)
    findDocumentsInternal(req: Req) returns (resp: Resp)

    accessAuthRequest2FAEmail(req: Req) returns (resp: Resp)

    auditLogFind(req: Req) returns (resp: Resp)
    auditLogDownload(req: Req) returns (resp: Resp)

    inboxFind(req: Req) returns (resp: Resp)
    inboxGetCount(req: Req) returns (resp: Resp)

    attachmentCreate(req: Req) returns (resp: Resp)
    attachmentUpdate(req: Req) returns (resp: Resp)
    attachmentDelete(req: Req) returns (resp: Resp)
    attachmentFind(req: Req) returns (resp: Resp)
}

# folder-router ZAP interface schema.
#
# Declares the folder router surface as a ZAP `interface` (one method per tRPC
# procedure, ordinals auto-assigned in declaration order). Wire payloads ride
# the shared ZapRequest/ZapReply envelope (../../zap/schema/transport.zap) as
# superjson; the route key on the envelope selects the handler. Inputs are
# validated by the SAME Zod schemas the tRPC procedures used.
#
# Route keys:
#   folder.getFolders / findFolders / findFoldersInternal
#   folder.createFolder / updateFolder / deleteFolder

package esign

struct Req  { Body text @0 }
struct Resp { Body text @0 }

interface Folder {
    getFolders(req: Req) returns (resp: Resp)
    findFolders(req: Req) returns (resp: Resp)
    findFoldersInternal(req: Req) returns (resp: Resp)
    createFolder(req: Req) returns (resp: Resp)
    updateFolder(req: Req) returns (resp: Resp)
    deleteFolder(req: Req) returns (resp: Resp)
}

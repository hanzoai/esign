# folder-router ZAP schema — typed scalar inputs for the fully-ported routes.
#
# Maps tRPC folderRouter procedures to ZAP structs. Rich list/object outputs
# (folders[], breadcrumbs[]) ride the generic ZapReply.Result (superjson),
# while scalar inputs get first-class typed structs here. Procedure ↔ route:
#   getFolders          -> folder.getFolders
#   findFolders         -> folder.findFolders
#   findFoldersInternal -> folder.findFoldersInternal
#   createFolder        -> folder.createFolder
#   updateFolder        -> folder.updateFolder
#   deleteFolder        -> folder.deleteFolder

package esign

# Folder type discriminator ("DOCUMENT" | "TEMPLATE" | "CHAT") + optional parent.
struct FolderQuery {
    Type     text @0    # folder type discriminator
    ParentId text @8    # parent folder id ("" = root)
    Page     u32  @16   # pagination (0 = unset)
    PerPage  u32  @20   # pagination (0 = unset)
}

struct CreateFolderInput {
    Name     text @0
    Type     text @8
    ParentId text @16   # "" = root
}

struct UpdateFolderInput {
    Id         text @0
    Name       text @8
    Visibility text @16  # "" = unchanged
}

struct DeleteFolderInput {
    Id text @0
}

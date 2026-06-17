// esign ZAP handlers — folder router (fully ported, 6/6 procedures).
//
// Each handler is the verbatim body of the corresponding tRPC procedure,
// rewired to (ctx, input). Input is validated by the SAME Zod schema the tRPC
// procedure used (type-level validation preserved); the server-only functions
// are reused unchanged. Routes: folder.getFolders / findFolders /
// findFoldersInternal / createFolder / updateFolder / deleteFolder.
import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import { createFolder } from '@hanzo/sign-lib/server-only/folder/create-folder';
import { deleteFolder } from '@hanzo/sign-lib/server-only/folder/delete-folder';
import { findFolders } from '@hanzo/sign-lib/server-only/folder/find-folders';
import { findFoldersInternal } from '@hanzo/sign-lib/server-only/folder/find-folders-internal';
import { getFolderBreadcrumbs } from '@hanzo/sign-lib/server-only/folder/get-folder-breadcrumbs';
import { getFolderById } from '@hanzo/sign-lib/server-only/folder/get-folder-by-id';
import { updateFolder } from '@hanzo/sign-lib/server-only/folder/update-folder';

import {
  ZCreateFolderRequestSchema,
  ZDeleteFolderRequestSchema,
  ZFindFoldersInternalRequestSchema,
  ZFindFoldersRequestSchema,
  ZGetFoldersSchema,
  ZUpdateFolderRequestSchema,
} from '../../../server/folder-router/schema';
import type { ZapContext } from '../context';
import type { ZapRouteMap } from '../dispatch';

export const folderRoutes: ZapRouteMap = {
  'folder.getFolders': async (ctx: ZapContext, raw) => {
    const { parentId, type } = ZGetFoldersSchema.parse(raw);
    const { teamId, user } = ctx;

    const folders = await findFoldersInternal({ userId: user.id, teamId, parentId, type });
    const breadcrumbs = parentId
      ? await getFolderBreadcrumbs({ userId: user.id, teamId, folderId: parentId, type })
      : [];

    return { folders, breadcrumbs, type };
  },

  'folder.findFolders': async (ctx: ZapContext, raw) => {
    const { parentId, type, page, perPage } = ZFindFoldersRequestSchema.parse(raw);
    const { teamId, user } = ctx;
    return await findFolders({ userId: user.id, teamId, parentId, type, page, perPage });
  },

  'folder.findFoldersInternal': async (ctx: ZapContext, raw) => {
    const { parentId, type } = ZFindFoldersInternalRequestSchema.parse(raw);
    const { teamId, user } = ctx;

    const folders = await findFoldersInternal({ userId: user.id, teamId, parentId, type });
    const breadcrumbs = parentId
      ? await getFolderBreadcrumbs({ userId: user.id, teamId, folderId: parentId, type })
      : [];

    return { data: folders, breadcrumbs, type };
  },

  'folder.createFolder': async (ctx: ZapContext, raw) => {
    const { name, parentId, type } = ZCreateFolderRequestSchema.parse(raw);
    const { teamId, user } = ctx;

    if (parentId) {
      try {
        await getFolderById({ userId: user.id, teamId, folderId: parentId, type });
      } catch {
        throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Parent folder not found' });
      }
    }

    return await createFolder({ userId: user.id, teamId, name, parentId, type });
  },

  'folder.updateFolder': async (ctx: ZapContext, raw) => {
    const { folderId, data } = ZUpdateFolderRequestSchema.parse(raw);
    const { teamId, user } = ctx;
    const result = await updateFolder({ userId: user.id, teamId, folderId, data });
    return { ...result };
  },

  'folder.deleteFolder': async (ctx: ZapContext, raw) => {
    const { folderId } = ZDeleteFolderRequestSchema.parse(raw);
    const { teamId, user } = ctx;
    await deleteFolder({ userId: user.id, teamId, folderId });
    return { success: true };
  },
};

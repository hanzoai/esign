// esign ZAP RPC — React hook layer.
//
// A minimal react-query wrapper over the ZAP client. It is NOT a tRPC
// re-implementation: it exposes exactly two hooks — useZapQuery / useZapMutation
// — that migrated callsites use in place of `trpc.<router>.<proc>.useQuery` /
// `.useMutation`. Both ride the app's existing @tanstack/react-query (v5)
// QueryClientProvider, so cache/invalidation behave like the rest of the app.
//
// Migration shape:
//   trpc.folder.getFolders.useQuery(input)
//     -> useZapQuery(['folder.getFolders', input], 'folder.getFolders', input)
//   trpc.folder.createFolder.useMutation({ onSuccess })
//     -> useZapMutation('folder.createFolder', { onSuccess })

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';

import type { AppError } from '@hanzo/sign-lib/errors/app-error';

import { zapCall, type ZapCallOptions } from '../client/index';

/** Default query key for a route + input pair. */
export function zapQueryKey(route: string, input?: unknown): unknown[] {
  return input === undefined ? [route] : [route, input];
}

/** react-query wrapper for a migrated ZAP query procedure. */
export function useZapQuery<TOutput = unknown>(
  route: string,
  input?: unknown,
  opts?: Omit<UseQueryOptions<TOutput, AppError>, 'queryKey' | 'queryFn'> & ZapCallOptions,
): UseQueryResult<TOutput, AppError> {
  const { teamId, ...queryOpts } = opts ?? {};
  return useQuery<TOutput, AppError>({
    queryKey: zapQueryKey(route, input),
    queryFn: () => zapCall<TOutput>(route, input, { teamId }),
    ...queryOpts,
  });
}

/** react-query wrapper for a migrated ZAP mutation procedure. */
export function useZapMutation<TOutput = unknown, TInput = void>(
  route: string,
  opts?: Omit<UseMutationOptions<TOutput, AppError, TInput>, 'mutationFn'> & ZapCallOptions,
): UseMutationResult<TOutput, AppError, TInput> {
  const { teamId, onSuccess, ...mutationOpts } = opts ?? {};
  const queryClient = useQueryClient();
  return useMutation<TOutput, AppError, TInput>({
    ...mutationOpts,
    mutationFn: (input: TInput) => zapCall<TOutput>(route, input, { teamId }),
    onSuccess: async (...args) => {
      await onSuccess?.(...args);
      // Mirror the tRPC override: invalidate everything not opted out.
      await queryClient.invalidateQueries({
        predicate: (q) => !q?.meta?.doNotInvalidateQueryOnMutation,
      });
    },
  });
}

export { zapCall, closeZap } from '../client/index';

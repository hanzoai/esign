// esign ZAP RPC — React hook layer.
//
// A react-query wrapper over the ZAP client. It is NOT a tRPC re-implementation:
// it exposes the small set of hooks migrated callsites use in place of the
// `trpc.<router>.<proc>.*` proxy. Everything rides the app's existing
// @tanstack/react-query (v5) QueryClientProvider, so cache/invalidation behave
// like the rest of the app.
//
// Migration shape:
//   trpc.folder.getFolders.useQuery(input)
//     -> useZapQuery<TOut>('folder.getFolders', input)
//   trpc.folder.createFolder.useMutation({ onSuccess })
//     -> useZapMutation<TOut, TIn>('folder.createFolder', { onSuccess })
//   trpc.document.auditLog.find.useInfiniteQuery(input, opts)
//     -> useZapInfiniteQuery<TOut, TPageParam>('document.auditLog.find', input, opts)
//   const utils = trpc.useUtils(); utils.template.getTemplateById.setData(input, fn)
//     -> const utils = useZapUtils(); utils.setData('template.getTemplateById', input, fn)
//
// The logical route ("<router>.<procedure>") is the same string the ZAP server
// dispatcher routes by name, so the wire contract is identical to tRPC.

import { useState } from 'react';

import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
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

export interface ZapProviderProps {
  children: React.ReactNode;
}

/**
 * The ZAP analogue of the old `TrpcProvider`. The ZAP hooks talk to the server
 * over the shared WebSocket client (../client) and ride @tanstack/react-query
 * for cache/invalidation, so the provider only needs to supply a stable
 * QueryClient — there is no separate RPC-client context to wire up.
 */
export function ZapProvider({ children }: ZapProviderProps) {
  const [queryClient] = useState(() => new QueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** react-query mutation meta the ZAP hooks understand. Mirrors the tRPC
 *  override: a mutation flagged `doNotInvalidateQueryOnMutation` does NOT
 *  trigger the broad post-success invalidation; a query flagged the same way
 *  is skipped by the broad invalidation a sibling mutation triggers. */
interface ZapMeta extends Record<string, unknown> {
  doNotInvalidateQueryOnMutation?: boolean;
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

/** react-query wrapper for a migrated ZAP infinite-query procedure. The page
 *  param is folded into the route input under `cursor` (the convention every
 *  cursor-paginated tRPC procedure in this app used). */
export function useZapInfiniteQuery<TOutput = unknown, TPageParam = unknown>(
  route: string,
  input: Record<string, unknown> | undefined,
  opts: Omit<
    UseInfiniteQueryOptions<TOutput, AppError, InfiniteData<TOutput>, unknown[], TPageParam>,
    'queryKey' | 'queryFn' | 'initialPageParam'
  > &
    ZapCallOptions & { initialPageParam?: TPageParam },
): UseInfiniteQueryResult<InfiniteData<TOutput>, AppError> {
  const { teamId, initialPageParam, ...queryOpts } = opts;
  return useInfiniteQuery<TOutput, AppError, InfiniteData<TOutput>, unknown[], TPageParam>({
    queryKey: zapQueryKey(route, input),
    queryFn: ({ pageParam }) =>
      zapCall<TOutput>(route, { ...(input ?? {}), cursor: pageParam }, { teamId }),
    // First page carries no cursor (the convention every cursor-paginated
    // procedure in this app used); callers may override.
    initialPageParam: (initialPageParam ?? undefined) as TPageParam,
    ...queryOpts,
  });
}

/** react-query wrapper for a migrated ZAP mutation procedure. */
export function useZapMutation<TOutput = unknown, TInput = void>(
  route: string,
  opts?: Omit<UseMutationOptions<TOutput, AppError, TInput>, 'mutationFn'> & ZapCallOptions,
): UseMutationResult<TOutput, AppError, TInput> {
  const { teamId, onSuccess, meta, ...mutationOpts } = opts ?? {};
  const queryClient = useQueryClient();
  const skipInvalidate = (meta as ZapMeta | undefined)?.doNotInvalidateQueryOnMutation === true;

  return useMutation<TOutput, AppError, TInput>({
    ...mutationOpts,
    meta,
    mutationFn: (input: TInput) => zapCall<TOutput>(route, input, { teamId }),
    onSuccess: async (...args) => {
      await onSuccess?.(...args);

      // Mirror the tRPC override exactly: when the mutation opts out, do
      // nothing; otherwise invalidate every query except those that opt out.
      if (skipInvalidate) {
        return;
      }

      await queryClient.invalidateQueries({
        predicate: (q) => !(q?.meta as ZapMeta | undefined)?.doNotInvalidateQueryOnMutation,
      });
    },
  });
}

/**
 * The ZAP analogue of `trpc.useUtils()`. tRPC exposed a per-procedure object
 * (`utils.<router>.<proc>.setData(input, updater)` / `.invalidate(input)`);
 * over ZAP the route is a string, so the same operations take the route as the
 * first argument. Every key is derived from `zapQueryKey(route, input)`, so the
 * cache entries line up with `useZapQuery` exactly.
 */
export interface ZapUtils {
  client: QueryClient;
  /** Imperatively set the cached value for a query (optimistic updates). */
  setData<TData>(
    route: string,
    input: unknown,
    updater: TData | ((old: TData | undefined) => TData),
  ): void;
  /** Read the cached value for a query, if any. */
  getData<TData>(route: string, input?: unknown): TData | undefined;
  /** Invalidate a query (route + optional input). Omit input to match all
   *  inputs for the route. */
  invalidate(route?: string, input?: unknown): Promise<void>;
  /** Refetch a query (route + optional input). */
  refetch(route: string, input?: unknown): Promise<void>;
  /** Cancel in-flight fetches for a query. */
  cancel(route: string, input?: unknown): Promise<void>;
  /** Imperatively fetch (and cache) a query. */
  fetch<TData>(route: string, input?: unknown, opts?: ZapCallOptions): Promise<TData>;
}

/** Hook form of {@link ZapUtils}. */
export function useZapUtils(): ZapUtils {
  const client = useQueryClient();

  return {
    client,
    setData(route, input, updater) {
      client.setQueryData(zapQueryKey(route, input), updater as never);
    },
    getData(route, input) {
      return client.getQueryData(zapQueryKey(route, input));
    },
    invalidate(route, input) {
      if (route === undefined) {
        return client.invalidateQueries();
      }
      return client.invalidateQueries({ queryKey: zapQueryKey(route, input) });
    },
    refetch(route, input) {
      return client.refetchQueries({ queryKey: zapQueryKey(route, input) });
    },
    cancel(route, input) {
      return client.cancelQueries({ queryKey: zapQueryKey(route, input) });
    },
    fetch(route, input, opts) {
      return client.fetchQuery({
        queryKey: zapQueryKey(route, input),
        queryFn: () => zapCall(route, input, opts),
      }) as never;
    },
  };
}

export { zapCall, closeZap } from '../client/index';
export type { ZapCallOptions } from '../client/index';

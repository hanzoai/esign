// esign ZAP RPC — wire method ordinal + route key.
//
// @zap-proto/web routes a call by an integer method ordinal
// (`bootstrap.call(method, { payload })`). esign multiplexes every logical
// procedure ("<router>.<procedure>") through ONE ordinal — METHOD_RPC — and
// carries the route name inside the ZapRequest envelope (transport.zap). A
// single dispatcher in serve()'s rootCap then routes by name. This keeps the
// ordinal space stable as procedures are added/removed and matches the way the
// generated ZapRequest struct is shaped.

/** The single wire method ordinal every esign ZAP call uses. */
export const METHOD_RPC = 1 as const;

/** A logical route key: "<router>.<procedure>", e.g. "folder.getFolders". */
export type Route = `${string}.${string}`;

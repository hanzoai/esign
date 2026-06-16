# esign ZAP RPC transport envelope.
#
# Replaces the tRPC JSON-over-HTTP transport with native ZAP envelopes over
# WebSocket binary frames (@zap-proto/web). One ZapRequest struct rides each
# call; one ZapReply rides each response. Both are ZAP-encoded structs — the
# wire is binary, not JSON-RPC.
#
# The Payload / Result / ErrorJson fields hold the app's existing
# superjson-serialized values (the same dataTransformer tRPC used), so the
# typed object semantics every callsite depends on are preserved byte-for-byte
# across the transport swap. Fully-ported leaf routers additionally get
# strongly-typed scalar structs (see folder.zap, profile.zap, api_token.zap).
#
# Method ordinals: every esign procedure is reachable through ONE wire method
# ordinal (METHOD_RPC, see ../runtime/method.ts); the logical route
# ("folder.getFolders") is carried in ZapRequest.Method so a single dispatcher
# in serve()'s rootCap routes by name. text fields occupy an 8-byte slot
# {relOff:u32, len:u32}; bool/u32 are inline.

package esign

# Outbound call: logical route + superjson-encoded input.
struct ZapRequest {
    Method  text @0    # "<router>.<procedure>", e.g. "folder.getFolders"
    Payload text @8    # superjson(JSON) of the procedure input ("" = void input)
    TeamId  text @16   # x-team-id equivalent ("" = none); carried per-call
}

# Inbound reply: ok flag + status + superjson-encoded result, OR error JSON.
struct ZapReply {
    Ok        bool @0     # true => Result holds the value; false => ErrorJson set
    Status    u32  @4     # HTTP-equivalent status (200, 400, 401, 404, 500, ...)
    Result    text @8     # superjson(JSON) of the procedure output ("" = void)
    ErrorJson text @16    # AppError.toJSON string when Ok=false ("" otherwise)
}

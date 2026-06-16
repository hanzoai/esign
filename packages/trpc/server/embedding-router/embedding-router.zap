# embedding-router ZAP interface schema.
#
# Declares the embedding-presign router surface as a ZAP `interface` (one method
# per tRPC procedure, method ordinals auto-assigned in declaration order). The
# wire payloads ride the shared ZapRequest/ZapReply envelope (../../zap/schema/
# transport.zap) as superjson — the same dataTransformer tRPC used — so the
# interface here is the typed CONTRACT, and the route key carried on the
# envelope ("embeddingPresign.createEmbeddingPresignToken", ...) selects the
# handler. Inputs are still validated by the SAME Zod schemas the tRPC
# procedures used.
#
# Auth note: the embedding procedures did NOT run the authenticatedMiddleware;
# they read a credential off the Authorization header — an API token for
# createEmbeddingPresignToken, a presign JWT for the create/update routes. The
# ZAP MintCap cannot mint a context for those credential classes, so the token
# rides the request PAYLOAD and each handler pulls + verifies it (see
# ../../zap/server/handlers/embedding.ts).
#
# Route keys (dotted, matching the tRPC nested router shape under the
# `embeddingPresign` appRouter key):
#   embeddingPresign.createEmbeddingPresignToken
#   embeddingPresign.verifyEmbeddingPresignToken
#   embeddingPresign.createEmbeddingEnvelope
#   embeddingPresign.createEmbeddingDocument
#   embeddingPresign.createEmbeddingTemplate
#   embeddingPresign.updateEmbeddingEnvelope
#   embeddingPresign.updateEmbeddingDocument
#   embeddingPresign.updateEmbeddingTemplate
#   embeddingPresign.getMultiSignDocument

package esign

# Opaque superjson-encoded request/response bodies. The strongly-typed scalar
# views live alongside each procedure's Zod schema; the interface documents the
# method set + ordinal stability.
struct Req  { Body text @0 }   # superjson(input)  ("" = void)
struct Resp { Body text @0 }   # superjson(output) ("" = void)

interface EmbeddingPresign {
    createEmbeddingPresignToken(req: Req) returns (resp: Resp)
    verifyEmbeddingPresignToken(req: Req) returns (resp: Resp)

    createEmbeddingEnvelope(req: Req) returns (resp: Resp)
    createEmbeddingDocument(req: Req) returns (resp: Resp)
    createEmbeddingTemplate(req: Req) returns (resp: Resp)

    updateEmbeddingEnvelope(req: Req) returns (resp: Resp)
    updateEmbeddingDocument(req: Req) returns (resp: Resp)
    updateEmbeddingTemplate(req: Req) returns (resp: Resp)

    getMultiSignDocument(req: Req) returns (resp: Resp)
}

# template-router ZAP interface schema.
#
# Declares the template router surface as a ZAP `interface` (one method per tRPC
# procedure, method ordinals auto-assigned in declaration order). The wire
# payloads ride the shared ZapRequest/ZapReply envelope (../../zap/schema/
# transport.zap) as superjson — the same dataTransformer tRPC used — so the
# interface here is the typed CONTRACT, and the route key carried on the
# envelope ("template.findTemplates", "template.getMany", ...) selects the
# handler. Inputs are still validated by the SAME Zod schemas the tRPC
# procedures used. The template router is FLAT (no nested sub-routers), so the
# route keys are simply "template.<procedure>".
#
# Route keys (dotted, matching the tRPC flat router shape):
#   template.findTemplates / getTemplateById / getMany
#   template.createTemplate / createTemplateTemporary / updateTemplate
#   template.duplicateTemplate / deleteTemplate
#   template.createDocumentFromTemplate / createDocumentFromDirectTemplate
#   template.createTemplateDirectLink / deleteTemplateDirectLink
#   template.toggleTemplateDirectLink / uploadBulkSend

package esign

# Opaque superjson-encoded request/response bodies. The strongly-typed scalar
# views live alongside each procedure's Zod schema; the interface documents the
# method set + ordinal stability.
struct Req  { Body text @0 }   # superjson(input)  ("" = void)
struct Resp { Body text @0 }   # superjson(output) ("" = void)

interface Template {
    findTemplates(req: Req) returns (resp: Resp)
    getTemplateById(req: Req) returns (resp: Resp)
    getMany(req: Req) returns (resp: Resp)

    createTemplate(req: Req) returns (resp: Resp)
    createTemplateTemporary(req: Req) returns (resp: Resp)
    updateTemplate(req: Req) returns (resp: Resp)
    duplicateTemplate(req: Req) returns (resp: Resp)
    deleteTemplate(req: Req) returns (resp: Resp)

    createDocumentFromTemplate(req: Req) returns (resp: Resp)
    createDocumentFromDirectTemplate(req: Req) returns (resp: Resp)

    createTemplateDirectLink(req: Req) returns (resp: Resp)
    deleteTemplateDirectLink(req: Req) returns (resp: Resp)
    toggleTemplateDirectLink(req: Req) returns (resp: Resp)

    uploadBulkSend(req: Req) returns (resp: Resp)
}

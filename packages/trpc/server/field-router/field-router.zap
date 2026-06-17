# field-router ZAP interface schema.
#
# Declares the field router surface as a ZAP `interface` (one method per tRPC
# procedure, method ordinals auto-assigned in declaration order). The wire
# payloads ride the shared ZapRequest/ZapReply envelope (../../zap/schema/
# transport.zap) as superjson — the same dataTransformer tRPC used — so the
# interface here is the typed CONTRACT, and the route key carried on the
# envelope ("field.getDocumentField", ...) selects the handler. Inputs are
# still validated by the SAME Zod schemas the tRPC procedures used.
#
# Route keys (dotted, matching the tRPC flat router shape):
#   field.getDocumentField / createDocumentField / createDocumentFields
#   field.updateDocumentField / updateDocumentFields / deleteDocumentField
#   field.setFieldsForDocument
#   field.createTemplateField / getTemplateField / createTemplateFields
#   field.updateTemplateField / updateTemplateFields / deleteTemplateField
#   field.setFieldsForTemplate
#   field.signFieldWithToken / removeSignedFieldWithToken

package esign

# Opaque superjson-encoded request/response bodies. The strongly-typed scalar
# views live alongside each procedure's Zod schema; the interface documents the
# method set + ordinal stability.
struct Req  { Body text @0 }   # superjson(input)  ("" = void)
struct Resp { Body text @0 }   # superjson(output) ("" = void)

interface Field {
    getDocumentField(req: Req) returns (resp: Resp)
    createDocumentField(req: Req) returns (resp: Resp)
    createDocumentFields(req: Req) returns (resp: Resp)
    updateDocumentField(req: Req) returns (resp: Resp)
    updateDocumentFields(req: Req) returns (resp: Resp)
    deleteDocumentField(req: Req) returns (resp: Resp)
    setFieldsForDocument(req: Req) returns (resp: Resp)

    createTemplateField(req: Req) returns (resp: Resp)
    getTemplateField(req: Req) returns (resp: Resp)
    createTemplateFields(req: Req) returns (resp: Resp)
    updateTemplateField(req: Req) returns (resp: Resp)
    updateTemplateFields(req: Req) returns (resp: Resp)
    deleteTemplateField(req: Req) returns (resp: Resp)
    setFieldsForTemplate(req: Req) returns (resp: Resp)

    signFieldWithToken(req: Req) returns (resp: Resp)
    removeSignedFieldWithToken(req: Req) returns (resp: Resp)
}

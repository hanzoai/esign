# api-token-router ZAP schema — typed scalar inputs for the fully-ported routes.
#
# Procedure ↔ route:
#   create  -> apiToken.create
#   getMany -> apiToken.getMany   (input from ctx.teamId only; void payload)
#   delete  -> apiToken.delete

package esign

struct CreateApiTokenInput {
    TokenName      text @0
    TeamId         u32  @8    # 0 = personal
    ExpirationDate text @12   # "" = never; otherwise enum key
}

struct DeleteApiTokenInput {
    Id     u32 @0
    TeamId u32 @4   # 0 = personal
}

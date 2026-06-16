# profile-router ZAP schema — typed scalar inputs for the fully-ported routes.
#
# Procedure ↔ route:
#   findUserSecurityAuditLogs -> profile.findUserSecurityAuditLogs
#   updateProfile             -> profile.updateProfile
#   deleteAccount             -> profile.deleteAccount   (no input)
#   setProfileImage           -> profile.setProfileImage
#   submitSupportTicket       -> profile.submitSupportTicket

package esign

struct AuditLogQuery {
    Page    u32 @0   # 0 = unset
    PerPage u32 @4   # 0 = unset
}

struct UpdateProfileInput {
    Name      text @0
    Signature text @8
}

struct SetProfileImageInput {
    ImageData      text @0    # base64 image bytes ("" = clear); name avoids StructView.bytes()
    TeamId         u32  @8    # 0 = none
    OrganisationId text @12   # "" = none
}

struct SupportTicketInput {
    OrganisationId text @0
    TeamId         text @8    # "" = none
    Subject        text @16
    Message        text @24
}

# profile-router ZAP interface schema.
#
# Route keys:
#   profile.findUserSecurityAuditLogs / updateProfile / deleteAccount
#   profile.setProfileImage / submitSupportTicket
# Wire payloads ride the shared ZapRequest/ZapReply envelope as superjson;
# inputs validated by the SAME Zod schemas the tRPC procedures used.

package esign

struct Req  { Body text @0 }
struct Resp { Body text @0 }

interface Profile {
    findUserSecurityAuditLogs(req: Req) returns (resp: Resp)
    updateProfile(req: Req) returns (resp: Resp)
    deleteAccount(req: Req) returns (resp: Resp)
    setProfileImage(req: Req) returns (resp: Resp)
    submitSupportTicket(req: Req) returns (resp: Resp)
}

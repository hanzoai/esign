/**
 * Whether user is the person an invitation sent to invitedEmail names: their
 * address is verified and is that address. Emails are stored lowercased (see
 * the invite schema), and SQLite has no case-insensitive filter, so both sides
 * are compared lowercased.
 */
export const isInvitedPerson = (
  user: { email: string; emailVerified: Date | null },
  invitedEmail: string,
): boolean => {
  return user.emailVerified !== null && user.email.toLowerCase() === invitedEmail.toLowerCase();
};

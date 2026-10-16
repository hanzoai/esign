/**
 * The instant esign began admitting people through Hanzo IAM alone — the time
 * of the commit that made it so.
 *
 * Every session, API token and organisation invitation created before it was
 * issued under the old sign-in rules (local passwords, other providers, and
 * invitations any account could send). None of them is honoured: everyone
 * signs in again through IAM, integrations mint new tokens, and an invitation
 * from before it makes no account.
 */
export const IAM_ONLY_SINCE = new Date('2026-10-16T09:51:53Z');

/** Whether something created at `createdAt` was issued under IAM-only sign-in. */
export const issuedUnderIamOnly = (createdAt: Date): boolean =>
  createdAt.getTime() >= IAM_ONLY_SINCE.getTime();

/**
 * Whether a session may still be used: issued under IAM-only sign-in, to a user
 * who is not disabled and whose account is linked to a Hanzo IAM identity.
 */
export const sessionIsCurrent = (facts: {
  createdAt: Date;
  disabled: boolean;
  linkedToIam: boolean;
}): boolean => issuedUnderIamOnly(facts.createdAt) && !facts.disabled && facts.linkedToIam;

/**
 * Whether an API token may still be used: issued under IAM-only sign-in, to a
 * user who is not disabled.
 */
export const apiTokenIsCurrent = (facts: { createdAt: Date; disabled: boolean }): boolean =>
  issuedUnderIamOnly(facts.createdAt) && !facts.disabled;

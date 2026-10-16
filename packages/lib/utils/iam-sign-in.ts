/**
 * Who esign admits, and what keeps working for them.
 *
 * ONE RULE, applied on every Hanzo IAM sign-in and on every use of a session or
 * API token: a person is admitted when IAM says they administer the org the
 * application serves (held as the ADMIN role, restated at each sign-in), or
 * when an ADMIN vouches for them — through an organisation membership that came
 * from that ADMIN's invitation, or through such an invitation still pending for
 * their verified address.
 *
 * The cutoff is structural. Migration 1_iam_only_sign_in deletes every session
 * and API token, and adds the columns that record who sent an invitation and
 * who invited a member, NULL for every row from before it. A NULL sender vouches
 * for nobody, so nothing issued under the old sign-in rules admits anyone.
 */

/** The sender of an invitation, or the inviter of a member; null before the cutoff. */
export type Voucher = { roles: readonly string[]; disabled: boolean } | null;

/** Whether an invitation's sender vouches for its invitee: an ADMIN who is not disabled. */
export const vouches = (voucher: Voucher): boolean =>
  voucher !== null && !voucher.disabled && voucher.roles.includes('ADMIN');

/** What admission is decided from. */
export type Admission = {
  /** IAM says the person administers the app's org (or ADMIN, recorded at sign-in). */
  iamAdmin: boolean;
  /** A membership whose inviter vouches for them. */
  vouchedMembership: boolean;
  /** A pending invitation to their verified address whose sender vouches for them. */
  vouchedInvite: boolean;
};

/** The one admission rule. */
export const isAdmitted = (admission: Admission): boolean =>
  admission.iamAdmin || admission.vouchedMembership || admission.vouchedInvite;

/** A user as the store holds them, for deciding whether their credentials still work. */
export type Standing = {
  disabled: boolean;
  /** The account is linked to a Hanzo IAM identity. */
  linkedToIam: boolean;
  admission: Admission;
};

/**
 * Whether a session or API token held by this user may be used: they are linked
 * to IAM, not disabled, and admitted. For a team token the holder is the
 * organisation's owner.
 */
export const credentialIsCurrent = (standing: Standing): boolean =>
  standing.linkedToIam && !standing.disabled && isAdmitted(standing.admission);

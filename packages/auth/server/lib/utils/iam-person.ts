import type { Role } from '@prisma/client';

import { SignInRefusal } from '@hanzo/esign-lib/constants/auth';
import { AppError } from '@hanzo/esign-lib/errors/app-error';
import { isAdmitted } from '@hanzo/esign-lib/utils/iam-sign-in';

import { AuthenticationErrorCode } from '../errors/error-codes';

/**
 * The person IAM signed in, as its userinfo endpoint states them. Userinfo is
 * read rather than the id_token because it is IAM's live answer from its store:
 * `email_verified`, `isAdmin` and `orgs` are there and nowhere else, and a grant
 * IAM revoked a minute ago is already gone from it.
 */
export type IamPerson = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  /** The org the application belongs to; IAM stamps it on every sign-in. */
  owner: string;
  isAdmin: boolean;
  /** The orgs the person may act in, the one their account lives in first. */
  orgs: Array<{ org: string; role?: string }>;
};

/**
 * Whether the person administers the org this application serves: their
 * account lives in that org and holds its admin role there. IAM's `isAdmin` is
 * admin of the account's OWN org, so it counts only when that org is the
 * application's.
 */
export const administersAppOrg = (person: IamPerson): boolean => {
  const home = person.orgs[0];

  return (
    person.isAdmin &&
    Boolean(person.owner) &&
    home?.org === person.owner &&
    (home.role === 'admin' || home.role === 'owner')
  );
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Reads IAM's userinfo answer into an IamPerson, refusing one that does not
 * describe the identity the id_token was issued for.
 */
export const readIamPerson = (info: Record<string, unknown>, idTokenSub: string): IamPerson => {
  const sub = str(info.sub);

  if (!sub || sub !== idTokenSub) {
    throw new AppError(AuthenticationErrorCode.InvalidRequest, {
      message: 'The identity provider described a different account',
    });
  }

  const email = str(info.email);

  if (!email) {
    throw new AppError(AuthenticationErrorCode.InvalidRequest, {
      message: 'Missing email',
    });
  }

  const orgs = Array.isArray(info.orgs)
    ? info.orgs
        .filter((o): o is Record<string, unknown> => Boolean(o) && typeof o === 'object')
        .map((o) => ({ org: str(o.org), role: str(o.role) }))
        .filter((o) => o.org !== '')
    : [];

  return {
    sub,
    email,
    emailVerified: info.email_verified === true,
    name: str(info.displayName) || str(info.name) || email,
    owner: str(info.owner),
    isAdmin: info.isAdmin === true,
    orgs,
  };
};

/**
 * The roles an account holds after an IAM sign-in: ADMIN exactly when IAM says
 * the person administers the org the application serves. It is restated on
 * every sign-in, so a person IAM stops calling an admin loses it on their next.
 */
export const rolesFor = (person: IamPerson, current: readonly Role[]): Role[] => {
  const rest = current.filter((role) => role !== 'ADMIN' && role !== 'USER');

  return administersAppOrg(person) ? ['USER', 'ADMIN', ...rest] : ['USER', ...rest];
};

export type SignInDecision =
  | { kind: 'sign-in'; userId: number }
  | { kind: 'create' }
  | { kind: 'refuse'; reason: SignInRefusal };

/**
 * What an IAM sign-in leads to, decided from what IAM said and what the store
 * holds.
 *
 * Every sign-in, returning or first, passes the one admission rule
 * (`isAdmitted`): IAM says the person administers the app's org, or an ADMIN
 * vouches for them through a membership or a pending invitation to their
 * verified address. A returning person is found by the IAM identity their
 * account is linked to; a disabled one is refused. A first sign-in also needs
 * an address IAM has verified that no unlinked account already holds.
 */
export const decideSignIn = (facts: {
  person: IamPerson;
  linked: { id: number; disabled: boolean } | null;
  addressHeldByUnlinkedAccount: boolean;
  /** The linked account holds a membership whose inviter vouches for it. */
  vouchedMembership: boolean;
  /** A pending invitation to the address IAM signed in, whose sender vouches for it. */
  vouchedInvite: boolean;
}): SignInDecision => {
  const { person, linked } = facts;

  const admitted = isAdmitted({
    iamAdmin: administersAppOrg(person),
    vouchedMembership: linked !== null && facts.vouchedMembership,
    vouchedInvite: person.emailVerified && facts.vouchedInvite,
  });

  if (linked) {
    if (linked.disabled) {
      return { kind: 'refuse', reason: SignInRefusal.Disabled };
    }

    return admitted
      ? { kind: 'sign-in', userId: linked.id }
      : { kind: 'refuse', reason: SignInRefusal.NotInvited };
  }

  if (!person.emailVerified) {
    return { kind: 'refuse', reason: SignInRefusal.UnverifiedEmail };
  }

  if (facts.addressHeldByUnlinkedAccount) {
    return { kind: 'refuse', reason: SignInRefusal.UnlinkedAccount };
  }

  return admitted ? { kind: 'create' } : { kind: 'refuse', reason: SignInRefusal.NotInvited };
};

import { AppError } from '@hanzo/esign-lib/errors/app-error';

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

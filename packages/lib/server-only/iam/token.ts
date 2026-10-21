import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

import { env } from '../../utils/env';

/**
 * Hanzo IAM tokens, both ways: the token this application presents as itself
 * when it calls a Hanzo service, and the check every bearer it is handed must
 * pass. IAM is the only issuer and its keys are the only proof; this
 * application keeps no credential of its own beyond its IAM client.
 */

/** The unified Hanzo API: the one origin this application calls as itself. */
export const HANZO_API = 'https://api.hanzo.ai';

/** Re-mint a little before expiry so a call never races the clock. */
const TOKEN_SKEW_SECONDS = 60;

/** Three tries, ~0.3s then ~0.9s apart, each spread by half so a fleet does not knock in step. */
const ATTEMPTS = 3;
const BACKOFF_MS = 300;

/** A failure that says nothing about the request: the far side was unreachable or briefly unable to answer. */
export class Transient extends Error {}

const sleep = async (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Runs `attempt` again while it fails transiently, backing off threefold each
 * time. Anything else — a refused credential, a rejected address — is raised
 * where it happens.
 */
export const retry = async <T>(attempt: () => Promise<T>): Promise<T> => {
  for (let n = 1; ; n++) {
    try {
      return await attempt();
    } catch (err) {
      if (!(err instanceof Transient) || n === ATTEMPTS) {
        throw err;
      }

      await sleep(BACKOFF_MS * 3 ** (n - 1) * (0.5 + Math.random()));
    }
  }
};

/** A POST whose network failure is transient rather than fatal. */
export const post = async (url: string, init: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, init);
  } catch (err) {
    throw new Transient(`${new URL(url).host} is unreachable: ${String(err)}`);
  }
};

/** A server that cannot answer will answer later; a client that is refused stays refused. */
export const refused = (status: number, message: string) =>
  status >= 500 ? new Transient(message) : new Error(message);

export interface IamClient {
  /** IAM issuer. Machine tokens are minted at `${iamUrl}/v1/iam/oauth/token`. */
  iamUrl: string;
  clientId: string;
  clientSecret: string;
}

/** This application's own IAM client, as the deployment states it. */
export const iamClient = (): IamClient => ({
  iamUrl: env('IAM_URL') ?? 'https://hanzo.id',
  clientId: env('IAM_CLIENT_ID') ?? '',
  clientSecret: env('IAM_CLIENT_SECRET') ?? '',
});

/**
 * This application as a machine: the client_credentials grant for its IAM
 * client, minted FOR `resource` when one is named (RFC 8707), so the token's
 * audience is the one service it is spent at and no other would take it. Each
 * token is held until a minute before it expires.
 */
export class Machine {
  private minted = new Map<string, { value: string; expiresAt: number }>();

  constructor(private client: IamClient) {}

  public async token(resource = ''): Promise<string> {
    const held = this.minted.get(resource);

    if (held && held.expiresAt > Date.now()) {
      return held.value;
    }

    const token = await mint(this.client, resource);

    this.minted.set(resource, {
      value: token.value,
      expiresAt: Date.now() + token.expiresIn * 1000 - TOKEN_SKEW_SECONDS * 1000,
    });

    return token.value;
  }
}

const mint = async (client: IamClient, resource: string) => {
  const { iamUrl, clientId, clientSecret } = client;

  if (!clientId || !clientSecret) {
    throw new Error('an IAM machine token needs IAM_CLIENT_ID and IAM_CLIENT_SECRET');
  }

  return retry(async () => {
    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    if (resource) {
      form.set('resource', resource);
    }

    const response = await post(`${iamUrl}/v1/iam/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });

    const text = await response.text();

    if (!response.ok) {
      throw refused(
        response.status,
        `could not mint an IAM token (${response.status}): ${text.slice(0, 200)}`,
      );
    }

    let body: { access_token?: string; expires_in?: number };

    // An IAM that answers HTML answers as a proxy, not as an issuer.
    try {
      body = JSON.parse(text);
    } catch {
      throw new Transient(`IAM returned an unreadable token: ${text.slice(0, 200)}`);
    }

    if (!body.access_token) {
      throw new Error('IAM returned no access token');
    }

    return { value: body.access_token, expiresIn: Number(body.expires_in) || 3600 };
  });
};

/** This application as a machine, one per process: its own IAM client from the environment. */
export const machine = new Machine(iamClient());

/** The claims this application reads off an IAM access token. */
export type IamClaims = JWTPayload & {
  sub: string;
  /** The org the token acts in: a person's own, or an application's. */
  owner?: string;
  /** `application` for a machine acting as itself; a person otherwise. */
  type?: string;
  /** The client the token was minted by. */
  azp?: string;
  /** `access-token`, or `id-token` for a sign-in's identity, which is never a bearer. */
  tokenType?: string;
};

let issuer: Promise<{ iss: string; keys: ReturnType<typeof createRemoteJWKSet> }> | null = null;

/** IAM's issuer and signing keys, from its discovery document, read once. */
const discover = async (iamUrl: string) => {
  const response = await fetch(`${iamUrl}/.well-known/openid-configuration`, {
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`IAM discovery answered ${response.status}`);
  }

  const doc = (await response.json()) as { issuer?: string; jwks_uri?: string };

  if (!doc.issuer || !doc.jwks_uri) {
    throw new Error('IAM discovery names no issuer or no keys');
  }

  return { iss: doc.issuer, keys: createRemoteJWKSet(new URL(doc.jwks_uri)) };
};

/**
 * Verifies a bearer as an IAM access token minted for this application: signed
 * by a key IAM publishes, issued by IAM, its audience this application's own
 * client id, and unexpired. Anything else throws.
 */
export const verifyIamToken = async (
  token: string,
  client: IamClient = iamClient(),
): Promise<IamClaims> => {
  if (!client.clientId) {
    throw new Error('IAM_CLIENT_ID is not set, so no bearer can be meant for this application');
  }

  issuer ??= discover(client.iamUrl).catch((err: unknown) => {
    issuer = null;
    throw err;
  });

  const { iss, keys } = await issuer;
  const { payload } = await jwtVerify(token, keys, {
    issuer: iss,
    audience: client.clientId,
    clockTolerance: 30,
  });

  if (typeof payload.sub !== 'string' || payload.sub === '') {
    throw new Error('an IAM token names no subject');
  }

  if (payload.tokenType !== 'access-token') {
    throw new Error('an IAM token that is not an access token is no bearer');
  }

  return payload as IamClaims;
};

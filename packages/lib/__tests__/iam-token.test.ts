/**
 * The one bearer this server accepts is an IAM token minted for it, and the one
 * token it presents is its own IAM machine token, minted for the service it
 * calls. Both against a stand-in IAM: its discovery document, its keys and its
 * token endpoint.
 *
 * Run:  npx tsx --test packages/lib/__tests__/iam-token.test.ts
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { SignJWT, exportJWK, generateKeyPair } from 'jose';

import { Machine, verifyIamToken } from '../server-only/iam/token';
import { appTeams } from '../server-only/public-api/get-bearer';
import { receivers } from '../server-only/webhooks/send';

const iamUrl = 'https://iam.test';
const client = { iamUrl, clientId: 'hanzo-sign', clientSecret: 'secret' };
const realFetch = globalThis.fetch;
const forms: URLSearchParams[] = [];

let sign: (claims: Record<string, unknown>, over?: { iss?: string; aud?: string; exp?: string }) => Promise<string>;
let stranger: typeof sign;

before(async () => {
  const keys = await generateKeyPair('RS256');
  const other = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'cert-hanzo', alg: 'RS256' };

  const signer =
    (key: CryptoKey) =>
    async (claims: Record<string, unknown>, over: { iss?: string; aud?: string; exp?: string } = {}) =>
      new SignJWT({ tokenType: 'access-token', ...claims })
        .setProtectedHeader({ alg: 'RS256', kid: 'cert-hanzo' })
        .setIssuer(over.iss ?? iamUrl)
        .setAudience(over.aud ?? 'hanzo-sign')
        .setIssuedAt()
        .setExpirationTime(over.exp ?? '5m')
        .sign(key);

  sign = signer(keys.privateKey);
  stranger = signer(other.privateKey);

  const answer = (input: string | URL | Request, init?: RequestInit): Response => {
    const url = String(input instanceof Request ? input.url : input);

    if (url === `${iamUrl}/.well-known/openid-configuration`) {
      return Response.json({ issuer: iamUrl, jwks_uri: `${iamUrl}/v1/iam/.well-known/jwks` });
    }

    if (url === `${iamUrl}/v1/iam/.well-known/jwks`) {
      return Response.json({ keys: [jwk] });
    }

    if (url === `${iamUrl}/v1/iam/oauth/token`) {
      const form = new URLSearchParams(String(init?.body));
      forms.push(form);

      return Response.json({
        access_token: `minted-for:${form.get('resource') ?? ''}`,
        expires_in: 3600,
      });
    }

    return new Response('not found', { status: 404 });
  };

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(answer(input, init))) as typeof fetch;
});

after(() => {
  globalThis.fetch = realFetch;
});

describe('an IAM bearer', () => {
  test('minted for this application is verified, and says who and where', async () => {
    const claims = await verifyIamToken(
      await sign({ sub: 'admin/hanzo-cloud', owner: 'hanzo', type: 'application' }),
      client,
    );

    assert.equal(claims.sub, 'admin/hanzo-cloud');
    assert.equal(claims.owner, 'hanzo');
    assert.equal(claims.type, 'application');
  });

  test('minted for another service is refused', async () => {
    await assert.rejects(verifyIamToken(await sign({ sub: 'u' }, { aud: 'hanzo-cloud' }), client));
  });

  test('from another issuer is refused', async () => {
    await assert.rejects(verifyIamToken(await sign({ sub: 'u' }, { iss: 'https://evil.test' }), client));
  });

  test('signed by a key IAM does not publish is refused', async () => {
    await assert.rejects(verifyIamToken(await stranger({ sub: 'u' }), client));
  });

  test('expired is refused', async () => {
    await assert.rejects(verifyIamToken(await sign({ sub: 'u' }, { exp: '-5m' }), client));
  });

  test('that is a sign-in identity, not an access token, is refused', async () => {
    await assert.rejects(verifyIamToken(await sign({ sub: 'u', tokenType: 'id-token' }), client));
  });

  test('naming no subject is refused', async () => {
    await assert.rejects(verifyIamToken(await sign({}), client));
  });

  test('is never meant for an application with no client id', async () => {
    await assert.rejects(verifyIamToken(await sign({ sub: 'u' }), { ...client, clientId: '' }));
  });
});

describe('the teams applications act for', () => {
  test('are read client by client, and a malformed entry names nobody', () => {
    const teams = appTeams(' hanzo-cloud:hanzo , bad, :x, y:, a:b:c,hanzo-ops:ops ');

    assert.deepEqual([...teams], [
      ['hanzo-cloud', 'hanzo'],
      ['hanzo-ops', 'ops'],
    ]);
    assert.equal(appTeams('').size, 0);
  });
});

describe('the webhooks eSign posts as itself', () => {
  test('are exact URLs on the Hanzo API, and nothing else', () => {
    const urls = receivers(
      'https://api.hanzo.ai/v1/marketing/leads/esign, https://evil.test/x, not a url, https://api.hanzo.ai.evil.test/x',
    );

    assert.deepEqual([...urls], ['https://api.hanzo.ai/v1/marketing/leads/esign']);
    assert.equal(urls.has('https://api.hanzo.ai/v1/marketing/leads/esign?x=1'), false);
    assert.equal(urls.has('https://api.hanzo.ai/v1/billing/usage'), false);
    assert.equal(receivers('').size, 0);
  });
});

describe('the machine token', () => {
  test('is minted for the service it is spent at, and held per service', async () => {
    forms.length = 0;
    const machine = new Machine(client);

    assert.equal(await machine.token('https://api.hanzo.ai'), 'minted-for:https://api.hanzo.ai');
    assert.equal(await machine.token('https://api.hanzo.ai'), 'minted-for:https://api.hanzo.ai');
    assert.equal(await machine.token(), 'minted-for:');

    assert.equal(forms.length, 2);
    assert.equal(forms[0].get('grant_type'), 'client_credentials');
    assert.equal(forms[0].get('client_id'), 'hanzo-sign');
    assert.equal(forms[0].get('resource'), 'https://api.hanzo.ai');
    assert.equal(forms[1].get('resource'), null);
  });
});

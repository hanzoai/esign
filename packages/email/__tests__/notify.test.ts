import assert from 'node:assert';
import { afterEach, describe, it } from 'node:test';

import { NotifyTransport } from '../transports/notify';

type Answer = { status: number; body: string };

const realFetch = globalThis.fetch;

/** Answers each call in turn and records the URLs it was asked for. */
const answer = (...answers: Answer[]) => {
  const calls: string[] = [];

  globalThis.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url));

    const { status, body } = answers[Math.min(calls.length - 1, answers.length - 1)];

    return Promise.resolve(new Response(body, { status }));
  }) as typeof fetch;

  return calls;
};

const mint = { status: 200, body: JSON.stringify({ access_token: 'token', expires_in: 3600 }) };
const sent = { status: 200, body: JSON.stringify({ message_id: 'id', status: 'sent' }) };

const send = async (transport: NotifyTransport) =>
  new Promise<{ messageId?: string }>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const mail = { data: { to: 'signer@example.com', subject: 'hi', html: '<p>hi</p>' } } as never;

    transport.send(mail, (err, info) => (err ? reject(err) : resolve(info)));
  });

const transport = () =>
  NotifyTransport.makeTransport({
    iamUrl: 'https://hanzo.id',
    clientId: 'id',
    clientSecret: 'secret',
  });

describe('notify transport', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('sends after IAM answers 502 twice', async () => {
    const calls = answer(
      { status: 502, body: '<!DOCTYPE html>' },
      { status: 502, body: '<!DOCTYPE html>' },
      mint,
      sent,
    );

    const info = await send(transport());

    assert.equal(calls.length, 4);
    assert.equal(calls.filter((url) => url.includes('/v1/iam/oauth/token')).length, 3);
    assert.equal(info.messageId, 'id');
  });

  it('sends after notify answers 503', async () => {
    const calls = answer(mint, { status: 503, body: 'unavailable' }, sent);

    await send(transport());

    assert.equal(calls.length, 3);
  });

  it('gives up on a refused credential without retrying', async () => {
    const calls = answer({ status: 401, body: 'invalid_client' });

    await assert.rejects(send(transport()), /could not mint an IAM token \(401\)/);
    assert.equal(calls.length, 1);
  });

  it('gives up on a refused address without retrying', async () => {
    const calls = answer(mint, { status: 400, body: 'bad address' });

    await assert.rejects(send(transport()), /notify send failed \(400\)/);
    assert.equal(calls.length, 2);
  });

  it('gives up when notify reports a failed delivery', async () => {
    const calls = answer(mint, {
      status: 200,
      body: JSON.stringify({ status: 'failed', error: 'mailbox full' }),
    });

    await assert.rejects(send(transport()), /mailbox full/);
    assert.equal(calls.length, 2);
  });
});

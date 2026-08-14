import type { SentMessageInfo, Transport } from 'nodemailer';
import type { Address } from 'nodemailer/lib/mailer';
import type MailMessage from 'nodemailer/lib/mailer/mail-message';

import { env } from '@hanzo/esign-lib/utils/env';

const VERSION = '1.0.0';

/** The unified endpoint. Every Hanzo service reaches notify here. */
const NOTIFY_SEND_EMAIL = 'https://api.hanzo.ai/v1/notify/send/email?sync=true';

/** Re-mint a little before expiry so a send never races the clock. */
const TOKEN_SKEW_SECONDS = 60;

/** Three tries, ~0.3s then ~0.9s apart, each spread by half so a fleet does not knock in step. */
const ATTEMPTS = 3;
const BACKOFF_MS = 300;

type NodeMailerAddress = string | Address | Array<string | Address> | undefined;

/** A failure that says nothing about the request: the far side was unreachable or briefly unable to answer. */
class Transient extends Error {}

const sleep = async (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Runs `attempt` again while it fails transiently, backing off threefold each
 * time. Anything else — a refused credential, a rejected address — is raised
 * where it happens.
 */
const retry = async <T>(attempt: () => Promise<T>): Promise<T> => {
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
const post = async (url: string, init: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, init);
  } catch (err) {
    throw new Transient(`${new URL(url).host} is unreachable: ${String(err)}`);
  }
};

/** A server that cannot answer will answer later; a client that is refused stays refused. */
const refused = (status: number, message: string) =>
  status >= 500 ? new Transient(message) : new Error(message);

interface NotifyTransportOptions {
  /** IAM issuer. Machine tokens are minted at `${iamUrl}/v1/iam/oauth/token`. */
  iamUrl: string;
  clientId: string;
  clientSecret: string;
}

/**
 * The notify send response. A transport error arrives as HTTP 200 with
 * `status: "failed"` — the delivery outcome lives in the body, not the status
 * line, so both have to be read before a send is called successful.
 */
interface NotifyOutcome {
  message_id?: string;
  status?: string;
  error?: string;
}

/**
 * Sends mail through notify, the Hanzo notification service.
 *
 * The service holds the provider credentials in KMS and picks the provider per
 * org, so this app carries none and names no sender: the from address belongs
 * to the credential. Authentication is the same IAM client this app already
 * uses to sign users in, presented as a machine token.
 */
export class NotifyTransport implements Transport<SentMessageInfo> {
  public name = 'HanzoNotifyTransport';
  public version = VERSION;

  private _options: NotifyTransportOptions;
  private _token: { value: string; expiresAt: number } | null = null;

  public static makeTransport(options: Partial<NotifyTransportOptions>) {
    return new NotifyTransport(options);
  }

  constructor(options: Partial<NotifyTransportOptions>) {
    const {
      iamUrl = env('IAM_URL') ?? 'https://hanzo.id',
      clientId = env('IAM_CLIENT_ID') ?? '',
      clientSecret = env('IAM_CLIENT_SECRET') ?? '',
    } = options;

    this._options = { iamUrl, clientId, clientSecret };
  }

  public send(mail: MailMessage, callback: (_err: Error | null, _info: SentMessageInfo) => void) {
    this.deliver(mail)
      .then((messageId) =>
        callback(null, {
          messageId,
          envelope: { from: mail.data.from, to: mail.data.to },
          accepted: mail.data.to,
          rejected: [],
          pending: [],
        }),
      )
      .catch((err: unknown) => callback(err instanceof Error ? err : new Error(String(err)), null));
  }

  private async deliver(mail: MailMessage): Promise<string> {
    const to = this.toAddresses(mail.data.to);

    if (to.length === 0) {
      throw new Error('Missing required field "to"');
    }

    const body = mail.data.html?.toString() ?? mail.data.text?.toString() ?? '';

    return retry(async () => {
      const response = await post(NOTIFY_SEND_EMAIL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await this.token()}`,
        },
        body: JSON.stringify({
          to,
          subject: mail.data.subject ?? '',
          body,
        }),
      });

      const text = await response.text();

      if (!response.ok) {
        throw refused(
          response.status,
          `notify send failed (${response.status}): ${text.slice(0, 200)}`,
        );
      }

      let outcome: NotifyOutcome = {};

      try {
        outcome = JSON.parse(text);
      } catch {
        throw new Error(`notify returned an unreadable response: ${text.slice(0, 200)}`);
      }

      // A refused delivery still answers 200; the outcome is the authority.
      if (outcome.status && outcome.status !== 'sent' && outcome.status !== 'queued') {
        throw new Error(outcome.error || `notify reported status "${outcome.status}"`);
      }

      return outcome.message_id ?? '';
    });
  }

  /** Mints and caches a machine token for this app's IAM client. */
  private async token(): Promise<string> {
    const now = Date.now();

    if (this._token && this._token.expiresAt > now) {
      return this._token.value;
    }

    const { iamUrl, clientId, clientSecret } = this._options;

    if (!clientId || !clientSecret) {
      throw new Error('notify transport requires IAM_CLIENT_ID and IAM_CLIENT_SECRET');
    }

    const minted = await retry(async () => {
      const response = await post(`${iamUrl}/v1/iam/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      const text = await response.text();

      if (!response.ok) {
        throw refused(
          response.status,
          `notify transport could not mint an IAM token (${response.status}): ${text.slice(0, 200)}`,
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

    this._token = {
      value: minted.value,
      expiresAt: Date.now() + minted.expiresIn * 1000 - TOKEN_SKEW_SECONDS * 1000,
    };

    return minted.value;
  }

  /** Flattens nodemailer's address shapes to the plain list notify accepts. */
  private toAddresses(address: NodeMailerAddress): string[] {
    if (!address) {
      return [];
    }

    const one = (value: string | Address) =>
      typeof value === 'string' ? value : (value.address ?? '');

    return (Array.isArray(address) ? address.map(one) : [one(address)]).filter(Boolean);
  }
}

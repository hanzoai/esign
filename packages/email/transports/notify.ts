import type { SentMessageInfo, Transport } from 'nodemailer';
import type { Address } from 'nodemailer/lib/mailer';
import type MailMessage from 'nodemailer/lib/mailer/mail-message';

import type { IamClient } from '@hanzo/esign-lib/server-only/iam/token';
import {
  HANZO_API,
  Machine,
  iamClient,
  post,
  refused,
  retry,
} from '@hanzo/esign-lib/server-only/iam/token';

const VERSION = '1.0.0';

/** The unified endpoint. Every Hanzo service reaches notify here. */
const NOTIFY_SEND_EMAIL = `${HANZO_API}/v1/notify/send/email?sync=true`;

type NodeMailerAddress = string | Address | Array<string | Address> | undefined;

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

  private _machine: Machine;

  public static makeTransport(options: Partial<IamClient>) {
    return new NotifyTransport(options);
  }

  constructor(options: Partial<IamClient>) {
    this._machine = new Machine({ ...iamClient(), ...options });
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
          Authorization: `Bearer ${await this._machine.token()}`,
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

      let outcome: NotifyOutcome;

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

import type { ClientResponse } from 'hono/client';
import { hc } from 'hono/client';
import superjson from 'superjson';

import { NEXT_PUBLIC_WEBAPP_URL } from '@hanzo/esign-lib/constants/app';
import { AppError } from '@hanzo/esign-lib/errors/app-error';

import type { AuthAppType } from '../server';
import type { SessionValidationResult } from '../server/lib/session/session';
import type { PartialAccount } from '../server/lib/utils/get-accounts';
import type { ActiveSession } from '../server/lib/utils/get-session';
import type {
  TDisableTwoFactorRequestSchema,
  TEnableTwoFactorRequestSchema,
  TViewTwoFactorRecoveryCodesRequestSchema,
} from '../server/routes/two-factor.types';

type AuthClientType = ReturnType<typeof hc<AuthAppType>>;

export class AuthClient {
  public client: AuthClientType;

  private signOutredirectPath: string = '/signin';

  constructor(options: { baseUrl: string }) {
    this.client = hc<AuthAppType>(options.baseUrl);
  }

  public async signOut({ redirectPath }: { redirectPath?: string } = {}) {
    await this.client.signout.$post();

    window.location.href = redirectPath ?? this.signOutredirectPath;
  }

  public async signOutAllSessions() {
    await this.client['signout-all'].$post();
  }

  public async signOutSession({
    sessionId,
    redirectPath,
  }: {
    sessionId: string;
    redirectPath?: string;
  }) {
    await this.client['signout-session'].$post({
      json: { sessionId },
    });

    if (redirectPath) {
      window.location.href = redirectPath;
    }
  }

  public async getSession() {
    const response = await this.client['session-json'].$get();

    if (!response.ok) {
      const error = await response.json();

      throw AppError.parseError(error);
    }

    const result = await response.json();

    return superjson.deserialize<SessionValidationResult>(result);
  }

  public async getSessions() {
    const response = await this.client['sessions'].$get();

    if (!response.ok) {
      const error = await response.json();

      throw AppError.parseError(error);
    }

    const result = await response.json();

    return superjson.deserialize<{ sessions: ActiveSession[] }>(result);
  }

  // !: Unused for now since it isn't providing the type narrowing
  // !: we need.
  private async handleError<T>(response: ClientResponse<T>): Promise<void> {
    if (!response.ok) {
      const error = await response.json();

      throw AppError.parseError(error);
    }
  }

  public account = {
    getMany: async () => {
      const response = await this.client['accounts'].$get();

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      const result = await response.json();

      return superjson.deserialize<{ accounts: PartialAccount[] }>(result);
    },
    delete: async (accountId: string) => {
      const response = await this.client['account'][':accountId'].$delete({
        param: { accountId },
      });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }
    },
  };

  public twoFactor = {
    setup: async () => {
      const response = await this.client['two-factor'].setup.$post();

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      return response.json();
    },
    enable: async (data: TEnableTwoFactorRequestSchema) => {
      const response = await this.client['two-factor'].enable.$post({ json: data });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      return response.json();
    },
    disable: async (data: TDisableTwoFactorRequestSchema) => {
      const response = await this.client['two-factor'].disable.$post({ json: data });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }
    },
    viewRecoveryCodes: async (data: TViewTwoFactorRecoveryCodesRequestSchema) => {
      const response = await this.client['two-factor']['view-recovery-codes'].$post({ json: data });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      return response.json();
    },
  };

  public hanzo = {
    signIn: async ({ redirectPath }: { redirectPath?: string } = {}) => {
      const response = await this.client['oauth'].authorize.hanzo.$post({
        json: { redirectPath },
      });

      if (!response.ok) {
        const error = await response.json();

        throw AppError.parseError(error);
      }

      const data = await response.json();

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    },
  };
}

export const authClient = new AuthClient({
  baseUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/v1/auth`,
});

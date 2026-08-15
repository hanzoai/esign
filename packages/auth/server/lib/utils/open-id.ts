import { z } from 'zod';

const ZOpenIdConfigurationSchema = z.object({
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  scopes_supported: z.array(z.string()).optional(),
});

type OpenIdConfiguration = z.infer<typeof ZOpenIdConfigurationSchema>;

type GetOpenIdConfigurationOptions = {
  requiredScopes?: string[];
};

/**
 * The provider's discovery document, remembered.
 *
 * Two endpoints are read out of it and both are settings of the identity
 * provider — they change when someone deploys a new one, not between two
 * sign-ins a second apart. Fetching it per request made every sign-in depend on
 * a live round trip to the provider, so a single edge blip surfaced as
 * `500 Failed to fetch OIDC configuration: Bad Gateway` with nothing to fall
 * back on. Observed in production.
 *
 * So: serve from memory while fresh, and if a refresh fails, keep serving the
 * last document that worked. Only a process that has never reached the provider
 * can fail here, which is the one case where failing is the honest answer.
 */
const REMEMBER_FOR = 10 * 60 * 1000;
const REACH_WITHIN = 8_000;

const known = new Map<string, { at: number; config: OpenIdConfiguration }>();

const load = async (wellKnownUrl: string): Promise<OpenIdConfiguration> => {
  const seen = known.get(wellKnownUrl);

  if (seen && Date.now() - seen.at < REMEMBER_FOR) {
    return seen.config;
  }

  try {
    const response = await fetch(wellKnownUrl, { signal: AbortSignal.timeout(REACH_WITHIN) });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const config = ZOpenIdConfigurationSchema.parse(await response.json());

    known.set(wellKnownUrl, { at: Date.now(), config });

    return config;
  } catch (err) {
    if (seen) {
      return seen.config;
    }

    throw new Error(
      `Failed to fetch OIDC configuration: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

export const getOpenIdConfiguration = async (
  wellKnownUrl: string,
  options: GetOpenIdConfigurationOptions = {},
): Promise<OpenIdConfiguration> => {
  const config = await load(wellKnownUrl);

  const supportedScopes = config.scopes_supported ?? [];
  const requiredScopes = options.requiredScopes ?? [];

  const unsupportedScopes = requiredScopes.filter((scope) => !supportedScopes.includes(scope));

  if (unsupportedScopes.length > 0) {
    throw new Error(`Requested scopes not supported by provider: ${unsupportedScopes.join(', ')}`);
  }

  return config;
};

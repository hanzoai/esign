import { StrictMode, startTransition, useEffect } from 'react';

import { i18n } from '@lingui/core';
import { detect, fromHtmlTag } from '@lingui/detect-locale';
import { I18nProvider } from '@lingui/react';
import posthog from '@hanzo/insights';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

import { extractInsightsConfig } from '@hanzo/sign-lib/constants/feature-flags';
import { dynamicActivate } from '@hanzo/sign-lib/utils/i18n';

import './utils/polyfills/promise-with-resolvers';

function InsightsInit() {
  const insightsConfig = extractInsightsConfig();

  useEffect(() => {
    if (insightsConfig) {
      posthog.init(insightsConfig.key, {
        api_host: insightsConfig.host,
        capture_exceptions: true,
      });
    }
  }, []);

  return null;
}

async function main() {
  const locale = detect(fromHtmlTag('lang')) || 'en';

  await dynamicActivate(locale);

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <I18nProvider i18n={i18n}>
          <HydratedRouter />
        </I18nProvider>

        <InsightsInit />
      </StrictMode>,
    );
  });
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();

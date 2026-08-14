import { StrictMode, startTransition } from 'react';

import insights from '@hanzo/insights';
import { i18n } from '@lingui/core';
import { detect, fromHtmlTag } from '@lingui/detect-locale';
import { I18nProvider } from '@lingui/react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

import { extractInsightsConfig } from '@hanzo/esign-lib/constants/feature-flags';
import { dynamicActivate } from '@hanzo/esign-lib/utils/i18n';

import './utils/polyfills/promise-with-resolvers';

async function main() {
  const locale = detect(fromHtmlTag('lang')) || 'en';

  await dynamicActivate(locale);

  const insightsConfig = extractInsightsConfig();

  if (insightsConfig) {
    insights.init(insightsConfig.key, {
      api_host: insightsConfig.host,
      capture_exceptions: true,
    });
  }

  // This tree has to match entry.server's exactly. `useId` numbers a component
  // by its position, and the count of its parent's children is part of that
  // position — so a wrapper on one side only, or a second child beside the
  // router, renumbers every id underneath and hydration fails on the first
  // component that asks for one. Starting insights here rather than as a second
  // child is what keeps the shapes equal.
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <I18nProvider i18n={i18n}>
          <HydratedRouter />
        </I18nProvider>
      </StrictMode>,
    );
  });
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();

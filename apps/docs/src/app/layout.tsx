import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { RootProvider } from 'fumadocs-ui/provider/next';
import PlausibleProvider from 'next-plausible';

import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://docs.sign.hanzo.ai'),
  title: {
    template: '%s | Hanzo Sign Docs',
    default: 'Hanzo Sign Docs',
  },
  description:
    'The official documentation for Hanzo Sign, the open-source document signing platform.',
  openGraph: {
    siteName: 'Hanzo Sign Docs',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@hanzoai',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <PlausibleProvider domain="sign.hanzo.ai">
          <RootProvider>{children}</RootProvider>
        </PlausibleProvider>
      </body>
    </html>
  );
}

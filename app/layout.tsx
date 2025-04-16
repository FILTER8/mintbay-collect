// File: app/layout.tsx
import './theme.css';
import '@coinbase/onchainkit/styles.css';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const URL = process.env.NEXT_PUBLIC_URL || 'https://mintbay-collect.vercel.app';
  const IMAGE_URL = process.env.NEXT_PUBLIC_IMAGE_URL || 'https://mintbay-collect.vercel.app/placeholder-nft.png';
  return {
    title: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'CollectApp',
    description: 'Mint NFTs on Base with Coinbase Wallet',
    other: {
      'fc:frame': 'vNext',
      'fc:frame:image': IMAGE_URL,
      'fc:frame:button:1': 'Open App',
      'fc:frame:button:1:action': 'post',
      'fc:frame:button:1:target': `${URL}/api/tx`,
      'og:image': IMAGE_URL,
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
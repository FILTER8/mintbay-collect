import './theme.css';
import '@coinbase/onchainkit/styles.css';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { gql } from '@apollo/client';
import client from './lib/apollo';

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const TOKEN_QUERY = gql`
  query TokenPageQuery($id: ID!) {
    edition(id: $id) {
      name
    }
  }
`;

const CONTRACT_ADDRESS = '0x7f19732c1ad9c25e604e3649638c1486f53e5c35';

export async function generateMetadata(): Promise<Metadata> {
  const URL = process.env.NEXT_PUBLIC_URL || 'https://mintbay-collect.vercel.app';
  let imageUrl = `${URL}/api/generate-png`; // Default
  const FALLBACK_IMAGE_URL = 'https://mintbay-collect.vercel.app/placeholder-nft.png';
  let title = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'CollectApp';

  try {
    // Fetch PNG URL from /api/generate-png
    console.log('Fetching PNG URL from:', `${URL}/api/generate-png`);
    const response = await fetch(`${URL}/api/generate-png`, { method: 'GET' });
    if (response.ok) {
      const blobUrl = response.headers.get('X-PNG-URL');
      if (blobUrl) {
        imageUrl = blobUrl;
        console.log('Using Blob URL:', imageUrl);
      } else {
        console.warn('No X-PNG-URL header found, using default');
      }
    } else {
      console.error('Failed to fetch PNG:', response.status, response.statusText);
      imageUrl = FALLBACK_IMAGE_URL;
    }

    // Fetch title
    const { data } = await client.query({
      query: TOKEN_QUERY,
      variables: { id: CONTRACT_ADDRESS.toLowerCase() },
    });
    if (data?.edition?.name) {
      title = data.edition.name;
    }
  } catch (err) {
    console.error('Metadata Error:', err);
    imageUrl = FALLBACK_IMAGE_URL;
  }

  return {
    title,
    description: 'Mint NFTs on Base with Coinbase Wallet',
    other: {
      "fc:frame": JSON.stringify({
        version: process.env.NEXT_PUBLIC_VERSION || 'next',
        imageUrl: imageUrl,
        button: {
          title: `Launch ${process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'CollectApp'}`,
          action: {
            type: "launch_frame",
            name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'CollectApp',
            url: URL,
            splashImageUrl: process.env.NEXT_PUBLIC_SPLASH_IMAGE_URL || imageUrl,
            splashBackgroundColor: `#${process.env.NEXT_PUBLIC_SPLASH_BACKGROUND_COLOR || 'FFFFFF'}`,
          },
        },
      }),
      "og:image": imageUrl,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-background">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
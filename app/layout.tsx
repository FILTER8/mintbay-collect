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
  const IMAGE_URL = `${URL}/api/generate-png`; // PNG from API route
  let title = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'CollectApp';

  try {
    const { data } = await client.query({
      query: TOKEN_QUERY,
      variables: { id: CONTRACT_ADDRESS.toLowerCase() },
    });
    if (data?.edition?.name) {
      title = data.edition.name;
    }
  } catch (err) {
    console.error('Metadata GraphQL Error:', err);
  }

  return {
    title,
    description: 'Mint NFTs on Base with Coinbase Wallet',
    other: {
      "fc:frame": JSON.stringify({
        version: process.env.NEXT_PUBLIC_VERSION || 'next',
        imageUrl: IMAGE_URL,
        imageAspectRatio: '1:1', // Explicitly set to square
        button: {
          title: `Launch ${process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'CollectApp'}`,
          action: {
            type: "launch_frame",
            name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'CollectApp',
            url: URL,
            splashImageUrl: process.env.NEXT_PUBLIC_SPLASH_IMAGE_URL || IMAGE_URL,
            splashBackgroundColor: `#${process.env.NEXT_PUBLIC_SPLASH_BACKGROUND_COLOR || 'FFFFFF'}`,
          },
        },
      }),
      "og:image": IMAGE_URL,
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
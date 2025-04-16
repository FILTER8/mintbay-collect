import './theme.css';
import '@coinbase/onchainkit/styles.css';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { NextRequest } from 'next/server';
import { gql } from '@apollo/client';
import client from './lib/apollo';
import { ethers } from 'ethers';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const TOKEN_QUERY = gql`
  query TokenPageQuery($id: ID!) {
    edition(id: $id) {
      name
      tokens(where: { tokenId: 1 }, first: 1) {
        tokenURI
      }
    }
  }
`;

const DEFAULT_CONTRACT_ADDRESS = '0x7f19732c1ad9c25e604e3649638c1486f53e5c35';

export async function generateMetadata({ req }: { req: NextRequest }): Promise<Metadata> {
  const URL = process.env.NEXT_PUBLIC_URL || 'https://mintbay-collect.vercel.app';
  const DEFAULT_IMAGE_URL = process.env.NEXT_PUBLIC_IMAGE_URL || 'https://mintbay-collect.vercel.app/placeholder-nft.png';
  let imageUrl = DEFAULT_IMAGE_URL;
  let title = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'CollectApp';

  const contractAddress = req.nextUrl.searchParams.get('contract')?.toLowerCase() || DEFAULT_CONTRACT_ADDRESS;
  if (ethers.isAddress(contractAddress)) {
    try {
      const { data } = await client.query({
        query: TOKEN_QUERY,
        variables: { id: contractAddress },
      });
      const tokenURI = data?.edition?.tokens?.[0]?.tokenURI;
      if (tokenURI?.startsWith('data:application/json;base64,')) {
        const metadata = JSON.parse(atob(tokenURI.split(',')[1]));
        if (metadata.image) {
          imageUrl = metadata.image;
        }
      }
      if (data?.edition?.name) {
        title = data.edition.name;
      }
    } catch (err) {
      console.error('Metadata GraphQL Error:', err);
    }
  }

  return {
    title,
    description: 'Mint NFTs on Base with Coinbase Wallet',
    other: {
      'fc:frame': 'vNext',
      'fc:frame:image': imageUrl,
      'fc:frame:button:1': 'Open App',
      'fc:frame:button:1:action': 'post',
      'fc:frame:button:1:target': `${URL}/api/tx`,
      'og:image': imageUrl,
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
import { NextResponse } from 'next/server';
import { gql } from '@apollo/client';
import client from '../../lib/apollo';

const TOKEN_QUERY = gql`
  query TokenPageQuery($id: ID!) {
    edition(id: $id) {
      tokens(where: { tokenId: 1 }, first: 1) {
        tokenURI
      }
    }
  }
`;

const CONTRACT_ADDRESS = '0x7f19732c1ad9c25e604e3649638c1486f53e5c35';

// This is a placeholder for client-side PNG generation, as server-side canvas isn't directly supported
export async function GET() {
  try {
    // Fetch tokenURI server-side
    const { data } = await client.query({
      query: TOKEN_QUERY,
      variables: { id: CONTRACT_ADDRESS.toLowerCase() },
    });

    const tokenURI = data?.edition?.tokens?.[0]?.tokenURI;
    if (!tokenURI || !tokenURI.startsWith('data:application/json;base64,')) {
      return NextResponse.json({ error: 'Invalid tokenURI' }, { status: 400 });
    }

    const base64Data = tokenURI.split(',')[1];
    const metadataStr = atob(base64Data);
    const metadata = JSON.parse(metadataStr);

    if (!metadata.image || !metadata.image.startsWith('data:image/svg+xml;base64,')) {
      return NextResponse.json({ error: 'No SVG image found' }, { status: 400 });
    }

    // Return the SVG data URI for client-side processing
    // In a real app, you'd use a CDN or storage service to host the PNG
    return NextResponse.json({ svgDataUri: metadata.image });
  } catch (err) {
    console.error('Error generating PNG:', err);
    return NextResponse.json({ error: 'Failed to generate PNG' }, { status: 500 });
  }
}
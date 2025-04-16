// File: app/api/tx/route.ts
import { NextResponse } from 'next/server';
import { gql } from '@apollo/client';
import client from '../../lib/apollo';

const TOKEN_QUERY = gql`
  query TokenPageQuery($id: ID!) {
    edition(id: $id) {
      name
      priceEth
      isFreeMint
      totalSupply
      editionSize
    }
  }
`;

export async function POST() {
  try {
    const contractAddress = '0x7f19732c1ad9c25e604e3649638c1486f53e5c35';
    const URL = process.env.NEXT_PUBLIC_URL || 'https://mintbay-collect.vercel.app';
    const IMAGE_URL = process.env.NEXT_PUBLIC_IMAGE_URL || 'https://mintbay-collect.vercel.app/placeholder-nft.png';

    const queryResult = await client.query({
      query: TOKEN_QUERY,
      variables: { id: contractAddress.toLowerCase() },
    });

    const editionName = queryResult.data?.edition?.name || 'NFT';
    const priceEth = queryResult.data?.edition?.priceEth || '0';
    const isFreeMint = queryResult.data?.edition?.isFreeMint || false;
    const totalSupply = Number(queryResult.data?.edition?.totalSupply || 0);
    const editionSize = Number(queryResult.data?.edition?.editionSize || 9);
    const launchpadFee = '0.0004';
    const totalCost = isFreeMint ? '0' : Number(priceEth).toFixed(4);

    // Return a frame response to display MiniApp content in the feed
    return new NextResponse(
      JSON.stringify({
        version: 'vNext',
        image: IMAGE_URL,
        buttons: [
          {
            label: 'Refresh',
            action: 'post',
            target: `${URL}/api/tx`,
          },
        ],
        post_url: `${URL}/api/tx`,
        state: {
          view: 'miniapp',
          contractAddress,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      }
    );
  } catch (error) {
    console.error('Frame endpoint error:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
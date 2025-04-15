

// File: app/api/tx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { gql } from '@apollo/client';
import client from '../../lib/apollo';
import editionAbi from '../../contracts/MintbayEdition.json';

const TOKEN_QUERY = gql`
  query TokenPageQuery($id: ID!) {
    edition(id: $id) {
      priceEth
      isFreeMint
    }
  }
`;

export async function POST(req: NextRequest) {
  const contractAddress = '0xad7e6d4870e94264fc811b8758e56cf8f19d6d6f';

  if (!ethers.isAddress(contractAddress)) {
    return new NextResponse('Invalid contract address', { status: 400 });
  }

  const queryResult = await client.query({
    query: TOKEN_QUERY,
    variables: { id: contractAddress.toLowerCase() },
  });

  const quantity = 1;
  const priceEth = queryResult.data?.edition?.priceEth || '0';
  const isFreeMint = queryResult.data?.edition?.isFreeMint || false;
  const launchpadFee = '0.0004';
  const totalCostEther = isFreeMint ? launchpadFee : (Number(priceEth) + Number(launchpadFee)).toString();
  const totalCostWei = ethers.parseEther(totalCostEther);

  const iface = new ethers.Interface(editionAbi.abi);
  const txData = iface.encodeFunctionData('collectBatch', [BigInt(quantity)]);

  const headers = {
    'Content-Type': 'application/json',
  };

  if (process.env.FARCASTER_HEADER && process.env.FARCASTER_PAYLOAD && process.env.FARCASTER_SIGNATURE) {
    headers[process.env.FARCASTER_HEADER] = process.env.FARCASTER_PAYLOAD;
    headers['X-Farcaster-Signature'] = process.env.FARCASTER_SIGNATURE;
  }

  return new NextResponse(
    JSON.stringify({
      chainId: 'eip155:8453',
      method: 'eth_sendTransaction',
      params: {
        to: contractAddress,
        data: txData,
        value: totalCostWei.toString(),
      },
    }),
    {
      status: 200,
      headers,
    }
  );
}
import { NextResponse } from 'next/server';
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

const DEFAULT_CONTRACT_ADDRESS = '0x7f19732c1ad9c25e604e3649638c1486f53e5c35';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const contractAddress = (body.contract || DEFAULT_CONTRACT_ADDRESS).toLowerCase();

  if (!ethers.isAddress(contractAddress)) {
    return new NextResponse('Invalid contract address', { status: 400 });
  }

  const queryResult = await client.query({
    query: TOKEN_QUERY,
    variables: { id: contractAddress },
  }).catch(err => {
    console.error('GraphQL Error:', err);
    return { data: null };
  });

  const quantity = 1;
  const priceEth = queryResult.data?.edition?.priceEth || '0';
  const isFreeMint = queryResult.data?.edition?.isFreeMint || false;
  const launchpadFee = '0.0004';
  const totalCostEther = isFreeMint ? launchpadFee : (Number(priceEth) + Number(launchpadFee)).toString();
  const totalCostWei = ethers.parseEther(totalCostEther);

  const iface = new ethers.Interface(editionAbi.abi);
  const txData = iface.encodeFunctionData('collectBatch', [BigInt(quantity)]);

  const headers: { [key: string]: string } = {
    'Content-Type': 'application/json',
  };

  // Remove Farcaster headers unless explicitly required by MiniKit/Warpcast
  /*
  if (process.env.FARCASTER_HEADER && process.env.FARCASTER_PAYLOAD && process.env.FARCASTER_SIGNATURE) {
    headers[process.env.FARCASTER_HEADER] = process.env.FARCASTER_PAYLOAD;
    headers['X-Farcaster-Signature'] = process.env.FARCASTER_SIGNATURE;
  }
  */

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
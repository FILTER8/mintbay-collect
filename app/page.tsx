// File: app/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount, useReadContracts } from 'wagmi';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { Transaction, TransactionButton } from '@coinbase/onchainkit/transaction';
import { ethers } from 'ethers';
import {
  useMiniKit,
  useAddFrame,
  useOpenUrl,
} from '@coinbase/onchainkit/minikit';
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from '@coinbase/onchainkit/identity';
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet';
import { Button, Icon, Home, Features } from './components/DemoComponents';
import editionAbi from './contracts/MintbayEdition.json';
import client from './lib/apollo';

const TOKEN_QUERY = gql`
  query TokenPageQuery($id: ID!) {
    edition(id: $id) {
      id
      address: id
      name
      totalSupply
      editionSize
      price
      priceEth
      isFreeMint
      whitelistedContracts {
        id
        whitelistedEdition {
          id
          address: id
        }
      }
      tokens(where: { tokenId: 1 }, first: 1) {
        id
        tokenId
        tokenURI
      }
    }
  }
`;

export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const contractAddress = searchParams.get('contract')?.toLowerCase();
  const { address: walletAddress } = useAccount();
  const [imageUrl, setImageUrl] = useState('https://mintbay-collect.vercel.app/placeholder-nft.png');

  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();

  const isValidAddress = contractAddress && ethers.isAddress(contractAddress);

  const { data, loading, error: graphError } = useQuery(TOKEN_QUERY, {
    variables: { id: contractAddress },
    skip: !isValidAddress,
    client,
  });

  const edition = data?.edition;

  const contractConfig = {
    address: contractAddress as `0x${string}`,
    abi: editionAbi.abi,
    chainId: 8453,
  };

  const { data: contractData, isLoading: contractLoading } = useReadContracts({
    contracts: [
      { ...contractConfig, functionName: 'isFreeMint' },
      { ...contractConfig, functionName: 'paused' },
      { ...contractConfig, functionName: 'maxMintPerAddress' },
      { ...contractConfig, functionName: 'mintCount', args: [walletAddress] },
    ],
    query: { enabled: !!isValidAddress && !!walletAddress },
  });

  const [isFreeMint, isPaused, maxMintPerAddress, mintCount] = contractData || [];

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  useEffect(() => {
    if (edition?.tokens?.[0]?.tokenURI) {
      const tokenURI = edition.tokens[0].tokenURI;
      if (tokenURI.startsWith('data:application/json;base64,')) {
        try {
          const metadata = JSON.parse(atob(tokenURI.split(',')[1]));
          if (metadata.image) {
            setImageUrl(metadata.image);
          }
        } catch (err) {
          console.error('Failed to parse tokenURI:', err);
        }
      }
    }
  }, [edition]);

  const handleAddFrame = async () => {
    const frameAdded = await addFrame();
    setFrameAdded(Boolean(frameAdded));
  };

  const saveFrameButton = context && !context.client.added ? (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleAddFrame}
      className="text-[var(--app-accent)] p-4"
      icon={<Icon name="plus" size="sm" />}
    >
      Save Frame
    </Button>
  ) : frameAdded ? (
    <div className="flex items-center space-x-1 text-sm font-medium text-[#0052FF] animate-fade-out">
      <Icon name="check" size="sm" className="text-[#0052FF]" />
      <span>Saved</span>
    </div>
  ) : null;

  const priceEth = edition?.priceEth || '0';
  const totalSupply = Number(edition?.totalSupply || 0);
  const editionSize = Number(edition?.editionSize || 9);
  const isSoldOut = totalSupply >= editionSize;
  const maxMintAllowed = maxMintPerAddress?.result
    ? Number(maxMintPerAddress.result) - (mintCount?.result ? Number(mintCount.result) : 0)
    : Infinity;
  const isMaxMintReached = maxMintAllowed <= 0;
  const hasWhitelist = edition?.whitelistedContracts?.length > 0;
  const isWhitelisted = !hasWhitelist;
  const canCollect = !isSoldOut && !isPaused?.result && !isMaxMintReached && isWhitelisted;
  const launchpadFee = '0.0004';
  const totalCost = isFreeMint?.result ? '0' : Number(priceEth).toFixed(4);

  const transactionCalls = isValidAddress && canCollect ? [
    {
      to: contractAddress as `0x${string}`,
      data: new ethers.Interface(editionAbi.abi).encodeFunctionData('collectBatch', [BigInt(1)]) as `0x${string}`,
      value: ethers.parseEther(isFreeMint?.result ? launchpadFee : (Number(priceEth) + Number(launchpadFee)).toString()),
    },
  ] : [];

  if (isValidAddress && (loading || contractLoading)) {
    return <div className="text-center p-4 mini-app-theme">Loading...</div>;
  }

  if (isValidAddress && graphError) {
    return <div className="text-center p-4 mini-app-theme">Error: {graphError.message}</div>;
  }

  if (isValidAddress && !edition) {
    return <div className="text-center p-4 mini-app-theme">Edition not found</div>;
  }

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        <header className="flex justify-between items-center mb-3 h-11">
          <div>
            <Wallet className="z-10">
              <ConnectWallet>
                <Name className="text-inherit" />
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address />
                  <EthBalance />
                </Identity>
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>
          </div>
          <div>{saveFrameButton}</div>
        </header>

        <main className="flex-1">
          {isValidAddress ? (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold mb-4 text-center">{edition?.name || 'NFT'}</h2>
              <img src={imageUrl} alt="NFT" className="w-72 h-72 object-cover mx-auto mb-4" />
              <div className="text-sm space-y-2 text-center">
                <p><strong>Price:</strong> {totalCost} ETH</p>
                <p><strong>Fee:</strong> {launchpadFee} ETH</p>
                <p><strong>Supply:</strong> {totalSupply}/{editionSize}</p>
                <p><strong>Whitelist:</strong> {isWhitelisted ? 'Eligible' : 'Not whitelisted'}</p>
              </div>
              {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
              <div className="mt-4 flex flex-col items-center gap-4">
                <Transaction
                  chainId={8453}
                  calls={transactionCalls}
                  capabilities={{
                    paymasterService: { url: '' },
                  }}
                  onError={(err) => setError(`Transaction failed: ${err.message}` meats/undefined/null
                  onSuccess={() => setError(null)}
                >
                  <TransactionButton
                    disabled={!canCollect || !walletAddress}
                    className={`w-full ${canCollect && walletAddress ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-400 text-gray-700 cursor-not-allowed'} py-2 px-4 rounded`}
                    text={`Collect (${totalCost} ETH)`}
                  />
                </Transaction>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'home' && <Home setActiveTab={setActiveTab} />}
              {activeTab === 'features' && <Features setActiveTab={setActiveTab} />}
            </>
          )}
        </main>

        <footer className="mt-2 pt-4 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--ock-text-foreground-muted)] text-xs"
            onClick={() => openUrl('https://base.org/builders/minikit')}
          >
            Built on Base with MiniKit
          </Button>
        </footer>
      </div>
    </div>
  );
}
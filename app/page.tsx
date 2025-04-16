"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery, gql } from "@apollo/client";
import {
  useMiniKit,
  useAddFrame,
  useOpenUrl,
} from "@coinbase/onchainkit/minikit";
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { Button, Icon } from "./components/DemoComponents";
import { useReadContract, useContractReads } from "wagmi";
import TokenCard from "./components/TokenCard";
import factoryAbi from "./contracts/MintbayEditionFactory.json";
import editionAbi from "./contracts/MintbayEdition.json";
import client from "./lib/apollo";

const FACTORY_ADDRESS = "0xd304E2932840185ed6634f593c103eA58367d848";

const EDITIONS_QUERY = gql`
  query Editions($first: Int!, $skip: Int!) {
    editions(first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc, where: { removed: false }) {
      id
      name
      editionSize
      price
      isFreeMint
      LAUNCHPAD_FEE
      createdAt
      nextTokenId
      totalSupply
      tokens(where: { tokenId: 1 }, first: 1) {
        id
        tokenId
        tokenURI
      }
    }
  }
`;

interface Edition {
  id: string;
  name: string;
  editionSize: string;
  price: string;
  isFreeMint: boolean;
  LAUNCHPAD_FEE: string;
  createdAt: string;
  nextTokenId: string;
  totalSupply: string;
  tokens: {
    id: string;
    tokenId: string;
    tokenURI: string | null;
  }[];
  imageSrc?: string;
  tokenURI?: string | null;
}

export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);
  const [scale, setScale] = useState<1 | 2 | 3>(2);
  const [page, setPage] = useState(0);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();

  const ITEMS_PER_PAGE = 12;

  const { data: graphData, loading, fetchMore } = useQuery(EDITIONS_QUERY, {
    variables: { first: ITEMS_PER_PAGE, skip: 0 },
    client,
  });

  // Fetch all editions from the factory contract
  const { data: allEditionsFromContract } = useReadContract({
    address: FACTORY_ADDRESS as `0x${string}`,
    abi: factoryAbi.abi,
    functionName: "getAllEditions",
    chainId: 8453, // Base Mainnet
    cacheTime: 600_000,
  });

  const normalizedEditions = useMemo(() => {
    return Array.isArray(allEditionsFromContract)
      ? allEditionsFromContract.map((addr: string) => addr.toLowerCase())
      : [];
  }, [allEditionsFromContract]);

  const editionContracts = useMemo(
    () =>
      normalizedEditions.map((address) => ({
        address: address as `0x${string}`,
        abi: editionAbi.abi,
        chainId: 8453, // Base Mainnet
      })),
    [normalizedEditions]
  );

  const { data: contractData } = useContractReads({
    contracts: editionContracts.flatMap((contract) => [
      { ...contract, functionName: "totalSupply" },
      { ...contract, functionName: "nextTokenId" },
      { ...contract, functionName: "price" },
      { ...contract, functionName: "isFreeMint" },
    ]),
    watch: true,
    cacheTime: 30000,
    staleTime: 30000,
  });

  const supplyMap = useMemo(() => {
    const map = new Map<string, { totalSupply: number; nextTokenId: number; price: string; isFreeMint: boolean }>();
    if (contractData) {
      for (let i = 0; i < normalizedEditions.length; i++) {
        const totalSupply = contractData[i * 4]?.result;
        const nextTokenId = contractData[i * 4 + 1]?.result;
        const price = contractData[i * 4 + 2]?.result;
        const isFreeMint = contractData[i * 4 + 3]?.result;
        if (totalSupply !== undefined && nextTokenId !== undefined && price !== undefined && isFreeMint !== undefined) {
          map.set(normalizedEditions[i], {
            totalSupply: Number(totalSupply),
            nextTokenId: Number(nextTokenId),
            price: price.toString(),
            isFreeMint,
          });
        }
      }
    }
    return map;
  }, [contractData, normalizedEditions]);

  // Process editions and image sources
  useEffect(() => {
    if (graphData?.editions) {
      const newEditions = graphData.editions.map((edition: Edition) => {
        const supplyData = supplyMap.get(edition.id) || {
          totalSupply: 0,
          nextTokenId: 0,
          price: "0",
          isFreeMint: false,
        };
        const token = edition.tokens[0] || {};
        return {
          ...edition,
          name: edition.name || "Unknown",
          editionSize: edition.editionSize || "0",
          price: edition.price || supplyData.price || "0",
          isFreeMint: edition.isFreeMint ?? supplyData.isFreeMint ?? false,
          LAUNCHPAD_FEE: edition.LAUNCHPAD_FEE || "0",
          nextTokenId: supplyData.nextTokenId || edition.nextTokenId || "0",
          totalSupply: supplyData.totalSupply || Number(edition.totalSupply) || 0,
          createdAt: Number(edition.createdAt) || 0,
          tokens: Array.isArray(edition.tokens)
            ? edition.tokens.map((token) => ({
                ...token,
                tokenId: Number(token.tokenId) || 0,
                tokenURI: token.tokenURI || null,
              }))
            : [],
          tokenURI: token.tokenURI || null,
        };
      });
      setEditions((prev) => [...prev, ...newEditions]);
      setHasMore(graphData.editions.length === ITEMS_PER_PAGE);
    }
  }, [graphData, supplyMap]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const mainElement = document.querySelector("main");
    if (
      mainElement &&
      mainElement.scrollHeight - mainElement.scrollTop <= mainElement.clientHeight + 100 &&
      hasMore &&
      !loading
    ) {
      setPage((prev) => prev + 1);
      fetchMore({
        variables: { first: ITEMS_PER_PAGE, skip: (page + 1) * ITEMS_PER_PAGE },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;
          return {
            ...prev,
            editions: [...prev.editions, ...fetchMoreResult.editions],
          };
        },
      });
    }
  }, [fetchMore, hasMore, loading, page]);

  useEffect(() => {
    const mainElement = document.querySelector("main");
    if (mainElement) {
      mainElement.addEventListener("scroll", handleScroll);
      return () => mainElement.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    if (!isFrameReady) {
      try {
        setFrameReady();
        console.log("MiniKit frame set to ready");
      } catch (err) {
        console.error("MiniKit setFrameReady error:", err);
      }
    }
  }, [setFrameReady, isFrameReady]);

  const handleAddFrame = async () => {
    try {
      const frameAdded = await addFrame();
      setFrameAdded(Boolean(frameAdded));
    } catch (err) {
      console.error("Add frame error:", err);
    }
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

  return (
    <div
      className="flex flex-col font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]"
      style={{ width: "375px", maxHeight: "600px", margin: "0 auto" }}
    >
      <header className="flex justify-between items-center px-4 py-3 h-11 shrink-0">
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

      <main className="flex-1 overflow-y-auto px-4">
        <section>
          <div className="flex justify-end mb-4">
            <div className="flex space-x-2">
              <button
                onClick={() => setScale(1)}
                className={`w-4 h-4 mt-3 ${scale === 1 ? "bg-black" : "bg-gray-300"} hover:bg-gray-400`}
                title="Small (72px)"
              />
              <button
                onClick={() => setScale(2)}
                className={`w-5 h-5 mt-2 ${scale === 2 ? "bg-black" : "bg-gray-300"} hover:bg-gray-400`}
                title="Medium (144px)"
              />
              <button
                onClick={() => setScale(3)}
                className={`w-6 h-6 mt-1 ${scale === 3 ? "bg-black" : "bg-gray-300"} hover:bg-gray-400`}
                title="Large (216px)"
              />
            </div>
          </div>
          <hr className="border-t-8 border-gray-900 mb-4 mt-2" />
          {loading && editions.length === 0 ? (
            <div className="text-center p-4">Loading...</div>
          ) : editions.length === 0 ? (
            <p className="text-sm text-gray-500">No editions created yet</p>
          ) : (
            <div className={scale === 1 ? "flex justify-center" : ""}>
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns:
                    scale === 1
                      ? "repeat(2, minmax(104px, 1fr))"
                      : `repeat(auto-fill, minmax(${scale === 2 ? 176 : 248}px, 1fr))`,
                  justifyItems: scale === 2 || scale === 3 ? "center" : "start",
                }}
              >
                {editions.map((edition) => (
                  <TokenCard
                    key={edition.id}
                    edition={edition}
                    address={edition.id}
                    scale={scale}
                    imageSrc={edition.imageSrc}
                    tokenURI={edition.tokenURI}
                  />
                ))}
              </div>
            </div>
          )}
          {loading && editions.length > 0 && (
            <div className="text-center p-4">Loading more...</div>
          )}
        </section>
      </main>

      <footer className="px-4 py-3 shrink-0 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--ock-text-foreground-muted)] text-xs"
          onClick={() => openUrl("https://base.org/builders/minikit")}
        >
          Built on Base with MiniKit
        </Button>
      </footer>
    </div>
  );
}
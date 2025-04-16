import { useState, useMemo, Suspense, useCallback, useEffect } from 'react';
import { useReadContract, useContractReads } from 'wagmi';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import Head from 'next/head';
import TokenCard from '../components/TokenCard';
import SalesCard from '../components/SalesCard';
import factoryAbi from '../contracts/MintbayEditionFactory.json';
import editionAbi from '../contracts/MintbayEdition.json';
import { processTokenURI } from '../components/NFTImage';

const FACTORY_ADDRESS = '0xd304E2932840185ed6634f593c103eA58367d848';

const INITIAL_EDITIONS_QUERY = gql`
  query InitialEditions {
    editions(first: 12, orderBy: createdAt, orderDirection: desc, where: { removed: false }) {
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
    stats(id: "global-stats") {
      editionsCount
    }
  }
`;

const ALL_EDITIONS_QUERY = gql`
  query AllEditions {
    editions(orderBy: createdAt, orderDirection: desc, where: { removed: false }) {
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
    stats(id: "global-stats") {
      editionsCount
    }
  }
`;

const INITIAL_SALES_QUERY = gql`
  query InitialSales {
    sales(orderBy: timestamp, orderDirection: desc, first: 12) {
      id
      edition {
        id
        name
        editionSize
        price
        isFreeMint
        LAUNCHPAD_FEE
      }
      quantity
      price
      totalCost
      tokenId
      timestamp
      isMint
      from
      to
      tokenURI
    }
    stats(id: "global-stats") {
      salesCount
    }
  }
`;

const ALL_SALES_QUERY = gql`
  query AllSales {
    sales(orderBy: timestamp, orderDirection: desc) {
      id
      edition {
        id
        name
        editionSize
        price
        isFreeMint
        LAUNCHPAD_FEE
      }
      quantity
      price
      totalCost
      tokenId
      timestamp
      isMint
      from
      to
      tokenURI
    }
    stats(id: "global-stats") {
      salesCount
    }
  }
`;

interface Sale {
  id: string;
  editionAddress: string;
  editionName: string;
  tokenId: number;
  saleType: 'mint' | 'secondary';
  price: string;
  editionSize: number;
  isFreeMint: boolean;
  timestamp: number;
  imageSrc?: string;
  tokenURI?: string | null;
}

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

export async function getServerSideProps() {
  try {
    const apolloClient = initializeApollo();
    const [{ data: initialGraphData }, { data: initialSalesData }] = await Promise.all([
      apolloClient.query({
        query: INITIAL_EDITIONS_QUERY,
        fetchPolicy: 'network-only',
      }),
      apolloClient.query({
        query: INITIAL_SALES_QUERY,
        fetchPolicy: 'network-only',
      }),
    ]);

    // Process images for editions
    const editionImageData = await Promise.all(
      initialGraphData.editions.map(async (edition: any) => {
        const token = edition.tokens[0];
        const imageSrc = token?.tokenURI ? await processTokenURI(token.tokenURI) : null;
        return { address: edition.id, tokenId: token?.tokenId || 1, imageSrc };
      })
    );

    // Process images for sales
    const salesImageData = await Promise.all(
      initialSalesData.sales.map(async (sale: any) => {
        const imageSrc = sale.tokenURI ? await processTokenURI(sale.tokenURI) : null;
        return { address: sale.edition.id, tokenId: sale.tokenId, imageSrc };
      })
    );

    return {
      props: {
        initialEditions: initialGraphData.editions.map((e: any) => e.id.toLowerCase()),
        initialGraphData,
        initialSalesData,
        initialImageData: editionImageData.filter((d) => d.imageSrc),
        initialSalesImageData: salesImageData.filter((d) => d.imageSrc),
      },
    };
  } catch (error) {
    console.error('getServerSideProps error:', error);
    return {
      props: {
        initialEditions: [],
        initialGraphData: null,
        initialSalesData: null,
        initialImageData: [],
        initialSalesImageData: [],
      },
    };
  }
}

function LoadingScreen({ onLoaded }: { onLoaded: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onLoaded();
    }, 100);
    return () => clearTimeout(timer);
  }, [onLoaded]);

  return (
    <div className="fixed inset-0 bg-gray-100 flex items-center justify-center z-50 animate-fade-out">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-t-4 border-gray-900 border-solid rounded-full animate-spin" />
        <p className="mt-4 text-lg font-mono text-gray-900">Loading...</p>
      </div>
    </div>
  );
}

export default function StartPage({
  initialEditions = [],
  initialGraphData,
  initialSalesData,
  initialImageData = [],
  initialSalesImageData = [],
}) {
  const [mintsDisplayLimit, setMintsDisplayLimit] = useState(12);
  const [salesDisplayLimit, setSalesDisplayLimit] = useState(12);
  const [scale, setScale] = useState<1 | 2 | 3 | 4>(2);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (initialGraphData && initialSalesData) {
      setTimeout(() => setIsLoading(false), 100);
    }
  }, [initialGraphData, initialSalesData]);

  const { data: allEditionsFromContract } = useReadContract({
    address: FACTORY_ADDRESS as `0x${string}`,
    abi: factoryAbi.abi,
    functionName: 'getAllEditions',
    chainId: 84532,
    enabled: initialEditions.length === 0,
    cacheTime: 600_000,
  });

  const normalizedEditions = useMemo(() => {
    const editions = Array.isArray(allEditionsFromContract)
      ? allEditionsFromContract.map((addr: string) => addr.toLowerCase())
      : initialEditions;
    return editions;
  }, [allEditionsFromContract, initialEditions]);

  const editionContracts = useMemo(
    () =>
      normalizedEditions.map((address) => ({
        address: address as `0x${string}`,
        abi: editionAbi.abi,
        chainId: 84532,
      })),
    [normalizedEditions]
  );

  const { data: contractData } = useContractReads({
    contracts: editionContracts.flatMap((contract) => [
      { ...contract, functionName: 'totalSupply' },
      { ...contract, functionName: 'nextTokenId' },
      { ...contract, functionName: 'price' },
      { ...contract, functionName: 'isFreeMint' },
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

  const { data: allGraphData } = useQuery(ALL_EDITIONS_QUERY, {
    skip: !!initialGraphData,
    fetchPolicy: 'cache-and-network',
  });

  const { data: allSalesData } = useQuery(ALL_SALES_QUERY, {
    skip: !!initialSalesData,
    fetchPolicy: 'cache-and-network',
  });

  const sortedEditions = useMemo(() => {
    const data = allGraphData?.editions || initialGraphData?.editions || [];
    if (!data.length) {
      console.log('No editions found in GraphQL data');
      return [];
    }
    const imageCache = new Map<string, string>();
    initialImageData.forEach((img: any) => imageCache.set(img.address, img.imageSrc));

    return data
      .map((edition: Edition) => {
        const supplyData = supplyMap.get(edition.id) || {
          totalSupply: 0,
          nextTokenId: 0,
          price: '0',
          isFreeMint: false,
        };
        const imageSrc = imageCache.get(edition.id);
        const token = edition.tokens[0] || {};
        return {
          ...edition,
          name: edition.name || 'Unknown',
          editionSize: edition.editionSize || '0',
          price: edition.price || supplyData.price || '0',
          isFreeMint: edition.isFreeMint ?? supplyData.isFreeMint ?? false,
          LAUNCHPAD_FEE: edition.LAUNCHPAD_FEE || '0',
          nextTokenId: supplyData.nextTokenId || edition.nextTokenId || '0',
          totalSupply: supplyData.totalSupply || Number(edition.totalSupply) || 0,
          createdAt: Number(edition.createdAt) || 0,
          tokens: Array.isArray(edition.tokens)
            ? edition.tokens.map((token) => ({
                ...token,
                tokenId: Number(token.tokenId) || 0,
                tokenURI: token.tokenURI || null,
              }))
            : [],
          imageSrc,
          tokenURI: token.tokenURI || null,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [allGraphData?.editions, initialGraphData?.editions, supplyMap, initialImageData]);

  const totalEditions = useMemo(() => sortedEditions.length, [sortedEditions]);

  const allSales = useMemo(() => {
    const data = allSalesData?.sales || initialSalesData?.sales || [];
    return data
      .filter((sale: any) => sale.tokenId)
      .map((sale: any) => {
        const imageSrc = initialSalesImageData.find(
          (img: any) => img.address === sale.edition.id && img.tokenId === Number(sale.tokenId)
        )?.imageSrc;
        return {
          id: sale.id,
          editionAddress: sale.edition.id,
          editionName: sale.edition.name || 'Unknown',
          tokenId: Number(sale.tokenId) || 0,
          saleType: sale.isMint ? 'mint' : 'secondary',
          price: sale.isMint ? (sale.edition.isFreeMint ? '0' : sale.price || '0') : sale.price || '0',
          editionSize: Number(sale.edition.editionSize) || 0,
          isFreeMint: sale.edition.isFreeMint ?? false,
          timestamp: Number(sale.timestamp) || 0,
          imageSrc,
          tokenURI: sale.tokenURI || null,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [allSalesData?.sales, initialSalesData?.sales, initialSalesImageData]);

  const totalSales = useMemo(
    () =>
      allSalesData?.stats?.salesCount
        ? Number(allSalesData.stats.salesCount)
        : initialSalesData?.stats?.salesCount
        ? Number(initialSalesData.stats.salesCount)
        : allSales.length,
    [allSalesData, initialSalesData, allSales.length]
  );

  const handleLoadMoreMints = useCallback(() => setMintsDisplayLimit((prev) => prev + 12), []);
  const handleLoadMoreSales = useCallback(() => setSalesDisplayLimit((prev) => prev + 12), []);

  if (isLoading) {
    return <LoadingScreen onLoaded={() => setIsLoading(false)} />;
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8 font-mono">
      <Head>
        {sortedEditions.slice(0, 12).map((edition) => (
          edition.imageSrc && (
            <link
              key={`edition-${edition.id}`}
              rel="preload"
              href={edition.imageSrc}
              as="image"
              crossOrigin="anonymous"
            />
          )
        ))}
        {allSales.slice(0, 12).map((sale) => (
          sale.imageSrc && (
            <link
              key={`sale-${sale.id}`}
              rel="preload"
              href={sale.imageSrc}
              as="image"
              crossOrigin="anonymous"
            />
          )
        ))}
      </Head>
      <div className="max-w-7xl mx-auto">
        <section>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-bold">Latest Editions ({totalEditions})</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setScale(1)}
                className={`w-4 h-4 mt-3 ${scale === 1 ? 'bg-black' : 'bg-gray-300'} hover:bg-gray-400`}
                title="Small (72px)"
              />
              <button
                onClick={() => setScale(2)}
                className={`w-5 h-5 mt-2 ${scale === 2 ? 'bg-black' : 'bg-gray-300'} hover:bg-gray-400`}
                title="Medium (144px)"
              />
              <button
                onClick={() => setScale(3)}
                className={`w-6 h-6 mt-1 ${scale === 3 ? 'bg-black' : 'bg-gray-300'} hover:bg-gray-400`}
                title="Large (216px)"
              />
              <button
                onClick={() => setScale(4)}
                className={`w-7 h-7 ${scale === 4 ? 'bg-black' : 'bg-gray-300'} hover:bg-gray-400`}
                title="X-Large (288px)"
              />
            </div>
          </div>
          <hr className="border-t-8 border-gray-900 mb-10 mt-4" />
          {sortedEditions.length === 0 ? (
            <p className="text-sm text-gray-500">No editions created yet</p>
          ) : (
            <>
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(${
                    scale === 1 ? 104 : scale === 2 ? 176 : scale === 3 ? 248 : 320
                  }px, 1fr))`,
                }}
              >
                {sortedEditions.slice(0, mintsDisplayLimit).map((edition) => (
                  <Suspense
                    key={edition.id}
                    fallback={
                      <div
                        style={{
                          width: `${72 * scale + 32}px`,
                          height: `${72 * scale + (scale > 1 ? 56 : 32)}px`,
                        }}
                      />
                    }
                  >
                    <TokenCard
                      edition={edition}
                      address={edition.id}
                      scale={scale}
                      imageSrc={edition.imageSrc}
                      tokenURI={edition.tokenURI}
                    />
                  </Suspense>
                ))}
              </div>
              {sortedEditions.length > mintsDisplayLimit && (
                <button
                  onClick={handleLoadMoreMints}
                  className="text-xs mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4"
                >
                  Load More
                </button>
              )}
            </>
          )}
        </section>

        <section className="mt-28">
          <h2 className="text-xl font-bold mb-4">Latest Sales ({totalSales})</h2>
          <hr className="border-t-8 border-gray-900 mb-10 mt-4" />
          {allSales.length === 0 ? (
            <p className="text-sm text-gray-500">No sales yet</p>
          ) : (
            <>
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(${
                    scale === 1 ? 104 : scale === 2 ? 176 : scale === 3 ? 248 : 320
                  }px, 1fr))`,
                }}
              >
                {allSales.slice(0, salesDisplayLimit).map((sale) => (
                  <Suspense
                    key={`${sale.id}-${sale.tokenId}`}
                    fallback={
                      <div
                        style={{
                          width: `${72 * scale + 32}px`,
                          height: `${72 * scale + (scale > 1 ? 56 : 32)}px`,
                        }}
                      />
                    }
                  >
                    <SalesCard
                      sale={sale}
                      scale={scale}
                      imageSrc={sale.imageSrc}
                      tokenURI={sale.tokenURI}
                    />
                  </Suspense>
                ))}
              </div>
              {allSales.length > salesDisplayLimit && (
                <button
                  onClick={handleLoadMoreSales}
                  className="text-xs mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4"
                >
                  Load More
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function initializeApollo() {
  throw new Error('Apollo Client not implemented');
}
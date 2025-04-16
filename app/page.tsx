
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
import { useWriteContract, useAccount, useReadContracts } from "wagmi";
import { Abi } from "viem";
import { ethers } from "ethers";
import Image from "next/image";
import client from "./lib/apollo";
import { Button, Icon } from "./components/DemoComponents";
import editionAbi from "./contracts/MintbayEdition.json";
import { useRouter } from "next/navigation";

interface WhitelistContract {
  id: string;
  whitelistedEdition: {
    id: string;
    address: string;
    name: string;
    priceEth: string;
    isFreeMint: boolean;
    editionSize: string;
    totalSupply: string;
    tokens?: Array<{
      tokenURI?: string | null;
    }>;
  };
}

const TOKEN_QUERY = gql`
  query TokenPageQuery($id: ID!) {
    edition(id: $id) {
      id
      name
      totalSupply
      editionSize
      priceEth
      isFreeMint
      whitelistedContracts {
        id
        whitelistedEdition {
          id
          address: id
          name
          priceEth
          isFreeMint
          editionSize
          totalSupply
          tokens(where: { tokenId: 1 }, first: 1) {
            tokenURI
          }
        }
      }
      tokens(where: { tokenId: 1 }, first: 1) {
        tokenURI
      }
    }
  }
`;

const CONTRACT_ADDRESS = "0x7f19732c1ad9c25e604e3649638c1486f53e5c35";

export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasWhitelistToken, setHasWhitelistToken] = useState<boolean | null>(null);
  const [showWhitelistPopup, setShowWhitelistPopup] = useState(false);
  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();
  const { address: walletAddress, isConnected } = useAccount();
  const { writeContract, error: writeError } = useWriteContract();
  const router = useRouter();

  const { data, loading, error } = useQuery(TOKEN_QUERY, {
    variables: { id: CONTRACT_ADDRESS.toLowerCase() },
    client,
  });

  const provider = useMemo(() => {
    return new ethers.JsonRpcProvider(
      `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
    );
  }, []);

  const edition = data?.edition;
  const minted = edition?.totalSupply ? Number(edition.totalSupply) : 0;
  const editionSize = edition?.editionSize ? Number(edition.editionSize) : Infinity;
  const remainingTokens = Math.max(0, editionSize - minted);
  const isSoldOut = minted >= editionSize;
  const priceEth = edition?.priceEth || "0";
  const isFreeMint = edition?.isFreeMint || false;
  const launchpadFee = "0.0004";
  const whitelistContracts = useMemo<WhitelistContract[]>(() => edition?.whitelistedContracts || [], [edition]);

  const contractConfig = { address: CONTRACT_ADDRESS as `0x${string}`, abi: editionAbi.abi as Abi };
  const whitelistContractConfigs = useMemo(() => {
    return whitelistContracts.map((wc: WhitelistContract) => ({
      address: wc.whitelistedEdition.address as `0x${string}`,
      abi: editionAbi.abi as Abi,
    }));
  }, [whitelistContracts]);

  const { data: contractData, isLoading: contractLoading } = useReadContracts({
    contracts: [
      {
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: editionAbi.abi as Abi,
        functionName: "maxMintPerAddress",
      },
      {
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: editionAbi.abi as Abi,
        functionName: "mintCount",
        args: walletAddress ? [walletAddress] : undefined,
      },
      ...whitelistContractConfigs.map((config) => ({
        address: config.address,
        abi: config.abi,
        functionName: "totalSupply",
      })),
    ],
    query: { enabled: !!walletAddress && whitelistContracts.length > 0, staleTime: 300_000 },
  });

  const [maxMintPerAddressData, mintCountData, ...whitelistTotalSupplyData] = contractData || [];

  const maxMintPerAddress = maxMintPerAddressData?.result;
  const mintCount = mintCountData?.result;
  const maxMintAllowed = maxMintPerAddress
    ? Math.max(0, Number(maxMintPerAddress) - (mintCount ? Number(mintCount) : 0))
    : Infinity;
  const isMaxMintReached = maxMintAllowed === 0;

  const whitelistContractInfo = useMemo(() => {
    return whitelistContracts.map((wc: WhitelistContract, index: number) => ({
      address: wc.whitelistedEdition.address,
      name: wc.whitelistedEdition.name,
      priceEth: wc.whitelistedEdition.priceEth || "0",
      isFreeMint: wc.whitelistedEdition.isFreeMint || false,
      totalSupply: whitelistTotalSupplyData[index]?.result
        ? Number(whitelistTotalSupplyData[index].result)
        : Number(wc.whitelistedEdition.totalSupply) || 0,
      editionSize: Number(wc.whitelistedEdition.editionSize) || Infinity,
      tokenURI: wc.whitelistedEdition.tokens?.[0]?.tokenURI || null,
    }));
  }, [whitelistContracts, whitelistTotalSupplyData]);

  const checkWhitelistToken = useCallback(async () => {
    if (!walletAddress || !whitelistContracts.length) {
      setHasWhitelistToken(false);
      return;
    }
    try {
      const balanceChecks = whitelistContracts.map(async (contractInfo) => {
        const whitelistContract = new ethers.Contract(
          contractInfo.whitelistedEdition.address,
          ["function balanceOf(address) view returns (uint256)"],
          provider
        );
        const balance = await whitelistContract.balanceOf(walletAddress);
        return Number(balance) > 0;
      });
      const results = await Promise.all(balanceChecks);
      const isWhitelisted = results.some((hasToken) => hasToken);
      setHasWhitelistToken(isWhitelisted);
    } catch (error) {
      console.error("Error checking token ownership:", error);
      setHasWhitelistToken(false);
      setErrorMessage("Failed to verify whitelist status. Please try again.");
    }
  }, [walletAddress, whitelistContracts, provider]);

  useEffect(() => {
    checkWhitelistToken();
  }, [checkWhitelistToken]);

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

  useEffect(() => {
    if (data?.edition?.tokens?.[0]?.tokenURI) {
      const tokenURI = data.edition.tokens[0].tokenURI;
      if (tokenURI.startsWith("data:application/json;base64,")) {
        try {
          const metadata = JSON.parse(atob(tokenURI.split(",")[1]));
          if (metadata.image) {
            setImageUrl(metadata.image);
          }
        } catch (err) {
          console.error("Failed to parse tokenURI:", err);
        }
      }
    }
  }, [data]);

  useEffect(() => {
    if (writeError) {
      setErrorMessage(`Transactionarm failed: ${writeError.message}`);
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [writeError]);

  const canCollect = useMemo(() => {
    if (!isConnected) return true; // Allow button to prompt wallet connection
    const isPublicMint = !whitelistContracts.length;
    return (isPublicMint ? true : hasWhitelistToken) && !isMaxMintReached && !isSoldOut;
  }, [isConnected, whitelistContracts, hasWhitelistToken, isMaxMintReached, isSoldOut]);

  const totalCost = useMemo(() => {
    const baseCost = isFreeMint ? 0 : Number(priceEth);
    return baseCost.toFixed(4).replace(/\.?0+$/, "");
  }, [isFreeMint, priceEth]);

  const editionCountDisplay = useMemo(() => {
    return `${minted}/${editionSize === Infinity ? "∞" : editionSize}`;
  }, [minted, editionSize]);

  const handleCollect = useCallback(async () => {
    if (!isConnected) {
      setErrorMessage("Please connect your wallet!");
      return;
    }

    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, editionAbi.abi, provider);

      const isPaused = await contract.paused();
      if (isPaused) {
        setErrorMessage("Minting is paused for this edition.");
        return;
      }

      if (remainingTokens < 1 && remainingTokens !== Infinity) {
        setErrorMessage("No tokens remain!");
        return;
      }

      const currentMintCount = await contract.mintCount(walletAddress);
      const maxPerAddress = await contract.maxMintPerAddress();
      const allowed = maxPerAddress ? Number(maxPerAddress) - Number(currentMintCount) : Infinity;
      if (allowed < 1) {
        setErrorMessage("You have reached the maximum mint limit for this wallet.");
        return;
      }

      const baseCostEther = isFreeMint ? "0" : priceEth;
      const feeCostEther = launchpadFee;
      const baseCostWei = ethers.parseEther(baseCostEther);
      const feeCostWei = ethers.parseEther(feeCostEther);
      const totalValueWei = (BigInt(baseCostWei) + BigInt(feeCostWei)).toString();

      writeContract(
        {
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: editionAbi.abi,
          functionName: "collectBatch",
          args: [BigInt(1)],
          value: BigInt(totalValueWei),
        },
        {
          onError: (error) => {
            let message = "Transaction failed!";
            if (error.message.includes("NotWhitelisted")) {
              message = "You need a token from a whitelisted contract to mint!";
            } else if (error.message.includes("InsufficientPayment")) {
              message = "Insufficient ETH sent for minting!";
            }
            setErrorMessage(message);
            console.error("Collect Error:", error);
          },
          onSuccess: () => {
            setErrorMessage(null);
            console.log("Mint successful!");
          },
        }
      );
    } catch (error) {
      setErrorMessage("Failed to validate mint conditions. Please try again.");
      console.error("Collect Validation Error:", error);
    }
  }, [isConnected, priceEth, isFreeMint, provider, writeContract, walletAddress, remainingTokens]);

  const handleCollectWhitelistToken = useCallback(
    async (contractAddress: string, priceEth: string, isFreeMint: boolean) => {
      if (!isConnected) {
        setErrorMessage("Please connect your wallet!");
        return;
      }

      try {
        const contract = new ethers.Contract(contractAddress, editionAbi.abi, provider);

        const isPaused = await contract.paused();
        if (isPaused) {
          setErrorMessage("Minting is paused for this whitelist contract.");
          return;
        }

        const totalSupply = Number(await contract.totalSupply());
        const editionSize = Number(await contract.editionSize());
        if (totalSupply >= editionSize) {
          setErrorMessage("This whitelist contract is sold out!");
          return;
        }

        const baseCostEther = isFreeMint ? "0" : priceEth;
        const feeCostEther = launchpadFee;
        const baseCostWei = ethers.parseEther(baseCostEther);
        const feeCostWei = ethers.parseEther(feeCostEther);
        const totalValueWei = (BigInt(baseCostWei) + BigInt(feeCostWei)).toString();

        writeContract(
          {
            address: contractAddress as `0x${string}`,
            abi: editionAbi.abi,
            functionName: "collectBatch",
            args: [BigInt(1)],
            value: BigInt(totalValueWei),
          },
          {
            onError: (error) => {
              let message = "Transaction failed!";
              if (error.message.includes("InsufficientPayment")) {
                message = "Insufficient ETH sent for minting!";
              }
              setErrorMessage(message);
              console.error("Whitelist Collect Error:", error);
            },
            onSuccess: () => {
              setErrorMessage(null);
              console.log("Whitelist mint successful!");
              setShowWhitelistPopup(false);
              checkWhitelistToken();
              router.reload();
            },
          }
        );
      } catch (error) {
        setErrorMessage("Failed to validate whitelist mint conditions. Please try again.");
        console.error("Whitelist Collect Validation Error:", error);
      }
    },
    [isConnected, writeContract, provider, checkWhitelistToken, router]
  );

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
          {loading ? (
            <div className="text-center p-4">Loading...</div>
          ) : error ? (
            <div className="text-center p-4 text-red-500">Error: {error.message}</div>
          ) : imageUrl ? (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-center mb-4">
                <h1 className="text-2xl font-bold">{edition?.name || "NFT Edition"}</h1>
              </div>
              <Image
                src={imageUrl}
                alt="NFT"
                width={288}
                height={288}
                className="object-cover mx-auto mb-4"
              />
              <div className="text-center mb-4">
                <p className="text-lg font-medium text-gray-700">{editionCountDisplay}</p>
              </div>
              {isSoldOut ? (
                <button
                  className="w-full bg-gray-300 text-gray-700 py-2 px-4 text-sm rounded"
                  disabled
                >
                  Sold Out
                </button>
              ) : isMaxMintReached ? (
                <button
                  className="w-full bg-gray-300 text-gray-700 py-2 px-4 text-sm rounded"
                  disabled
                >
                  Max Mint Reached
                </button>
              ) : (
                <div className="flex flex-col items-center space-y-2">
                  {isConnected && !hasWhitelistToken && whitelistContracts.length > 0 ? (
                    <>
                      <p className="text-xs text-red-500">
                        Requires token from whitelisted contract
                      </p>
                      <button
                        onClick={() => setShowWhitelistPopup(true)}
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 text-sm rounded"
                      >
                        Get Whitelist Token
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleCollect}
                      className={`w-full py-2 px-4 text-sm text-white rounded ${
                        isFreeMint
                          ? "bg-green-500 hover:bg-green-600"
                          : "bg-blue-500 hover:bg-blue-600"
                      } ${!canCollect ? "bg-gray-400 cursor-not-allowed" : ""}`}
                      disabled={!canCollect}
                    >
                      {isFreeMint
                        ? `Free (${totalCost} ETH)`
                        : `Collect (${totalCost} ETH)`}
                    </button>
                  )}
                  <div className="text-xs text-gray-500 flex items-center space-x-1">
                    <span>+ {launchpadFee} ETH fee</span>
                    <span className="relative group">
                      ⓘ
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-white text-xs p-2 rounded w-48">
                        Mintbay charges a small fee for each token minted to run our service.
                      </span>
                    </span>
                  </div>
                </div>
              )}
              {errorMessage && (
                <div className="mt-2 text-center text-red-500 text-xs">
                  {errorMessage}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-4">No image available</div>
          )}
          {showWhitelistPopup && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowWhitelistPopup(false)}
            >
              <div
                className="bg-white p-6 rounded-lg shadow-xl w-[95vw] max-w-xl max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Get Whitelist Token</h3>
                  <button
                    onClick={() => setShowWhitelistPopup(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>
                {contractLoading && whitelistContractInfo.length === 0 ? (
                  <p className="text-sm text-gray-500">Loading whitelist contracts...</p>
                ) : whitelistContractInfo.length === 0 ? (
                  <p className="text-sm text-gray-500">No whitelist contracts available</p>
                ) : (
                  <div className="space-y-6">
                    {whitelistContractInfo.map((contract) => (
                      <div
                        key={contract.address}
                        className="flex flex-col items-center gap-4 border-b border-gray-200 pb-4"
                      >
                        <div className="w-54 h-54">
                          <Image
                            src={
                              contract.tokenURI && contract.tokenURI.startsWith("data:application/json;base64,")
                                ? JSON.parse(atob(contract.tokenURI.split(",")[1])).image
                                : "/placeholder.png"
                            }
                            alt={contract.name}
                            width={216}
                            height={216}
                            className="border border-gray-200 rounded"
                          />
                        </div>
                        <hr className="w-full border-t border-gray-200" />
                        <a
                          href={`/token/${contract.address}`}
                          className="text-blue-500 hover:underline text-sm"
                        >
                          {contract.name}
                        </a>
                        <div className="text-center">
                          <p className="text-xs text-gray-500">
                            {contract.totalSupply !== undefined && contract.editionSize !== undefined
                              ? `${contract.totalSupply}/${contract.editionSize === Infinity ? "∞" : contract.editionSize}`
                              : contractLoading
                              ? "Loading..."
                              : "0/∞"}
                          </p>
                          <button
                            onClick={() =>
                              handleCollectWhitelistToken(
                                contract.address,
                                contract.priceEth,
                                contract.isFreeMint
                              )
                            }
                            className={`mt-2 text-sm py-2 px-4 rounded ${
                              contract.totalSupply >= contract.editionSize
                                ? "bg-gray-300 cursor-not-allowed"
                                : contract.isFreeMint
                                ? "bg-green-500 hover:bg-green-600 text-white"
                                : "bg-blue-500 hover:bg-blue-600 text-white"
                            }`}
                            disabled={contract.totalSupply >= contract.editionSize}
                          >
                            {contract.isFreeMint
                              ? `Free (${contract.priceEth} ETH)`
                              : `Collect (${contract.priceEth} ETH)`}
                          </button>
                          <div className="text-xs text-gray-500 flex items-center justify-center gap-1 mt-2">
                            <span>+ {launchpadFee} ETH fee</span>
                            <span className="relative group">
                              ⓘ
                              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-white text-xs p-2 rounded w-48">
                                Mintbay charges a small fee for each token minted to run our service.
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <footer className="mt-2 pt-4 flex justify-center">
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
    </div>
  );
}
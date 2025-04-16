"use client";

import { useEffect, useState } from "react";
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
import client from "./lib/apollo";
import Image from "next/image";

const TOKEN_QUERY = gql`
  query TokenPageQuery($id: ID!) {
    edition(id: $id) {
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
  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();

  const { data, loading, error } = useQuery(TOKEN_QUERY, {
    variables: { id: CONTRACT_ADDRESS.toLowerCase() },
    client,
  });

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
              <Image
                src={imageUrl}
                alt="NFT"
                width={288}
                height={288}
                className="object-cover mx-auto mb-4"
              />
            </div>
          ) : null}
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
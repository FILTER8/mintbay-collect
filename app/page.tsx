"use client";

import { useEffect, useState } from "react";
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
import Image from "next/image";

export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);
  const [imageUrl, setImageUrl] = useState("https://mintbay-collect.vercel.app/placeholder-nft.png");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();

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
    async function fetchAndConvertImage() {
      try {
        const response = await fetch('/api/generate-png');
        const result = await response.json();
        if (result.error) {
          throw new Error(result.error);
        }

        const svgDataUri = result.svgDataUri;
        if (!svgDataUri) {
          throw new Error('No SVG data returned');
        }

        // Convert SVG to PNG client-side
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 600;
          canvas.height = 600;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, 600, 600);

          const pngUrl = canvas.toDataURL('image/png');
          setImageUrl(pngUrl);
          setLoading(false);
          console.log('PNG generated:', pngUrl);
        };
        img.onerror = () => {
          throw new Error('Failed to load SVG');
        };
        img.src = svgDataUri;
      } catch (err) {
        console.error('Failed to generate PNG:', err);
        setError('Failed to load token image');
        setLoading(false);
      }
    }

    fetchAndConvertImage();
  }, []);

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
            <div className="text-center p-4 text-red-500">Error: {error}</div>
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <Image
                src={imageUrl}
                alt="NFT"
                width={288}
                height={288}
                className="object-cover mx-auto mb-4"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://mintbay-collect.vercel.app/placeholder-nft.png";
                }}
              />
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
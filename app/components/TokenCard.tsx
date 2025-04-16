import React, { useMemo } from 'react';
import Link from 'next/link';
import NFTImage from './NFTImage';
import { ethers } from 'ethers';

interface Edition {
  id: string;
  name: string;
  totalSupply: number;
  editionSize: number;
  price: string;
  priceEth?: string;
  isFreeMint: boolean;
  imageSrc?: string;
  tokenURI?: string | null;
}

interface TokenCardProps {
  edition: Edition;
  address: string;
  scale: 1 | 2 | 3;
  imageSrc?: string;
  tokenURI?: string | null;
}

const formatPrice = (price: string, isFreeMint: boolean, isSoldOut: boolean): JSX.Element | string => {
  if (isSoldOut) return <span className="text-red-500">Sold Out</span>;
  if (isFreeMint) return <span className="text-green-500">Free</span>;
  // Check if price is in ETH (contains decimal) or Wei (integer)
  const isEthFormat = /\d*\.\d+/.test(price);
  if (isEthFormat) {
    // Trim trailing zeros after decimal
    return price.replace(/(\.0+|(?<=\.\d+)0+)$/, '');
  }
  // Assume Wei, convert to ETH
  const eth = ethers.formatEther(BigInt(price || '0'));
  return eth.replace(/(\.0+|(?<=\.\d+)0+)$/, '');
};

function TokenCard({ edition, address, scale, imageSrc, tokenURI }: TokenCardProps) {
  const baseSize = scale * 72;
  const minted = Math.min(edition.totalSupply, edition.editionSize);
  const isSoldOut = minted >= edition.editionSize;

  const displayPrice = useMemo(
    () => formatPrice(edition.priceEth || edition.price, edition.isFreeMint, isSoldOut),
    [edition.priceEth, edition.price, edition.isFreeMint, isSoldOut]
  );

  return (
    <Link
      href={`/token/${address}`}
      className="border bg-white shadow hover:shadow-lg flex flex-col justify-between no-underline p-4"
      style={{ width: `${baseSize + 32}px`, height: `${baseSize + (scale > 1 ? 56 : 32)}px` }}
    >
      <div className="flex items-center justify-center mx-auto" style={{ width: `${baseSize}px`, height: `${baseSize}px` }}>
        <NFTImage address={address} tokenId={1} scale={scale} imageSrc={imageSrc} tokenURI={tokenURI} />
      </div>
      {scale > 1 && (
        <div className="flex justify-between items-center mt-2 w-full text-xs text-gray-700 font-mono">
          <span className="truncate w-1/2">{minted}/{edition.editionSize}</span>
          <span className="truncate w-1/2 text-right">{displayPrice}</span>
        </div>
      )}
    </Link>
  );
}

export default React.memo(TokenCard, (prevProps, nextProps) =>
  prevProps.edition.id === nextProps.edition.id &&
  prevProps.address === nextProps.address &&
  prevProps.scale === nextProps.scale &&
  prevProps.imageSrc === nextProps.imageSrc &&
  prevProps.tokenURI === nextProps.tokenURI
);
import { useEffect, useState, useMemo, memo } from 'react';
import { useReadContract } from 'wagmi';
import localforage from 'localforage';
import Image from 'next/image';
import editionAbi from '../contracts/MintbayEdition.json';

interface NFTImageProps {
  address: string;
  tokenId: number;
  scale: 1 | 2 | 3;
  imageSrc?: string;
  tokenURI?: string | null;
  onImageLoad?: () => void;
}

localforage.config({ name: 'NFTImageCache' });

export const processTokenURI = async (uri: string): Promise<string | null> => {
  try {
    if (!uri.startsWith('data:application/json;base64,')) {
      console.error('Invalid tokenURI format:', uri);
      return null;
    }

    const base64Data = uri.split(',')[1];
    const metadata = JSON.parse(atob(base64Data));
    const imageSrc = metadata.image;

    if (!imageSrc || !imageSrc.startsWith('data:image/svg+xml;base64,')) {
      console.error('Invalid image format:', imageSrc);
      return null;
    }

    return imageSrc;
  } catch (err) {
    console.error('Failed to process URI:', uri, err);
    return null;
  }
};

const useNFTURI = (address: string, tokenId: number, skip: boolean) => {
  const shouldSkip = skip || !address || tokenId < 0;
  const { data, error } = useReadContract({
    address: address as `0x${string}`,
    abi: editionAbi.abi,
    functionName: 'tokenURI',
    args: [tokenId],
    query: {
      enabled: !shouldSkip,
    },
  });

  return useMemo(() => {
    if (shouldSkip || !data || error) return null;
    return typeof data === 'string' ? data : null;
  }, [data, error, shouldSkip]);
};

function NFTImage({ address, tokenId, scale, imageSrc, tokenURI, onImageLoad }: NFTImageProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(imageSrc ? 'success' : 'loading');
  const [fetchedImageSrc, setFetchedImageSrc] = useState<string | null>(imageSrc || null);
  const size = 72 * scale;
  const cacheKey = `${address}:${tokenId}:image`;

  // Check cache for image
  useEffect(() => {
    if (!imageSrc) {
      localforage.getItem<string | null>(cacheKey).then((cached) => {
        if (cached) {
          setFetchedImageSrc(cached);
          setStatus('success');
        }
      });
    }
  }, [address, tokenId, imageSrc, cacheKey]);

  // Fetch tokenURI from contract only if needed
  const contractURI = useNFTURI(address, tokenId, !!imageSrc || !!tokenURI);
  const primaryURI = tokenURI || contractURI;

  useEffect(() => {
    if (imageSrc || !primaryURI) {
      if (!imageSrc) setStatus('error');
      return;
    }

    const loadImage = async () => {
      const image = await processTokenURI(primaryURI);
      if (image) {
        setFetchedImageSrc(image);
        setStatus('success');
        await localforage.setItem(cacheKey, image);
      } else {
        setStatus('error');
      }
    };

    loadImage();
  }, [primaryURI, imageSrc, address, tokenId, cacheKey]);

  if (status === 'loading') {
    return <Placeholder size={size} text="Loading..." />;
  }

  if (fetchedImageSrc) {
    return (
      <div style={{ width: size, height: size }}>
        <Image
          src={fetchedImageSrc}
          alt={`NFT ${tokenId}`}
          width={size}
          height={size}
          loading="lazy"
          sizes={`(max-width: 768px) ${size}px, ${size * 2}px`}
          onLoad={onImageLoad}
          style={{
            objectFit: 'contain',
            imageRendering: 'pixelated',
          }}
        />
      </div>
    );
  }

  return (
    <Image
      src={process.env.NEXT_PUBLIC_SPLASH_IMAGE_URL || '/loading.png'}
      alt="Default NFT"
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
    />
  );
}

const Placeholder = ({ size, text }: { size: number; text: string }) => (
  <div
    className="bg-gray-100 flex items-center justify-center"
    style={{ width: size, height: size }}
  >
    <span className="text-gray-400 text-xs">{text}</span>
  </div>
);

export default memo(NFTImage, (prevProps, nextProps) =>
  prevProps.address === nextProps.address &&
  prevProps.tokenId === nextProps.tokenId &&
  prevProps.scale === nextProps.scale &&
  prevProps.imageSrc === nextProps.imageSrc &&
  prevProps.tokenURI === nextProps.tokenURI &&
  prevProps.onImageLoad === nextProps.onImageLoad
);
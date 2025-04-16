import { NextResponse } from 'next/server';
import { gql } from '@apollo/client';
import client from '../../lib/apollo';
import { createCanvas, loadImage } from 'canvas';

const TOKEN_QUERY = gql`
  query TokenPageQuery($id: ID!) {
    edition(id: $id) {
      tokens(where: { tokenId: 1 }, first: 1) {
        tokenURI
      }
    }
  }
`;

const CONTRACT_ADDRESS = '0x7f19732c1ad9c25e604e3649638c1486f53e5c35';

export async function GET() {
  try {
    console.log('Fetching tokenURI for contract:', CONTRACT_ADDRESS);
    const { data } = await client.query({
      query: TOKEN_QUERY,
      variables: { id: CONTRACT_ADDRESS.toLowerCase() },
    });
    console.log('GraphQL response:', data);

    const tokenURI = data?.edition?.tokens?.[0]?.tokenURI;
    if (!tokenURI || !tokenURI.startsWith('data:application/json;base64,')) {
      console.error('Invalid tokenURI:', tokenURI);
      return NextResponse.json({ error: 'Invalid tokenURI' }, { status: 400 });
    }

    const base64Data = tokenURI.split(',')[1];
    const metadataStr = atob(base64Data);
    const metadata = JSON.parse(metadataStr);
    console.log('Metadata:', metadata);

    if (!metadata.image || !metadata.image.startsWith('data:image/svg+xml;base64,')) {
      console.error('No SVG image found:', metadata.image);
      return NextResponse.json({ error: 'No SVG image found' }, { status: 400 });
    }

    const svgBase64 = metadata.image.split(',')[1];
    const svgContent = Buffer.from(svgBase64, 'base64');
    console.log('SVG Buffer Size:', svgContent.length);
    console.log('SVG Content Sample:', svgContent.toString('utf8').slice(0, 200));

    // Preprocess SVG to scale it
    let svgString = svgContent.toString('utf8');
    // Adjust width, height, and viewBox for high-resolution rendering
    svgString = svgString.replace(/width="[^"]*"/, 'width="1200"')
                        .replace(/height="[^"]*"/, 'height="1200"');
    if (!svgString.includes('viewBox')) {
      svgString = svgString.replace(/<svg/, '<svg viewBox="0 0 72 72"');
    }
    const svgContentModified = Buffer.from(svgString, 'utf8');

    const canvas = createCanvas(1200, 1200);
    const ctx = canvas.getContext('2d');

    // Optimize rendering
    ctx.imageSmoothingEnabled = true;

    console.log('Loading SVG image');
    const img = await loadImage(svgContentModified);
    ctx.drawImage(img, 0, 0, 1200, 1200);

    const buffer = canvas.toBuffer('image/png', { compressionLevel: 0 });
    console.log('PNG Buffer Size:', buffer.length);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline; filename="token.png"',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    console.error('Error generating PNG:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to generate PNG', details: errorMessage }, { status: 500 });
  }
}
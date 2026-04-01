import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse('tiktok-developers-site-verification=hPSmLS5D3VaWKXS6ucTZSe7M3Jbkm3IA', {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

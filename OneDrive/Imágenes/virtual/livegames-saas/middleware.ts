import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Interceptar solicitudes a archivos de verificación de TikTok
  if (pathname === '/tiktokHPSmLS5D3VaWKXS6ucTZSe7M3Jbkm3IA.txt') {
    return new NextResponse('tiktok-developers-site-verification=hPSmLS5D3VaWKXS6ucTZSe7M3Jbkm3IA', {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
  
  if (pathname === '/tiktokajJY76tTTIDA1isLHix7qoBpIKh2i7vT.txt') {
    return new NextResponse('tiktok-developers-site-verification=ajJY76tTTIDA1isLHix7qoBpIKh2i7vT', {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/tiktok*.txt',
};

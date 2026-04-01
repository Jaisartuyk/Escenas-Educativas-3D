import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Verificar qué archivo se está solicitando
  if (pathname.includes('tiktokHPSmLS5D3VaWKXS6ucTZSe7M3Jbkm3IA')) {
    return new NextResponse('tiktok-developers-site-verification=hPSmLS5D3VaWKXS6ucTZSe7M3Jbkm3IA', {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
  
  if (pathname.includes('tiktokajJY76tTTIDA1isLHix7qoBpIKh2i7vT')) {
    return new NextResponse('tiktok-developers-site-verification=ajJY76tTTIDA1isLHix7qoBpIKh2i7vT', {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
  
  return new NextResponse('Not found', { status: 404 });
}

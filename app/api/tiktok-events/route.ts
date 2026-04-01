import { NextRequest, NextResponse } from 'next/server';

// Este endpoint será usado para Server-Sent Events (SSE)
// Los clientes se conectarán aquí para recibir eventos en tiempo real

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  // Configurar Server-Sent Events
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Enviar un mensaje inicial
      const data = `data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`;
      controller.enqueue(encoder.encode(data));

      // Mantener la conexión abierta
      const interval = setInterval(() => {
        const heartbeat = `data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`;
        controller.enqueue(encoder.encode(heartbeat));
      }, 30000); // Heartbeat cada 30 segundos

      // Limpiar al cerrar
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { WebcastPushConnection } from 'tiktok-live-connector';

// Almacenar las conexiones activas y sus datos
const activeConnections = new Map<string, WebcastPushConnection>();
const sessionData = new Map<string, { likes: number; comments: number; viewers: number }>();

export async function POST(request: NextRequest) {
  try {
    const { action, username, sessionId } = await request.json();

    if (action === 'connect') {
      // Conectar a un live de TikTok
      if (!username) {
        return NextResponse.json({ error: 'Username is required' }, { status: 400 });
      }

      // Verificar si ya hay una conexión activa
      if (activeConnections.has(sessionId)) {
        return NextResponse.json({ 
          success: true, 
          message: 'Already connected',
          sessionId 
        });
      }

      const tiktokLiveConnection = new WebcastPushConnection(username, {
        processInitialData: false,
        enableExtendedGiftInfo: true,
      });

      // Inicializar datos de la sesión
      sessionData.set(sessionId, { likes: 0, comments: 0, viewers: 0 });

      // Escuchar eventos de likes
      tiktokLiveConnection.on('like', (data) => {
        const currentData = sessionData.get(sessionId);
        if (currentData) {
          currentData.likes += data.likeCount || 1;
          sessionData.set(sessionId, currentData);
          console.log(`[${sessionId}] +${data.likeCount || 1} likes. Total: ${currentData.likes}`);
        }
      });

      // Escuchar comentarios
      tiktokLiveConnection.on('chat', (data) => {
        const currentData = sessionData.get(sessionId);
        if (currentData) {
          currentData.comments += 1;
          sessionData.set(sessionId, currentData);
          console.log(`[${sessionId}] Comment from ${data.uniqueId}: ${data.comment}`);
        }
      });

      // Escuchar cuando alguien se une
      tiktokLiveConnection.on('member', (data) => {
        const currentData = sessionData.get(sessionId);
        if (currentData) {
          currentData.viewers += 1;
          sessionData.set(sessionId, currentData);
          console.log(`[${sessionId}] ${data.uniqueId} joined`);
        }
      });

      // Manejar errores
      tiktokLiveConnection.on('error', (err) => {
        console.error(`[${sessionId}] Error:`, err);
      });

      // Guardar la conexión
      activeConnections.set(sessionId, tiktokLiveConnection);

      // Conectar al live
      await tiktokLiveConnection.connect();

      console.log(`[${sessionId}] Connected to @${username}'s live`);

      return NextResponse.json({ 
        success: true, 
        message: `Connected to @${username}'s live`,
        sessionId,
        username
      });

    } else if (action === 'disconnect') {
      // Desconectar del live
      const connection = activeConnections.get(sessionId);
      if (connection) {
        connection.disconnect();
        activeConnections.delete(sessionId);
        sessionData.delete(sessionId);
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Disconnected' 
      });

    } else if (action === 'getData') {
      // Obtener datos de la sesión
      const data = sessionData.get(sessionId);
      return NextResponse.json({ 
        success: true, 
        data: data || { likes: 0, comments: 0, viewers: 0 }
      });

    } else if (action === 'status') {
      // Verificar estado de la conexión
      const connection = activeConnections.get(sessionId);
      const isConnected = connection ? true : false;

      return NextResponse.json({ 
        success: true, 
        connected: isConnected 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('TikTok Live API Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to connect to TikTok Live' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  const connection = activeConnections.get(sessionId);
  
  return NextResponse.json({ 
    connected: connection ? true : false,
    sessionId
  });
}

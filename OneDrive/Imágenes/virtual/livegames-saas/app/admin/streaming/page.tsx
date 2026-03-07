'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';

interface Stream {
  id: string;
  title: string;
  active: boolean;
  created_at: string;
  viewers_count: number;
}

export default function StreamingAdmin() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStream, setCurrentStream] = useState<Stream | null>(null);
  const [streamTitle, setStreamTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [viewersCount, setViewersCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, SimplePeer.Instance>>(new Map());

  useEffect(() => {
    // Verificar sesión
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    loadStreams();
  }, []);

  const loadStreams = async () => {
    const { data, error } = await supabase
      .from('streams')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setStreams(data);
    }
  };

  const createPeerConnection = (viewerId: string, stream: MediaStream) => {
    const peer = new SimplePeer({
      initiator: true,
      trickle: true,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (signal) => {
      // Enviar offer al viewer
      socketRef.current?.emit('offer', {
        roomId: currentStream?.id,
        offer: signal,
        viewerId
      });
    });

    peer.on('error', (err) => {
      console.error('Error en peer connection:', err);
      peersRef.current.delete(viewerId);
    });

    peer.on('close', () => {
      console.log('Peer connection cerrada:', viewerId);
      peersRef.current.delete(viewerId);
    });

    peersRef.current.set(viewerId, peer);
  };

  const startStreaming = async () => {
    if (!streamTitle.trim()) {
      alert('Por favor ingresa un título para la transmisión');
      return;
    }

    setLoading(true);

    try {
      // Solicitar permiso para compartir pantalla
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080 },
        audio: true
      });

      mediaStreamRef.current = stream;

      // Mostrar preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Crear transmisión en la base de datos
      const response = await fetch('/api/stream/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: streamTitle,
          userId: session?.user?.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setCurrentStream(data.stream);
        setIsStreaming(true);
        loadStreams();
        
        // Conectar a WebSocket
        const socket = io();
        socketRef.current = socket;

        // Unirse a la sala como streamer
        socket.emit('join-room', { roomId: data.stream.id, isStreamer: true });

        // Escuchar cuando un viewer se une
        socket.on('viewer-joined', ({ viewerId }: { viewerId: string }) => {
          console.log('Nuevo viewer:', viewerId);
          createPeerConnection(viewerId, stream);
        });

        // Recibir respuestas de viewers
        socket.on('answer', ({ answer, viewerId }: { answer: any; viewerId: string }) => {
          const peer = peersRef.current.get(viewerId);
          if (peer) {
            peer.signal(answer);
          }
        });

        // Recibir ICE candidates
        socket.on('ice-candidate', ({ candidate, senderId }: { candidate: any; senderId: string }) => {
          const peer = peersRef.current.get(senderId);
          if (peer) {
            peer.signal(candidate);
          }
        });

        // Actualizar conteo de viewers
        socket.on('viewer-count', (count: number) => {
          setViewersCount(count);
        });
        
        // Detectar cuando el usuario deja de compartir
        stream.getVideoTracks()[0].onended = () => {
          stopStreaming();
        };
      }
    } catch (error) {
      console.error('Error starting stream:', error);
      alert('Error al iniciar transmisión. Asegúrate de dar permisos para compartir pantalla.');
    } finally {
      setLoading(false);
    }
  };

  const stopStreaming = async () => {
    // Cerrar todas las conexiones peer
    peersRef.current.forEach((peer) => {
      peer.destroy();
    });
    peersRef.current.clear();

    // Desconectar WebSocket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Detener media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Desactivar transmisión en la base de datos
    if (currentStream) {
      await fetch(`/api/stream/${currentStream.id}`, {
        method: 'DELETE'
      });
    }

    setIsStreaming(false);
    setCurrentStream(null);
    setStreamTitle('');
    setViewersCount(0);
    loadStreams();
  };

  const copyWatchUrl = (streamId: string) => {
    const url = `${window.location.origin}/watch/${streamId}`;
    navigator.clipboard.writeText(url);
    alert('¡URL copiada al portapapeles!');
  };

  const deactivateStream = async (streamId: string) => {
    if (confirm('¿Desactivar esta transmisión?')) {
      await fetch(`/api/stream/${streamId}`, {
        method: 'DELETE'
      });
      loadStreams();
    }
  };

  if (!session) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Debes iniciar sesión para acceder al panel de streaming</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px' }}>
          📺 Panel de Streaming
        </h1>
        <p style={{ color: '#666', fontSize: '16px' }}>
          Crea transmisiones con URLs temporales
        </p>
      </div>

      {/* Crear nueva transmisión */}
      {!isStreaming ? (
        <div style={{
          background: 'white',
          padding: '30px',
          borderRadius: '15px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '30px'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
            Nueva Transmisión
          </h2>
          
          <input
            type="text"
            value={streamTitle}
            onChange={(e) => setStreamTitle(e.target.value)}
            placeholder="Título de la transmisión (ej: Barcelona vs Real Madrid)"
            style={{
              width: '100%',
              padding: '12px 20px',
              border: '2px solid #e0e0e0',
              borderRadius: '10px',
              fontSize: '16px',
              marginBottom: '15px',
              outline: 'none'
            }}
          />

          <button
            onClick={startStreaming}
            disabled={loading}
            style={{
              padding: '12px 30px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '⏳ Iniciando...' : '🎥 Iniciar Transmisión'}
          </button>
        </div>
      ) : (
        <div style={{
          background: 'white',
          padding: '30px',
          borderRadius: '15px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '30px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#22c55e', margin: 0 }}>
              🔴 Transmitiendo en vivo
            </h2>
            <div style={{
              background: '#22c55e',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 700
            }}>
              👥 {viewersCount} {viewersCount === 1 ? 'espectador' : 'espectadores'}
            </div>
          </div>

          {/* Preview */}
          <video
            ref={videoRef}
            autoPlay
            muted
            style={{
              width: '100%',
              maxHeight: '400px',
              borderRadius: '10px',
              background: '#000',
              marginBottom: '20px'
            }}
          />

          {/* URL para compartir */}
          <div style={{
            background: '#f5f5f5',
            padding: '15px',
            borderRadius: '10px',
            marginBottom: '15px'
          }}>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px', fontWeight: 600 }}>
              URL para compartir:
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={`${window.location.origin}/watch/${currentStream?.id}`}
                readOnly
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={() => copyWatchUrl(currentStream!.id)}
                style={{
                  padding: '10px 20px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                📋 Copiar
              </button>
            </div>
          </div>

          <button
            onClick={stopStreaming}
            style={{
              padding: '12px 30px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ⏹️ Detener Transmisión
          </button>
        </div>
      )}

      {/* Lista de transmisiones */}
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '15px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
          📋 Historial de Transmisiones
        </h2>

        {streams.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
            No hay transmisiones aún
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {streams.map((stream) => (
              <div
                key={stream.id}
                style={{
                  padding: '15px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '5px' }}>
                    {stream.title}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#999' }}>
                    {stream.active ? '🔴 Activa' : '⚫ Finalizada'} • 
                    Código: {stream.id} • 
                    {new Date(stream.created_at).toLocaleString('es-ES')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {stream.active && (
                    <>
                      <button
                        onClick={() => copyWatchUrl(stream.id)}
                        style={{
                          padding: '8px 16px',
                          background: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        📋 Copiar URL
                      </button>
                      <button
                        onClick={() => deactivateStream(stream.id)}
                        style={{
                          padding: '8px 16px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        ⏹️ Desactivar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

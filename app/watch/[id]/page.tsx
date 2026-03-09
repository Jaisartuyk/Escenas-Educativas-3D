'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';

interface Stream {
  id: string;
  title: string;
  active: boolean;
  created_at: string;
}

export default function WatchStream() {
  const params = useParams();
  const streamId = params.id as string;

  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const streamerIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadStream();

    return () => {
      // Cleanup on unmount
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [streamId]);

  const loadStream = async () => {
    try {
      const response = await fetch(`/api/stream/${streamId}`);
      const data = await response.json();

      if (data.error) {
        setError('Transmisión no encontrada');
        setLoading(false);
        return;
      }

      if (!data.stream.active) {
        setError('Esta transmisión ha finalizado');
        setLoading(false);
        return;
      }

      setStream(data.stream);
      setLoading(false);

      // Connect to WebSocket
      const socketUrl = process.env.NEXT_PUBLIC_RAILWAY_URL || window.location.origin;
      const socket = io(socketUrl);
      socketRef.current = socket;

      // Join room as viewer
      socket.emit('join-room', { roomId: streamId, isStreamer: false });

      // Receive signals from streamer (offers and ICE candidates)
      socket.on('offer', ({ offer, streamerId }: { offer: any; streamerId: string }) => {
        console.log('Received signal from streamer, type:', offer.type || 'candidate');

        if (!peerRef.current) {
          // First signal — create peer connection and process it
          console.log('Creating new peer connection');
          streamerIdRef.current = streamerId;
          createPeerConnection(offer, streamerId);
        } else {
          // Subsequent signals (ICE candidates) — feed to existing peer
          console.log('Feeding signal to existing peer');
          try {
            peerRef.current.signal(offer);
          } catch (err) {
            console.error('Error signaling to peer:', err);
          }
        }
      });

      // Streamer disconnected
      socket.on('streamer-disconnected', () => {
        setError('El streamer ha finalizado la transmisión');
        if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
        }
      });

      // If streamer is already ready (we joined late), request a connection
      socket.on('streamer-ready', () => {
        console.log('Streamer is ready, waiting for offer...');
      });

    } catch (err) {
      setError('Error al cargar la transmisión');
      setLoading(false);
    }
  };

  const createPeerConnection = (initialSignal: any, streamerId: string) => {
    const peer = new SimplePeer({
      initiator: false,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      }
    });

    peer.on('signal', (signal) => {
      console.log('Viewer sending signal type:', signal.type || 'candidate');
      socketRef.current?.emit('answer', {
        roomId: streamId,
        answer: signal,
        streamerId
      });
    });

    peer.on('stream', (remoteStream) => {
      console.log('Remote stream received! Tracks:', remoteStream.getTracks().length);
      remoteStream.getTracks().forEach(t => console.log('  Track:', t.kind, t.readyState, t.enabled));
      if (videoRef.current) {
        videoRef.current.srcObject = remoteStream;
        videoRef.current.play().then(() => {
          console.log('Video playing!');
          setIsConnected(true);
        }).catch((err) => {
          console.log('Play failed, trying muted:', err);
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().then(() => {
              setIsConnected(true);
            }).catch(e => console.error('Even muted play failed:', e));
          }
        });
      }
    });

    peer.on('connect', () => {
      console.log('Peer connection established!');
      setIsConnected(true);
    });

    peer.on('error', (err) => {
      console.error('Error en peer connection:', err);
      setError('Error al conectar con el streamer. Intenta recargar la página.');
    });

    peer.on('close', () => {
      console.log('Peer connection closed');
      setError('La transmisión ha finalizado');
      peerRef.current = null;
    });

    // Process the initial signal (the offer)
    peer.signal(initialSignal);
    peerRef.current = peer;
  };

  if (loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ fontSize: '48px' }}>⏳</div>
        <div style={{
          fontSize: '24px',
          fontWeight: 800,
          color: '#fff',
          fontFamily: "'Bebas Neue', sans-serif"
        }}>
          CARGANDO TRANSMISIÓN...
        </div>
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '30px',
        padding: '40px'
      }}>
        <div style={{ fontSize: '120px' }}>📺</div>
        <div style={{
          fontSize: '48px',
          fontWeight: 800,
          color: '#fff',
          fontFamily: "'Bebas Neue', sans-serif",
          textAlign: 'center',
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text' as any
        }}>
          {error || 'TRANSMISIÓN NO DISPONIBLE'}
        </div>
        <div style={{
          fontSize: '20px',
          color: 'rgba(255,255,255,0.6)',
          fontWeight: 600,
          textAlign: 'center',
          maxWidth: '600px'
        }}>
          Esta transmisión ha finalizado o el código es incorrecto.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 30px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          🔄 Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Video */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          onLoadedMetadata={(e) => {
            const vid = e.currentTarget;
            vid.play().catch(() => console.log('Autoplay blocked'));
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />

        {/* Unmute button */}
        {isConnected && isMuted && (
          <button
            onClick={() => {
              setIsMuted(false);
              if (videoRef.current) videoRef.current.muted = false;
            }}
            style={{
              position: 'absolute',
              bottom: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              fontSize: '18px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 30px rgba(102, 126, 234, 0.5)',
              animation: 'pulse 2s ease-in-out infinite',
              zIndex: 10
            }}
          >
            🔊 Activar Audio
          </button>
        )}

        {/* Waiting message */}
        {!isConnected && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: 'white',
            background: 'rgba(0,0,0,0.8)',
            padding: '40px',
            borderRadius: '20px'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px', animation: 'pulse 2s ease-in-out infinite' }}>📡</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>
              Conectando a la transmisión...
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginTop: '10px' }}>
              Esperando señal del streamer
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.95), rgba(118, 75, 162, 0.95))',
        padding: '20px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ fontSize: '40px' }}>⚽</div>
          <div>
            <div style={{
              fontSize: '24px',
              fontWeight: 800,
              color: '#fff',
              fontFamily: "'Bebas Neue', sans-serif",
              lineHeight: 1
            }}>
              {stream.title}
            </div>
            <div style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.8)',
              marginTop: '5px'
            }}>
              {isConnected ? '🔴 EN VIVO' : '⏳ Conectando...'}
            </div>
          </div>
        </div>

        <div style={{
          background: isConnected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.2)',
          padding: '10px 20px',
          borderRadius: '50px',
          fontSize: '14px',
          fontWeight: 700,
          color: '#fff',
          backdropFilter: 'blur(10px)',
          border: isConnected ? '2px solid rgba(34, 197, 94, 0.5)' : '2px solid rgba(255,255,255,0.3)'
        }}>
          {isConnected ? '✅ CONECTADO' : '📡 CONECTANDO...'}
        </div>
      </div>
    </div>
  );
}

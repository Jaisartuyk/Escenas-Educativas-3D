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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);

  useEffect(() => {
    loadStream();
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

      // Conectar a WebSocket
      const socketUrl = process.env.NEXT_PUBLIC_RAILWAY_URL || window.location.origin;
      const socket = io(socketUrl);
      socketRef.current = socket;

      // Unirse a la sala como viewer
      socket.emit('join-room', { roomId: streamId, isStreamer: false });

      // Esperar offer del streamer
      socket.on('offer', ({ offer, streamerId }: { offer: any; streamerId: string }) => {
        console.log('Recibida offer del streamer');
        createPeerConnection(offer, streamerId);
      });

      // Recibir ICE candidates
      socket.on('ice-candidate', ({ candidate }: { candidate: any }) => {
        if (peerRef.current) {
          peerRef.current.signal(candidate);
        }
      });

      // Streamer desconectado
      socket.on('streamer-disconnected', () => {
        setError('El streamer ha finalizado la transmisión');
        if (peerRef.current) {
          peerRef.current.destroy();
        }
      });

    } catch (err) {
      setError('Error al cargar la transmisión');
      setLoading(false);
    }
  };

  const createPeerConnection = (offer: any, streamerId: string) => {
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
      // Enviar answer al streamer
      socketRef.current?.emit('answer', {
        roomId: streamId,
        answer: signal,
        streamerId
      });
    });

    peer.on('stream', (remoteStream) => {
      console.log('Stream recibido!');
      if (videoRef.current) {
        videoRef.current.srcObject = remoteStream;
        setIsConnected(true);
      }
    });

    peer.on('error', (err) => {
      console.error('Error en peer connection:', err);
      setError('Error al conectar con el streamer');
    });

    peer.on('close', () => {
      console.log('Conexión cerrada');
      setError('La transmisión ha finalizado');
    });

    // Procesar la offer
    peer.signal(offer);
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
          backgroundClip: 'text'
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
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />

        {/* Mensaje de espera */}
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
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>📡</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>
              Conectando a la transmisión...
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginTop: '10px' }}>
              Esperando señal del streamer
            </div>
          </div>
        )}
      </div>

      {/* Barra inferior */}
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
              🔴 EN VIVO
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.2)',
          padding: '10px 20px',
          borderRadius: '50px',
          fontSize: '14px',
          fontWeight: 700,
          color: '#fff',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(255,255,255,0.3)'
        }}>
          📺 TRANSMISIÓN PRIVADA
        </div>
      </div>
    </div>
  );
}

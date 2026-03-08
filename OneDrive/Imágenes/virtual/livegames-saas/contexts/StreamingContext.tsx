'use client';

import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';

interface Stream {
  id: string;
  title: string;
  active: boolean;
  created_at: string;
  viewers_count: number;
}

interface StreamingContextType {
  isStreaming: boolean;
  currentStream: Stream | null;
  viewersCount: number;
  mediaStream: MediaStream | null;
  startStreaming: (title: string, userId: string) => Promise<void>;
  stopStreaming: () => Promise<void>;
}

const StreamingContext = createContext<StreamingContextType | undefined>(undefined);

export function StreamingProvider({ children }: { children: ReactNode }) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStream, setCurrentStream] = useState<Stream | null>(null);
  const [viewersCount, setViewersCount] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, SimplePeer.Instance>>(new Map());

  const createPeerConnection = (viewerId: string, stream: MediaStream) => {
    const peer = new SimplePeer({
      initiator: true,
      trickle: true,
      stream: stream,
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

  const startStreaming = async (title: string, userId: string) => {
    try {
      // Solicitar permiso para compartir pantalla
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080 },
        audio: true
      });

      setMediaStream(stream);

      // Crear transmisión en la base de datos
      const response = await fetch('/api/stream/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, userId })
      });

      const data = await response.json();

      if (data.success) {
        setCurrentStream(data.stream);
        setIsStreaming(true);

        // Conectar a WebSocket
        const socketUrl = process.env.NEXT_PUBLIC_RAILWAY_URL || window.location.origin;
        const socket = io(socketUrl);
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
      throw error;
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
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }

    // Desactivar transmisión en la base de datos
    if (currentStream) {
      await fetch(`/api/stream/${currentStream.id}`, {
        method: 'DELETE'
      });
    }

    setIsStreaming(false);
    setCurrentStream(null);
    setViewersCount(0);
  };

  return (
    <StreamingContext.Provider
      value={{
        isStreaming,
        currentStream,
        viewersCount,
        mediaStream,
        startStreaming,
        stopStreaming
      }}
    >
      {children}
    </StreamingContext.Provider>
  );
}

export function useStreaming() {
  const context = useContext(StreamingContext);
  if (context === undefined) {
    throw new Error('useStreaming must be used within a StreamingProvider');
  }
  return context;
}

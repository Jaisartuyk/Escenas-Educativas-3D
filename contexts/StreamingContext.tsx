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
  // Use a ref to store the current roomId so closures always have the latest value
  const roomIdRef = useRef<string | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const createPeerConnection = (viewerId: string, stream: MediaStream) => {
    // Destroy existing peer for this viewer if any
    const existingPeer = peersRef.current.get(viewerId);
    if (existingPeer) {
      existingPeer.destroy();
      peersRef.current.delete(viewerId);
    }

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
      // Use roomIdRef instead of currentStream (fixes stale closure bug)
      const roomId = roomIdRef.current;
      if (!roomId) {
        console.error('No roomId available for signaling');
        return;
      }
      console.log('Streamer sending signal type:', signal.type || 'candidate', 'to viewer:', viewerId);
      socketRef.current?.emit('offer', {
        roomId,
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

    peer.on('connect', () => {
      console.log('Peer connection established with viewer:', viewerId);
    });

    peersRef.current.set(viewerId, peer);
  };

  const startStreaming = async (title: string, userId: string) => {
    try {
      // Request screen share permission
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080 },
        audio: true
      });

      setMediaStream(stream);
      mediaStreamRef.current = stream;

      // Create stream in database
      const response = await fetch('/api/stream/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, userId })
      });

      const data = await response.json();

      if (data.success) {
        const streamData = data.stream;
        // Store roomId in ref BEFORE setting up socket events
        roomIdRef.current = streamData.id;

        setCurrentStream(streamData);
        setIsStreaming(true);

        // Connect to WebSocket
        const socketUrl = process.env.NEXT_PUBLIC_RAILWAY_URL || window.location.origin;
        const socket = io(socketUrl);
        socketRef.current = socket;

        // Join room as streamer
        socket.emit('join-room', { roomId: streamData.id, isStreamer: true });

        // Listen for new viewers
        socket.on('viewer-joined', ({ viewerId }: { viewerId: string }) => {
          console.log('New viewer joined:', viewerId);
          // Use mediaStreamRef to always get the current stream
          if (mediaStreamRef.current) {
            createPeerConnection(viewerId, mediaStreamRef.current);
          }
        });

        // Receive answers from viewers
        socket.on('answer', ({ answer, viewerId }: { answer: any; viewerId: string }) => {
          console.log('Received answer from viewer:', viewerId);
          const peer = peersRef.current.get(viewerId);
          if (peer) {
            peer.signal(answer);
          }
        });

        // Receive ICE candidates
        socket.on('ice-candidate', ({ candidate, senderId }: { candidate: any; senderId: string }) => {
          console.log('Received ICE candidate from:', senderId);
          const peer = peersRef.current.get(senderId);
          if (peer) {
            peer.signal(candidate);
          }
        });

        // Update viewer count
        socket.on('viewer-count', (count: number) => {
          setViewersCount(count);
        });

        // Detect when user stops sharing
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
    // Close all peer connections
    peersRef.current.forEach((peer) => {
      peer.destroy();
    });
    peersRef.current.clear();

    // Disconnect WebSocket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Stop media stream
    const stream = mediaStreamRef.current || mediaStream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
      mediaStreamRef.current = null;
    }

    // Deactivate stream in database
    const roomId = roomIdRef.current;
    if (roomId) {
      await fetch(`/api/stream/${roomId}`, {
        method: 'DELETE'
      });
    }

    roomIdRef.current = null;
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

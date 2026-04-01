'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import DailyIframe from '@daily-co/daily-js';

interface Stream {
  id: string;
  title: string;
  active: boolean;
  daily_room_url: string;
}

export default function WatchDailyStream() {
  const params = useParams();
  const streamId = params.id as string;
  
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);

  useEffect(() => {
    loadStream();
    
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
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

      if (!data.stream.daily_room_url) {
        setError('URL de transmisión no disponible');
        setLoading(false);
        return;
      }

      setStream(data.stream);
      setLoading(false);

      // Iniciar Daily.co
      if (containerRef.current && data.stream.daily_room_url) {
        callFrameRef.current = DailyIframe.createFrame(containerRef.current, {
          showLeaveButton: false,
          showFullscreenButton: true,
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: 'none'
          }
        });

        await callFrameRef.current.join({
          url: data.stream.daily_room_url,
          showLeaveButton: false,
          userName: 'Viewer',
          startVideoOff: true,
          startAudioOff: true
        });
      }
    } catch (err) {
      setError('Error al cargar la transmisión');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>⏳</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>
            Cargando transmisión...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          fontSize: '80px',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          {error || 'TRANSMISIÓN NO DISPONIBLE'}
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
      flexDirection: 'column'
    }}>
      {/* Video container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative'
        }}
      />

      {/* Barra inferior */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            background: 'white',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}>
            ⚽
          </div>
          <div>
            <div style={{ color: 'white', fontSize: '20px', fontWeight: 700 }}>
              {stream?.title}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
              🔴 EN VIVO
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.2)',
          padding: '10px 20px',
          borderRadius: '20px',
          color: 'white',
          fontWeight: 600
        }}>
          📺 TRANSMISIÓN PRIVADA
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Stream {
  id: string;
  title: string;
  active: boolean;
  created_at: string;
  daily_room_url: string;
}

export default function StreamingDailyAdmin() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [streamTitle, setStreamTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [currentStream, setCurrentStream] = useState<Stream | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    loadStreams();
  }, []);

  const loadStreams = async () => {
    const { data } = await supabase
      .from('streams')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setStreams(data);
    }
  };

  const startStreaming = async () => {
    if (!streamTitle.trim()) {
      alert('Por favor ingresa un título para la transmisión');
      return;
    }

    setLoading(true);

    try {
      // Crear sala en Daily.co
      const dailyResponse = await fetch('/api/daily/create-room', {
        method: 'POST'
      });

      const dailyData = await dailyResponse.json();

      if (!dailyData.success) {
        throw new Error('Failed to create Daily room');
      }

      // Crear transmisión en Supabase
      const streamCode = Math.random().toString(36).substring(2, 10);

      const { data, error } = await supabase
        .from('streams')
        .insert({
          id: streamCode,
          title: streamTitle,
          user_id: session?.user?.id,
          active: true,
          daily_room_url: dailyData.roomUrl
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentStream(data);
      setStreamTitle('');
      loadStreams();

      // Abrir Daily.co en nueva ventana
      window.open(dailyData.roomUrl, '_blank', 'width=1280,height=720');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al crear transmisión');
    } finally {
      setLoading(false);
    }
  };

  const stopStreaming = async () => {
    if (currentStream) {
      // Desactivar en Supabase
      await supabase
        .from('streams')
        .update({ active: false })
        .eq('id', currentStream.id);

      // Cerrar sala de Daily.co
      if (currentStream.daily_room_url) {
        const roomName = currentStream.daily_room_url.split('/').pop();
        try {
          await fetch('/api/daily/delete-room', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName })
          });
        } catch (error) {
          console.error('Error closing Daily room:', error);
        }
      }

      setCurrentStream(null);
      loadStreams();
    }
  };

  const copyWatchUrl = (streamId: string) => {
    const url = `${window.location.origin}/watch-daily/${streamId}`;
    navigator.clipboard.writeText(url);
    alert('URL copiada al portapapeles!');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', height: '100vh', overflowY: 'auto' }}>
      {/* Back */}
      <button onClick={() => window.location.href = '/'} style={{ padding: '8px 18px', background: 'rgba(0,0,0,0.05)', border: '1px solid #e0e0e0', borderRadius: '10px', color: '#666', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '20px' }}>
        ← Volver al inicio
      </button>

      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px', color: '#1a1a1a' }}>
          📺 Panel de Streaming (Daily.co)
        </h1>
        <p style={{ color: '#666', fontSize: '16px' }}>
          Streaming profesional con Daily.co
        </p>
      </div>

      {!currentStream ? (
        <div style={{
          background: 'white',
          padding: '30px',
          borderRadius: '15px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '30px'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', color: '#1a1a1a' }}>
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
              outline: 'none',
              color: '#1a1a1a'
            }}
          />

          <button
            onClick={startStreaming}
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
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
            {loading ? '⏳ Creando sala...' : '🎥 Crear Transmisión'}
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
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', color: '#22c55e' }}>
            🔴 Transmisión Activa
          </h2>

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
                value={currentStream.daily_room_url || `${window.location.origin}/watch-daily/${currentStream.id}`}
                readOnly
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#1a1a1a',
                  background: 'white'
                }}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentStream.daily_room_url || `${window.location.origin}/watch-daily/${currentStream.id}`);
                  alert('URL copiada!');
                }}
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
              width: '100%',
              padding: '15px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ⏹️ Finalizar Transmisión
          </button>
        </div>
      )}

      {/* Historial */}
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '15px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', color: '#1a1a1a' }}>
          📋 Historial de Transmisiones
        </h2>

        {streams.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
            No hay transmisiones aún
          </p>
        ) : (
          streams.map((stream) => (
            <div
              key={stream.id}
              style={{
                padding: '15px',
                borderBottom: '1px solid #eee',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '5px', color: '#1a1a1a' }}>
                  {stream.title}
                </h3>
                <p style={{ fontSize: '12px', color: '#666' }}>
                  {stream.active ? '🔴 Activa' : '⚫ Finalizada'} •
                  {new Date(stream.created_at).toLocaleString('es-ES')}
                </p>
              </div>
              {stream.active && (
                <div style={{ display: 'flex', gap: '10px' }}>
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
                    onClick={async () => {
                      await supabase
                        .from('streams')
                        .update({ active: false })
                        .eq('id', stream.id);
                      loadStreams();
                    }}
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
                    ❌ Desactivar
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

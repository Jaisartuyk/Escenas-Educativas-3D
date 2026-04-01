'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useStreaming } from '@/contexts/StreamingContext';

interface Stream {
  id: string;
  title: string;
  active: boolean;
  created_at: string;
  viewers_count: number;
}

export default function StreamingAdmin() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [streamTitle, setStreamTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Usar el contexto global de streaming
  const {
    isStreaming,
    currentStream,
    viewersCount,
    mediaStream,
    startStreaming: startStreamingGlobal,
    stopStreaming: stopStreamingGlobal
  } = useStreaming();

  useEffect(() => {
    // Verificar sesión
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    loadStreams();
  }, []);

  // Actualizar preview cuando cambie el mediaStream
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream, isStreaming]);

  // Debug: ver estado actual
  useEffect(() => {
    console.log('Estado streaming:', { isStreaming, currentStream, viewersCount });
  }, [isStreaming, currentStream, viewersCount]);

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

  const startStreaming = async () => {
    if (!streamTitle.trim()) {
      alert('Por favor ingresa un título para la transmisión');
      return;
    }

    setLoading(true);

    try {
      await startStreamingGlobal(streamTitle, session?.user?.id);
      setStreamTitle('');
      loadStreams();
    } catch (error) {
      console.error('Error starting stream:', error);
      alert('Error al iniciar transmisión. Asegúrate de dar permisos para compartir pantalla.');
    } finally {
      setLoading(false);
    }
  };

  const stopStreaming = async () => {
    await stopStreamingGlobal();
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
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', height: '100vh', overflowY: 'auto' }}>
      {/* Back */}
      <button onClick={() => window.location.href = '/'} style={{ padding: '8px 18px', background: 'rgba(0,0,0,0.05)', border: '1px solid #e0e0e0', borderRadius: '10px', color: '#666', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '20px' }}>
        ← Volver al inicio
      </button>

      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px', color: '#1a1a1a' }}>
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
          {currentStream ? (
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
                  value={`${window.location.origin}/watch/${currentStream.id}`}
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
                  onClick={() => copyWatchUrl(currentStream.id)}
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
          ) : (
            <div style={{
              background: '#fff3cd',
              padding: '15px',
              borderRadius: '10px',
              marginBottom: '15px',
              border: '1px solid #ffc107'
            }}>
              <p style={{ fontSize: '14px', color: '#856404', margin: 0 }}>
                ⚠️ Generando URL de transmisión...
              </p>
            </div>
          )}

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
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', color: '#1a1a1a' }}>
          📋 Historial de Transmisiones
        </h2>

        {streams.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
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
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '5px', color: '#1a1a1a' }}>
                    {stream.title}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#666' }}>
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

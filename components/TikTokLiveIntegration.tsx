'use client';

import { useState, useEffect } from 'react';

interface TikTokLiveIntegrationProps {
  onLikeReceived?: (count: number) => void;
  onCommentReceived?: (username: string, comment: string) => void;
  onViewerJoin?: (username: string) => void;
}

export default function TikTokLiveIntegration({ 
  onLikeReceived, 
  onCommentReceived, 
  onViewerJoin 
}: TikTokLiveIntegrationProps) {
  const [username, setUsername] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [totalLikes, setTotalLikes] = useState(0);
  const [error, setError] = useState('');

  const connectToLive = async () => {
    if (!username.trim()) {
      setError('Por favor ingresa un nombre de usuario de TikTok');
      return;
    }

    setConnecting(true);
    setError('');

    try {
      const response = await fetch('/api/tiktok-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          username: username.trim().replace('@', ''),
          sessionId
        })
      });

      const data = await response.json();

      if (data.success) {
        setConnected(true);
        // Aquí conectaríamos al stream de eventos
        // Por ahora es una implementación básica
      } else {
        setError(data.error || 'Error al conectar');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await fetch('/api/tiktok-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disconnect',
          sessionId
        })
      });
      setConnected(false);
      setTotalLikes(0);
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  };

  useEffect(() => {
    if (!connected) return;

    // Consultar datos cada segundo
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/tiktok-live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getData',
            sessionId
          })
        });

        const result = await response.json();
        if (result.success && result.data) {
          setTotalLikes(result.data.likes);
          if (onLikeReceived) {
            onLikeReceived(result.data.likes);
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    }, 1000); // Actualizar cada segundo

    return () => clearInterval(interval);
  }, [connected, sessionId]);

  useEffect(() => {
    return () => {
      if (connected) {
        disconnect();
      }
    };
  }, [connected]);

  return (
    <div style={{ 
      background: 'var(--bg2)', 
      border: '1px solid var(--border)', 
      borderRadius: '12px', 
      padding: '16px' 
    }}>
      <div style={{ 
        fontSize: '11px', 
        fontWeight: 800, 
        color: 'var(--text2)', 
        letterSpacing: '.12em', 
        textTransform: 'uppercase', 
        marginBottom: '12px' 
      }}>
        📱 TikTok Live
      </div>

      {!connected ? (
        <div>
          <input
            type="text"
            placeholder="@usuario de TikTok"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && connectToLive()}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '10px'
            }}
          />
          
          {error && (
            <div style={{ 
              color: '#ff6b6b', 
              fontSize: '11px', 
              marginBottom: '10px',
              fontWeight: 600 
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={connectToLive}
            disabled={connecting}
            style={{
              width: '100%',
              padding: '10px',
              background: connecting ? 'var(--bg3)' : 'linear-gradient(135deg, #ff0050, #00f2ea)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: connecting ? 'not-allowed' : 'pointer',
              opacity: connecting ? 0.6 : 1
            }}
          >
            {connecting ? '🔄 Conectando...' : '🔗 Conectar al Live'}
          </button>

          <div style={{ 
            fontSize: '10px', 
            color: 'var(--text2)', 
            marginTop: '10px',
            lineHeight: '1.5'
          }}>
            💡 Ingresa el nombre de usuario de TikTok que está en vivo
          </div>
        </div>
      ) : (
        <div>
          <div style={{ 
            background: 'rgba(0, 242, 234, 0.1)', 
            border: '1px solid rgba(0, 242, 234, 0.3)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '12px'
          }}>
            <div style={{ 
              fontSize: '11px', 
              color: '#00f2ea', 
              fontWeight: 700,
              marginBottom: '6px'
            }}>
              ✅ Conectado a @{username}
            </div>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 800, 
              color: '#fff' 
            }}>
              ❤️ {totalLikes.toLocaleString()} likes
            </div>
          </div>

          <button
            onClick={disconnect}
            style={{
              width: '100%',
              padding: '10px',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text2)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🔌 Desconectar
          </button>
        </div>
      )}
    </div>
  );
}

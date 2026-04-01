'use client';

import { useState, useEffect } from 'react';

interface Song {
  emoji: string;
  song: string;
  artist: string;
  year: string;
  ytUrl: string;
  instrumentalUrl?: string;
}

export default function PresentationMode() {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [showInstrumental, setShowInstrumental] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<'music' | 'football'>('music');
  const [currentFootballVideo, setCurrentFootballVideo] = useState<any>(null);

  // Detectar modo desde URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    if (modeParam === 'football') {
      setMode('football');
    }
  }, []);

  // Sincronizar con el estado del juego principal
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/game-state');
        const data = await response.json();
        
        if (mode === 'music' && data.currentSong) {
          setCurrentSong(data.currentSong);
          setShowInstrumental(data.showInstrumental || false);
        } else if (mode === 'football' && data.currentFootballVideo) {
          setCurrentFootballVideo(data.currentFootballVideo);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error syncing game state:', error);
      }
    }, 500); // Sincronizar cada 500ms

    return () => clearInterval(syncInterval);
  }, [mode]);

  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    return match ? match[1] : null;
  };

  const getVideoUrl = () => {
    if (mode === 'football') {
      return currentFootballVideo?.id || null;
    }
    
    if (!currentSong) return null;
    
    const url = showInstrumental && currentSong.instrumentalUrl 
      ? currentSong.instrumentalUrl 
      : currentSong.ytUrl;
    
    return url;
  };

  const videoUrl = getVideoUrl();
  const videoId = mode === 'football' 
    ? videoUrl // En football, videoUrl ya es el ID
    : (videoUrl ? extractYouTubeId(videoUrl) : null);

  if (isLoading) {
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
        <div style={{
          fontSize: '48px',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          🎤
        </div>
        <div style={{
          fontSize: '24px',
          fontWeight: 800,
          color: '#fff',
          fontFamily: "'Bebas Neue', sans-serif"
        }}>
          CARGANDO...
        </div>
        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.1); }
          }
        `}</style>
      </div>
    );
  }

  const hasContent = mode === 'football' 
    ? (currentFootballVideo && videoId) 
    : (currentSong && videoId);

  if (!hasContent) {
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
        <div style={{
          fontSize: '120px',
          marginBottom: '20px'
        }}>
          {mode === 'football' ? '⚽' : '🎤'}
        </div>
        <div style={{
          fontSize: '48px',
          fontWeight: 800,
          color: '#fff',
          fontFamily: "'Bebas Neue', sans-serif",
          textAlign: 'center',
          background: 'linear-gradient(135deg, #9b5de5, #f72585)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          {mode === 'football' ? 'RESÚMENES DE FÚTBOL' : 'CANTA CONMIGO'}
        </div>
        <div style={{
          fontSize: '20px',
          color: 'rgba(255,255,255,0.6)',
          fontWeight: 600,
          textAlign: 'center',
          maxWidth: '600px'
        }}>
          {mode === 'football' 
            ? 'Esperando que se seleccione un partido...' 
            : 'Esperando que se seleccione una canción...'}
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
      {/* Video de YouTube - Ocupa la mayor parte de la pantalla */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: '#000'
      }}>
        <iframe
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none'
          }}
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&controls=1`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        ></iframe>

        {/* Mensaje de ayuda si el video está bloqueado */}
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(10px)',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.2)',
          maxWidth: '350px',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.8)',
          lineHeight: '1.5',
          fontWeight: 600
        }}>
          💡 <strong>Si el video no se reproduce:</strong><br/>
          Algunos videos tienen restricciones de derechos de autor.<br/>
          Solución: Busca otra versión de karaoke en el Editor.
        </div>
      </div>

      {/* Información de la canción/partido - Barra inferior */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(155, 93, 229, 0.95), rgba(247, 37, 133, 0.95))',
        padding: '30px 50px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <div style={{
            fontSize: '60px',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
          }}>
            {mode === 'football' ? '⚽' : currentSong?.emoji}
          </div>
          <div>
            <div style={{
              fontSize: '42px',
              fontWeight: 800,
              color: '#fff',
              fontFamily: "'Bebas Neue', sans-serif",
              lineHeight: 1,
              marginBottom: '8px',
              textShadow: '0 2px 10px rgba(0,0,0,0.3)'
            }}>
              {mode === 'football' ? currentFootballVideo?.title : currentSong?.song}
            </div>
            <div style={{
              fontSize: '24px',
              color: 'rgba(255,255,255,0.9)',
              fontWeight: 700,
              textShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
              {mode === 'football' 
                ? currentFootballVideo?.channel 
                : `${currentSong?.artist} • ${currentSong?.year}`}
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.2)',
          padding: '12px 24px',
          borderRadius: '50px',
          fontSize: '18px',
          fontWeight: 800,
          color: '#fff',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
        }}>
          {mode === 'football' 
            ? '⚽ RESUMEN' 
            : (showInstrumental ? '🎹 INSTRUMENTAL' : '🎤 ORIGINAL')}
        </div>
      </div>
    </div>
  );
}

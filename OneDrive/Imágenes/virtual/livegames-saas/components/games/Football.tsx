'use client';

import { useState, useEffect } from 'react';

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  publishedAt: string;
  url: string;
}

export default function Football() {
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cargar estado de localStorage al iniciar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedQuery = localStorage.getItem('livegames_football_searchQuery');
      const savedVideos = localStorage.getItem('livegames_football_videos');
      const savedSelected = localStorage.getItem('livegames_football_selectedVideo');

      if (savedQuery) setSearchQuery(savedQuery);
      if (savedVideos) {
        try { setVideos(JSON.parse(savedVideos)); } catch (e) {}
      }
      if (savedSelected) {
        try { setSelectedVideo(JSON.parse(savedSelected)); } catch (e) {}
      }
    }
  }, []);

  // Guardar estado en localStorage al cambiar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('livegames_football_searchQuery', searchQuery);
      localStorage.setItem('livegames_football_videos', JSON.stringify(videos));
      if (selectedVideo) {
        localStorage.setItem('livegames_football_selectedVideo', JSON.stringify(selectedVideo));
      } else {
        localStorage.removeItem('livegames_football_selectedVideo');
      }
    }
  }, [searchQuery, videos, selectedVideo]);

  // Sincronizar video seleccionado con el estado global
  useEffect(() => {
    if (selectedVideo) {
      fetch('/api/game-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentFootballVideo: selectedVideo })
      }).catch(err => console.error('Error syncing football video:', err));
    }
  }, [selectedVideo]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/football-search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al buscar');
      }

      setVideos(data.videos);
      if (data.videos.length > 0) {
        setSelectedVideo(data.videos[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickSearches = [
    'Real Madrid vs Barcelona',
    'Manchester United vs Liverpool',
    'PSG vs Marseille',
    'Bayern Munich vs Dortmund',
    'Champions League final',
    'Copa America final'
  ];

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Back button */}
      <button
        onClick={() => window.location.href = '/'}
        style={{
          padding: '8px 18px',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '10px',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        ← Volver al inicio
      </button>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{
          display: 'inline-block',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '8px 20px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '15px'
        }}>
          ⚽ Resúmenes de Fútbol
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px' }}>
          Resúmenes de Partidos
        </h1>
        <p style={{ color: '#666', fontSize: '16px' }}>
          Busca y mira resúmenes de tus partidos favoritos
        </p>
      </div>

      {/* Buscador */}
      <form onSubmit={handleSearch} style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', maxWidth: '600px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Busca cualquier video de YouTube..."
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '12px 20px',
              border: '2px solid #e0e0e0',
              borderRadius: '10px',
              fontSize: '16px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
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
            {loading ? '🔍 Buscando...' : '🔍 Buscar'}
          </button>
        </div>
      </form>

      {/* Botón Modo Presentación */}
      <div style={{ marginBottom: '30px' }}>
        <button
          onClick={() => window.open('/present?mode=football', '_blank', 'width=1920,height=1080')}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #9b5de5, #f72585)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(155, 93, 229, 0.3)',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          📺 Abrir Modo Presentación
        </button>
      </div>

      {/* Búsquedas rápidas */}
      <div style={{ marginBottom: '30px' }}>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px', fontWeight: 600 }}>
          Búsquedas rápidas:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {quickSearches.map((search) => (
            <button
              key={search}
              onClick={() => {
                setSearchQuery(search);
                handleSearch({ preventDefault: () => { } } as React.FormEvent);
              }}
              style={{
                padding: '8px 16px',
                background: '#f5f5f5',
                border: '1px solid #e0e0e0',
                borderRadius: '20px',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#667eea';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.borderColor = '#667eea';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#f5f5f5';
                e.currentTarget.style.color = 'black';
                e.currentTarget.style.borderColor = '#e0e0e0';
              }}
            >
              {search}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '15px',
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '10px',
          color: '#c33',
          marginBottom: '20px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Contenido principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }} className="football-grid">
        {/* Reproductor */}
        <div>
          {selectedVideo ? (
            <div>
              <div style={{
                position: 'relative',
                paddingBottom: '56.25%',
                height: 0,
                overflow: 'hidden',
                borderRadius: '15px',
                background: '#000',
                marginBottom: '20px'
              }}>
                <iframe
                  src={`https://www.youtube.com/embed/${selectedVideo.id}?autoplay=1`}
                  loading="lazy"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div style={{
                padding: '20px',
                background: 'white',
                borderRadius: '15px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>
                  {selectedVideo.title}
                </h2>
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '5px' }}>
                  📺 {selectedVideo.channel}
                </p>
                <p style={{ color: '#999', fontSize: '12px' }}>
                  📅 {new Date(selectedVideo.publishedAt).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              padding: '60px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '15px',
              textAlign: 'center',
              color: 'white'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚽</div>
              <h3 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '10px' }}>
                Busca un partido
              </h3>
              <p style={{ opacity: 0.9 }}>
                Escribe el nombre de los equipos o usa las búsquedas rápidas
              </p>
            </div>
          )}
        </div>

        {/* Lista de videos */}
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '15px' }}>
            📋 Resultados ({videos.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '800px', overflowY: 'auto' }}>
            {videos.map((video) => (
              <div
                key={video.id}
                onClick={() => setSelectedVideo(video)}
                style={{
                  padding: '10px',
                  background: selectedVideo?.id === video.id ? '#f0f0ff' : 'white',
                  border: selectedVideo?.id === video.id ? '2px solid #667eea' : '1px solid #e0e0e0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (selectedVideo?.id !== video.id) {
                    e.currentTarget.style.background = '#f9f9f9';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedVideo?.id !== video.id) {
                    e.currentTarget.style.background = 'white';
                  }
                }}
              >
                <div style={{ display: 'flex', gap: '10px' }}>
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    style={{
                      width: '120px',
                      height: '68px',
                      objectFit: 'cover',
                      borderRadius: '8px'
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '5px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {video.title}
                    </h4>
                    <p style={{ fontSize: '11px', color: '#666' }}>
                      {video.channel}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

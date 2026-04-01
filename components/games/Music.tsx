import React, { useState, useEffect } from 'react';
import TikTokLiveIntegration from '../TikTokLiveIntegration';
import ParticipantsManager from '../ParticipantsManager';

const CIRC = 358.1;

export default function Music({
  items,
  idx,
  setIdx,
  onShowEditor,
  triggerConfetti,
  timerSeconds
}: {
  items: { emoji: string, song: string, artist: string, year: string, ytUrl: string, instrumentalUrl?: string, clues: { type: string, value: string }[] }[],
  idx: number,
  setIdx: (i: number) => void,
  onShowEditor: () => void,
  triggerConfetti: () => void,
  timerSeconds: number
}) {
  const [revealedClues, setRevealedClues] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [timerState, setTimerState] = useState<'stopped' | 'running' | 'paused' | 'done'>('stopped');
  const [showInstrumental, setShowInstrumental] = useState(false);
  const [autoFoundVideo, setAutoFoundVideo] = useState<{ videoId: string, url: string, title: string } | null>(null);
  const [searchingVideo, setSearchingVideo] = useState(false);
  const [currentTikTokLikes, setCurrentTikTokLikes] = useState(0);
  const [lastRecordedLikes, setLastRecordedLikes] = useState(0);

  const currentSong = items.length > 0 ? items[idx] : null;

  useEffect(() => {
    setRevealedClues(0);
    setAnswered(false);
    setTimeLeft(timerSeconds);
    setTimerState('stopped');
    setShowInstrumental(false);
    setAutoFoundVideo(null);
  }, [idx, items, timerSeconds]);

  // Sincronizar estado con el modo presentación
  useEffect(() => {
    const syncState = async () => {
      if (!currentSong) return;

      try {
        await fetch('/api/game-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentSong,
            showInstrumental,
            currentIndex: idx
          })
        });
      } catch (error) {
        console.error('Error syncing game state:', error);
      }
    };

    syncState();
  }, [currentSong, showInstrumental, idx]);

  // Buscar automáticamente el video cuando se active el modo instrumental
  useEffect(() => {
    const searchVideo = async () => {
      if (!currentSong || !showInstrumental) {
        setAutoFoundVideo(null);
        return;
      }

      const hasInstrumental = currentSong.instrumentalUrl && ytIdFromUrl(currentSong.instrumentalUrl);
      if (hasInstrumental) {
        setAutoFoundVideo(null);
        return;
      }

      setSearchingVideo(true);
      try {
        const query = `${currentSong.song} ${currentSong.artist} instrumental karaoke`;
        const response = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.videoId) {
          setAutoFoundVideo(data);
        } else {
          setAutoFoundVideo(null);
        }
      } catch (error) {
        console.error('Error searching video:', error);
        setAutoFoundVideo(null);
      } finally {
        setSearchingVideo(false);
      }
    };

    searchVideo();
  }, [currentSong, showInstrumental]);

  // Timer logic
  useEffect(() => {
    let interval: any = null;
    if (timerState === 'running' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setTimerState('done');
            triggerConfetti();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerState === 'done') {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerState, timeLeft, triggerConfetti]);

  const ytIdFromUrl = (url: string) => {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  };

  const renderYtPlayer = () => {
    if (!currentSong) return null;

    // Determinar qué URL usar (original, instrumental configurado, o video encontrado automáticamente)
    let currentUrl = currentSong.ytUrl;
    let videoId = null;

    if (showInstrumental) {
      if (currentSong.instrumentalUrl) {
        currentUrl = currentSong.instrumentalUrl;
      } else if (autoFoundVideo) {
        videoId = autoFoundVideo.videoId;
      }
    }

    if (!videoId) {
      videoId = ytIdFromUrl(currentUrl);
    }

    // Generar búsqueda automática para instrumental
    const instrumentalSearchQuery = encodeURIComponent(`${currentSong.song} ${currentSong.artist} instrumental karaoke`);
    const instrumentalSearchUrl = `https://www.youtube.com/results?search_query=${instrumentalSearchQuery}`;

    const hasInstrumental = currentSong.instrumentalUrl && ytIdFromUrl(currentSong.instrumentalUrl);

    // Si estamos buscando el video automáticamente
    if (showInstrumental && !hasInstrumental && searchingVideo) {
      return (
        <div style={{ position: 'relative', background: 'linear-gradient(135deg, rgba(155, 93, 229, 0.1), rgba(247, 37, 133, 0.1))', borderRadius: '12px', padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', animation: 'pulse 1.5s ease-in-out infinite' }}>🔍</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            Buscando Instrumental...
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
            Buscando el mejor karaoke de:<br />
            <span style={{ color: '#9b5de5', fontWeight: 700 }}>"{currentSong.song}" - {currentSong.artist}</span>
          </div>
        </div>
      );
    }

    // Si estamos en modo instrumental, no hay URL configurada, y no se encontró video automáticamente
    if (showInstrumental && !hasInstrumental && !autoFoundVideo) {
      return (
        <div style={{ position: 'relative', background: 'linear-gradient(135deg, rgba(155, 93, 229, 0.1), rgba(247, 37, 133, 0.1))', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>😔</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            No se encontró instrumental automáticamente
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '20px', lineHeight: '1.5' }}>
            Busca manualmente en YouTube:<br />
            <span style={{ color: '#9b5de5', fontWeight: 700 }}>"{currentSong.song} {currentSong.artist} instrumental"</span>
          </div>
          <button
            onClick={() => window.open(instrumentalSearchUrl, '_blank')}
            style={{
              background: 'linear-gradient(135deg, #9b5de5, #f72585)',
              border: 'none',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 800,
              padding: '14px 28px',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(155, 93, 229, 0.4)',
              transition: 'transform 0.2s',
              marginBottom: '16px'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🔍 Buscar en YouTube
          </button>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '12px' }}>
            💡 Tip: Copia la URL del video y pégala en el Editor
          </div>
        </div>
      );
    }

    if (!videoId) {
      return (
        <div className="yt-no-video" id="yt-placeholder">
          <div className="yt-icon">🎬</div>
          <p>Sin video de YouTube.<br />Agrega el link en el <a href="#" onClick={(e) => { e.preventDefault(); onShowEditor(); }}>Editor ✏️</a><br /><span style={{ fontSize: '10px', opacity: .6 }}>Busca en YouTube: "[nombre canción] karaoke" o "instrumental"</span></p>
        </div>
      );
    }

    const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const isAutoFound = showInstrumental && autoFoundVideo && !hasInstrumental;

    return (
      <>
        {/* Botones para cambiar entre original e instrumental */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', padding: '0 4px' }}>
          <button
            onClick={() => setShowInstrumental(false)}
            style={{
              flex: 1,
              background: !showInstrumental ? 'linear-gradient(135deg, #ff6d00, #ff0000)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 800,
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🎤 Original
          </button>
          <button
            onClick={() => setShowInstrumental(true)}
            style={{
              flex: 1,
              background: showInstrumental ? 'linear-gradient(135deg, #9b5de5, #f72585)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 800,
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🎹 Instrumental {isAutoFound && '✨'}
          </button>
        </div>

        {isAutoFound && (
          <div style={{ background: 'linear-gradient(135deg, rgba(155, 93, 229, 0.2), rgba(247, 37, 133, 0.2))', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', fontSize: '11px', color: '#9b5de5', fontWeight: 700, textAlign: 'center' }}>
            ✨ Video encontrado automáticamente: "{autoFoundVideo.title}"
          </div>
        )}

        {/* Reproductor de YouTube embebido - RECUADRO EXTRA GRANDE */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          maxHeight: '700px',
          borderRadius: '12px',
          background: '#000',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          marginBottom: '12px',
          overflow: 'hidden'
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
            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          ></iframe>
        </div>

        <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '8px', borderRadius: '0 0 8px 8px' }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.5)', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: '150px' }}>
            {showInstrumental ? (isAutoFound ? '✨ Auto-encontrado' : '🎹 Instrumental') : '🎤 Original'}
          </span>
          <button onClick={() => window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')} style={{ background: '#ff0000', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '5px 14px', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Abrir en YouTube ▶
          </button>
        </div>
      </>
    );
  };

  const pct = timerSeconds > 0 ? timeLeft / timerSeconds : 1;
  const offset = CIRC * (1 - pct);
  const useCol = pct <= 0.2 ? 'var(--pink)' : pct <= 0.4 ? 'var(--yellow)' : 'var(--green)';
  const formatTime = (s: number) => {
    if (s >= 60) {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return m + ':' + (sec < 10 ? '0' : '') + sec;
    }
    return String(s);
  };

  return (
    <div className="page active" style={{ animation: 'fadeUp .35s ease' }}>
      <div className="split">
        <div className="split-left">
          <div className="yt-player-wrap" style={{ minHeight: '300px' }}>
            {renderYtPlayer()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', marginTop: '16px' }}>
              <div className="song-badge sb-hint">
                🎤 Canta Conmigo
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 800 }}>
                Canción {items.length > 0 ? idx + 1 : 0} / {items.length}
              </div>
            </div>

            {!currentSong && (
              <div style={{ color: 'var(--text2)', fontSize: '14px', fontWeight: 700, textAlign: 'center', padding: '20px' }}>
                Ve al Editor para agregar canciones con IA
              </div>
            )}

            {currentSong && (
              <div style={{ background: 'linear-gradient(135deg, rgba(155, 93, 229, 0.15), rgba(247, 37, 133, 0.15))', border: '2px solid rgba(155, 93, 229, 0.4)', borderRadius: '20px', padding: '24px 28px', textAlign: 'center', marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', color: '#9b5de5', fontWeight: 800, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: '10px' }}>🎤 AHORA CANTANDO</div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '42px', color: '#fff', lineHeight: 1, marginBottom: '6px' }}>{currentSong.song}</div>
                <div style={{ fontSize: '18px', color: 'rgba(255,255,255,.7)', fontWeight: 700, marginBottom: '10px' }}>{currentSong.artist}</div>
                <span style={{ display: 'inline-block', padding: '5px 16px', borderRadius: '100px', background: 'rgba(155, 93, 229, 0.3)', color: '#9b5de5', fontSize: '13px', fontWeight: 800 }}>{currentSong.year}</span>
              </div>
            )}
          </div>
        </div>

        <div className="split-right">
          <div className="panel">
            <div className="panel-title">⏱️ Temporizador</div>
            <div className="timer-wrap">
              <div className="timer-ring-wrap">
                <svg width="130" height="130" viewBox="0 0 130 130">
                  <circle className="timer-track" cx="65" cy="65" r="57" />
                  <circle
                    className="timer-progress"
                    cx="65" cy="65" r="57"
                    stroke={useCol}
                    strokeDasharray="358.1"
                    strokeDashoffset={offset}
                  />
                </svg>
                <div className={`timer-inner timer-state-${timerState}`}>
                  <div className="timer-num" style={{ color: timerState === 'done' ? 'var(--pink)' : useCol }}>
                    {formatTime(timeLeft)}
                  </div>
                  <div className="timer-lbl">segundos</div>
                </div>
              </div>
              <div className="timer-bar-bg">
                <div className="timer-bar-fill" style={{ width: `${pct * 100}%`, background: useCol }}></div>
              </div>
              <div className="timer-controls">
                {(timerState === 'stopped' || timerState === 'done') && (
                  <button className="tc-btn tc-start" onClick={() => { setTimeLeft(timerSeconds); setTimerState('running'); }}>
                    {timerState === 'done' ? '↺ Repetir' : '▶ Iniciar'}
                  </button>
                )}
                {timerState === 'running' && (
                  <button className="tc-btn tc-pause" onClick={() => setTimerState('paused')}>⏸ Pausar</button>
                )}
                {timerState === 'paused' && (
                  <button className="tc-btn tc-pause" onClick={() => setTimerState('running')}>▶ Continuar</button>
                )}
                <button className="tc-btn tc-reset" onClick={() => { setTimeLeft(timerSeconds); setTimerState('stopped'); }}>↺</button>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Controles</div>
            <div className="ctrl-group">
              <div className="ctrl-grid2">
                <button className="ctrl-btn ctrl-secondary" style={{ justifyContent: 'center' }} onClick={() => items.length && setIdx((idx - 1 + items.length) % items.length)}>◀ Anterior</button>
                <button className="ctrl-btn ctrl-secondary" style={{ justifyContent: 'center' }} onClick={() => items.length && setIdx((idx + 1) % items.length)}>Siguiente ▶</button>
              </div>
              <button className="ctrl-btn ctrl-secondary" onClick={() => items.length && setIdx(Math.floor(Math.random() * items.length))}>🎲 Canción al azar</button>
              <button className="ctrl-btn ctrl-secondary" onClick={onShowEditor}>✏️ Editar canciones</button>
              <button
                className="ctrl-btn"
                style={{
                  background: 'linear-gradient(135deg, #9b5de5, #f72585)',
                  color: '#fff',
                  fontWeight: 800,
                  marginTop: '8px'
                }}
                onClick={() => window.open('/present', '_blank', 'width=1920,height=1080')}
              >
                📺 Abrir Modo Presentación
              </button>
            </div>
          </div>

          <TikTokLiveIntegration
            onLikeReceived={(totalLikes) => {
              const newLikes = totalLikes - lastRecordedLikes;
              setCurrentTikTokLikes(newLikes);
            }}
          />

          <div style={{ marginTop: '14px' }}>
            <ParticipantsManager
              currentLikes={currentTikTokLikes}
              onReset={() => {
                setLastRecordedLikes(lastRecordedLikes + currentTikTokLikes);
                setCurrentTikTokLikes(0);
              }}
            />
          </div>

          <div className="panel" style={{ marginTop: '14px' }}>
            <div className="panel-title">💡 Cómo jugar</div>
            <div style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 600, lineHeight: '1.6' }}>
              <p style={{ marginBottom: '8px' }}>🎤 Los participantes cantan la canción mostrada</p>
              <p style={{ marginBottom: '8px' }}>❤️ Los espectadores dan likes al que cante mejor</p>
              <p style={{ marginBottom: '0' }}>🏆 El que tenga más likes gana</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

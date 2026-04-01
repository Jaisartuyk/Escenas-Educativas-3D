"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Roulette from "./games/Roulette";
import Challenge from "./games/Challenge";
import Trivia from "./games/Trivia";
import Music from "./games/Music";
import Football from "./games/Football";
import Editor from "./Editor";

// --- COMPONENTS ---
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const cols = ['#fe2c55', '#ffcc00', '#9b5de5', '#25f4ee', '#ff6d00', '#00f5a0'];
  return (
    <div className="confetti" id="confetti">
      {Array.from({ length: 60 }).map((_, i) => (
        <div
          key={i}
          className="cp"
          style={{
            left: `${Math.random() * 100}%`,
            background: cols[Math.floor(Math.random() * cols.length)],
            // @ts-ignore
            '--d': `${1.4 + Math.random() * 2.2}s`,
            '--delay': `${Math.random() * 0.6}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
}

function Toast({ msg, show }: { msg: string; show: boolean }) {
  return (
    <div className={`toast ${show ? 'show' : ''}`} id="toast">
      {msg}
    </div>
  );
}

// Default Data
const DEFAULT_VOTE = { q: "¿TE BAÑAS EN LA MAÑANA O EN LA NOCHE?", eA: "☀️", nA: "Equipo Mañana", eB: "🌙", nB: "Equipo Noche", vA: 0, vB: 0 };
const DEFAULT_ROULETTE = ["Imita al presentador 30s 🎤", "Cuenta un secreto gracioso 🤫", "Haz 10 sentadillas en vivo 🏋️", "Canta la intro de tu serie favorita 🎵", "Llama a alguien y dile que ganó 📞", "Habla con acento extranjero 1 min 🌍", "Muestra tu última foto guardada 📸", "Baila sin música 20 segundos 🕺"];
const DEFAULT_TRIVIA = [{ q: "¿CUÁNTOS HUESOS TIENE EL CUERPO HUMANO?", opts: ["186", "206", "226", "246"], correct: 1 }];
const DEFAULT_CHALLENGES = ["Muestra tu baile favorito 💃", "Di 5 cosas que amas de tu mejor amigo/a ❤️", "Haz una cara graciosa y mantenla 10 segundos 😜", "Describe tu día como película de acción 🎬", "Muestra tu snack favorito y defiéndelo 🍿"];
const DEFAULT_SONGS = [{ emoji: "🌧️", song: "Quevedo: Bzrp Music Sessions #52", artist: "Bizarrap & Quevedo", year: "2022", ytUrl: "", clues: [{ type: "Género 🎸", value: "Trap / Pop Latino" }, { type: "Primera letra 🔤", value: "Empieza con Q" }, { type: "Pista de letra ✍️", value: "\"Me quedé en el andén...\"" }, { type: "Colaboración 🤝", value: "Argentino + Español" }] }];

export default function LiveGamesApp() {
  const [isClient, setIsClient] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [activePage, setActivePage] = useState("home");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPage = localStorage.getItem('livegames_activePage');
      if (savedPage) setActivePage(savedPage);
    }
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [toastMsg, setToastMsg] = useState({ msg: "", show: false });

  // Auth form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  // Game States
  const [vote, setVoteState] = useState<any>(DEFAULT_VOTE);
  const [roulette, setRouletteState] = useState<any>(DEFAULT_ROULETTE);
  const [trivia, setTriviaState] = useState<any>(DEFAULT_TRIVIA);
  const [challenges, setChallengesState] = useState<any>(DEFAULT_CHALLENGES);
  const [songs, setSongsState] = useState<any>(DEFAULT_SONGS);
  const [timerTrivia, setTimerTriviaState] = useState<number>(30);
  const [timerMusic, setTimerMusicState] = useState<number>(60);

  // Local play states
  const [triviaIdx, setTriviaIdx] = useState(0);
  const [challengeIdx, setChallengeIdx] = useState(0);
  const [songIdx, setSongIdx] = useState(0);

  // Wake Lock (Prevent screen from sleeping)
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          // @ts-ignore
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('Screen Wake Lock is active');
          wakeLock.addEventListener('release', () => {
            console.log('Screen Wake Lock was released');
          });
        }
      } catch (err: any) {
        console.error(`Wake Lock error: ${err.name}, ${err.message}`);
      }
    };

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    // Delay a bit to ensure the document is fully ready for wake lock
    setTimeout(requestWakeLock, 1000);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wakeLock !== null) {
        wakeLock.release().catch(console.error);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    setIsClient(true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);


  const loadUserData = useCallback(async () => {
    if (!session?.user) return;
    
    // Solo mostrar pantalla de carga si es la primera vez
    if (!initialLoadDone) {
      setDataLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('user_games')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setVoteState(data.vote_data || DEFAULT_VOTE);
        setRouletteState(data.roulette_data || DEFAULT_ROULETTE);
        setTriviaState(data.trivia_data || DEFAULT_TRIVIA);
        setChallengesState(data.challenge_data || DEFAULT_CHALLENGES);
        setSongsState(data.music_data || DEFAULT_SONGS);
        setTimerTriviaState(data.timers_data?.trivia || 30);
        setTimerMusicState(data.timers_data?.music || 60);
      } else {
        // Create initial row if it doesn't exist
        await supabase.from('user_games').insert({
          user_id: session.user.id,
          vote_data: DEFAULT_VOTE,
          roulette_data: DEFAULT_ROULETTE,
          trivia_data: DEFAULT_TRIVIA,
          challenge_data: DEFAULT_CHALLENGES,
          music_data: DEFAULT_SONGS,
          timers_data: { trivia: 30, music: 60 }
        });
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setDataLoading(false);
      setInitialLoadDone(true);
    }
  }, [session, initialLoadDone]);

  useEffect(() => {
    if (session) {
      loadUserData();
    }
  }, [session, loadUserData]);

  // Sync wrappers
  const updateSupabase = async (column: string, value: any) => {
    if (!session?.user) return;
    await supabase.from('user_games').update({ [column]: value }).eq('user_id', session.user.id);
  };

  const setVote = (newVote: any) => { setVoteState(newVote); updateSupabase('vote_data', newVote); };
  const setRoulette = (newR: any) => { setRouletteState(newR); updateSupabase('roulette_data', newR); };
  const setTrivia = (newT: any) => { setTriviaState(newT); updateSupabase('trivia_data', newT); };
  const setChallenges = (newC: any) => { setChallengesState(newC); updateSupabase('challenge_data', newC); };
  const setSongs = (newS: any) => { setSongsState(newS); updateSupabase('music_data', newS); };

  const setTimerTrivia = (val: number) => {
    setTimerTriviaState(val);
    updateSupabase('timers_data', { trivia: val, music: timerMusic });
  };
  const setTimerMusic = (val: number) => {
    setTimerMusicState(val);
    updateSupabase('timers_data', { trivia: timerTrivia, music: val });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
      else alert('¡Registro exitoso! Ya puedes iniciar sesión.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError('Usuario o contraseña incorrectos');
    }
  };

  const handleLogout = async () => {
    if (window.confirm('¿Cerrar sesión?')) {
      await supabase.auth.signOut();
    }
  };

  const triggerConfetti = () => {
    setConfettiActive(false);
    setTimeout(() => setConfettiActive(true), 10);
    setTimeout(() => setConfettiActive(false), 4000);
  };

  const showToast = (msg: string) => {
    setToastMsg({ msg, show: true });
    setTimeout(() => setToastMsg({ msg: "", show: false }), 2600);
  };

  if (!isClient || authLoading) return null;

  if (!session) {
    return (
      <div id="login-screen">
        <div className="login-box">
          <div className="login-logo">🎮 LiveGames IA</div>
          <div className="login-sub">{isSignUp ? 'Crear nueva cuenta' : 'Panel de control — Acceso'}</div>

          <form onSubmit={handleAuth}>
            <div className="login-field">
              <label className="login-label">Correo Electrónico</label>
              <input
                className="login-input" type="email" placeholder="tu@correo.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required
              />
            </div>
            <div className="login-field">
              <label className="login-label">Contraseña</label>
              <input
                className="login-input" type="password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} required
              />
            </div>
            <button className="login-btn" type="submit">
              {isSignUp ? '✨ Registrarse' : '🚀 Entrar al panel'}
            </button>
            <button
              className="login-btn"
              type="button"
              style={{
                marginTop: '10px',
                background: '#000',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onClick={() => alert('La integración oficial de TikTok está en proceso de revisión')}
            >
              <svg width="20" height="20" viewBox="0 0 448 512" fill="currentColor">
                <path d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z"/>
              </svg>
              Continuar con TikTok
            </button>
          </form>

          {authError && <div className="login-error show" style={{ marginTop: '14px' }}>❌ {authError}</div>}

          <div
            className="login-hint"
            style={{ cursor: 'pointer', textDecoration: 'underline', marginTop: '20px' }}
            onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}
          >
            {isSignUp ? '¿Ya tienes cuenta? Inicia sesión aquí' : '¿No tienes cuenta? Regístrate gratis'}
          </div>

          <div style={{ marginTop: '25px', fontSize: '12px', textAlign: 'center', color: '#888', lineHeight: '1.5' }}>
            Al continuar, aceptas nuestros <br />
            <a href="https://jaisartuyk.github.io/LiveGames-SaaS/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: '#fe2c55', textDecoration: 'none', fontWeight: 'bold' }}>Términos de Servicio</a> y nuestra <a href="https://jaisartuyk.github.io/LiveGames-SaaS/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: '#fe2c55', textDecoration: 'none', fontWeight: 'bold' }}>Política de Privacidad</a>.
          </div>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--purple)', fontFamily: 'var(--font-outfit)', fontWeight: 800 }}>
        Cargando tus juegos... ⏳
      </div>
    );
  }

  const goPage = (page: string) => { setActivePage(page); localStorage.setItem('livegames_activePage', page); setSidebarOpen(false); };

  return (
    <div id="app" className="visible">
      <div className="bg-mesh"></div>
      <div className="scanlines"></div>
      <Confetti active={confettiActive} />
      <Toast msg={toastMsg.msg} show={toastMsg.show} />

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="logo">
          <div className="logo-mark">🎮 LiveGames IA</div>
          <div className="logo-sub">Powered by Claude</div>
        </div>
        <nav className="nav">
          <div className={`nav-item c-gray ${activePage === 'home' ? 'active' : ''}`} onClick={() => goPage('home')}><span className="nav-icon">🏠</span>Inicio</div>
          <div className="nav-divider"></div>
          <div className={`nav-item c-pink ${activePage === 'vote' ? 'active' : ''}`} onClick={() => goPage('vote')}><span className="nav-icon">🗳️</span>Votación</div>
          <div className={`nav-item c-yellow ${activePage === 'roulette' ? 'active' : ''}`} onClick={() => goPage('roulette')}><span className="nav-icon">🎰</span>Ruleta</div>
          <div className={`nav-item c-purple ${activePage === 'trivia' ? 'active' : ''}`} onClick={() => goPage('trivia')}><span className="nav-icon">❓</span>Trivia</div>
          <div className={`nav-item c-cyan ${activePage === 'challenge' ? 'active' : ''}`} onClick={() => goPage('challenge')}><span className="nav-icon">🎯</span>Reto del Día</div>
          <div className={`nav-item c-green ${activePage === 'music' ? 'active' : ''}`} onClick={() => goPage('music')}><span className="nav-icon">🎵</span>Adivina la Canción</div>
          <div className={`nav-item c-purple ${activePage === 'football' ? 'active' : ''}`} onClick={() => goPage('football')}><span className="nav-icon">⚽</span>Resúmenes de Fútbol</div>
          <div className="nav-divider"></div>
          <div className={`nav-item c-pink ${activePage === 'streaming' ? 'active' : ''}`} onClick={() => window.location.href = '/admin/streaming-daily'}><span className="nav-icon">📺</span>Streaming</div>
          <div className={`nav-item c-gray ${activePage === 'editor' ? 'active' : ''}`} onClick={() => goPage('editor')}><span className="nav-icon">✏️</span>Editor</div>
        </nav>
        <div className="sidebar-footer">
          <div className="live-pill"><div className="live-dot"></div>EN VIVO</div>
          <div style={{ fontSize: '10px', color: 'var(--text2)', textAlign: 'center', marginTop: '10px', wordBreak: 'break-all' }}>
            {session.user.email}
          </div>
        </div>
      </aside>
      <div className={`sidebar-overlay ${sidebarOpen ? 'sidebar-overlay-show' : ''}`} onClick={() => setSidebarOpen(false)} />

      <main className="main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
            <div className="page-title">
              {activePage === 'home' ? '🏠 Inicio' :
                activePage === 'vote' ? '🗳️ Votación' :
                  activePage === 'roulette' ? '🎰 Ruleta' :
                    activePage === 'trivia' ? '❓ Trivia' :
                      activePage === 'challenge' ? '🎯 Reto del Día' :
                        activePage === 'music' ? '🎵 Adivina la Canción' : '✏️ Editor'}
            </div>
          </div>
          <div className="topbar-right">
            <button className="tb-btn" onClick={() => goPage('editor')}>✏️ Editor</button>
            <button className="tb-btn" onClick={triggerConfetti}>🎉 Confeti</button>
            <button className="tb-btn" onClick={handleLogout} style={{ color: 'var(--pink)', borderColor: 'rgba(254,44,85,.3)' }}>🚪 Salir</button>
          </div>
        </div>

        <div className="content">
          {activePage === 'home' && (
            <div className="page active" style={{ animation: 'fadeUp .35s ease' }}>
              <p style={{ fontSize: '14px', color: 'var(--text2)', fontWeight: 700, marginBottom: '18px' }}>
                Usa el <strong style={{ color: 'var(--purple)' }}>✏️ Editor</strong> para generar contenido con IA y configurar cada juego antes de tu live 🔥
              </p>
              <div className="home-grid">
                <div className="game-card gc-vote" onClick={() => goPage('vote')}>
                  <span className="gc-icon">🗳️</span><div className="gc-name">Votación</div><div className="gc-desc">Pregunta vs pregunta en tiempo real.</div><span className="gc-tag t-pink">Live</span><button className="gc-btn btn-pink">▶ Jugar</button>
                </div>
                <div className="game-card gc-roulette" onClick={() => goPage('roulette')}>
                  <span className="gc-icon">🎰</span><div className="gc-name">Ruleta</div><div className="gc-desc">Gira y descubre el reto del momento.</div><span className="gc-tag t-yellow">Live</span><button className="gc-btn btn-yellow">▶ Jugar</button>
                </div>
                <div className="game-card gc-trivia" onClick={() => goPage('trivia')}>
                  <span className="gc-icon">❓</span><div className="gc-name">Trivia</div><div className="gc-desc">Preguntas con opciones para el chat.</div><span className="gc-tag t-purple">Live</span><button className="gc-btn btn-purple">▶ Jugar</button>
                </div>
                <div className="game-card gc-challenge" onClick={() => goPage('challenge')}>
                  <span className="gc-icon">🎯</span><div className="gc-name">Reto del Día</div><div className="gc-desc">Un reto diferente cada vez.</div><span className="gc-tag t-cyan">Live</span><button className="gc-btn btn-cyan">▶ Jugar</button>
                </div>
                <div className="game-card gc-music" onClick={() => goPage('music')}>
                  <span className="gc-icon">🎵</span><div className="gc-name">Adivina Canción</div><div className="gc-desc">Pistas + música de YouTube en vivo.</div><span className="gc-tag t-green">Live</span><button className="gc-btn btn-green">▶ Jugar</button>
                </div>
              </div>
            </div>
          )}

          {activePage === 'vote' && (
            <div className="page active" style={{ animation: 'fadeUp .35s ease' }}>
              <div className="split">
                <div className="split-left">
                  <div className="panel">
                    <div className="vote-total-bar">
                      <div className="vtb-line"></div>
                      <div className="vtb-count">🗳️ {(vote.vA + vote.vB).toLocaleString()} votos</div>
                      <div className="vtb-line"></div>
                    </div>
                    <div className="vote-q">{vote.q}</div>
                    <div className="vote-options" style={{ marginTop: '18px' }}>
                      <div className={`vopt vopt-a`} onClick={() => { setVote({ ...vote, vA: vote.vA + 1 }); triggerConfetti(); }}>
                        <span className="vo-emoji">{vote.eA}</span>
                        <div className="vo-name">{vote.nA}</div>
                        <div className="vo-pct">{vote.vA + vote.vB > 0 ? Math.round((vote.vA / (vote.vA + vote.vB)) * 100) : 0}%</div>
                        <div className="vo-cnt">{vote.vA.toLocaleString()} votos</div>
                        <div className="vo-bar"><div className="vo-fill fill-a" style={{ width: `${vote.vA + vote.vB > 0 ? (vote.vA / (vote.vA + vote.vB)) * 100 : 0}%` }}></div></div>
                      </div>
                      <div className={`vopt vopt-b`} onClick={() => { setVote({ ...vote, vB: vote.vB + 1 }); triggerConfetti(); }}>
                        <span className="vo-emoji">{vote.eB}</span>
                        <div className="vo-name">{vote.nB}</div>
                        <div className="vo-pct">{vote.vA + vote.vB > 0 ? Math.round((vote.vB / (vote.vA + vote.vB)) * 100) : 0}%</div>
                        <div className="vo-cnt">{vote.vB.toLocaleString()} votos</div>
                        <div className="vo-bar"><div className="vo-fill fill-b" style={{ width: `${vote.vA + vote.vB > 0 ? (vote.vB / (vote.vA + vote.vB)) * 100 : 0}%` }}></div></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="split-right">
                  <div className="panel">
                    <div className="panel-title">Controles</div>
                    <div className="ctrl-group">
                      <button className="ctrl-btn ctrl-primary" onClick={() => { setVote({ ...vote, vA: vote.vA + 1 }); }}>{vote.eA} +1 {vote.nA}</button>
                      <button className="ctrl-btn ctrl-secondary" style={{ borderColor: 'rgba(155,93,229,.3)', color: 'var(--purple)' }} onClick={() => { setVote({ ...vote, vB: vote.vB + 1 }); }}>{vote.eB} +1 {vote.nB}</button>
                      <button className="ctrl-btn ctrl-danger" onClick={() => { if (window.confirm('¿Reiniciar votos?')) { setVote({ ...vote, vA: 0, vB: 0 }); showToast('✅ Votos reiniciados'); } }}>🗑️ Reiniciar votos</button>
                      <button className="ctrl-btn ctrl-secondary" onClick={() => goPage('editor')} style={{ marginTop: '4px' }}>✏️ Editar votación</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activePage === 'roulette' && (
            <Roulette items={roulette} onShowEditor={() => goPage('editor')} triggerConfetti={triggerConfetti} />
          )}

          {activePage === 'trivia' && (
            <Trivia items={trivia} idx={triviaIdx} setIdx={setTriviaIdx} timerSeconds={timerTrivia} onShowEditor={() => goPage('editor')} triggerConfetti={triggerConfetti} />
          )}

          {activePage === 'challenge' && (
            <Challenge items={challenges} idx={challengeIdx} setIdx={setChallengeIdx} onShowEditor={() => goPage('editor')} triggerConfetti={triggerConfetti} />
          )}

          {activePage === 'music' && (
            <Music items={songs} idx={songIdx} setIdx={setSongIdx} timerSeconds={timerMusic} onShowEditor={() => goPage('editor')} triggerConfetti={triggerConfetti} />
          )}

          <div style={{ display: activePage === 'football' ? 'block' : 'none' }}>
            <Football />
          </div>

          {activePage === 'editor' && (
            <Editor
              vote={vote} setVote={setVote}
              roulette={roulette} setRoulette={setRoulette}
              trivia={trivia} setTrivia={setTrivia}
              challenges={challenges} setChallenges={setChallenges}
              songs={songs} setSongs={setSongs}
              timerTrivia={timerTrivia} setTimerTrivia={setTimerTrivia}
              timerMusic={timerMusic} setTimerMusic={setTimerMusic}
              triggerConfetti={triggerConfetti}
            />
          )}

        </div>
      </main>
    </div>
  );
}

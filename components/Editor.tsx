import React, { useState } from 'react';

export default function Editor({
  vote, setVote,
  roulette, setRoulette,
  trivia, setTrivia,
  challenges, setChallenges,
  songs, setSongs,
  timerTrivia, setTimerTrivia,
  timerMusic, setTimerMusic,
  triggerConfetti
}: any) {
  const [etab, setEtab] = useState('vote');

  const [localVote, setLocalVote] = useState(vote);
  const [localRoulette, setLocalRoulette] = useState(roulette);
  const [localTrivia, setLocalTrivia] = useState(trivia);
  const [localChallenges, setLocalChallenges] = useState(challenges);
  const [localSongs, setLocalSongs] = useState(songs);
  
  const [localTimerTrivia, setLocalTimerTrivia] = useState(timerTrivia);
  const [localTimerMusic, setLocalTimerMusic] = useState(timerMusic);

  // AI Inputs
  const [aiInputs, setAiInputs] = useState({ vote: '', roulette: '', trivia: '', challenge: '', music: '' });
  const [loading, setLoading] = useState({ vote: false, roulette: false, trivia: false, challenge: false, music: false });

  const saveVote = () => { setVote(localVote); triggerConfetti(); alert("✅ Votación guardada"); };
  const saveRoulette = () => { setRoulette(localRoulette.filter((r:string) => r.trim())); triggerConfetti(); alert("✅ Ruleta guardada"); };
  const saveTrivia = () => { setTrivia(localTrivia); triggerConfetti(); alert("✅ Trivia guardada"); };
  const saveChallenge = () => { setChallenges(localChallenges.filter((c:string) => c.trim())); triggerConfetti(); alert("✅ Retos guardados"); };
  const saveMusic = () => { setSongs(localSongs); triggerConfetti(); alert("✅ Canciones guardadas"); };

  const handleAiGeneration = async (type: 'vote' | 'roulette' | 'trivia' | 'challenge' | 'music') => {
    const input = aiInputs[type].trim();
    if (!input) return alert('⚠️ Escribe un tema primero');

    setLoading({ ...loading, [type]: true });

    let prompt = '';
    if (type === 'vote') {
      prompt = `Asistente TikTok Live. Genera una votación para el tema: "${input}"\nDevuelve SOLO JSON:\n{"q":"PREGUNTA MAYÚSCULAS (máx 60 chars)","eA":"emoji A","nA":"Nombre A (máx 25 chars)","eB":"emoji B","nB":"Nombre B (máx 25 chars)"}`;
    } else if (type === 'roulette') {
      prompt = `Asistente TikTok Live. Genera 8 retos para el tema: "${input}"\nDevuelve SOLO JSON:\n{"retos":["Reto 1 🎯","Reto 2 😂",...8 total]}\nRetos cortos (máx 60 chars), divertidos, con emoji al final.`;
    } else if (type === 'trivia') {
      prompt = `Asistente TikTok Live. Genera 5 preguntas de trivia sobre: "${input}"\nDevuelve SOLO JSON:\n{"preguntas":[{"q":"¿PREGUNTA MAYÚSCULAS?","opts":["A","B","C","D"],"correct":0}]}\n"correct" es el índice (0-3) de la respuesta correcta.`;
    } else if (type === 'challenge') {
      prompt = `Asistente TikTok Live. Genera 8 retos del día sobre: "${input}"\nDevuelve SOLO JSON:\n{"retos":["Reto 🎯",...]}\nMáx 80 chars, con emoji, realizables en vivo.`;
    } else if (type === 'music') {
      prompt = `Asistente TikTok Live. Canción: "${input}"\nDevuelve SOLO JSON:\n{"emoji":"emoji","song":"nombre oficial","artist":"artista","year":"año","clues":[{"type":"Género 🎸","value":"..."},{"type":"Primera letra 🔤","value":"Empieza con X"},{"type":"Pista de letra ✍️","value":"frase famosa"},{"type":"Dato curioso 🌟","value":"..."}]}\nLas pistas no deben revelar el título directamente.`;
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Error en la generación');
      
      const parsed = JSON.parse(data.result);

      if (type === 'vote') {
        setLocalVote({ ...localVote, ...parsed, vA: 0, vB: 0 });
      } else if (type === 'roulette') {
        setLocalRoulette(parsed.retos);
      } else if (type === 'trivia') {
        setLocalTrivia(parsed.preguntas);
      } else if (type === 'challenge') {
        setLocalChallenges(parsed.retos);
      } else if (type === 'music') {
        // Mantener las URLs si vienen del generador, sino usar cadenas vacías
        setLocalSongs([...localSongs, { 
          ...parsed, 
          ytUrl: parsed.ytUrl || '', 
          instrumentalUrl: parsed.instrumentalUrl || '' 
        }]);
      }
      
      setAiInputs({ ...aiInputs, [type]: '' });
      triggerConfetti();
      alert('✅ Generación exitosa. ¡No olvides guardar!');
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setLoading({ ...loading, [type]: false });
    }
  };

  return (
    <div className="page active" style={{ animation: 'fadeUp .35s ease' }}>
      <div className="editor-layout">
        <div className="editor-nav">
          <div className={`etab ${etab === 'vote' ? 'active' : ''}`} onClick={() => setEtab('vote')}>🗳️ Votación</div>
          <div className={`etab ${etab === 'roulette' ? 'active' : ''}`} onClick={() => setEtab('roulette')}>🎰 Ruleta</div>
          <div className={`etab ${etab === 'trivia' ? 'active' : ''}`} onClick={() => setEtab('trivia')}>❓ Trivia</div>
          <div className={`etab ${etab === 'challenge' ? 'active' : ''}`} onClick={() => setEtab('challenge')}>🎯 Retos</div>
          <div className={`etab ${etab === 'music' ? 'active' : ''}`} onClick={() => setEtab('music')}>🎵 Canciones</div>
          <div className={`etab ${etab === 'timers' ? 'active' : ''}`} onClick={() => setEtab('timers')}>⏱️ Timers</div>
        </div>
        
        <div className="editor-body">
          {etab === 'vote' && (
            <div className="esec active">
              <div className="ai-box">
                <div className="ai-box-title">🤖 IA — Generar votación</div>
                <div className="ai-input-row">
                  <input className="ai-input" placeholder="Ej: ¿Pizza o hamburguesa?..." value={aiInputs.vote} onChange={e => setAiInputs({...aiInputs, vote: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleAiGeneration('vote')} disabled={loading.vote} />
                  <button className="ai-btn" onClick={() => handleAiGeneration('vote')} disabled={loading.vote}>{loading.vote ? '⏳ Generando...' : '✨ Generar'}</button>
                </div>
                <div className="ai-hint">💡 Escribe el tema y la IA completa opciones + emojis</div>
              </div>
              <div className="fl">Pregunta</div>
              <input className="fi" value={localVote.q} onChange={e => setLocalVote({...localVote, q: e.target.value})} />
              <div className="eg2">
                <div><div className="fl">Emoji A</div><input className="fi" value={localVote.eA} onChange={e => setLocalVote({...localVote, eA: e.target.value})} /></div>
                <div><div className="fl">Nombre A</div><input className="fi" value={localVote.nA} onChange={e => setLocalVote({...localVote, nA: e.target.value})} /></div>
                <div><div className="fl">Emoji B</div><input className="fi" value={localVote.eB} onChange={e => setLocalVote({...localVote, eB: e.target.value})} /></div>
                <div><div className="fl">Nombre B</div><input className="fi" value={localVote.nB} onChange={e => setLocalVote({...localVote, nB: e.target.value})} /></div>
              </div>
              <button className="save-btn" onClick={saveVote}>💾 Guardar votación</button>
            </div>
          )}

          {etab === 'roulette' && (
            <div className="esec active">
              <div className="ai-box">
                <div className="ai-box-title">🤖 IA — Generar retos</div>
                <div className="ai-input-row">
                  <input className="ai-input" placeholder="Ej: retos divertidos para TikTok Live..." value={aiInputs.roulette} onChange={e => setAiInputs({...aiInputs, roulette: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleAiGeneration('roulette')} disabled={loading.roulette} />
                  <button className="ai-btn" onClick={() => handleAiGeneration('roulette')} disabled={loading.roulette}>{loading.roulette ? '⏳ Generando...' : '✨ Generar'}</button>
                </div>
                <div className="ai-hint">💡 La IA genera 8 retos y actualiza la ruleta</div>
              </div>
              <div className="fl">Retos de la ruleta</div>
              <div>
                {localRoulette.map((r: string, i: number) => (
                  <div className="item-row" key={i}>
                    <div className="item-n">{i + 1}</div>
                    <input className="item-inp" value={r} onChange={e => {
                      const newR = [...localRoulette]; newR[i] = e.target.value; setLocalRoulette(newR);
                    }} />
                    <button className="item-del" onClick={() => setLocalRoulette(localRoulette.filter((_:any, j:number) => j !== i))}>✕</button>
                  </div>
                ))}
              </div>
              <button className="add-btn" onClick={() => setLocalRoulette([...localRoulette, 'Nuevo reto 🎯'])}>+ Agregar reto</button>
              <button className="save-btn" onClick={saveRoulette}>💾 Guardar ruleta</button>
            </div>
          )}

          {etab === 'trivia' && (
            <div className="esec active">
              <div className="ai-box">
                <div className="ai-box-title">🤖 IA — Generar preguntas</div>
                <div className="ai-input-row">
                  <input className="ai-input" placeholder="Ej: cultura general, historia..." value={aiInputs.trivia} onChange={e => setAiInputs({...aiInputs, trivia: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleAiGeneration('trivia')} disabled={loading.trivia} />
                  <button className="ai-btn" onClick={() => handleAiGeneration('trivia')} disabled={loading.trivia}>{loading.trivia ? '⏳ Generando...' : '✨ Generar'}</button>
                </div>
                <div className="ai-hint">💡 La IA genera 5 preguntas con 4 opciones</div>
              </div>
              <div>
                {localTrivia.map((item: any, i: number) => (
                  <div className="trivia-item" key={i}>
                    <button className="del-t-btn" onClick={() => setLocalTrivia(localTrivia.filter((_:any, j:number) => j !== i))}>✕ Eliminar</button>
                    <div className="fl">Pregunta {i + 1}</div>
                    <input className="tq-inp" value={item.q} onChange={e => {
                      const newT = [...localTrivia]; newT[i].q = e.target.value; setLocalTrivia(newT);
                    }} />
                    <div className="to-grid">
                      {item.opts.map((o:string, j:number) => (
                        <input key={j} className={`to-inp ${j === item.correct ? 'correct-inp' : ''}`} value={o} onChange={e => {
                          const newT = [...localTrivia]; newT[i].opts[j] = e.target.value; setLocalTrivia(newT);
                        }} />
                      ))}
                    </div>
                    <div className="fl" style={{ marginTop: '8px' }}>Correcta</div>
                    <select className="cs" value={item.correct} onChange={e => {
                      const newT = [...localTrivia]; newT[i].correct = parseInt(e.target.value); setLocalTrivia(newT);
                    }}>
                      {['A','B','C','D'].map((l, j) => (
                        <option key={j} value={j}>{l}: {item.opts[j]}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <button className="add-btn" onClick={() => setLocalTrivia([...localTrivia, { q: "¿NUEVA PREGUNTA?", opts: ["Opción A", "Opción B", "Opción C", "Opción D"], correct: 0 }])}>+ Agregar pregunta</button>
              <button className="save-btn" onClick={saveTrivia}>💾 Guardar trivia</button>
            </div>
          )}

          {etab === 'challenge' && (
            <div className="esec active">
              <div className="ai-box">
                <div className="ai-box-title">🤖 IA — Generar retos</div>
                <div className="ai-input-row">
                  <input className="ai-input" placeholder="Ej: retos físicos, sociales..." value={aiInputs.challenge} onChange={e => setAiInputs({...aiInputs, challenge: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleAiGeneration('challenge')} disabled={loading.challenge} />
                  <button className="ai-btn" onClick={() => handleAiGeneration('challenge')} disabled={loading.challenge}>{loading.challenge ? '⏳ Generando...' : '✨ Generar'}</button>
                </div>
              </div>
              <div className="fl">Lista de retos</div>
              <div>
                {localChallenges.map((c: string, i: number) => (
                  <div className="item-row" key={i}>
                    <div className="item-n">{i + 1}</div>
                    <input className="item-inp" value={c} onChange={e => {
                      const newC = [...localChallenges]; newC[i] = e.target.value; setLocalChallenges(newC);
                    }} />
                    <button className="item-del" onClick={() => setLocalChallenges(localChallenges.filter((_:any, j:number) => j !== i))}>✕</button>
                  </div>
                ))}
              </div>
              <button className="add-btn" onClick={() => setLocalChallenges([...localChallenges, 'Nuevo reto 🎯'])}>+ Agregar reto</button>
              <button className="save-btn" onClick={saveChallenge}>💾 Guardar retos</button>
            </div>
          )}

          {etab === 'music' && (
            <div className="esec active">
              <div className="ai-box">
                <div className="ai-box-title">🤖 IA — Generar canción</div>
                <div className="ai-input-row">
                  <input className="ai-input" placeholder="Ej: Flowers - Miley Cyrus, 2023..." value={aiInputs.music} onChange={e => setAiInputs({...aiInputs, music: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleAiGeneration('music')} disabled={loading.music} />
                  <button className="ai-btn" onClick={() => handleAiGeneration('music')} disabled={loading.music}>{loading.music ? '⏳ Generando...' : '✨ Generar'}</button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div className="fl" style={{ marginBottom: 0 }}>Canciones</div>
                <button className="tc-btn tc-start" onClick={() => setLocalSongs([...localSongs, { emoji: '🎵', song: 'Nueva canción', artist: 'Artista', year: '2024', ytUrl: '', instrumentalUrl: '', clues: [{ type: 'Género 🎸', value: 'Pop' }] }])}>+ Agregar manual</button>
              </div>
              <div>
                {localSongs.map((s: any, i: number) => (
                  <div key={i} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '18px', color: 'var(--green)' }}>Canción {i + 1} {s.emoji}</div>
                      <button className="item-del" onClick={() => { if(window.confirm('¿Eliminar?')) setLocalSongs(localSongs.filter((_:any, j:number) => j !== i)); }}>✕</button>
                    </div>
                    <div className="eg2" style={{ marginBottom: 0 }}>
                      <div><div className="fl">Emoji</div><input className="fi" style={{ marginBottom: '8px' }} value={s.emoji} onChange={e => { const n = [...localSongs]; n[i].emoji = e.target.value; setLocalSongs(n); }} /></div>
                      <div><div className="fl">Año</div><input className="fi" style={{ marginBottom: '8px' }} value={s.year} onChange={e => { const n = [...localSongs]; n[i].year = e.target.value; setLocalSongs(n); }} /></div>
                    </div>
                    <div className="fl">Canción</div><input className="fi" value={s.song} onChange={e => { const n = [...localSongs]; n[i].song = e.target.value; setLocalSongs(n); }} />
                    <div className="fl">Artista</div><input className="fi" value={s.artist} onChange={e => { const n = [...localSongs]; n[i].artist = e.target.value; setLocalSongs(n); }} />
                    <div className="fl" style={{ color: '#ff6666' }}>🎬 URL de YouTube (Original)</div>
                    <input className="fi fi-yt" style={{ marginBottom: '10px' }} placeholder="https://www.youtube.com/watch?v=..." value={s.ytUrl} onChange={e => { const n = [...localSongs]; n[i].ytUrl = e.target.value; setLocalSongs(n); }} />
                    <div className="fl" style={{ color: '#9b5de5' }}>🎹 URL de YouTube (Instrumental - Opcional)</div>
                    <input className="fi fi-yt" style={{ marginBottom: '10px' }} placeholder="https://www.youtube.com/watch?v=..." value={s.instrumentalUrl || ''} onChange={e => { const n = [...localSongs]; n[i].instrumentalUrl = e.target.value; setLocalSongs(n); }} />
                    <div className="fl">Pistas</div>
                    {s.clues.map((c: any, j: number) => (
                      <div key={j} style={{ display: 'flex', gap: '8px', marginBottom: '7px' }}>
                        <input className="fi" style={{ marginBottom: 0, flex: 1 }} value={c.type} placeholder="Tipo" onChange={e => { const n = [...localSongs]; n[i].clues[j].type = e.target.value; setLocalSongs(n); }} />
                        <input className="fi" style={{ marginBottom: 0, flex: 2 }} value={c.value} placeholder="Valor" onChange={e => { const n = [...localSongs]; n[i].clues[j].value = e.target.value; setLocalSongs(n); }} />
                        <button className="item-del" onClick={() => { const n = [...localSongs]; n[i].clues.splice(j, 1); setLocalSongs(n); }}>✕</button>
                      </div>
                    ))}
                    {s.clues.length < 4 && <button className="add-btn" style={{ marginTop: '4px' }} onClick={() => { const n = [...localSongs]; n[i].clues.push({ type: 'Pista', value: '...' }); setLocalSongs(n); }}>+ Agregar pista</button>}
                  </div>
                ))}
              </div>
              <button className="save-btn" onClick={saveMusic}>💾 Guardar canciones</button>
            </div>
          )}

          {etab === 'timers' && (
            <div className="esec active">
              <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '6px' }}>⏱️ Temporizadores</div>
              <div style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 600, marginBottom: '20px' }}>Cambios se aplican inmediatamente</div>
              
              <div style={{ background: 'rgba(155,93,229,.1)', border: '1px solid rgba(155,93,229,.3)', borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--purple)', marginBottom: '12px' }}>❓ Trivia</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                  <input className="fi" style={{ marginBottom: 0, flex: 1 }} type="number" min="5" max="300" value={localTimerTrivia} onChange={e => setLocalTimerTrivia(parseInt(e.target.value) || 30)} />
                  <button className="tc-btn tc-start" style={{ background: 'var(--purple)' }} onClick={() => { setTimerTrivia(localTimerTrivia); alert("✅ Timer actualizado"); }}>Aplicar</button>
                </div>
                <div className="timer-preset-grid">
                  {[15, 30, 45, 60].map(v => (
                    <button key={v} className={`tp-btn ${localTimerTrivia === v ? 'active-preset' : ''}`} onClick={() => { setLocalTimerTrivia(v); setTimerTrivia(v); }}>{v}s</button>
                  ))}
                </div>
              </div>

              <div style={{ background: 'rgba(0,245,160,.1)', border: '1px solid rgba(0,245,160,.3)', borderRadius: '14px', padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--green)', marginBottom: '12px' }}>🎵 Canción</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                  <input className="fi" style={{ marginBottom: 0, flex: 1 }} type="number" min="5" max="600" value={localTimerMusic} onChange={e => setLocalTimerMusic(parseInt(e.target.value) || 60)} />
                  <button className="tc-btn tc-start" onClick={() => { setTimerMusic(localTimerMusic); alert("✅ Timer actualizado"); }}>Aplicar</button>
                </div>
                <div className="timer-preset-grid">
                  {[30, 60, 90, 120].map(v => (
                    <button key={v} className={`tp-btn ${localTimerMusic === v ? 'active-preset' : ''}`} onClick={() => { setLocalTimerMusic(v); setTimerMusic(v); }}>{v === 120 ? '2min' : v + 's'}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

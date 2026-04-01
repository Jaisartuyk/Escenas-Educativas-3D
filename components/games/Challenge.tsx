import React from 'react';

export default function Challenge({ 
    items, 
    idx, 
    setIdx, 
    onShowEditor, 
    triggerConfetti 
}: { 
    items: string[], 
    idx: number, 
    setIdx: (i: number) => void, 
    onShowEditor: () => void, 
    triggerConfetti: () => void 
}) {
  const currentChallenge = items.length > 0 ? items[idx] : "Ve al Editor para generar retos con IA";

  const moveChallenge = (dir: number) => {
    if (!items.length) return;
    setIdx((idx + dir + items.length) % items.length);
  };

  const randomChallenge = () => {
    if (!items.length) return;
    setIdx(Math.floor(Math.random() * items.length));
    triggerConfetti();
  };

  return (
    <div className="page active" style={{ animation: 'fadeUp .35s ease' }}>
      <div className="split">
        <div className="split-left">
          <div className="panel">
            <div className="counter-badge" style={{ marginBottom: '14px' }}>
              Reto {items.length > 0 ? idx + 1 : 0} / {items.length}
            </div>
            <div className="challenge-big">
              <div style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '6px' }}>Reto número</div>
              <div className="ch-num">{items.length > 0 ? idx + 1 : 0}</div>
              <div className="ch-text">{currentChallenge}</div>
            </div>
          </div>
        </div>
        <div className="split-right">
          <div className="panel">
            <div className="panel-title">Controles</div>
            <div className="ctrl-group">
              <button className="ctrl-btn ctrl-cyan" onClick={randomChallenge}>🎲 Reto al azar</button>
              <div className="ctrl-grid2">
                <button className="ctrl-btn ctrl-secondary" style={{ justifyContent: 'center' }} onClick={() => moveChallenge(-1)}>◀ Anterior</button>
                <button className="ctrl-btn ctrl-secondary" style={{ justifyContent: 'center' }} onClick={() => moveChallenge(1)}>Siguiente ▶</button>
              </div>
              <button className="ctrl-btn ctrl-secondary" onClick={onShowEditor} style={{ marginTop: '4px' }}>✏️ Editar retos</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

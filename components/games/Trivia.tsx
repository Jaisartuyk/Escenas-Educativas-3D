import React, { useState, useEffect } from 'react';

const CIRC = 358.1;

export default function Trivia({
  items,
  idx,
  setIdx,
  onShowEditor,
  triggerConfetti,
  timerSeconds
}: {
  items: { q: string, opts: string[], correct: number }[],
  idx: number,
  setIdx: (i: number) => void,
  onShowEditor: () => void,
  triggerConfetti: () => void,
  timerSeconds: number
}) {
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [timerState, setTimerState] = useState<'stopped' | 'running' | 'paused' | 'done'>('stopped');

  const currentItem = items.length > 0 ? items[idx] : null;

  // Reset local state when idx or items change
  useEffect(() => {
    setAnswered(false);
    setTimeLeft(timerSeconds);
    setTimerState('stopped');
  }, [idx, items, timerSeconds]);

  // Timer effect
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

  const handleAnswer = (optIdx: number) => {
    if (answered || !currentItem) return;
    setAnswered(true);
    if (optIdx === currentItem.correct) triggerConfetti();
  };

  const pct = timerSeconds > 0 ? timeLeft / timerSeconds : 1;
  const offset = CIRC * (1 - pct);
  const useCol = pct <= 0.2 ? 'var(--pink)' : pct <= 0.4 ? 'var(--yellow)' : 'var(--purple)';

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
          <div className="panel">
            <div className="counter-badge" style={{ marginBottom: '14px' }}>
              Pregunta {items.length > 0 ? idx + 1 : 0} / {items.length}
            </div>
            <div className="trivia-q">
              {currentItem ? currentItem.q : "Ve al Editor para generar preguntas de trivia con IA"}
            </div>
            <div className="trivia-opts">
              {currentItem?.opts.map((o, i) => (
                <div
                  key={i}
                  className={`topt ${answered ? (i === currentItem.correct ? 'correct' : 'wrong') + ' disabled' : ''}`}
                  onClick={() => handleAnswer(i)}
                >
                  <div className="opt-badge">{'ABCD'[i]}</div>
                  {o}
                </div>
              ))}
            </div>
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
                <button className="ctrl-btn ctrl-purple" style={{ justifyContent: 'center' }} onClick={() => items.length && setIdx((idx + 1) % items.length)}>Siguiente ▶</button>
              </div>
              <button className="ctrl-btn ctrl-secondary" onClick={() => setAnswered(false)}>🔄 Resetear respuesta</button>
              <button className="ctrl-btn ctrl-secondary" onClick={onShowEditor} style={{ marginTop: '4px' }}>✏️ Editar trivia</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

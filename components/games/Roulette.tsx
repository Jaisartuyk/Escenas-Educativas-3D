import React, { useEffect, useRef, useState } from 'react';

const WCOLS = ['#fe2c55', '#ffcc00', '#9b5de5', '#25f4ee', '#ff6d00', '#00f5a0', '#f72585', '#4cc9f0'];

export default function Roulette({ items, onShowEditor, triggerConfetti }: { items: string[], onShowEditor: () => void, triggerConfetti: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spinning, setSpinning] = useState(false);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [result, setResult] = useState<{ num: number, text: string } | null>(null);

  const drawWheelRaw = (ctx: CanvasRenderingContext2D, items: string[], angle: number) => {
    const n = items.length;
    if (!n) {
      ctx.clearRect(0, 0, 340, 340);
      return;
    }
    const cx = 170, cy = 170, r = 162, arc = (2 * Math.PI) / n;
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.translate(-cx, -cy);
    ctx.clearRect(0, 0, 340, 340);
    
    for (let i = 0; i < n; i++) {
      const s = arc * i - Math.PI / 2;
      const e = s + arc;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, s, e);
      ctx.closePath();
      ctx.fillStyle = WCOLS[i % WCOLS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(s + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.font = 'bold 18px Outfit';
      ctx.fillText((i + 1).toString(), r - 14, 6);
      ctx.restore();
    }
    
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, 2 * Math.PI);
    ctx.fillStyle = '#0a0a0f';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) drawWheelRaw(ctx, items, wheelAngle);
    }
  }, [items, wheelAngle]);

  const spinWheel = () => {
    if (spinning) return;
    if (!items.length) return alert('⚠️ Agrega retos en el Editor primero');
    
    setSpinning(true);
    setResult(null);
    
    const n = items.length;
    const arc = (2 * Math.PI) / n;
    
    // Generar un ángulo final aleatorio
    const spins = (6 + Math.random() * 4) * 2 * Math.PI;
    const randomAngle = Math.random() * 2 * Math.PI;
    const currentMod = ((wheelAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    let delta = randomAngle - currentMod;
    if (delta < 0) delta += 2 * Math.PI;
    const finalDelta = spins + delta;
    
    // Calcular el ángulo final de la rueda
    const finalWheelAngle = (wheelAngle + finalDelta) % (2 * Math.PI);
    
    // La flecha apunta a -π/2. Necesitamos encontrar qué segmento contiene ese ángulo.
    // El segmento i (sin rotación) comienza en: arc * i - π/2
    // Después de rotar con finalWheelAngle, comienza en: arc * i - π/2 + finalWheelAngle
    // La flecha está en -π/2, así que necesitamos: arc * i - π/2 + finalWheelAngle <= -π/2 < arc * (i+1) - π/2 + finalWheelAngle
    // Simplificando: arc * i + finalWheelAngle <= 0 < arc * (i+1) + finalWheelAngle
    // arc * i <= -finalWheelAngle < arc * (i+1)
    // i <= -finalWheelAngle / arc < i+1
    const arrowAngle = -Math.PI / 2;
    // Ángulo relativo desde el inicio del segmento 0 (que está en -π/2 sin rotación)
    const relativeAngle = ((arrowAngle - finalWheelAngle + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const target = Math.floor(relativeAngle / arc) % n;
    
    const dur = 4200;
    const t0 = performance.now();
    
    const frame = (now: number) => {
      const prog = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - prog, 4);
      const ang = wheelAngle + finalDelta * ease;
      
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) drawWheelRaw(ctx, items, ang);
      }
      
      if (prog < 1) {
        requestAnimationFrame(frame);
      } else {
        setWheelAngle(wheelAngle + finalDelta);
        setSpinning(false);
        setResult({ num: target + 1, text: items[target] });
        triggerConfetti();
      }
    };
    requestAnimationFrame(frame);
  };

  return (
    <div className="page active" style={{ animation: 'fadeUp .35s ease' }}>
      <div className="split">
        <div className="split-left">
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
            <div className="wheel-wrap">
              <div className="wheel-pointer">▼</div>
              <canvas ref={canvasRef} width="340" height="340"></canvas>
              <div className="wheel-center-btn">🎰</div>
            </div>
            <button className="spin-btn" disabled={spinning} onClick={spinWheel}>¡ GIRAR !</button>
            {result && (
              <div className="spin-result show">
                <div className="sr-label">¡Cayó el número!</div>
                <div className="sr-num">{result.num}</div>
                <div className="sr-text">{result.text}</div>
              </div>
            )}
          </div>
        </div>
        <div className="split-right">
          <div className="panel">
            <div className="panel-title">Controles</div>
            <div className="ctrl-group">
              <button className="ctrl-btn ctrl-yellow" onClick={spinWheel} disabled={spinning}>🎰 Girar ruleta</button>
              <button className="ctrl-btn ctrl-secondary" onClick={() => setResult(null)}>✕ Ocultar resultado</button>
              <button className="ctrl-btn ctrl-secondary" onClick={onShowEditor} style={{ marginTop: '4px' }}>✏️ Editar retos</button>
            </div>
          </div>
          <div className="panel">
            <div className="panel-title">Retos actuales</div>
            <div>
              {items.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'var(--bg3)', borderRadius: '9px', fontSize: '12px', marginBottom: '5px' }}>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '16px', color: WCOLS[i % WCOLS.length], width: '18px', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

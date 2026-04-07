'use client'
// src/components/horarios/steps/StepInstitucion.tsx

import type { InstitucionConfig } from '@/types/horarios'
import { HORARIOS_MATUTINA, HORARIOS_VESPERTINA, DEFAULT_CURSOS_ESCUELA, DEFAULT_CURSOS_COLEGIO } from '@/types/horarios'

interface Props {
  config: InstitucionConfig
  onChange: (c: InstitucionConfig) => void
  onNext: () => void
}

export function StepInstitucion({ config, onChange, onNext }: Props) {
  function set<K extends keyof InstitucionConfig>(key: K, val: InstitucionConfig[K]) {
    onChange({ ...config, [key]: val })
  }

  function handleJornada(j: 'MATUTINA' | 'VESPERTINA') {
    onChange({ ...config, jornada: j, horarios: j === 'VESPERTINA' ? HORARIOS_VESPERTINA : HORARIOS_MATUTINA })
  }

  function handleNivel(n: 'Escuela' | 'Colegio') {
    const cursos = n === 'Escuela' ? [...DEFAULT_CURSOS_ESCUELA] : [...DEFAULT_CURSOS_COLEGIO]
    onChange({ ...config, nivel: n, cursos, tutores: {} })
  }

  function handleHorario(i: number, val: string) {
    const h = [...config.horarios]
    h[i] = val
    onChange({ ...config, horarios: h })
  }

  function handleCursos(raw: string) {
    const cursos = raw.split(',').map(s => s.trim()).filter(Boolean)
    const tutores = { ...config.tutores }
    onChange({ ...config, cursos, tutores })
  }

  function handleTutor(curso: string, val: string) {
    onChange({ ...config, tutores: { ...config.tutores, [curso]: val } })
  }

  return (
    <div>
      <div className="card p-6 mb-4">
        <h2 className="font-display text-base font-bold tracking-tight mb-5">Datos institucionales</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="col-span-3">
            <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nombre de la institución</label>
            <input value={config.nombre} onChange={e => set('nombre', e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nivel</label>
            <select value={config.nivel ?? 'Colegio'} onChange={e => handleNivel(e.target.value as any)} className="input-base">
              <option value="Colegio">Colegio / Bachillerato</option>
              <option value="Escuela">Escuela / Básica</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Jornada</label>
            <select value={config.jornada} onChange={e => handleJornada(e.target.value as any)} className="input-base">
              <option value="VESPERTINA">VESPERTINA</option>
              <option value="MATUTINA">MATUTINA</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Año lectivo</label>
            <input value={config.anio} onChange={e => set('anio', e.target.value)} className="input-base" />
          </div>
          <div className="col-span-3">
            <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Cursos (separados por coma)</label>
            <input
              value={config.cursos.join(', ')}
              onChange={e => handleCursos(e.target.value)}
              className="input-base"
              placeholder="8VO, 9NO, 10MO, 1ERO BGU, 2DO BGU, 3ERO BGU"
            />
          </div>
        </div>

        {/* Horarios por período */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-3">Horario de cada período</label>
          <div className="grid grid-cols-2 gap-2">
            {config.horarios.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 4
                    ? 'bg-[rgba(38,215,180,0.15)] text-teal'
                    : 'bg-[rgba(124,109,250,0.1)] text-violet2'
                }`}>
                  {i === 4 ? 'R' : i + 1}
                </span>
                <input
                  value={h}
                  onChange={e => handleHorario(i, e.target.value)}
                  className="input-base text-sm"
                  placeholder="HH:MM-HH:MM"
                />
                {i === 4 && <span className="text-[11px] text-teal font-semibold whitespace-nowrap">Receso</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tutores por curso */}
      <div className="card p-6 mb-5">
        <h2 className="font-display text-base font-bold tracking-tight mb-4">Tutores por curso</h2>
        <div className="grid grid-cols-2 gap-3">
          {config.cursos.map(curso => (
            <div key={curso}>
              <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">{curso}</label>
              <input
                value={config.tutores[curso] ?? ''}
                onChange={e => handleTutor(curso, e.target.value)}
                className="input-base text-sm"
                placeholder="Nombre del tutor..."
              />
            </div>
          ))}
        </div>
      </div>

      <button onClick={onNext} className="btn-primary px-8 py-3">Continuar →</button>
    </div>
  )
}

'use client'
// src/components/horarios/steps/StepInstitucion.tsx

import type { InstitucionConfig } from '@/types/horarios'
import type { Docente } from '@/types/horarios'

interface Props {
  config: InstitucionConfig
  onChange: (c: InstitucionConfig) => void
  onNext: () => void
  docentes?: Docente[]
}

export function StepInstitucion({ config, onChange, onNext, docentes = [] }: Props) {
  function set<K extends keyof InstitucionConfig>(key: K, val: InstitucionConfig[K]) {
    onChange({ ...config, [key]: val })
  }

  function handleHorario(i: number, val: string) {
    const h = [...config.horarios]
    h[i] = val
    onChange({ ...config, horarios: h })
  }

  function handleAddPeriod() {
    const n = Math.min((config.nPeriodos || 8) + 1, 15)
    const h = [...config.horarios]
    while (h.length < n) h.push('')
    onChange({ ...config, nPeriodos: n, horarios: h })
  }

  function handleRemovePeriod() {
    const n = Math.max((config.nPeriodos || 8) - 1, 4)
    const h = [...config.horarios].slice(0, n)
    // Filter out recesos that are out of bounds
    const recesos = (config.recesos || [4]).filter(r => r < n)
    onChange({ ...config, nPeriodos: n, horarios: h, recesos })
  }

  function toggleReceso(i: number) {
    const current = config.recesos || [4]
    if (current.includes(i)) {
      onChange({ ...config, recesos: current.filter(r => r !== i) })
    } else {
      onChange({ ...config, recesos: [...current, i].sort((a,b)=>a-b) })
    }
  }

  function handleTutor(curso: string, val: string) {
    onChange({ ...config, tutores: { ...config.tutores, [curso]: val } })
  }

  return (
    <div>
      <div className="card p-6 mb-4">
        <h2 className="font-display text-base font-bold tracking-tight mb-5">Datos institucionales</h2>

        {/* Info badges — nivel, jornada y cursos vienen del selector de slot y la DB */}
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl bg-[rgba(124,109,250,0.05)] border border-[rgba(120,100,255,0.12)]">
          <span className="text-sm">
            {config.nivel === 'Escuela' ? '🏫' : '🎓'}
          </span>
          <span className="text-sm font-medium text-ink2">
            {config.nivel === 'Escuela' ? 'Escuela / Básica' : 'Colegio / Bachillerato'}
          </span>
          <span className="text-ink4 text-xs">•</span>
          <span className="text-sm text-ink3">
            {config.jornada === 'MATUTINA' ? '🌅 Matutina' : '🌇 Vespertina'}
          </span>
          <span className="text-ink4 text-xs">•</span>
          <span className="text-sm text-ink3">
            {config.cursos.length} curso{config.cursos.length !== 1 ? 's' : ''}
          </span>
          {config.cursos.length > 0 && (
            <>
              <span className="text-ink4 text-xs">→</span>
              <div className="flex flex-wrap gap-1">
                {config.cursos.map(c => (
                  <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(124,109,250,0.1)] text-violet2 font-medium">{c}</span>
                ))}
              </div>
            </>
          )}
        </div>
        <p className="text-[11px] text-ink4 mb-4">
          El nivel, jornada y cursos se configuran en <strong>Mi Institución</strong> y se seleccionan desde el selector de horarios.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nombre de la institución</label>
            <input value={config.nombre} onChange={e => set('nombre', e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Año lectivo</label>
            <input value={config.anio} onChange={e => set('anio', e.target.value)} className="input-base" />
          </div>
        </div>

        {/* Horarios por período */}
        <div>
          <div className="flex items-center justify-between mb-3 border-t border-[rgba(0,0,0,0.05)] pt-4 mt-2">
             <label className="text-[11px] font-bold uppercase tracking-[.5px] text-ink3">Bloques y Recreos de Clase ({(config.nPeriodos || 8) - (config.recesos?.length || 0)} Horas + {config.recesos?.length || 0} Recreo{(config.recesos?.length || 0) !== 1 ? 's' : ''})</label>
             <div className="flex gap-2">
               <button onClick={handleRemovePeriod} className="w-6 h-6 flex items-center justify-center rounded-md bg-surface2 text-ink3 hover:bg-surface border border-transparent transition-colors font-bold text-sm">-</button>
               <button onClick={handleAddPeriod} className="w-6 h-6 flex items-center justify-center rounded-md bg-surface2 text-ink3 hover:bg-surface border border-transparent transition-colors font-bold text-sm">+</button>
             </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(() => {
              let classNum = 0 // counter that skips recreos
              return (config.horarios.slice(0, config.nPeriodos || 8)).map((h, i) => {
              const isReceso = (config.recesos || [4]).includes(i)
              if (!isReceso) classNum++
              return (
                <div key={i} className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${isReceso ? 'bg-[rgba(38,215,180,0.05)] border-[rgba(38,215,180,0.2)]' : 'bg-transparent border-transparent hover:bg-bg'}`}>
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 cursor-pointer transition-colors ${
                    isReceso
                      ? 'bg-[rgba(38,215,180,0.15)] text-teal'
                      : 'bg-surface2 text-ink3 hover:bg-[rgba(124,109,250,0.1)] hover:text-violet2'
                  }`} onClick={() => toggleReceso(i)} title="Clic para marcar/desmarcar como Receso">
                    {isReceso ? '☕' : classNum}
                  </span>
                  <input
                    value={h}
                    onChange={e => handleHorario(i, e.target.value)}
                    className="input-base text-sm flex-1 bg-transparent"
                    placeholder="HH:MM - HH:MM"
                  />
                  {isReceso && <span className="text-[10px] uppercase text-teal font-bold tracking-wider px-2">Receso</span>}
                </div>
              )
            })
            })()}
          </div>
        </div>
      </div>

      {/* Tutores por curso */}
      <div className="card p-6 mb-5">
        <h2 className="font-display text-base font-bold tracking-tight mb-1">Tutores por curso</h2>
        <p className="text-[11px] text-ink4 mb-4">Selecciona el docente tutor de cada curso. Solo aparecen docentes cargados en el paso anterior.</p>
        <div className="grid grid-cols-2 gap-3">
          {config.cursos.map(curso => {
            const current = config.tutores[curso] ?? ''
            // Build label for selected teacher
            const selectedDoc = docentes.find(d => {
              const fullName = `${d.titulo ? d.titulo + ' ' : ''}${d.nombre}`.trim()
              return fullName === current
            })
            return (
              <div key={curso}>
                <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">{curso}</label>
                <div className="relative">
                  <select
                    value={current}
                    onChange={e => handleTutor(curso, e.target.value)}
                    className="input-base text-sm appearance-none pr-8 cursor-pointer"
                  >
                    <option value="">— Sin tutor asignado —</option>
                    {docentes.map((d, i) => {
                      const fullName = `${d.titulo ? d.titulo + ' ' : ''}${d.nombre}`.trim()
                      return (
                        <option key={i} value={fullName}>
                          {fullName}{d.materias?.length ? ` (${d.materias.slice(0, 2).join(', ')}${d.materias.length > 2 ? '…' : ''})` : ''}
                        </option>
                      )
                    })}
                  </select>
                  {/* Chevron icon */}
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink4">
                    ▾
                  </span>
                </div>
                {current && (
                  <p className="text-[10px] text-teal mt-1 flex items-center gap-1">
                    ✓ {current}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <button onClick={onNext} className="btn-primary px-8 py-3">Continuar →</button>
    </div>
  )
}

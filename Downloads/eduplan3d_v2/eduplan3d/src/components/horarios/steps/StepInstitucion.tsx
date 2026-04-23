'use client'
// src/components/horarios/steps/StepInstitucion.tsx

import { useState } from 'react'
import type { InstitucionConfig, CursoHorarioOverride } from '@/types/horarios'
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

  // ─── Overrides per-curso (cursosCustom) ───────────────────────────────
  function enableOverride(curso: string) {
    // Seed con la estructura global actual
    const seed: CursoHorarioOverride = {
      nPeriodos: config.nPeriodos,
      horarios:  [...config.horarios].slice(0, config.nPeriodos),
      recesos:   [...(config.recesos || [])],
    }
    onChange({
      ...config,
      cursosCustom: { ...(config.cursosCustom || {}), [curso]: seed },
    })
  }
  function disableOverride(curso: string) {
    const next = { ...(config.cursosCustom || {}) }
    delete next[curso]
    onChange({ ...config, cursosCustom: Object.keys(next).length ? next : undefined })
  }
  function updateOverride(curso: string, patch: Partial<CursoHorarioOverride>) {
    const prev = config.cursosCustom?.[curso]
    if (!prev) return
    const merged: CursoHorarioOverride = { ...prev, ...patch }
    onChange({
      ...config,
      cursosCustom: { ...(config.cursosCustom || {}), [curso]: merged },
    })
  }
  function ovAddPeriod(curso: string) {
    const ov = config.cursosCustom?.[curso]
    if (!ov) return
    const n = Math.min(ov.nPeriodos + 1, 15)
    const horarios = [...ov.horarios]
    while (horarios.length < n) horarios.push('')
    updateOverride(curso, { nPeriodos: n, horarios })
  }
  function ovRemovePeriod(curso: string) {
    const ov = config.cursosCustom?.[curso]
    if (!ov) return
    const n = Math.max(ov.nPeriodos - 1, 4)
    const horarios = ov.horarios.slice(0, n)
    const recesos = ov.recesos.filter(r => r < n)
    updateOverride(curso, { nPeriodos: n, horarios, recesos })
  }
  function ovHandleHorario(curso: string, i: number, val: string) {
    const ov = config.cursosCustom?.[curso]
    if (!ov) return
    const horarios = [...ov.horarios]
    horarios[i] = val
    updateOverride(curso, { horarios })
  }
  function ovToggleReceso(curso: string, i: number) {
    const ov = config.cursosCustom?.[curso]
    if (!ov) return
    const recesos = ov.recesos.includes(i)
      ? ov.recesos.filter(r => r !== i)
      : [...ov.recesos, i].sort((a, b) => a - b)
    updateOverride(curso, { recesos })
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

      {/* Horarios personalizados por curso */}
      <CursosCustomCard
        config={config}
        onEnable={enableOverride}
        onDisable={disableOverride}
        onAddPeriod={ovAddPeriod}
        onRemovePeriod={ovRemovePeriod}
        onHorario={ovHandleHorario}
        onToggleReceso={ovToggleReceso}
      />

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

// ─── Sub-componente: Horarios personalizados por curso ──────────────────
function CursosCustomCard({
  config,
  onEnable,
  onDisable,
  onAddPeriod,
  onRemovePeriod,
  onHorario,
  onToggleReceso,
}: {
  config: InstitucionConfig
  onEnable: (curso: string) => void
  onDisable: (curso: string) => void
  onAddPeriod: (curso: string) => void
  onRemovePeriod: (curso: string) => void
  onHorario: (curso: string, i: number, v: string) => void
  onToggleReceso: (curso: string, i: number) => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const anyOverride = !!config.cursosCustom && Object.keys(config.cursosCustom).length > 0

  return (
    <div className="card p-6 mb-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-base font-bold tracking-tight">Horarios personalizados por curso</h2>
        {anyOverride && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(255,179,71,0.12)] text-amber font-semibold">
            {Object.keys(config.cursosCustom!).length} con override
          </span>
        )}
      </div>
      <p className="text-[11px] text-ink4 mb-4">
        Usa esto cuando un curso tiene jornada/recesos distintos a los demás (ej: 1RO BÁSICA no comparte receso con los grandes). Si no está activado, el curso usa la estructura global de arriba.
      </p>
      <div className="space-y-2">
        {config.cursos.map(curso => {
          const ov = config.cursosCustom?.[curso]
          const isOn = !!ov
          const isExpanded = expanded[curso] ?? isOn
          return (
            <div
              key={curso}
              className={`rounded-xl border transition-colors ${
                isOn
                  ? 'border-[rgba(255,179,71,0.3)] bg-[rgba(255,179,71,0.04)]'
                  : 'border-[rgba(120,100,255,0.14)] bg-transparent'
              }`}
            >
              <div className="flex items-center gap-3 p-3">
                <span className="text-sm font-semibold text-ink min-w-[120px]">{curso}</span>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={e => (e.target.checked ? onEnable(curso) : onDisable(curso))}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="text-[11px] text-ink3">Horario propio</span>
                </label>
                {isOn && (
                  <>
                    <span className="text-[10px] text-ink4">
                      {ov!.nPeriodos} períodos · {ov!.recesos.length} receso{ov!.recesos.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => setExpanded(e => ({ ...e, [curso]: !isExpanded }))}
                      className="ml-auto text-[11px] text-violet2 hover:underline"
                    >
                      {isExpanded ? 'Ocultar' : 'Editar'}
                    </button>
                  </>
                )}
              </div>
              {isOn && isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-[rgba(255,179,71,0.15)]">
                  <div className="flex items-center justify-between mb-2 mt-2">
                    <span className="text-[10px] font-bold uppercase tracking-[.5px] text-ink3">
                      Períodos de {curso}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => onRemovePeriod(curso)}
                        className="w-6 h-6 flex items-center justify-center rounded-md bg-surface2 text-ink3 hover:bg-surface border border-transparent transition-colors font-bold text-sm"
                      >
                        -
                      </button>
                      <button
                        onClick={() => onAddPeriod(curso)}
                        className="w-6 h-6 flex items-center justify-center rounded-md bg-surface2 text-ink3 hover:bg-surface border border-transparent transition-colors font-bold text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {(() => {
                      let classNum = 0
                      return ov!.horarios.slice(0, ov!.nPeriodos).map((h, i) => {
                        const isR = ov!.recesos.includes(i)
                        if (!isR) classNum++
                        return (
                          <div
                            key={i}
                            className={`flex items-center gap-2 p-1.5 rounded-lg border transition-colors ${
                              isR
                                ? 'bg-[rgba(38,215,180,0.05)] border-[rgba(38,215,180,0.2)]'
                                : 'bg-transparent border-transparent hover:bg-bg'
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0 cursor-pointer transition-colors ${
                                isR
                                  ? 'bg-[rgba(38,215,180,0.15)] text-teal'
                                  : 'bg-surface2 text-ink3 hover:bg-[rgba(124,109,250,0.1)] hover:text-violet2'
                              }`}
                              onClick={() => onToggleReceso(curso, i)}
                              title="Clic para marcar/desmarcar como Receso"
                            >
                              {isR ? '☕' : classNum}
                            </span>
                            <input
                              value={h}
                              onChange={e => onHorario(curso, i, e.target.value)}
                              className="input-base text-xs flex-1 bg-transparent"
                              placeholder="HH:MM - HH:MM"
                            />
                            {isR && (
                              <span className="text-[9px] uppercase text-teal font-bold tracking-wider px-1.5">
                                Receso
                              </span>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

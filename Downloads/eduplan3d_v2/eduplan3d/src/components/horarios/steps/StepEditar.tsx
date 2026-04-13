'use client'
// src/components/horarios/steps/StepEditar.tsx

import { useState, useMemo } from 'react'
import type { HorariosState, HorarioGrid, Dia } from '@/types/horarios'
import { DIAS } from '@/types/horarios'
import { detectConflictos, getDocForMateria } from '@/lib/horarios/generator'

interface Props {
  state: HorariosState
  onChange: (h: HorarioGrid) => void
  onBack: () => void
  onExport: () => void
}

export function StepEditar({ state, onChange, onBack, onExport }: Props) {
  const { config, docentes, horario, horasPorCurso } = state
  const [cursoActivo, setCursoActivo] = useState(config.cursos[0] ?? '')
  const [vistaDoc, setVistaDoc] = useState(false)

  const OPCIONES_CELDA = useMemo(() => {
    const materias = new Set<string>()
    Object.values(horasPorCurso).forEach(curso => {
      Object.keys(curso).forEach(m => materias.add(m))
    })
    return ['', ...Array.from(materias).sort(), 'ACOMPAÑAMIENTO']
  }, [horasPorCurso])

  const conflictos = detectConflictos(horario, docentes, config.nPeriodos, config.jornada, config.nivel)
  const conflictoSet = new Set(
    conflictos.map(c => `${c.curso}|${c.dia}|${c.periodo}`)
  )

  function updateCell(curso: string, dia: Dia, periodo: number, val: string) {
    const nuevo: HorarioGrid = JSON.parse(JSON.stringify(horario))
    nuevo[curso][dia][periodo] = val
    onChange(nuevo)
  }

  // Vista por docente
  function buildVistaDocente() {
    const result: Record<string, Record<Dia, string[]>> = {}
    config.cursos.forEach(c => {
      DIAS.forEach(d => {
        horario[c]?.[d]?.forEach((m, p) => {
          if (!m || m === 'RECESO' || m === 'ACOMPAÑAMIENTO') return
          const doc = getDocForMateria(m, docentes, config.jornada, config.nivel, state.docentePorCurso, c)
          if (doc === '—') return
          if (!result[doc]) result[doc] = {} as any
          if (!result[doc][d]) result[doc][d] = Array(config.nPeriodos).fill('')
          const existing = result[doc][d][p]
          result[doc][d][p] = existing ? `${existing}\n${m} (${c})` : `${m} (${c})`
        })
      })
    })
    return result
  }

  const datos = horario[cursoActivo]

  return (
    <div>
      {/* Header con conflictos */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {conflictos.length > 0 ? (
            <div className="px-3 py-1.5 rounded-xl bg-[rgba(240,98,146,0.1)] border border-[rgba(240,98,146,0.25)] text-[#f48fb1] text-xs font-semibold">
              ⚠ {conflictos.length} conflicto{conflictos.length > 1 ? 's' : ''} de docente
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-[rgba(38,215,180,0.1)] border border-[rgba(38,215,180,0.25)] text-teal text-xs font-semibold">
              ✓ Sin conflictos — listo para exportar
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVistaDoc(v => !v)}
            className="btn-secondary text-sm px-4 py-2"
          >
            {vistaDoc ? '📋 Vista por curso' : '👤 Vista por docente'}
          </button>
          <button onClick={onExport} className="btn-primary text-sm px-5 py-2">
            ⬇ Descargar Excel
          </button>
        </div>
      </div>

      {!vistaDoc ? (
        <>
          {/* Tabs cursos */}
          <div className="flex flex-wrap gap-2 mb-4">
            {config.cursos.map(c => (
              <button
                key={c}
                onClick={() => setCursoActivo(c)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  cursoActivo === c
                    ? 'bg-[rgba(124,109,250,0.15)] border-[rgba(124,109,250,0.4)] text-violet2'
                    : 'border-[rgba(120,100,255,0.14)] text-ink3 hover:text-ink2'
                }`}
              >{c}</button>
            ))}
          </div>

          {/* Grilla editable */}
          <div className="overflow-x-auto">
            <table className="border-collapse" style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <th className="w-8 px-2 py-2 text-[11px] font-semibold text-ink3 bg-surface border border-[rgba(120,100,255,0.14)]">N°</th>
                  <th className="w-24 px-2 py-2 text-[11px] font-semibold text-ink3 bg-surface border border-[rgba(120,100,255,0.14)]">Hora</th>
                  {DIAS.map(d => (
                    <th key={d} className="px-2 py-2 text-[11px] font-semibold text-white bg-[#2E5090] border border-[rgba(120,100,255,0.14)]">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let classNum = 0
                  return config.horarios.map((hora, pi) => {
                  const isReceso = (config.recesos || [4]).includes(pi)
                  if (!isReceso) classNum++
                  return (
                    <tr key={pi}>
                      <td className={`text-center text-xs font-semibold border border-[rgba(120,100,255,0.14)] ${isReceso ? 'bg-[rgba(38,215,180,0.15)] text-teal' : 'bg-surface text-ink3'}`}>
                        {isReceso ? 'R' : classNum}
                      </td>
                      <td className={`text-center text-[10px] border border-[rgba(120,100,255,0.14)] px-1 ${isReceso ? 'bg-[rgba(38,215,180,0.15)] text-teal' : 'bg-surface text-ink3'}`}>
                        {hora}
                      </td>
                      {DIAS.map(d => {
                        if (isReceso) {
                          return (
                            <td key={d} className="text-center text-xs font-semibold border border-[rgba(120,100,255,0.14)] bg-[rgba(38,215,180,0.12)] text-teal">
                              RECESO
                            </td>
                          )
                        }
                        const val = datos?.[d]?.[pi] ?? ''
                        const isConflict = conflictoSet.has(`${cursoActivo}|${d}|${pi}`)
                        const isAcomp = val === 'ACOMPAÑAMIENTO'
                        const doc = val && !isAcomp ? getDocForMateria(val, docentes, config.jornada, config.nivel, state.docentePorCurso, cursoActivo) : ''

                        return (
                          <td
                            key={d}
                            className={`border border-[rgba(120,100,255,0.14)] p-0 align-top ${
                              isConflict ? 'bg-[rgba(240,98,146,0.15)]' :
                              isAcomp    ? 'bg-[rgba(255,179,71,0.2)]' :
                              pi % 2 === 0 ? 'bg-[rgba(124,109,250,0.03)]' : 'bg-[rgba(0,0,0,0)]'
                            }`}
                          >
                            <select
                              value={val}
                              onChange={e => updateCell(cursoActivo, d, pi, e.target.value)}
                              className={`w-full border-none bg-transparent text-[11px] py-1 px-1 cursor-pointer focus:outline-none font-medium ${
                                isConflict ? 'text-rose' : isAcomp ? 'text-amber' : val ? 'text-ink' : 'text-ink3'
                              }`}
                              style={{ minHeight: 28 }}
                            >
                              {OPCIONES_CELDA.map(o => (
                                <option key={o} value={o} style={{ background: '#1a1730', color: '#f0eeff' }}>
                                  {o || '—'}
                                </option>
                              ))}
                            </select>
                            {doc && doc !== '—' && (
                              <div className="text-[9px] text-ink3 px-1 pb-1 leading-tight truncate">
                                {doc.split(',')[0]}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
                })()}
              </tbody>
            </table>
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <span className="text-[11px] text-ink3">Leyenda:</span>
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="w-3 h-3 rounded bg-[rgba(255,179,71,0.3)] inline-block" />
              <span className="text-ink3">Acompañamiento</span>
            </span>
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="w-3 h-3 rounded bg-[rgba(38,215,180,0.2)] inline-block" />
              <span className="text-ink3">Receso</span>
            </span>
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="w-3 h-3 rounded bg-[rgba(240,98,146,0.2)] inline-block" />
              <span className="text-ink3">Conflicto de docente</span>
            </span>
          </div>
        </>
      ) : (
        /* ── VISTA DOCENTE ── */
        <div>
          {Object.entries(buildVistaDocente()).map(([doc, diasDoc]) => (
            <div key={doc} className="card p-5 mb-4">
              <h3 className="font-display text-sm font-bold mb-3 text-violet2">👤 {doc}</h3>
              <div className="overflow-x-auto">
                <table className="border-collapse w-full" style={{ minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th className="w-8 text-[11px] text-ink3 font-semibold bg-surface border border-[rgba(120,100,255,0.14)] px-2 py-1.5">N°</th>
                      <th className="w-20 text-[11px] text-ink3 font-semibold bg-surface border border-[rgba(120,100,255,0.14)] px-2 py-1.5">Hora</th>
                      {DIAS.map(d => <th key={d} className="text-[11px] text-white font-semibold bg-[#2E5090] border border-[rgba(120,100,255,0.14)] px-2 py-1.5">{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let cn2 = 0
                      return config.horarios.map((hora, pi) => {
                      const isR = (config.recesos || [4]).includes(pi)
                      if (!isR) cn2++
                      return (
                      <tr key={pi}>
                        <td className="text-center text-[11px] border border-[rgba(120,100,255,0.14)] bg-surface text-ink3 px-1">{isR ? 'R' : cn2}</td>
                        <td className="text-center text-[10px] border border-[rgba(120,100,255,0.14)] bg-surface text-ink3 px-1">{hora}</td>
                        {DIAS.map(d => {
                          const v = diasDoc[d]?.[pi] ?? ''
                          return (
                            <td key={d} className={`text-center text-[11px] border border-[rgba(120,100,255,0.14)] px-1 py-1 ${isR ? 'bg-[rgba(38,215,180,0.12)] text-teal' : v ? 'bg-[rgba(124,109,250,0.06)] text-ink font-medium' : 'text-ink3'}`}>
                              {isR ? 'RECESO' : (v || '—')}
                            </td>
                          )
                        })}
                      </tr>
                    )
                    })
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-5">
        <button onClick={onBack} className="btn-secondary px-6 py-2.5">← Regenerar</button>
        <button onClick={onExport} className="btn-primary px-8 py-2.5">⬇ Descargar Excel</button>
      </div>
    </div>
  )
}

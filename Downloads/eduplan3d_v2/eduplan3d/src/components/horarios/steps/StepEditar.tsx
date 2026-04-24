'use client'
// src/components/horarios/steps/StepEditar.tsx

import { useState, useMemo } from 'react'
import type { HorariosState, HorarioGrid, Dia } from '@/types/horarios'
import { DIAS, getCursoStructure } from '@/types/horarios'
import { detectConflictosPorHora, getDocForMateria } from '@/lib/horarios/generator'

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
  const [vistaCarga, setVistaCarga] = useState(false)

  // Carga docente: suma horas semanales asignadas a cada docente (según docentePorCurso
  // + horasPorCurso) y detecta sobrecargas en materias con días restringidos.
  const cargaDocente = useMemo(() => {
    type MateriaRow = { materia: string; curso: string; horas: number; diasRestringidos?: Dia[] }
    const byDoc: Record<string, { total: number; rows: MateriaRow[] }> = {}
    const dpc = state.docentePorCurso ?? {}
    Object.entries(horasPorCurso).forEach(([curso, mats]) => {
      Object.entries(mats).forEach(([materia, horas]) => {
        if (!horas || horas <= 0) return
        const doc = dpc[curso]?.[materia]
        if (!doc || doc === '—') return
        const diasRestringidos = config.diasPorMateria?.[materia]
        if (!byDoc[doc]) byDoc[doc] = { total: 0, rows: [] }
        byDoc[doc].total += horas
        byDoc[doc].rows.push({ materia, curso, horas, diasRestringidos })
      })
    })
    // Slots útiles por día (promedio): usa la estructura global como referencia
    const slotsPorDiaGlobal = Math.max(1, config.nPeriodos - (config.recesos?.length ?? 0))
    const list = Object.entries(byDoc)
      .map(([doc, { total, rows }]) => {
        // Detectar sobrecarga por días restringidos: agrupar rows por materia con dias
        const porMateriaRestringida: Record<string, { horas: number; dias: Dia[] }> = {}
        rows.forEach(r => {
          if (r.diasRestringidos && r.diasRestringidos.length > 0) {
            if (!porMateriaRestringida[r.materia]) {
              porMateriaRestringida[r.materia] = { horas: 0, dias: r.diasRestringidos }
            }
            porMateriaRestringida[r.materia].horas += r.horas
          }
        })
        const alertas: string[] = []
        Object.entries(porMateriaRestringida).forEach(([mat, info]) => {
          const slotsDisponibles = info.dias.length * slotsPorDiaGlobal
          if (info.horas > slotsDisponibles) {
            alertas.push(
              `${mat}: ${info.horas}h necesita ${slotsDisponibles} slots disponibles (${info.dias.join('+')})`
            )
          }
        })
        return { doc, total, rows, alertas }
      })
      .sort((a, b) => b.total - a.total)
    return list
  }, [horasPorCurso, state.docentePorCurso, config])

  const OPCIONES_CELDA = useMemo(() => {
    const materias = new Set<string>()
    Object.values(horasPorCurso).forEach(curso => {
      Object.keys(curso).forEach(m => materias.add(m))
    })
    return ['', ...Array.from(materias).sort(), 'ACOMPAÑAMIENTO', 'SALIDA']
  }, [horasPorCurso])

  // Usa detectConflictosPorHora (compara por hora real) para soportar cursos
  // con estructuras distintas (cursosCustom). Si no hay overrides, equivale
  // al detector anterior.
  const conflictos = detectConflictosPorHora(horario, config, docentes, state.docentePorCurso)
  const conflictoSet = new Set(
    conflictos.map(c => `${c.curso}|${c.dia}|${c.periodo}`)
  )

  function updateCell(curso: string, dia: Dia, periodo: number, val: string) {
    const nuevo: HorarioGrid = JSON.parse(JSON.stringify(horario))
    nuevo[curso][dia][periodo] = val
    onChange(nuevo)
  }

  // Vista por docente — agrupada por HORA REAL (label). Soporta cursos con
  // estructuras distintas (cursosCustom): cada fila = una hora única, las
  // clases de cualquier curso a esa hora caen en esa fila.
  // result: doc → horaLabel → { dia → string } ; además devolvemos las horas únicas ordenadas.
  function buildVistaDocente(): {
    byDoc: Record<string, Record<string, Partial<Record<Dia, string>>>>
    labels: Array<{ label: string; isReceso: boolean }>
  } {
    const byDoc: Record<string, Record<string, Partial<Record<Dia, string>>>> = {}
    // Recoger labels únicos (ordenados por hora de inicio, alfabético funciona con "HH:MM-HH:MM")
    const labelSet = new Map<string, boolean>() // label → isReceso en al menos un curso
    config.cursos.forEach(c => {
      const { horarios: h, recesos: r } = getCursoStructure(config, c)
      h.forEach((label, idx) => {
        const wasReceso = r.includes(idx)
        labelSet.set(label, (labelSet.get(label) ?? true) && wasReceso)
      })
    })
    const labels = Array.from(labelSet.entries())
      .map(([label, isReceso]) => ({ label, isReceso }))
      .sort((a, b) => a.label.localeCompare(b.label))

    config.cursos.forEach(c => {
      const { horarios: hCurso } = getCursoStructure(config, c)
      DIAS.forEach(d => {
        horario[c]?.[d]?.forEach((m, p) => {
          if (!m || m === 'RECESO' || m === 'ACOMPAÑAMIENTO' || m === 'SALIDA') return
          const doc = getDocForMateria(m, docentes, config.jornada, config.nivel, state.docentePorCurso, c)
          if (doc === '—') return
          const label = hCurso[p] ?? String(p)
          if (!byDoc[doc]) byDoc[doc] = {}
          if (!byDoc[doc][label]) byDoc[doc][label] = {}
          const existing = byDoc[doc][label][d]
          byDoc[doc][label][d] = existing ? `${existing}\n${m} (${c})` : `${m} (${c})`
        })
      })
    })
    return { byDoc, labels }
  }

  const datos = horario[cursoActivo]
  // Estructura del curso activo (override si existe, si no la global)
  const estrActivo = getCursoStructure(config, cursoActivo)

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
            onClick={() => { setVistaCarga(v => !v); setVistaDoc(false) }}
            className="btn-secondary text-sm px-4 py-2"
          >
            {vistaCarga ? '📋 Volver al horario' : '📊 Carga docente'}
          </button>
          <button
            onClick={() => { setVistaDoc(v => !v); setVistaCarga(false) }}
            className="btn-secondary text-sm px-4 py-2"
          >
            {vistaDoc ? '📋 Vista por curso' : '👤 Vista por docente'}
          </button>
          <button onClick={onExport} className="btn-primary text-sm px-5 py-2">
            ⬇ Descargar Excel
          </button>
        </div>
      </div>

      {vistaCarga && (
        <div className="card p-5 mb-4">
          <h3 className="font-display text-sm font-bold mb-1 text-violet2">📊 Carga horaria de docentes</h3>
          <p className="text-[11px] text-ink3 mb-3">
            Suma de horas semanales asignadas por docente (según materias × cursos).
            Las alertas marcan materias con días restringidos donde la carga supera los slots disponibles.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1.5 bg-surface border border-[rgba(120,100,255,0.14)] text-ink3 font-semibold">Docente</th>
                  <th className="text-center px-2 py-1.5 bg-surface border border-[rgba(120,100,255,0.14)] text-ink3 font-semibold w-20">Total h/sem</th>
                  <th className="text-left px-2 py-1.5 bg-surface border border-[rgba(120,100,255,0.14)] text-ink3 font-semibold">Desglose (materia × curso)</th>
                  <th className="text-left px-2 py-1.5 bg-surface border border-[rgba(120,100,255,0.14)] text-ink3 font-semibold">Alertas</th>
                </tr>
              </thead>
              <tbody>
                {cargaDocente.map(({ doc, total, rows, alertas }) => {
                  const overloaded = total > 30 || alertas.length > 0
                  return (
                    <tr key={doc} className={overloaded ? 'bg-[rgba(240,98,146,0.08)]' : ''}>
                      <td className="px-2 py-1.5 border border-[rgba(120,100,255,0.14)] text-ink font-medium">{doc}</td>
                      <td className={`text-center px-2 py-1.5 border border-[rgba(120,100,255,0.14)] font-bold ${
                        total > 35 ? 'text-rose' : total > 30 ? 'text-amber' : 'text-teal'
                      }`}>{total}h</td>
                      <td className="px-2 py-1.5 border border-[rgba(120,100,255,0.14)] text-ink2 text-[11px]">
                        {rows.map((r, i) => (
                          <div key={i} className="leading-tight">
                            <span className={r.diasRestringidos ? 'text-amber' : ''}>{r.materia}</span>
                            {' '}×{r.horas}h
                            {' '}<span className="text-ink3">({r.curso}{r.diasRestringidos ? ` · ${r.diasRestringidos.map(d => d[0]).join('')}` : ''})</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-2 py-1.5 border border-[rgba(120,100,255,0.14)] text-[11px]">
                        {alertas.length === 0 ? (
                          <span className="text-ink3">—</span>
                        ) : (
                          alertas.map((a, i) => (
                            <div key={i} className="text-rose leading-tight">⚠ {a}</div>
                          ))
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap text-[11px]">
            <span className="text-ink3">Referencia:</span>
            <span className="text-teal">≤30h saludable</span>
            <span className="text-amber">31-35h alta</span>
            <span className="text-rose">&gt;35h imposible en una jornada</span>
          </div>
        </div>
      )}

      {!vistaCarga && !vistaDoc ? (
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
                  return estrActivo.horarios.map((hora, pi) => {
                  const isReceso = (estrActivo.recesos || []).includes(pi)
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
                        const isSalida = val === 'SALIDA'
                        const doc = val && !isAcomp && !isSalida ? getDocForMateria(val, docentes, config.jornada, config.nivel, state.docentePorCurso, cursoActivo) : ''

                        return (
                          <td
                            key={d}
                            className={`border border-[rgba(120,100,255,0.14)] p-0 align-top ${
                              isConflict ? 'bg-[rgba(240,98,146,0.15)]' :
                              isAcomp    ? 'bg-[rgba(255,179,71,0.2)]' :
                              isSalida   ? 'bg-[rgba(148,163,184,0.18)]' :
                              pi % 2 === 0 ? 'bg-[rgba(124,109,250,0.03)]' : 'bg-[rgba(0,0,0,0)]'
                            }`}
                          >
                            <select
                              value={val}
                              onChange={e => updateCell(cursoActivo, d, pi, e.target.value)}
                              className={`w-full border-none bg-transparent text-[11px] py-1 px-1 cursor-pointer focus:outline-none font-medium ${
                                isConflict ? 'text-rose' : isAcomp ? 'text-amber' : isSalida ? 'text-ink3 italic' : val ? 'text-ink' : 'text-ink3'
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
          <details className="mt-4">
            <summary className="text-xs text-ink3 cursor-pointer">Debug Data (Mándame captura de esto por favor)</summary>
            <pre className="text-[10px] mt-2 p-2 bg-[rgba(0,0,0,0.8)] text-white rounded overflow-auto max-h-40">
              {JSON.stringify(datos, null, 2)}
            </pre>
          </details>

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
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="w-3 h-3 rounded bg-[rgba(148,163,184,0.25)] inline-block" />
              <span className="text-ink3">Salida (fin de jornada)</span>
            </span>
          </div>
        </>
      ) : vistaDoc ? (
        /* ── VISTA DOCENTE ── */
        (() => {
          const { byDoc, labels } = buildVistaDocente()
          return (
            <div>
              {Object.entries(byDoc).map(([doc, byLabel]) => (
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
                          return labels.map(({ label, isReceso: isR }, pi) => {
                            if (!isR) cn2++
                            return (
                              <tr key={label}>
                                <td className="text-center text-[11px] border border-[rgba(120,100,255,0.14)] bg-surface text-ink3 px-1">{isR ? 'R' : cn2}</td>
                                <td className="text-center text-[10px] border border-[rgba(120,100,255,0.14)] bg-surface text-ink3 px-1">{label}</td>
                                {DIAS.map(d => {
                                  const v = byLabel[label]?.[d] ?? ''
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
          )
        })()
      ) : null}

      <div className="flex gap-3 mt-5">
        <button onClick={onBack} className="btn-secondary px-6 py-2.5">← Regenerar</button>
        <button onClick={onExport} className="btn-primary px-8 py-2.5">⬇ Descargar Excel</button>
      </div>
    </div>
  )
}

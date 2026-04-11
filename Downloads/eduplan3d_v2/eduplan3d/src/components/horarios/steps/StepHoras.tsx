'use client'
// src/components/horarios/steps/StepHoras.tsx

import { useState } from 'react'
import type { Docente, HorasPorCurso } from '@/types/horarios'
import { TODAS_MATERIAS } from '@/types/horarios'
import { getDocForMateria } from '@/lib/horarios/generator'

interface Props {
  config: any
  cursos: string[]
  docentes: Docente[]
  horasPorCurso: HorasPorCurso
  jornada: string
  onChange: (h: HorasPorCurso) => void
  onBack: () => void
  onNext: () => void
}

export function StepHoras({ config, cursos, docentes, horasPorCurso, jornada, onChange, onBack, onNext }: Props) {
  const [cursoActivo, setCursoActivo] = useState(cursos[0] ?? '')
  const [showAddMateria, setShowAddMateria] = useState(false)
  const [newMateriaName, setNewMateriaName] = useState('')

  function updateHoras(curso: string, materia: string, val: number) {
    onChange({
      ...horasPorCurso,
      [curso]: { ...(horasPorCurso[curso] ?? {}), [materia]: Math.max(0, Math.min(10, val)) },
    })
  }

  function addMateria() {
    const name = newMateriaName.trim().toUpperCase()
    if (!name) return
    updateHoras(cursoActivo, name, 1)
    setNewMateriaName('')
    setShowAddMateria(false)
  }

  function removeMateria(materia: string) {
    const updated = { ...horasPorCurso }
    if (updated[cursoActivo]) {
      const { [materia]: _, ...rest } = updated[cursoActivo]
      updated[cursoActivo] = rest
    }
    onChange(updated)
  }

  const hm = horasPorCurso[cursoActivo] ?? {}

  // Build dynamic subject list: merge TODAS_MATERIAS + any extra subjects from horasPorCurso
  const allMateriasSet = new Set<string>(TODAS_MATERIAS)
  // Add subjects from ALL courses' horasPorCurso (so custom subjects show everywhere)
  Object.values(horasPorCurso).forEach(cursoMaterias => {
    Object.keys(cursoMaterias).forEach(m => allMateriasSet.add(m))
  })
  const allMaterias = Array.from(allMateriasSet)

  const totalHoras = Object.values(hm).reduce((a, b) => a + b, 0)

  const dailyTotal = config.nPeriodos || 8
  const validPeriodsPerDay = dailyTotal - (config.recesos?.length || 1)
  const slotsDisponibles = validPeriodsPerDay * 5 - 1  // 5 días × períodos útiles − 1 de acompañamiento

  // Separate: materias with hours assigned vs the rest
  const materiasConHoras = allMaterias.filter(m => (hm[m] ?? 0) > 0)
  const materiasSinHoras = allMaterias.filter(m => (hm[m] ?? 0) === 0)

  return (
    <div>
      {/* Tabs cursos */}
      <div className="flex flex-wrap gap-2 mb-4">
        {cursos.map(c => (
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

      <div className="card p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-bold tracking-tight">{cursoActivo} — Horas semanales por materia</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink3">Total asignado:</span>
            <span className={`text-sm font-bold ${totalHoras > slotsDisponibles ? 'text-rose' : 'text-teal'}`}>
              {totalHoras} / {slotsDisponibles} períodos
            </span>
          </div>
        </div>

        {totalHoras > slotsDisponibles && (
          <div className="mb-4 p-3 rounded-xl bg-[rgba(240,98,146,0.1)] border border-[rgba(240,98,146,0.25)] text-[#f48fb1] text-xs">
            ⚠ Has asignado más horas ({totalHoras}) que slots disponibles ({slotsDisponibles}). Reduce algunas horas.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-[rgba(120,100,255,0.14)]">
                <th className="text-left text-[11px] font-semibold text-ink3 uppercase tracking-[.5px] pb-2" style={{ width: '30%' }}>Materia</th>
                <th className="text-left text-[11px] font-semibold text-ink3 uppercase tracking-[.5px] pb-2" style={{ width: '28%' }}>Docente</th>
                <th className="text-center text-[11px] font-semibold text-ink3 uppercase tracking-[.5px] pb-2" style={{ width: '12%' }}>Horas/sem</th>
                <th className="text-left text-[11px] font-semibold text-ink3 uppercase tracking-[.5px] pb-2" style={{ width: '20%' }}>Distribución</th>
                <th className="text-center text-[11px] font-semibold text-ink3 uppercase tracking-[.5px] pb-2" style={{ width: '10%' }}></th>
              </tr>
            </thead>
            <tbody>
              {/* Materias with hours first */}
              {materiasConHoras.map((m, idx) => {
                const h = hm[m] ?? 0
                const doc = getDocForMateria(m, docentes, jornada)
                const sinDoc = doc === '—' && h > 0
                const isCustom = !TODAS_MATERIAS.includes(m)
                return (
                  <tr key={m} className={`border-b border-[rgba(120,100,255,0.07)] ${idx % 2 === 0 ? 'bg-[rgba(0,0,0,0.02)]' : ''}`}>
                    <td className="py-2 text-sm font-semibold text-ink flex items-center gap-1.5">
                      {m}
                      {isCustom && <span className="text-[9px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded font-bold">NUEVA</span>}
                    </td>
                    <td className={`py-2 text-xs ${sinDoc ? 'text-rose' : 'text-ink3'}`}>
                      {sinDoc ? '⚠ Sin docente' : doc}
                    </td>
                    <td className="py-2 text-center">
                      <input
                        type="number"
                        min={0} max={10}
                        value={h}
                        onChange={e => updateHoras(cursoActivo, m, parseInt(e.target.value) || 0)}
                        className="w-14 text-center py-1 px-2 border border-[rgba(120,100,255,0.2)] rounded-lg bg-[rgba(0,0,0,0.05)] text-sm text-ink focus:outline-none focus:border-violet"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <div className="h-1.5 bg-[rgba(120,100,255,0.1)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet2 transition-all"
                          style={{ width: `${Math.min(100, (h / 5) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-ink3">{h} períodos</span>
                    </td>
                    <td className="py-2 text-center">
                      <button
                        onClick={() => removeMateria(m)}
                        className="text-red-400 hover:text-red-600 text-xs transition-colors"
                        title="Quitar materia de este curso"
                      >✕</button>
                    </td>
                  </tr>
                )
              })}

              {/* Separator if there are materias without hours */}
              {materiasConHoras.length > 0 && materiasSinHoras.length > 0 && (
                <tr>
                  <td colSpan={5} className="py-2">
                    <div className="text-[10px] text-ink3 uppercase tracking-wider font-bold">Materias disponibles (sin horas asignadas)</div>
                  </td>
                </tr>
              )}

              {/* Materias without hours */}
              {materiasSinHoras.map((m, idx) => {
                const doc = getDocForMateria(m, docentes, jornada)
                return (
                  <tr key={m} className={`border-b border-[rgba(120,100,255,0.04)] opacity-50 hover:opacity-100 transition-opacity`}>
                    <td className="py-2 text-sm text-ink3">{m}</td>
                    <td className="py-2 text-xs text-ink3">{doc}</td>
                    <td className="py-2 text-center">
                      <input
                        type="number"
                        min={0} max={10}
                        value={0}
                        onChange={e => updateHoras(cursoActivo, m, parseInt(e.target.value) || 0)}
                        className="w-14 text-center py-1 px-2 border border-[rgba(120,100,255,0.1)] rounded-lg bg-[rgba(0,0,0,0.03)] text-sm text-ink3 focus:outline-none focus:border-violet"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <div className="h-1.5 bg-[rgba(120,100,255,0.05)] rounded-full" />
                    </td>
                    <td className="py-2"></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Add custom materia */}
        <div className="mt-4 pt-4 border-t border-[rgba(120,100,255,0.1)]">
          {showAddMateria ? (
            <div className="flex items-center gap-2">
              <input
                value={newMateriaName}
                onChange={e => setNewMateriaName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMateria()}
                placeholder="Nombre de la materia..."
                className="input-base text-sm flex-1"
                autoFocus
              />
              <button onClick={addMateria} className="btn-primary text-sm px-4 py-2">Agregar</button>
              <button onClick={() => { setShowAddMateria(false); setNewMateriaName('') }} className="btn-secondary text-sm px-3 py-2">Cancelar</button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddMateria(true)}
              className="text-xs font-semibold text-violet2 hover:text-violet transition-colors"
            >
              + Agregar materia personalizada
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary px-6 py-2.5">← Atrás</button>
        <button onClick={onNext} className="btn-primary px-8 py-2.5">Continuar →</button>
      </div>
    </div>
  )
}

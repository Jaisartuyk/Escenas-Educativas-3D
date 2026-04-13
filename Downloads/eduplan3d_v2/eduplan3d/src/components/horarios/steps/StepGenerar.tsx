'use client'
// src/components/horarios/steps/StepGenerar.tsx

import type { HorariosState } from '@/types/horarios'
import { getDocForMateria } from '@/lib/horarios/generator'

interface Props {
  state: HorariosState
  onBack: () => void
  onGenerar: () => void
}

export function StepGenerar({ state, onBack, onGenerar }: Props) {
  const { config, docentes, horasPorCurso } = state

  // ── Stats ─────────────────────────────────────────────────────────────────
  let totalPeriodos = 0
  let sinDocente    = 0
  const materiasSinDocente: { materia: string; curso: string }[] = []

  config.cursos.forEach(c => {
    Object.entries(horasPorCurso[c] ?? {}).forEach(([m, h]) => {
      totalPeriodos += h
      if (h > 0 && getDocForMateria(m, docentes, config.jornada, config.nivel, state.docentePorCurso, c) === '—') {
        sinDocente++
        materiasSinDocente.push({ materia: m, curso: c })
      }
    })
  })

  // ── Docentes summary ──────────────────────────────────────────────────────
  const docentesConMaterias = docentes.filter((d: any) => d.materias && d.materias.length > 0)
  const docentesSinMaterias = docentes.filter((d: any) => !d.materias || d.materias.length === 0)

  // ── Check compatibility ───────────────────────────────────────────────────
  const isCompatible = (d: any) =>
    (!d.jornada || d.jornada === 'AMBAS' || d.jornada === config.jornada) &&
    (!d.nivel || d.nivel === 'AMBOS' || d.nivel === config.nivel)

  const docentesCompatibles = docentesConMaterias.filter(isCompatible)
  const docentesIncompatibles = docentesConMaterias.filter((d: any) => !isCompatible(d))

  const stats = [
    { label: 'Cursos',     value: config.cursos.length,        icon: '📚', color: 'text-violet2' },
    { label: 'Docentes',   value: docentesCompatibles.length,   icon: '👨‍🏫', color: 'text-teal'    },
    { label: 'Períodos',   value: totalPeriodos,                icon: '⏱',  color: 'text-ink'     },
    { label: 'Sin docente',value: sinDocente,                   icon: '⚠️', color: sinDocente > 0 ? 'text-rose' : 'text-teal' },
  ]

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="card p-5 text-center">
            <div className="text-lg mb-1">{s.icon}</div>
            <div className={`font-display text-3xl font-extrabold tracking-tight mb-1 ${s.color}`}>{s.value}</div>
            <div className="text-xs text-ink3 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {sinDocente > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-[rgba(255,179,71,0.1)] border border-[rgba(255,179,71,0.25)] text-amber text-sm">
          <p className="font-semibold mb-1">⚠ {sinDocente} materia{sinDocente > 1 ? 's' : ''} sin docente asignado</p>
          <p className="text-xs text-ink3">
            Asigna docentes en <strong>Institución → Materias</strong>. Materias sin docente quedarán vacías en el horario.
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {materiasSinDocente.map((m, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(255,179,71,0.15)] text-amber font-medium">
                {m.materia} ({m.curso})
              </span>
            ))}
          </div>
        </div>
      )}

      {docentesIncompatibles.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-[rgba(124,109,250,0.06)] border border-[rgba(124,109,250,0.2)] text-sm">
          <p className="font-semibold text-ink2 mb-1">ℹ {docentesIncompatibles.length} docente{docentesIncompatibles.length > 1 ? 's' : ''} no participa{docentesIncompatibles.length > 1 ? 'n' : ''} en este horario</p>
          <p className="text-xs text-ink3">
            Enseñan en otro nivel o jornada. No se incluirán en la generación.
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {docentesIncompatibles.map((d: any) => (
              <span key={d.id} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(0,0,0,0.05)] text-ink3">
                {d.nombre} ({d.nivel}/{d.jornada})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Docentes que participan */}
      <div className="card p-6 mb-6">
        <h2 className="font-display text-base font-bold tracking-tight mb-4">👨‍🏫 Docentes en este horario</h2>
        {docentesCompatibles.length === 0 ? (
          <p className="text-sm text-ink3">No hay docentes con materias asignadas para este nivel y jornada.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {docentesCompatibles.map((d: any) => (
              <div key={d.id} className="p-3 rounded-xl border border-[rgba(120,100,255,0.12)] bg-bg">
                <div className="font-semibold text-sm text-ink mb-1">
                  {d.titulo ? `${d.titulo} ` : ''}{d.nombre}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(d.materias || []).map((m: string) => (
                    <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(38,215,180,0.1)] text-teal font-medium">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resumen por curso */}
      <div className="card p-6 mb-6">
        <h2 className="font-display text-base font-bold tracking-tight mb-4">📚 Resumen por curso</h2>
        {config.cursos.length === 0 ? (
          <p className="text-sm text-ink3">No hay cursos configurados. Verifica los cursos en Institución.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {config.cursos.map(c => {
              const hm = horasPorCurso[c] ?? {}
              const total = Object.values(hm).reduce((a, b) => a + b, 0)
              const materias = Object.entries(hm).filter(([, h]) => h > 0)
              return (
                <div key={c} className="p-4 border border-[rgba(120,100,255,0.14)] rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{c}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[rgba(124,109,250,0.1)] text-violet2">{total}h/sem</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {materias.length === 0 ? (
                      <span className="text-[10px] text-ink4">Sin materias asignadas</span>
                    ) : materias.map(([m, h]) => {
                      const doc = getDocForMateria(m, docentes, config.jornada, config.nivel, state.docentePorCurso, c)
                      return (
                        <span
                          key={m}
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            doc === '—'
                              ? 'bg-[rgba(255,179,71,0.08)] border-[rgba(255,179,71,0.2)] text-amber'
                              : 'bg-[rgba(0,0,0,0.03)] border-[rgba(120,100,255,0.12)] text-ink3'
                          }`}
                          title={doc !== '—' ? doc : 'Sin docente'}
                        >
                          {m} ×{h}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="card p-8 text-center mb-5">
        <div className="text-4xl mb-4">📅</div>
        <h3 className="font-display text-lg font-bold mb-2">Listo para generar</h3>
        <p className="text-ink3 text-sm mb-6 max-w-md mx-auto">
          El sistema distribuirá automáticamente todas las materias sin que ningún docente aparezca en dos cursos al mismo tiempo. Luego podrás editar celda por celda.
        </p>
        <button onClick={onGenerar} className="btn-primary text-base px-10 py-3.5">
          ✨ Generar horario automático
        </button>
      </div>

      <button onClick={onBack} className="btn-secondary px-6 py-2.5">← Atrás</button>
    </div>
  )
}

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

  let totalPeriodos = 0
  let sinDocente    = 0
  config.cursos.forEach(c => {
    Object.entries(horasPorCurso[c] ?? {}).forEach(([m, h]) => {
      totalPeriodos += h
      if (h > 0 && getDocForMateria(m, docentes, config.jornada) === '—') sinDocente++
    })
  })

  const stats = [
    { label: 'Cursos',             value: config.cursos.length,    color: 'text-violet2' },
    { label: 'Docentes',           value: docentes.length,          color: 'text-teal'    },
    { label: 'Períodos totales',   value: totalPeriodos,            color: 'text-ink'     },
    { label: 'Sin docente asig.',  value: sinDocente,               color: sinDocente > 0 ? 'text-rose' : 'text-teal' },
  ]

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="card p-5 text-center">
            <div className={`font-display text-3xl font-extrabold tracking-tight mb-1 ${s.color}`}>{s.value}</div>
            <div className="text-xs text-ink3 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {sinDocente > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-[rgba(255,179,71,0.1)] border border-[rgba(255,179,71,0.25)] text-amber text-sm">
          ⚠ Hay {sinDocente} materia{sinDocente > 1 ? 's' : ''} con horas asignadas pero sin docente registrado. Esas celdas quedarán vacías en el horario.
        </div>
      )}

      {/* Resumen por curso */}
      <div className="card p-6 mb-6">
        <h2 className="font-display text-base font-bold tracking-tight mb-4">Resumen por curso</h2>
        <div className="grid grid-cols-2 gap-4">
          {config.cursos.map(c => {
            const hm = horasPorCurso[c] ?? {}
            const total = Object.values(hm).reduce((a, b) => a + b, 0)
            const materias = Object.entries(hm).filter(([, h]) => h > 0)
            return (
              <div key={c} className="p-4 border border-[rgba(120,100,255,0.14)] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{c}</span>
                  <span className="badge-violet px-2 py-0.5 rounded-full text-[11px] font-bold bg-[rgba(124,109,250,0.1)] text-violet2">{total} períodos</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {materias.map(([m, h]) => (
                    <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(0,0,0,0.05)] border border-[rgba(120,100,255,0.12)] text-ink3">
                      {m} ×{h}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
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

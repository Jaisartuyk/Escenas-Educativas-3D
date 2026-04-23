'use client'

import React from 'react'
import { DIAS } from '@/types/horarios'

interface ScheduleData {
  curso: string
  nivel: string
  jornada: string
  nPeriodos: number
  periodos: string[]
  recesos: number[]
  horarioGrid: any // Record<string, string[]> mapped by day
}

export function TutorHorarioClient({ schedules }: { schedules: ScheduleData[] }) {
  if (!schedules || schedules.length === 0) {
    return (
      <div className="bg-surface border border-surface2 rounded-2xl p-10 flex flex-col items-center justify-center min-h-[300px] text-center space-y-3">
        <span className="text-4xl opacity-80">📭</span>
        <h3 className="text-lg font-bold text-ink">Sin Tutorías Asignadas</h3>
        <p className="text-ink3 text-sm max-w-sm">No figuras como tutor de ningún curso en la configuración actual de horarios.</p>
        <p className="text-ink4 text-xs mt-2">Contacta a la administración si crees que esto es un error.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {schedules.map((schedule, idx) => (
        <div key={idx} className="bg-surface border border-[rgba(120,100,255,0.14)] rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="p-5 border-b border-[rgba(120,100,255,0.14)] bg-[rgba(124,109,250,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-violet2">{schedule.curso}</h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-ink3 font-medium">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal"></span>
                  {schedule.nivel}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber"></span>
                  {schedule.jornada === 'MATUTINA' ? 'Matutina' : 'Vespertina'}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => window.print()}
              className="text-xs bg-ink/5 hover:bg-ink/10 text-ink px-4 py-2 rounded-xl transition-all self-start md:self-auto print:hidden"
            >
              🖨️ Imprimir
            </button>
          </div>

          {/* Grilla */}
          <div className="overflow-x-auto p-4 custom-scrollbar">
            <table className="border-collapse w-full min-w-[700px]">
              <thead>
                <tr>
                  <th className="w-10 px-2 py-3 text-[11px] font-semibold text-ink3 uppercase">N°</th>
                  <th className="w-28 px-2 py-3 text-[11px] font-semibold text-ink3 uppercase">Hora</th>
                  {DIAS.map(d => (
                    <th key={d} className="px-2 py-3 text-[11px] font-semibold text-white bg-violet2 border border-[rgba(120,100,255,0.2)] rounded-t-sm uppercase tracking-wider">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let classNum = 0
                  return schedule.periodos.map((hora, pi) => {
                    const isReceso = (schedule.recesos || [4]).includes(pi)
                    if (!isReceso) classNum++
                    
                    return (
                      <tr key={pi} className="group hover:bg-[rgba(0,0,0,0.01)] transition-colors">
                        <td className={`text-center text-xs font-semibold border-b border-surface2 p-2 ${isReceso ? 'bg-[rgba(38,215,180,0.05)] text-teal' : 'text-ink3'}`}>
                          {isReceso ? 'R' : classNum}
                        </td>
                        <td className={`text-center text-[10px] sm:text-xs font-medium border-b border-surface2 p-2 ${isReceso ? 'bg-[rgba(38,215,180,0.05)] text-teal' : 'text-ink2'}`}>
                          {hora}
                        </td>
                        
                        {DIAS.map(d => {
                          if (isReceso) {
                            return (
                              <td key={d} className="text-center text-[11px] font-bold tracking-widest text-[rgba(38,215,180,0.6)] border border-surface2 bg-[rgba(38,215,180,0.03)] p-2">
                                RECESO
                              </td>
                            )
                          }
                          
                          const materiaInfo = schedule.horarioGrid?.[d]?.[pi]
                          const materia = typeof materiaInfo === 'string' ? materiaInfo : (materiaInfo?.materia || '')
                          const isAcomp = materia === 'ACOMPAÑAMIENTO'
                          const isSalida = materia === 'SALIDA'

                          return (
                            <td
                              key={d}
                              className={`border border-[rgba(0,0,0,0.04)] p-2 align-middle text-center min-h-[50px] ${
                                isAcomp ? 'bg-[rgba(255,179,71,0.05)] text-amber' :
                                isSalida ? 'bg-[rgba(148,163,184,0.15)] text-ink3 italic' :
                                materia ? 'bg-[rgba(124,109,250,0.03)] text-ink' : 'text-ink4'
                              }`}
                            >
                              <div className="text-[10px] sm:text-xs font-semibold leading-tight px-1">
                                {materia || '—'}
                              </div>
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
}

'use client'

import { useState } from 'react'
import { TomaAsistencia } from './TomaAsistencia'

const REPORT_TYPES = [
  'Listado estudiantes',
  'Asistencia mensual por curso',
  'Reporte mensual de asistencias por materia',
  'Asistencia mensual por estudiante',
  'Toma de asistencia',
  'Toma de asistencia por estudiante'
]

export function AsistenciasClient() {
  const [reportType, setReportType] = useState<string>(REPORT_TYPES[0])

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in pb-24">
      {/* ── Encabezado ── */}
      <div className="flex flex-col gap-2 border-b border-[rgba(120,100,255,0.14)] pb-4">
        <h1 className="text-3xl font-bold text-ink">Gestión de Asistencias</h1>
        <p className="text-ink3 text-sm">Monitorea y registra la asistencia de tus estudiantes por curso o materia.</p>
      </div>

      {/* ── Controles ── */}
      <div className="bg-surface border border-surface2 rounded-2xl p-5 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex flex-col w-full md:w-1/2 lg:w-1/3">
            <label className="text-xs font-semibold text-ink2 mb-1.5 uppercase tracking-wider">Tipo de reporte *</label>
            <div className="relative">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full h-11 bg-bg text-ink border border-surface2 rounded-xl px-4 appearance-none focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet2 transition-all cursor-pointer"
              >
                {REPORT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-ink4">
                ▼
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Vista Dinámica ── */}
      {reportType === 'Toma de asistencia' ? (
        <TomaAsistencia />
      ) : (
        <div className="bg-surface border border-surface2 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center space-y-3">
          <span className="text-4xl">📊</span>
          <h3 className="text-lg font-bold text-ink">Vista de {reportType}</h3>
          <p className="text-ink3 text-sm max-w-sm">Aquí se mostrará la tabla de datos, el formulario de toma de asistencia o el listado de estudiantes según el tipo de reporte seleccionado.</p>
          <button className="mt-4 bg-violet2 hover:bg-violet text-white font-medium py-2 px-5 rounded-xl transition-all shadow-md shadow-violet/20 hover:shadow-violet/40 hover:-translate-y-0.5 active:translate-y-0 text-sm">
            Cargar Datos
          </button>
        </div>
      )}
    </div>
  )
}

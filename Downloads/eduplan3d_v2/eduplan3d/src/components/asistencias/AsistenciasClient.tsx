'use client'

import { useState, useMemo } from 'react'
import { TomaAsistencia } from './TomaAsistencia'
import { JustificacionesPanel } from './JustificacionesPanel'
import { Users, AlertTriangle, Clock as ClockIcon, ChevronDown } from 'lucide-react'

const REPORT_TYPES = [
  'Listado estudiantes',
  'Toma de asistencia',
  'Justificaciones',
]

export function AsistenciasClient({ tutoredCourses = [], enrollments = [], attendanceGlobal = [], justifications = [] }: any) {
  const [reportType, setReportType] = useState<string>(REPORT_TYPES[0])
  const [selectedCourse, setSelectedCourse] = useState(tutoredCourses[0]?.id || '')

  const currentEnrollments = useMemo(() => {
    return enrollments
      .filter((e: any) => selectedCourse === '' || e.course_id === selectedCourse)
      .sort((a: any, b: any) => (a.student?.full_name || '').localeCompare(b.student?.full_name || ''))
  }, [enrollments, selectedCourse])

  // Count attendances for each student
  const attendanceStats = useMemo(() => {
    const stats: Record<string, { present: number, late: number, absent: number }> = {}
    attendanceGlobal.forEach((a: any) => {
      if (!stats[a.student_id]) stats[a.student_id] = { present: 0, late: 0, absent: 0 }
      if (a.status === 'present') stats[a.student_id].present++
      if (a.status === 'late') stats[a.student_id].late++
      if (a.status === 'absent') stats[a.student_id].absent++
    })
    return stats
  }, [attendanceGlobal])

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in pb-24">
      {/* ── Encabezado ── */}
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 border-b border-[rgba(120,100,255,0.14)] pb-4">
        <div>
          <h1 className="text-3xl font-bold text-ink">Gesti&oacute;n de Asistencias</h1>
          <p className="text-ink3 text-sm mt-1">Monitorea y registra la asistencia de tus estudiantes por curso o materia.</p>
        </div>
      </div>

      {/* ── Controles ── */}
      <div className="bg-surface border border-surface2 rounded-2xl p-5 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex flex-col w-full md:w-1/3">
            <label className="text-xs font-semibold text-ink2 mb-1.5 uppercase tracking-wider">Tipo de interacci&oacute;n *</label>
            <div className="relative">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full h-11 bg-bg text-ink border border-surface2 rounded-xl px-4 appearance-none focus:outline-none focus:border-indigo-400 font-medium"
              >
                {REPORT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Vista Dinámica ── */}
      {reportType === 'Toma de asistencia' ? (
        <TomaAsistencia />
      ) : reportType === 'Justificaciones' ? (
        <JustificacionesPanel justifications={justifications} />
      ) : (
        <div className="space-y-4">
           {tutoredCourses.length > 0 ? (
             <>
               <div className="flex flex-wrap items-center gap-4">
                 <div className="relative min-w-[250px]">
                   <select
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className="w-full appearance-none bg-surface border border-surface2 rounded-xl pl-4 pr-10 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-400"
                   >
                     {tutoredCourses.map((c: any) => (
                       <option key={c.id} value={c.id}>{c.name} {c.parallel || ''}</option>
                     ))}
                   </select>
                   <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
                 </div>
                 
                 <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <Users size={16} className="text-indigo-600" />
                    <span className="text-sm font-bold text-indigo-900">{currentEnrollments.length} Inscritos</span>
                 </div>
               </div>

               <div className="bg-surface border border-surface2 rounded-2xl overflow-hidden shadow-sm">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-[rgba(0,0,0,0.02)]">
                     <tr className="border-b border-surface2 text-xs text-ink3 uppercase tracking-wider">
                       <th className="px-5 py-4 font-bold">Estudiante</th>
                       <th className="px-5 py-4 font-bold text-center">Faltas Injustificadas</th>
                       <th className="px-5 py-4 font-bold text-center">Atrasos</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-surface2/50">
                     {currentEnrollments.map((en: any, i: number) => {
                       const st = attendanceStats[en.student_id] || { present: 0, late: 0, absent: 0 }
                       return (
                         <tr key={en.id} className={`hover:bg-bg/50 ${i % 2 === 0 ? '' : 'bg-[rgba(0,0,0,0.015)]'}`}>
                           <td className="px-5 py-4 font-semibold text-ink">
                             {en.student?.full_name || 'Desconocido'}
                           </td>
                           <td className="px-5 py-4 text-center">
                             <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-bold border transition-colors ${
                               st.absent > 0 ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-surface2/50 text-ink4 border-transparent'
                             }`}>
                               <AlertTriangle size={14} /> {st.absent}
                             </div>
                           </td>
                           <td className="px-5 py-4 text-center">
                             <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-bold border transition-colors ${
                               st.late > 0 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-surface2/50 text-ink4 border-transparent'
                             }`}>
                               <ClockIcon size={14} /> {st.late}
                             </div>
                           </td>
                         </tr>
                       )
                     })}
                     {currentEnrollments.length === 0 && (
                       <tr>
                         <td colSpan={3} className="px-5 py-12 text-center text-ink3">
                            <Users size={32} className="mx-auto mb-3 opacity-20" />
                            <p>No hay estudiantes enrolados en este curso.</p>
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
             </>
           ) : (
             <div className="bg-surface border border-surface2 rounded-2xl p-12 text-center space-y-3">
               <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-2">
                 <Users size={28} className="text-indigo-500" />
               </div>
               <h3 className="text-lg font-bold text-ink">Sin Cursos Tutoreados</h3>
               <p className="text-ink3 text-sm max-w-sm mx-auto">No figuras como tutor de ningún curso actualmente. Cambia a "Toma de asistencia" si deseas registrar ausencias para las materias que dictas.</p>
             </div>
           )}
        </div>
      )}
    </div>
  )
}

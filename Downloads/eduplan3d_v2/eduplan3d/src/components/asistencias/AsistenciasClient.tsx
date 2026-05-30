'use client'

import { useState, useMemo } from 'react'
import { TomaAsistencia } from './TomaAsistencia'
import { JustificacionesPanel } from './JustificacionesPanel'
import { Users, AlertTriangle, Clock as ClockIcon, ChevronDown, Eye, X, CalendarDays, CheckCircle2 } from 'lucide-react'
import { buildAttendanceSummaries, getStudentAttendanceHistory } from '@/lib/attendance-summary'

const REPORT_TYPES = [
  'Listado estudiantes',
  'Toma de asistencia',
  'Justificaciones',
]

export function AsistenciasClient({ tutoredCourses = [], enrollments = [], attendanceGlobal = [], justifications = [] }: any) {
  const [reportType, setReportType] = useState<string>(REPORT_TYPES[0])
  const [selectedCourse, setSelectedCourse] = useState(tutoredCourses[0]?.id || '')
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null)

  const currentEnrollments = useMemo(() => {
    return enrollments
      .filter((e: any) => selectedCourse === '' || e.course_id === selectedCourse)
      .sort((a: any, b: any) => (a.student?.full_name || '').localeCompare(b.student?.full_name || ''))
  }, [enrollments, selectedCourse])

  const attendanceStats = useMemo(() => {
    return buildAttendanceSummaries(attendanceGlobal)
  }, [attendanceGlobal])

  const selectedStudentHistory = useMemo(() => {
    if (!selectedStudent) return []
    return getStudentAttendanceHistory(attendanceGlobal, selectedStudent.student_id)
  }, [attendanceGlobal, selectedStudent])

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
                       <th className="px-5 py-4 font-bold text-center">% Asistencia</th>
                       <th className="px-5 py-4 font-bold text-center">Faltas Injustificadas</th>
                       <th className="px-5 py-4 font-bold text-center">Faltas Justificadas</th>
                       <th className="px-5 py-4 font-bold text-center">Atrasos</th>
                       <th className="px-5 py-4 font-bold text-center">Ultimo registro</th>
                       <th className="px-5 py-4 font-bold text-center">Accion</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-surface2/50">
                     {currentEnrollments.map((en: any, i: number) => {
                       const st = attendanceStats[en.student_id] || { present: 0, late: 0, absent: 0, justified: 0, total: 0, attendanceRate: 0, lastStatus: null, lastDate: null }
                       return (
                         <tr key={en.id} className={`hover:bg-bg/50 ${i % 2 === 0 ? '' : 'bg-[rgba(0,0,0,0.015)]'}`}>
                           <td className="px-5 py-4 font-semibold text-ink">
                             {en.student?.full_name || 'Desconocido'}
                           </td>
                           <td className="px-5 py-4 text-center">
                             <div className={`inline-flex min-w-[70px] items-center justify-center rounded-lg px-3 py-1 font-bold border ${
                               st.total > 0
                                 ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                 : 'bg-surface2/50 text-ink4 border-transparent'
                             }`}>
                               {st.attendanceRate}%
                             </div>
                           </td>
                           <td className="px-5 py-4 text-center">
                             <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-bold border transition-colors ${
                               st.absent > 0 ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-surface2/50 text-ink4 border-transparent'
                             }`}>
                               <AlertTriangle size={14} /> {Math.max(st.absent - st.justified, 0)}
                             </div>
                           </td>
                           <td className="px-5 py-4 text-center">
                             <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-bold border transition-colors ${
                               st.justified > 0 ? 'bg-sky-100 text-sky-800 border-sky-300' : 'bg-surface2/50 text-ink4 border-transparent'
                             }`}>
                               <CheckCircle2 size={14} /> {st.justified}
                             </div>
                           </td>
                           <td className="px-5 py-4 text-center">
                             <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-bold border transition-colors ${
                               st.late > 0 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-surface2/50 text-ink4 border-transparent'
                             }`}>
                               <ClockIcon size={14} /> {st.late}
                             </div>
                           </td>
                           <td className="px-5 py-4 text-center">
                             <div className="text-xs text-ink3 leading-tight">
                               <div className="font-semibold text-ink2">{formatDate(st.lastDate)}</div>
                               <div>{statusLabel(st.lastStatus)}</div>
                             </div>
                           </td>
                           <td className="px-5 py-4 text-center">
                             <button
                               type="button"
                               onClick={() => setSelectedStudent({
                                 student_id: en.student_id,
                                 full_name: en.student?.full_name || 'Desconocido',
                                 course_name: tutoredCourses.find((course: any) => course.id === selectedCourse)?.name || '',
                                 parallel: tutoredCourses.find((course: any) => course.id === selectedCourse)?.parallel || '',
                                 stats: st,
                               })}
                               className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                             >
                               <Eye size={14} /> Ver detalle
                             </button>
                           </td>
                         </tr>
                       )
                     })}
                     {currentEnrollments.length === 0 && (
                       <tr>
                         <td colSpan={7} className="px-5 py-12 text-center text-ink3">
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

      {selectedStudent && (
        <AttendanceStudentDetailModal
          student={selectedStudent}
          history={selectedStudentHistory}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  )
}

function AttendanceStudentDetailModal({ student, history, onClose }: { student: any, history: any[], onClose: () => void }) {
  const recentHistory = history.slice(0, 12)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl rounded-2xl border border-surface2 bg-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-surface2 px-6 py-5">
          <div>
            <h3 className="text-xl font-bold text-ink">Detalle de asistencia</h3>
            <p className="text-sm text-ink3 mt-1">
              {student.full_name} · {student.course_name} {student.parallel || ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-ink3 hover:bg-bg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryMetric label="% Asistencia" value={`${student.stats.attendanceRate}%`} tone="emerald" />
            <SummaryMetric label="Faltas injustificadas" value={String(Math.max(student.stats.absent - student.stats.justified, 0))} tone="rose" />
            <SummaryMetric label="Faltas justificadas" value={String(student.stats.justified)} tone="sky" />
            <SummaryMetric label="Atrasos" value={String(student.stats.late)} tone="amber" />
            <SummaryMetric label="Ultimo estado" value={statusLabel(student.stats.lastStatus)} tone="slate" />
          </div>

          <div className="rounded-2xl border border-surface2 bg-bg p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-ink mb-3">
              <CalendarDays size={16} className="text-indigo-500" />
              Ultimos registros
            </div>
            <div className="flex flex-wrap gap-2">
              {recentHistory.length > 0 ? recentHistory.map((record: any) => (
                <div
                  key={`${record.student_id}-${record.date}`}
                  className={`rounded-full px-3 py-1 text-xs font-bold border ${statusPillClasses(record.status, record.justification_status)}`}
                  title={`${formatDate(record.date)} · ${statusLabel(record.status)}${record.justification_status ? ` · ${record.justification_status}` : ''}`}
                >
                  {formatShortDate(record.date)} · {statusLabel(record.status)}
                </div>
              )) : (
                <p className="text-sm text-ink3">No hay historial de asistencia disponible para este estudiante todavia.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-surface2 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[rgba(0,0,0,0.02)]">
                <tr className="text-left text-xs uppercase tracking-wider text-ink3">
                  <th className="px-4 py-3 font-bold">Fecha</th>
                  <th className="px-4 py-3 font-bold">Estado</th>
                  <th className="px-4 py-3 font-bold">Justificacion</th>
                  <th className="px-4 py-3 font-bold">Observacion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface2/60">
                {history.length > 0 ? history.map((record: any) => (
                  <tr key={`${record.student_id}-${record.date}`}>
                    <td className="px-4 py-3 font-medium text-ink">{formatDate(record.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold border ${statusPillClasses(record.status, record.justification_status)}`}>
                        {statusLabel(record.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink2">{justificationLabel(record.justification_status)}</td>
                    <td className="px-4 py-3 text-ink3">{record.justification_text || 'Sin observacion'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-ink3">
                      No hay registros de asistencia para este estudiante.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryMetric({ label, value, tone }: { label: string, value: string, tone: 'emerald' | 'rose' | 'sky' | 'amber' | 'slate' }) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
    sky: 'bg-sky-50 text-sky-800 border-sky-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    slate: 'bg-slate-50 text-slate-800 border-slate-200',
  }

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  )
}

function formatDate(value?: string | null) {
  if (!value) return '--'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatShortDate(value?: string | null) {
  if (!value) return '--'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short' }).format(date)
}

function statusLabel(status?: string | null) {
  if (status === 'late') return 'Atraso'
  if (status === 'absent') return 'Falta'
  if (status === 'present') return 'Asistio'
  return 'Sin registro'
}

function justificationLabel(status?: string | null) {
  if (!status) return 'Sin justificar'
  if (status === 'approved' || status === 'aprobada' || status === 'justified') return 'Aprobada'
  if (status === 'pending' || status === 'pendiente') return 'Pendiente'
  if (status === 'rejected' || status === 'rechazada') return 'Rechazada'
  return status
}

function statusPillClasses(status?: string | null, justificationStatus?: string | null) {
  if (status === 'absent' && (justificationStatus === 'approved' || justificationStatus === 'aprobada' || justificationStatus === 'justified')) {
    return 'bg-sky-50 text-sky-800 border-sky-200'
  }
  if (status === 'absent') return 'bg-rose-50 text-rose-800 border-rose-200'
  if (status === 'late') return 'bg-amber-50 text-amber-800 border-amber-200'
  if (status === 'present') return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

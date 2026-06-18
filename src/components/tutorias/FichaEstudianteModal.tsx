'use client'

import { useState } from 'react'
import { X, User, Users, HeartPulse, BrainCircuit, GraduationCap, Receipt, ShieldAlert, CalendarDays } from 'lucide-react'

function calcularEdad(fechaNacimiento: string | undefined): string {
  if (!fechaNacimiento) return '--'
  const dob = new Date(fechaNacimiento)
  if (Number.isNaN(dob.getTime())) return '--'

  const diffMs = Date.now() - dob.getTime()
  const ageDate = new Date(diffMs)
  const years = Math.abs(ageDate.getUTCFullYear() - 1970)
  const months = ageDate.getUTCMonth()
  const days = ageDate.getUTCDate() - 1
  return `${years} anos, ${months} meses, ${days} dias`
}

export function FichaEstudianteModal({ student, onClose }: { student: any, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState('Perfil')

  const TABS = [
    { id: 'Perfil', icon: User },
    { id: 'Datos Familiares', icon: Users },
    { id: 'Representante', icon: ShieldAlert },
    { id: 'Socio-Economicos', icon: Receipt },
    { id: 'Medicos', icon: HeartPulse },
    { id: 'Fisicos', icon: BrainCircuit },
    { id: 'Academicos', icon: GraduationCap },
    { id: 'Asistencia', icon: CalendarDays },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
      <div
        className="w-full max-w-5xl bg-surface border border-surface2 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[rgba(0,0,0,0.05)] flex items-center justify-between">
          <h2 className="font-display font-medium text-xl text-slate-700">Perfil Administrativo</h2>
          <button onClick={onClose} className="p-2 text-ink3 hover:bg-[rgba(0,0,0,0.05)] rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="bg-slate-50 border-b border-[rgba(0,0,0,0.05)] flex overflow-x-auto custom-scrollbar shadow-inner">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors border-b-2
                  ${isActive
                    ? 'border-indigo-600 outline-none text-indigo-700 bg-white shadow-[0_-2px_0_0_inset_#4f46e5]'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
                  }`}
              >
                <Icon size={14} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                {tab.id}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white custom-scrollbar">
          {activeTab === 'Perfil' && (
            <div className="flex flex-col lg:flex-row gap-8 animate-fade-in">
              <div className="flex-none flex flex-col items-center w-full lg:w-48 space-y-3">
                <div className="w-48 h-48 rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-50 relative p-1 shadow-sm">
                  {student.avatar_url ? (
                    <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover rounded shadow-inner" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                      <User size={64} />
                      <span className="text-[10px] mt-2 font-semibold">SIN FOTO</span>
                    </div>
                  )}
                </div>
                <div className="w-full bg-emerald-100 border border-emerald-200 text-emerald-700 py-2 rounded-lg font-bold text-center text-sm shadow-inner flex items-center justify-center gap-2">
                  <GraduationCap size={14} /> {student.student_code || '26EGB4A'}
                </div>
                {student.courseLabel ? (
                  <div className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 py-2 rounded-lg font-bold text-center text-xs uppercase tracking-wide">
                    {student.courseLabel}
                  </div>
                ) : null}
              </div>

              <div className="flex-1 space-y-8">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-2xl lg:text-3xl text-slate-700 uppercase tracking-tight">{student.full_name}</h1>
                  <span className="bg-[#2D7A31] text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
                    {student.username || student.email?.split('@')[0] || 'estudiante'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12 text-sm">
                  <div className="space-y-4">
                    <Field label="N Documento" value={student.dni} />
                    <Field label="T. Documento" value={student.document_type || 'Cedula'} />
                    <Field label="Pais nacimiento" value={student.birth_country || 'Ecuador'} />
                    <Field label="C. Nacimiento" value={student.birth_city || 'No registrada'} />
                    <Field label="F. Nacimiento" value={student.birth_date || 'No registrada'} />
                    <Field label="Edad" value={calcularEdad(student.birth_date)} />
                    <Field label="Genero" value={student.gender || 'No especificado'} />
                    <Field label="Etnia" value={student.ethnicity || 'Mestizo'} />
                  </div>

                  <div className="space-y-4">
                    <Field label="Pais" value={student.current_country || 'Ecuador'} />
                    <Field label="Ciudad" value={student.current_city || 'No registrada'} />
                    <Field label="Parroquia" value={student.parish || 'No registrada'} />
                    <Field label="Direccion" value={student.address || 'No registrada'} />
                    <Field label="Codigo unico electrico" value={student.cuel || 'No aplica'} />
                    <Field label="Celular / Telefono" value={student.phone || 'No registrado'} />
                    <Field label="Correo" value={student.email} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Datos Familiares' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-fade-in">
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-teal flex items-center gap-2 border-b border-teal/10 pb-2 uppercase tracking-wider">Datos de la Madre</h3>
                <div className="space-y-4">
                  <Field label="Nombres Completos" value={student.mother_name} />
                  <Field label="Telefono" value={student.mother_phone} />
                  <Field label="Email" value={student.mother_email} />
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-[#F8D25A] flex items-center gap-2 border-b border-yellow-500/10 pb-2 uppercase tracking-wider">Datos del Padre</h3>
                <div className="space-y-4">
                  <Field label="Nombres Completos" value={student.father_name} />
                  <Field label="Telefono" value={student.father_phone} />
                  <Field label="Email" value={student.father_email} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Representante' && (
            <div className="max-w-2xl animate-fade-in space-y-8">
              <h3 className="text-sm font-bold text-violet2 flex items-center gap-2 border-b border-violet2/10 pb-2 uppercase tracking-wider">Representacion y Emergencia</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Field label="Representante oficial" value={student.representative || 'No definido'} />
                <Field label="Telefono de Emergencia" value={student.emergency_phone} />
                {student.representative === 'OTRO' && (
                  <Field label="Nombre del Tutor Alterno" value={student.other_representative_name} />
                )}
              </div>
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-widest">Observacion de Seguridad</p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Solo el representante oficial esta facultado para retirar al estudiante o firmar actas compromisorias. En caso de emergencia, llamar prioritariamente al numero indicado.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'Medicos' && (
            <div className="space-y-8 animate-fade-in">
              <h3 className="text-sm font-bold text-rose-500 flex items-center gap-2 border-b border-rose-500/10 pb-2 uppercase tracking-wider">Informacion de Salud</h3>
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center flex-none">
                    <HeartPulse size={24} className="text-rose-500" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-rose-800 uppercase tracking-widest">Notas Medicas / Alergias</p>
                    <p className="text-slate-700 text-base leading-relaxed italic">
                      {student.medical_notes || student.address || 'No se han registrado alergias o condiciones medicas especiales para este estudiante.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Asistencia' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-sm font-bold text-indigo-600 flex items-center gap-2 border-b border-indigo-100 pb-2 uppercase tracking-wider">
                  <CalendarDays size={14} /> Resumen de asistencia
                </h3>
                <p className="mt-2 text-sm text-slate-500">Vista consolidada por fecha segun la asistencia oficial del curso.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard label="% Asistencia" value={`${student.attendanceSummary?.attendanceRate ?? 0}%`} tone="emerald" />
                <StatCard label="Faltas injustificadas" value={String(Math.max((student.attendanceSummary?.absent ?? 0) - (student.attendanceSummary?.justified ?? 0), 0))} tone="rose" />
                <StatCard label="Faltas justificadas" value={String(student.attendanceSummary?.justified ?? 0)} tone="sky" />
                <StatCard label="Atrasos" value={String(student.attendanceSummary?.late ?? 0)} tone="amber" />
                <StatCard label="Ultimo estado" value={attendanceStatusLabel(student.attendanceSummary?.lastStatus)} tone="slate" />
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3 font-bold">Fecha</th>
                      <th className="px-4 py-3 font-bold">Estado</th>
                      <th className="px-4 py-3 font-bold">Justificacion</th>
                      <th className="px-4 py-3 font-bold">Observacion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(student.attendanceHistory || []).length > 0 ? (student.attendanceHistory || []).map((record: any) => (
                      <tr key={`${record.student_id}-${record.date}`}>
                        <td className="px-4 py-3 font-medium text-slate-700">{formatAttendanceDate(record.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold border ${attendancePillClasses(record.status, record.justification_status)}`}>
                            {attendanceStatusLabel(record.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{attendanceJustificationLabel(record.justification_status)}</td>
                        <td className="px-4 py-3 text-slate-500">{record.justification_text || 'Sin observacion'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-400">No hay historial de asistencia disponible para este estudiante.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {['Fisicos', 'Socio-Economicos', 'Academicos'].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4 animate-fade-in">
              {(() => {
                const ContentIcon = TABS.find(t => t.id === activeTab)?.icon
                return ContentIcon ? <ContentIcon size={56} className="opacity-10" /> : null
              })()}
              <div className="text-center">
                <p className="font-bold text-slate-400">Expediente de {activeTab}</p>
                <p className="text-sm text-slate-300 max-w-xs mt-1">Esta seccion contiene documentos sensibles manejados directamente por Rectorado y Secretaria.</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold tracking-widest uppercase">
          <span>Documento Privado · {new Date().getFullYear()} · Sistema Admin</span>
          <span>ClassNova Institution Management</span>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string, value: string | undefined }) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-4 border-b border-slate-50 pb-2 group">
      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider col-span-1 flex items-center">{label}</span>
      <span className="text-slate-700 font-semibold col-span-2 md:col-span-3 text-sm">{value || 'No registrado'}</span>
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string, value: string, tone: 'emerald' | 'rose' | 'sky' | 'amber' | 'slate' }) {
  const toneMap: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    rose: 'bg-rose-50 border-rose-200 text-rose-900',
    sky: 'bg-sky-50 border-sky-200 text-sky-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
  }

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneMap[tone]}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  )
}

function formatAttendanceDate(value?: string | null) {
  if (!value) return '--'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function attendanceStatusLabel(status?: string | null) {
  if (status === 'late') return 'Atraso'
  if (status === 'absent') return 'Falta'
  if (status === 'present') return 'Asistio'
  return 'Sin registro'
}

function attendanceJustificationLabel(status?: string | null) {
  if (!status) return 'Sin justificar'
  if (status === 'approved' || status === 'aprobada' || status === 'justified') return 'Aprobada'
  if (status === 'pending' || status === 'pendiente') return 'Pendiente'
  if (status === 'rejected' || status === 'rechazada') return 'Rechazada'
  return status
}

function attendancePillClasses(status?: string | null, justificationStatus?: string | null) {
  if (status === 'absent' && (justificationStatus === 'approved' || justificationStatus === 'aprobada' || justificationStatus === 'justified')) {
    return 'bg-sky-50 text-sky-800 border-sky-200'
  }
  if (status === 'absent') return 'bg-rose-50 text-rose-800 border-rose-200'
  if (status === 'late') return 'bg-amber-50 text-amber-800 border-amber-200'
  if (status === 'present') return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

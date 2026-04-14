'use client'

import { useState } from 'react'
import {
  BookOpen, CalendarDays, BarChart2,
  CheckCircle2, Clock3, ThumbsUp, ThumbsDown,
  Upload, X, Check, Paperclip, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

type TabType = 'resumen' | 'tareas' | 'horario' | 'calificaciones' | 'asistencia' | 'comportamiento'

const CARD_COLORS = [
  '#7C6DFA', '#3B82F6', '#14B8A6',
  '#F59E0B', '#F43F5E', '#6366F1',
  '#10B981', '#F97316', '#EC4899', '#06B6D4',
]
const DIAS_SEMANA = ['Lunes','Martes','Miércoles','Jueves','Viernes'] as const

function toISO(d: Date) { return d.toISOString().split('T')[0] }

export function AlumnoClient({
  profile, courses, subjects, assignments, grades, categories, attendance, behaviors, scheduleConfig, horariosData
}: any) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<TabType>('resumen')

  // Justification Modal State
  const [showJustifyModal, setShowJustifyModal] = useState<any>(null) // the attendance record
  const [justifyText, setJustifyText] = useState('')
  const [justifyFile, setJustifyFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localAttendance, setLocalAttendance] = useState<any[]>(attendance || [])

  // ── Stats
  const missingAssignments = assignments.filter((a: any) => !grades.find((g: any) => g.assignment_id === a.id))
  const attendanceIssues = localAttendance.filter((a: any) => a.status === 'absent' || a.status === 'late')

  // ── Today's Classes 
  const now = new Date()
  const dayIndex = now.getDay()
  const todayName = dayIndex >= 1 && dayIndex <= 5 ? DIAS_SEMANA[dayIndex - 1] : null
  
  const todayClasses: any[] = []
  const myCourseNames = courses.map((c: any) => `${c.name} ${c.parallel || ''}`.trim())
  
  if (todayName) {
    Object.values(horariosData).forEach((slot: any) => {
      const cfg = slot.config || {}
      const perArr = cfg.horarios || []
      const rec = new Set<number>(cfg.recesos || [4])
      
      Object.entries(slot.horario || {}).forEach(([curso, dias]: [string, any]) => {
        if (myCourseNames.includes(curso)) {
          const materias = dias[todayName] || []
          materias.forEach((m: string, idx: number) => {
            if (m && !rec.has(idx)) {
              todayClasses.push({
                materia: m,
                curso,
                hora: perArr[idx] || `${idx + 1}°`,
                periodoIdx: idx
              })
            }
          })
        }
      })
    })
    todayClasses.sort((a, b) => a.periodoIdx - b.periodoIdx)
  }

  // ── Submit Justification
  async function handleJustifySubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!justifyText.trim()) return toast.error('Ingresa un motivo')
    setIsSubmitting(true)

    try {
      let file_url = null
      if (justifyFile) {
        const fileExt = justifyFile.name.split('.').pop()
        const fileName = `${profile.id}-${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('justifications')
          .upload(fileName, justifyFile)
          
        if (uploadError) throw new Error('Error al subir el archivo: ' + uploadError.message)
        
        const { data: { publicUrl } } = supabase.storage
          .from('justifications')
          .getPublicUrl(fileName)
        file_url = publicUrl
      }

      const res = await fetch('/api/alumno/attendance/justify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendance_id: showJustifyModal.id,
          text: justifyText,
          file_url
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      
      // Update local state
      setLocalAttendance(prev => prev.map(a => 
        a.id === showJustifyModal.id ? { ...a, justification_status: 'pending', justification_text: justifyText, justification_file_url: file_url } : a
      ))
      
      toast.success('Justificación enviada')
      setShowJustifyModal(null)
      setJustifyText('')
      setJustifyFile(null)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
      {/* ── HEADER ── */}
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">
          Hola, {profile.full_name?.split(' ')[0] || 'Estudiante'} 👋
        </h1>
        <p className="text-ink3 text-sm mt-1">{courses.map((c: any) => `${c.name} ${c.parallel || ''}`.trim()).join(' / ')}</p>
      </div>

      {/* ── TABS ── */}
      <div className="flex bg-surface rounded-2xl border border-surface2 p-1 overflow-x-auto custom-scrollbar shadow-sm">
        {[
          { id: 'resumen', icon: <BarChart2 size={16}/>, label: 'Resumen' },
          { id: 'tareas', icon: <BookOpen size={16}/>, label: 'Tareas' },
          { id: 'horario', icon: <CalendarDays size={16}/>, label: 'Horario' },
          { id: 'calificaciones', icon: <CheckCircle2 size={16}/>, label: 'Calificaciones' },
          { id: 'asistencia', icon: <Clock3 size={16}/>, label: 'Asistencia' },
          { id: 'comportamiento', icon: <ThumbsUp size={16}/>, label: 'Comportamiento' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`flex-1 flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === t.id ? 'bg-violet text-white shadow-glow' : 'text-ink3 hover:bg-[rgba(0,0,0,0.03)] hover:text-ink'
            }`}>
            {t.icon} <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      {activeTab === 'resumen' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface rounded-2xl border border-surface2 p-4">
              <div className="text-xs font-bold text-ink4 uppercase mb-1 tracking-wide">Materias</div>
              <div className="text-2xl font-bold text-[#7C6DFA]">{subjects.length}</div>
            </div>
            <div className="bg-surface rounded-2xl border border-surface2 p-4">
              <div className="text-xs font-bold text-ink4 uppercase mb-1 tracking-wide">Tareas Pendientes</div>
              <div className="text-2xl font-bold text-[#F59E0B]">{missingAssignments.length}</div>
            </div>
            <div className="bg-surface rounded-2xl border border-surface2 p-4">
              <div className="text-xs font-bold text-ink4 uppercase mb-1 tracking-wide">Faltas/Atrasos</div>
              <div className="text-2xl font-bold text-[#EF4444]">{attendanceIssues.length}</div>
            </div>
            <div className="bg-surface rounded-2xl border border-surface2 p-4">
              <div className="text-xs font-bold text-ink4 uppercase mb-1 tracking-wide">Méritos</div>
              <div className="text-2xl font-bold text-[#10B981]">{behaviors.filter((b: any) => b.type === 'positive').length}</div>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-surface2 p-5">
            <h2 className="font-display text-lg font-bold mb-4">📅 Clases de Hoy</h2>
            {todayClasses.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {todayClasses.map((cl, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-surface2 bg-bg min-w-[200px]">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-ink truncate">{cl.materia}</div>
                      <div className="text-xs text-ink3 truncate">{cl.hora}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink3">No tienes clases hoy o es fin de semana.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tareas' && (
        <div className="bg-surface rounded-2xl border border-surface2 p-5">
          <h2 className="font-display text-lg font-bold mb-4">📓 Todas las tareas</h2>
          <div className="space-y-3">
            {assignments.length > 0 ? assignments.map((a: any) => {
              const subject = subjects.find((s: any) => s.id === a.subject_id)
              const grade = grades.find((g: any) => g.assignment_id === a.id)
              const isPastDue = a.due_date && new Date(a.due_date).getTime() < new Date().getTime()
              
              return (
                <div key={a.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-4 rounded-xl border border-surface2 bg-bg hover:border-violet/30 transition-all">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-ink">{a.title}</div>
                      {grade ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500">Calificada</span>
                      ) : isPastDue ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500">Atrasada</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500">Pendiente</span>
                      )}
                    </div>
                    <div className="text-sm text-ink3 mt-0.5">{subject?.name || 'Materia general'}</div>
                    {a.due_date && (
                      <div className="text-xs text-ink4 mt-1 flex items-center gap-1">
                        <Clock3 size={12}/> Vence: {new Date(a.due_date).toLocaleDateString('es-ES')}
                      </div>
                    )}
                  </div>
                  {grade && (
                    <div className="sm:text-right">
                      <div className="text-2xl font-black text-emerald-500">{grade.score}</div>
                      <div className="text-[10px] text-ink4 font-bold uppercase tracking-wide">Calificación</div>
                    </div>
                  )}
                </div>
              )
            }) : <p className="text-sm text-ink3 text-center py-10">No tienes tareas registradas.</p>}
          </div>
        </div>
      )}

      {activeTab === 'asistencia' && (
        <div className="bg-surface rounded-2xl border border-surface2 p-5">
          <h2 className="font-display text-lg font-bold mb-4">🕒 Faltas y Atrasos</h2>
          <div className="space-y-3">
            {attendanceIssues.length > 0 ? attendanceIssues.map((a: any) => {
              const subject = subjects.find((s: any) => s.id === a.subject_id)
              const statusColors = {
                missing: 'text-rose-500 bg-rose-500/10',
                late: 'text-amber-500 bg-amber-500/10'
              }
              const isLate = a.status === 'late'
              
              return (
                <div key={a.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-4 rounded-xl border border-surface2 bg-bg">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={`px-2 py-0.5 rounded text-xs font-bold ${isLate ? statusColors.late : statusColors.missing}`}>
                        {isLate ? 'Atraso' : 'Falta'}
                      </div>
                      <div className="font-semibold text-sm text-ink">{subject?.name || 'Clase'}</div>
                    </div>
                    <div className="text-xs text-ink4 mt-1">{new Date(a.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</div>
                    
                    {a.justification_status && (
                      <div className="mt-2 text-xs">
                        <span className="font-semibold">Justificación: </span>
                        {a.justification_status === 'pending' && <span className="text-amber-500">En revisión</span>}
                        {a.justification_status === 'approved' && <span className="text-emerald-500">Aprobada</span>}
                        {a.justification_status === 'rejected' && <span className="text-rose-500">Rechazada</span>}
                        <br/>
                        <span className="text-ink3 italic">"{a.justification_text}"</span>
                        {a.justification_file_url && (
                          <a href={a.justification_file_url} target="_blank" rel="noreferrer" className="text-violet hover:underline ml-2">Ver adjunto</a>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {!a.justification_status && (
                    <button onClick={() => setShowJustifyModal(a)} className="btn-secondary px-3 py-1.5 text-xs">
                      Justificar
                    </button>
                  )}
                </div>
              )
            }) : <p className="text-sm text-ink3 text-center py-10">¡Excelente! Tienes asistencia perfecta.</p>}
          </div>
        </div>
      )}

      {/* Justification Modal */}
      {showJustifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl border border-surface2 shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-surface2 bg-bg2">
              <h3 className="font-bold text-ink">Justificar Inasistencia</h3>
              <button onClick={() => { setShowJustifyModal(null); setJustifyText(''); setJustifyFile(null) }} className="text-ink3 hover:text-ink"><X size={20}/></button>
            </div>
            <form onSubmit={handleJustifySubmit} className="p-4 space-y-4">
              <div className="text-sm text-ink3">
                Explica el motivo de la falta o atraso del día <b>{showJustifyModal.date}</b> para la clase de <b>{subjects.find((s:any)=>s.id===showJustifyModal.subject_id)?.name}</b>.
              </div>
              
              <div>
                <label className="block text-xs font-bold text-ink4 uppercase tracking-wider mb-2">Motivo</label>
                <textarea 
                  required
                  value={justifyText} onChange={e => setJustifyText(e.target.value)}
                  className="input-base w-full h-24 resize-none"
                  placeholder="Detalla el motivo de la inasistencia..."
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-ink4 uppercase tracking-wider mb-2">Adjuntar evidencia (Opcional)</label>
                <div className="flex items-center gap-3">
                  <label className="btn-secondary px-3 py-2 cursor-pointer flex items-center gap-2">
                    <Paperclip size={16}/> Seleccionar Archivo
                    <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={e => setJustifyFile(e.target.files?.[0] || null)} />
                  </label>
                  <span className="text-xs text-ink4 truncate">{justifyFile ? justifyFile.name : 'Ningún archivo seleccionado'}</span>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-surface2">
                <button type="button" onClick={() => setShowJustifyModal(null)} className="btn-secondary px-4 py-2">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary px-4 py-2 disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting ? 'Enviando...' : <><Upload size={16}/> Enviar Justificación</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MORE TABS: calificaciones, horario, comportamiento would go here following similar beautiful UI logic */}
      {activeTab === 'comportamiento' && (
        <div className="bg-surface rounded-2xl border border-surface2 p-5">
           <h2 className="font-display text-lg font-bold mb-4">👍 Observaciones Disciplinarias</h2>
           <div className="space-y-3">
             {behaviors.length > 0 ? behaviors.map((b: any) => (
                <div key={b.id} className="flex gap-4 p-4 rounded-xl border border-surface2 bg-bg">
                  <div className={`mt-1 flex-shrink-0 ${b.type==='positive'?'text-emerald-500':b.type==='negative'?'text-rose-500':'text-amber-500'}`}>
                    {b.type === 'positive' ? <ThumbsUp size={20}/> : b.type === 'negative' ? <ThumbsDown size={20}/> : <AlertTriangle size={20}/>}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{subjects.find((s:any)=>s.id===b.subject_id)?.name}</div>
                    <div className="text-sm text-ink3 mt-1">{b.description}</div>
                    <div className="text-xs text-ink4 mt-2">{new Date(b.date).toLocaleDateString('es-ES')}</div>
                  </div>
                </div>
             )) : <p className="text-sm text-ink3 py-10 text-center">No tienes observaciones.</p>}
           </div>
        </div>
      )}
      
      {activeTab === 'horario' && (
        <div className="bg-surface rounded-2xl border border-surface2 p-5 text-center">
          <p className="text-sm text-ink3">El horario institucional estará visible aquí próximamente.</p>
        </div>
      )}
      
      {activeTab === 'calificaciones' && (
        <div className="bg-surface rounded-2xl border border-surface2 p-5">
          <h2 className="font-display text-lg font-bold mb-4">🎓 Libreta de Calificaciones</h2>
           <div className="space-y-3">
             {subjects.map((sub:any) => {
               const myAsgs = assignments.filter((a:any)=>a.subject_id === sub.id)
               const myGrades = grades.filter((g:any)=>myAsgs.some((a:any)=>a.id===g.assignment_id))
               const avg = myGrades.length > 0 ? (myGrades.reduce((acc:any, g:any)=>acc+g.score,0)/myGrades.length).toFixed(2) : null
               
               return (
                 <div key={sub.id} className="flex justify-between items-center p-4 rounded-xl border border-surface2 bg-bg">
                   <div>
                     <div className="font-bold text-ink">{sub.name}</div>
                     <div className="text-xs text-ink4">{sub.teacher?.full_name || 'Sin docente'}</div>
                   </div>
                   <div className="text-right">
                     {avg ? (
                        <>
                          <div className={`text-xl font-black ${Number(avg) >= 7 ? 'text-emerald-500' : 'text-rose-500'}`}>{avg}</div>
                          <div className="text-[10px] text-ink4 font-bold uppercase tracking-wide">Promedio</div>
                        </>
                     ) : <span className="text-sm text-ink4">Sin notas</span>}
                   </div>
                 </div>
               )
             })}
           </div>
        </div>
      )}

    </div>
  )
}

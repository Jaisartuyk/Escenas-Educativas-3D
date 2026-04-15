'use client'

import { useState } from 'react'
import {
  BookOpen, CalendarDays, BarChart2,
  CheckCircle2, Clock3, ThumbsUp, ThumbsDown,
  Upload, X, Check, Paperclip, AlertTriangle,
  Award, Trophy, Star, Send, ExternalLink, FileText,
  Trash2
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

function parseLocalDate(dateStr: string) {
  if (!dateStr) return new Date();
  const [yyyy, mm, dd] = dateStr.split('T')[0].split('-');
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

export function AlumnoClient({
  profile, courses, subjects, assignments, grades, categories, attendance, behaviors, scheduleConfig, horariosData
}: any) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<TabType>('resumen')

  const currentDayIndex = new Date().getDay()
  const defaultDay = currentDayIndex >= 1 && currentDayIndex <= 5 ? DIAS_SEMANA[currentDayIndex - 1] : 'Lunes'
  const [selectedDay, setSelectedDay] = useState<string>(defaultDay)

  // Justification Modal State
  const [showJustifyModal, setShowJustifyModal] = useState<any>(null)
  const [justifyText, setJustifyText] = useState('')
  const [justifyFile, setJustifyFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localAttendance, setLocalAttendance] = useState<any[]>(attendance || [])

  // Assignment Submission Modal State
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null)
  const [mySubmissions, setMySubmissions] = useState<Record<string, any>>({})
  const [submitComment, setSubmitComment] = useState('')
  const [submitFile, setSubmitFile] = useState<File | null>(null)
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
  const [loadedSubmissions, setLoadedSubmissions] = useState(false)

  // Load submissions once when Tareas tab is opened
  async function loadMySubmissions() {
    if (loadedSubmissions) return
    try {
      const res = await fetch('/api/alumno/submissions')
      const data = await res.json()
      const map: Record<string, any> = {}
      ;(data.submissions || []).forEach((s: any) => { map[s.assignment_id] = s })
      setMySubmissions(map)
      setLoadedSubmissions(true)
    } catch {}
  }

  async function handleOpenAssignment(a: any) {
    setSelectedAssignment(a)
    setSubmitComment('')
    setSubmitFile(null)
    if (!loadedSubmissions) await loadMySubmissions()
  }

  async function handleSubmitTask(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAssignment) return
    setIsSubmittingTask(true)
    try {
      let file_url = null
      if (submitFile) {
        const ext = submitFile.name.split('.').pop()
        const fileName = `${profile.id}-${selectedAssignment.id}-${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('submissions')
          .upload(fileName, submitFile)
        if (uploadError) throw new Error('Error al subir: ' + uploadError.message)
        const { data: { publicUrl } } = supabase.storage.from('submissions').getPublicUrl(fileName)
        file_url = publicUrl
      }
      const res = await fetch('/api/alumno/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: selectedAssignment.id, comment: submitComment, file_url })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMySubmissions(prev => ({ ...prev, [selectedAssignment.id]: data.submission }))
      toast.success('¡Tarea entregada correctamente!')
      setSelectedAssignment(null)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmittingTask(false)
    }
  }

  async function handleDeleteSubmission(submissionId: string, assignmentId: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar tu entrega? Esta acción no se puede deshacer.')) return

    try {
      const res = await fetch(`/api/alumno/submissions?id=${submissionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Error al eliminar la entrega')
      
      setMySubmissions(prev => {
        const next = { ...prev }
        delete next[assignmentId]
        return next
      })
      toast.success('Entrega eliminada correctamente')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // ── Stats
  const missingAssignments = assignments.filter((a: any) => !grades.find((g: any) => g.assignment_id === a.id))
  const attendanceIssues = localAttendance.filter((a: any) => a.status === 'absent' || a.status === 'late')
  const merits = behaviors.filter((b: any) => b.type === 'positive')

  // ── Today's Classes 
  const now = new Date()
  const dayIndex = now.getDay()
  const todayName = dayIndex >= 1 && dayIndex <= 5 ? DIAS_SEMANA[dayIndex - 1] : null
  
  // ── My Schedule Logic
  let myScheduleGrid: any = null
  let myPeriods: string[] = []
  let myBreaks = new Set<number>()
  
  const todayClasses: any[] = []
  const myCourseNames = courses.map((c: any) => `${c.name} ${c.parallel || ''}`.trim())
  
  Object.values(horariosData).forEach((slot: any) => {
    Object.entries(slot.horario || {}).forEach(([cursoName, schedule]: [string, any]) => {
      // Find matching schedule for my enrolled course
      if (myCourseNames.includes(cursoName.trim()) && !myScheduleGrid) {
        myScheduleGrid = schedule
        myPeriods = slot.config?.horarios || []
        myBreaks = new Set(slot.config?.recesos || [4])
      }
    })
  })
  
  if (todayName && myScheduleGrid) {
    const materias = myScheduleGrid[todayName] || []
    materias.forEach((m: string, idx: number) => {
      if (m && !myBreaks.has(idx)) {
        todayClasses.push({
          materia: m,
          curso: myCourseNames[0],
          hora: myPeriods[idx] || `${idx + 1}°`,
          periodoIdx: idx
        })
      }
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
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-fade-in px-4 sm:px-0">
      
      {/* ── PREMIUM HEADER BANNER ── */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 shadow-xl shadow-indigo-500/20 p-8 sm:p-12 mb-8">
        {/* Abstract decor */}
        <div className="absolute top-0 right-0 -m-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -m-20 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-cyan-400/20 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
          <div className="text-center sm:text-left">
            <h1 className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-sm mb-2">
              Hola, {profile.full_name?.split(' ')[0] || 'Estudiante'} 👋
            </h1>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-sm font-medium">
              <Award size={16} className="text-yellow-300" />
              {courses.map((c: any) => `${c.name} ${c.parallel || ''}`.trim()).join(' / ')}
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-4 bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-inner">
            <div className="text-center px-4 border-r border-white/10">
              <div className="text-3xl font-black text-white">{subjects.length}</div>
              <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">Materias</div>
            </div>
            <div className="text-center px-4">
              <div className="text-3xl font-black text-emerald-400">{merits.length}</div>
              <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">Méritos</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODERN TABS ── */}
      <div className="sticky top-4 z-40 p-1.5 bg-surface/80 backdrop-blur-xl border border-surface2 rounded-2xl shadow-sm overflow-x-auto custom-scrollbar flex gap-1">
        {[
          { id: 'resumen', icon: <BarChart2 size={18}/>, label: 'Resumen' },
          { id: 'tareas', icon: <BookOpen size={18}/>, label: 'Tareas' },
          { id: 'horario', icon: <CalendarDays size={18}/>, label: 'Horario' },
          { id: 'calificaciones', icon: <CheckCircle2 size={18}/>, label: 'Promedios' },
          { id: 'asistencia', icon: <Clock3 size={18}/>, label: 'Asistencia' },
          { id: 'comportamiento', icon: <Star size={18}/>, label: 'Docencia' },
        ].map(t => {
          const isActive = activeTab === t.id
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)}
              className={`flex-1 flex justify-center items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                isActive 
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 scale-[1.02]' 
                  : 'text-ink3 hover:bg-[rgba(0,0,0,0.04)] hover:text-ink'
              }`}>
              {t.icon} <span className="hidden sm:inline">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="animate-slide-up">
        {activeTab === 'resumen' && (
          <div className="space-y-8">
            <h2 className="font-display text-2xl font-bold flex items-center gap-3">
              <span className="p-2 bg-violet-100 dark:bg-violet-900/30 text-violet-600 rounded-xl">📊</span> Visión General
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Materias Inscritas', value: subjects.length, color: 'from-blue-500 to-cyan-400', icon: '📚', shadow: 'shadow-blue-500/20' },
                { label: 'Tareas Pendientes', value: missingAssignments.length, color: 'from-amber-400 to-orange-500', icon: '📝', shadow: 'shadow-orange-500/20' },
                { label: 'Faltas y Atrasos', value: attendanceIssues.length, color: 'from-rose-500 to-red-600', icon: '⚠️', shadow: 'shadow-rose-500/20' },
                { label: 'Felicitaciones', value: merits.length, color: 'from-emerald-400 to-teal-500', icon: '🏆', shadow: 'shadow-emerald-500/20' },
              ].map((stat, i) => (
                <div key={i} className={`relative overflow-hidden bg-surface rounded-[1.5rem] border border-surface2 p-6 shadow-xl ${stat.shadow} hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 group`}>
                  <div className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500`} />
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <div className="text-[11px] font-black text-ink4 uppercase tracking-widest mb-1">{stat.label}</div>
                      <div className={`text-4xl font-black bg-gradient-to-br ${stat.color} text-transparent bg-clip-text`}>{stat.value}</div>
                    </div>
                    <div className={`text-2xl p-3 bg-gradient-to-br ${stat.color} bg-opacity-10 rounded-2xl bg-clip-padding backdrop-filter backdrop-blur-sm shadow-sm`}>{stat.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-surface rounded-[2rem] border border-surface2 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-bold flex items-center gap-3">
                   📅 Clases de Hoy
                </h2>
                <span className="text-sm font-medium text-ink4 bg-surface2 px-4 py-1.5 rounded-full">{todayName || 'Fin de semana'}</span>
              </div>
              
              {todayClasses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {todayClasses.map((cl, i) => (
                    <div key={i} className="flex flex-col gap-3 p-5 rounded-2xl border border-surface2 bg-bg hover:border-violet-400/50 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-colors duration-300 group">
                      <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center font-bold shadow-sm group-hover:scale-110 transition-transform">
                        {cl.hora.split('-')[0]?.trim() || `P${cl.periodoIdx+1}`}
                      </div>
                      <div>
                        <div className="font-bold text-ink text-lg leading-tight mb-1">{cl.materia}</div>
                        <div className="text-xs font-semibold text-ink4 flex items-center gap-1">
                          <Clock3 size={12}/> {cl.hora}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-bg rounded-2xl border border-dashed border-surface2">
                  <div className="text-4xl mb-4">🎉</div>
                  <h3 className="font-bold text-ink">¡Día Libre!</h3>
                  <p className="text-sm text-ink3 mt-1">No tienes clases programadas para hoy, o es fin de semana.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tareas' && (
          <div className="bg-surface rounded-[2rem] border border-surface2 p-6 sm:p-8 shadow-sm">
            <h2 className="font-display text-2xl font-bold flex items-center gap-3 mb-6">
              <span className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl"><BookOpen size={20}/></span> 
              Historial de Tareas
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {assignments.length > 0 ? assignments.map((a: any) => {
                const subject = subjects.find((s: any) => s.id === a.subject_id)
                const grade = grades.find((g: any) => g.assignment_id === a.id)
                const hasSubmission = !!mySubmissions[a.id]
                
                let isPastDue = false
                if (a.due_date) {
                  const due = parseLocalDate(a.due_date)
                  due.setHours(23, 59, 59, 999)
                  isPastDue = due.getTime() < new Date().getTime()
                }
                
                return (
                  <button key={a.id} onClick={() => { setActiveTab('tareas'); handleOpenAssignment(a) }}
                    className="w-full text-left relative overflow-hidden flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-6 rounded-2xl border border-surface2 bg-bg hover:border-violet-400/50 transition-all duration-300 group hover:shadow-md"
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${grade ? 'bg-emerald-400' : hasSubmission ? 'bg-blue-400' : isPastDue ? 'bg-rose-400' : 'bg-amber-400'}`} />
                    <div className="pl-2">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <div className="font-bold text-lg text-ink">{a.title}</div>
                        {grade ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest bg-emerald-500/10 text-emerald-600 uppercase border border-emerald-500/20">Evaluada</span>
                        ) : hasSubmission ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest bg-blue-500/10 text-blue-600 uppercase border border-blue-500/20">Entregada ✓</span>
                        ) : isPastDue ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest bg-rose-500/10 text-rose-600 uppercase border border-rose-500/20">Atrasada</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest bg-amber-500/10 text-amber-600 uppercase border border-amber-500/20">Pendiente</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-lg">{subject?.name || 'Materia general'}</div>
                        {a.due_date && (
                          <div className={`text-xs font-semibold flex items-center gap-1.5 ${isPastDue && !grade ? 'text-rose-500' : 'text-ink4'}`}>
                            <CalendarDays size={14}/> Vence: {parseLocalDate(a.due_date).toLocaleDateString('es-ES')}
                          </div>
                        )}
                      </div>
                    </div>
                    {grade && (
                      <div className="sm:text-right bg-surface px-6 py-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                        <div className="text-3xl font-black text-emerald-500">{grade.score}</div>
                        <div className="text-[10px] text-ink4 font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 px-2 rounded-md mt-1">Nota Final</div>
                      </div>
                    )}
                    {!grade && (
                      <div className="flex-shrink-0 hidden sm:flex items-center gap-2 text-ink4 group-hover:text-violet-500 transition-colors text-xs font-semibold">
                        <FileText size={14}/> Ver detalles
                      </div>
                    )}
                  </button>
                )
              }) : (
                <div className="flex flex-col items-center justify-center py-20 bg-bg rounded-2xl border border-dashed border-surface2">
                  <BookOpen size={48} className="text-ink4/50 mb-4" />
                  <p className="text-ink3 font-medium">No hay tareas publicadas actualmente.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'asistencia' && (
          <div className="bg-surface rounded-[2rem] border border-surface2 p-6 sm:p-8 shadow-sm">
            <h2 className="font-display text-2xl font-bold flex items-center gap-3 mb-6">
              <span className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-xl"><AlertTriangle size={20}/></span> 
              Control de Asistencia
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {attendanceIssues.length > 0 ? attendanceIssues.map((a: any) => {
                const subject = subjects.find((s: any) => s.id === a.subject_id)
                const isLate = a.status === 'late'
                
                return (
                  <div key={a.id} className="p-6 rounded-2xl border border-surface2 bg-bg hover:border-surface3 transition-all flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${isLate ? 'text-amber-600 bg-amber-100 border border-amber-200' : 'text-rose-600 bg-rose-100 border border-rose-200'}`}>
                          {isLate ? '⏳ Atraso' : '❌ Falta Injustificada'}
                        </div>
                        <div className="font-bold text-ink">{subject?.name || 'Clase'}</div>
                      </div>
                      <div className="text-sm font-medium text-ink4 flex items-center gap-2">
                        <CalendarDays size={14}/> {new Date(a.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                      </div>
                      
                      {a.justification_status && (
                        <div className="mt-4 p-4 rounded-xl bg-surface border border-surface2 relative overflow-hidden">
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${a.justification_status === 'pending' ? 'bg-amber-400' : a.justification_status === 'approved' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          <div className="flex items-center gap-2 mb-2 ml-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-ink4">Estado del Trámite:</span>
                            {a.justification_status === 'pending' && <span className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded">En revisión administrativa</span>}
                            {a.justification_status === 'approved' && <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded">Falta Justificada ✅</span>}
                            {a.justification_status === 'rejected' && <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded">Rechazada ❌</span>}
                          </div>
                          <div className="text-sm text-ink3 italic ml-2 bg-bg p-3 rounded-lg border border-surface2">
                            "{a.justification_text}"
                          </div>
                          {a.justification_file_url && (
                            <a href={a.justification_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg mt-3 ml-2 transition-colors">
                              <Paperclip size={14}/> Ver Evidencia Adjunta
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {!a.justification_status && (
                      <button onClick={() => setShowJustifyModal(a)} className="btn-secondary whitespace-nowrap bg-white hover:bg-surface2 shadow-sm border-surface2 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-ink">
                        <Upload size={16}/> Enviar Justificativo
                      </button>
                    )}
                  </div>
                )
              }) : (
                <div className="flex flex-col items-center justify-center py-20 bg-bg rounded-2xl border border-dashed border-emerald-300">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="font-display font-bold text-xl text-ink">¡Asistencia Perfecta!</h3>
                  <p className="text-ink3 font-medium mt-1">No tienes faltas ni atrasos reportados.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Justification Modal */}
        {showJustifyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md animate-fade-in">
            <div className="bg-surface rounded-3xl border border-surface2 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col transform transition-all">
              <div className="relative h-24 bg-gradient-to-r from-violet-600 to-indigo-600 p-6 flex flex-col justify-end">
                <button onClick={() => { setShowJustifyModal(null); setJustifyText(''); setJustifyFile(null) }} className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/10 hover:bg-black/20 rounded-full p-1.5 transition-colors"><X size={20}/></button>
                <h3 className="font-display text-2xl font-bold text-white drop-shadow-sm">Justificar Inasistencia</h3>
              </div>
              
              <form onSubmit={handleJustifySubmit} className="p-6 md:p-8 space-y-6">
                <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200">
                  <p className="text-sm text-orange-800 dark:text-orange-200 font-medium leading-relaxed">
                    Estás a punto de enviar una justificación para el día <b>{new Date(showJustifyModal.date).toLocaleDateString('es-ES')}</b> en la materia de <b>{subjects.find((s:any)=>s.id===showJustifyModal.subject_id)?.name}</b>. Este proceso genera una alerta a inspección.
                  </p>
                </div>
                
                <div>
                  <label className="block text-[11px] font-black text-ink4 uppercase tracking-widest mb-2 ml-1">Motivo Detallado <span className="text-rose-500">*</span></label>
                  <textarea 
                    required autoFocus
                    value={justifyText} onChange={e => setJustifyText(e.target.value)}
                    className="input-base w-full h-32 resize-none rounded-2xl bg-bg border-surface2 focus:border-violet-500 focus:ring-violet-500/20 shadow-inner"
                    placeholder="Escribe el motivo médico o personal con el mayor nivel de detalle posible..."
                  />
                </div>
                
                <div>
                  <label className="block text-[11px] font-black text-ink4 uppercase tracking-widest mb-2 ml-1">Evidencia Documental (Certificado)</label>
                  <div className="flex items-center gap-3">
                    <label className="btn-secondary bg-white hover:bg-surface2 px-4 py-2.5 rounded-xl border border-surface2 cursor-pointer flex items-center gap-2 font-bold shadow-sm transition-all text-sm">
                      <Paperclip size={16} className="text-violet-500"/> {justifyFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}
                      <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={e => setJustifyFile(e.target.files?.[0] || null)} />
                    </label>
                    <div className="flex-1 min-w-0">
                      {justifyFile ? (
                        <div className="text-sm font-semibold text-emerald-600 flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg truncate border border-emerald-100">
                          <Check size={14} className="flex-shrink-0"/> {justifyFile.name}
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-ink4 italic truncate">Ningún archivo...</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowJustifyModal(null)} className="btn-secondary hover:bg-surface2 px-5 py-2.5 rounded-xl font-bold">Cancelar</button>
                  <button type="submit" disabled={isSubmitting} className="btn-primary shadow-glow shadow-violet-500/30 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all">
                    {isSubmitting ? 'Procesando trámite...' : <><Upload size={18}/> Enviar Formalmente</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MORE TABS */}
        {activeTab === 'comportamiento' && (
          <div className="bg-surface rounded-[2rem] border border-surface2 p-6 sm:p-8 shadow-sm">
             <h2 className="font-display text-2xl font-bold flex items-center gap-3 mb-6">
                <span className="p-2 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded-xl"><Trophy size={20}/></span> 
                Desempeño y Observaciones
             </h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {behaviors.length > 0 ? behaviors.map((b: any) => {
                  const isPositive = b.type === 'positive'
                  const isNegative = b.type === 'negative'
                  return (
                    <div key={b.id} className="flex gap-5 p-5 rounded-2xl border border-surface2 bg-bg hover:shadow-md transition-all">
                      <div className={`mt-1 flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl shadow-inner ${isPositive?'bg-emerald-100 text-emerald-600 border border-emerald-200':isNegative?'bg-rose-100 text-rose-600 border border-rose-200':'bg-amber-100 text-amber-600 border border-amber-200'}`}>
                        {isPositive ? <ThumbsUp size={24}/> : isNegative ? <ThumbsDown size={24}/> : <AlertTriangle size={24}/>}
                      </div>
                      <div>
                        <div className="font-bold text-lg leading-tight mb-1">{subjects.find((s:any)=>s.id===b.subject_id)?.name || 'General'}</div>
                        <div className="text-sm font-medium text-ink3">{b.description}</div>
                        <div className="text-[10px] font-black uppercase text-ink4 tracking-widest mt-3 flex items-center gap-1.5"><Clock3 size={12}/> {new Date(b.date).toLocaleDateString('es-ES')}</div>
                      </div>
                    </div>
                  )
                }) : (
                 <div className="col-span-full flex flex-col items-center justify-center py-16 bg-bg rounded-2xl border border-dashed border-surface2">
                   <Star size={40} className="text-ink4/40 mb-3" />
                   <p className="text-ink3 font-medium">Aún no hay registros de comportamiento.</p>
                 </div>
               )}
             </div>
          </div>
        )}
        
        {activeTab === 'horario' && (
          <div className="bg-surface rounded-[2rem] border border-surface2 p-6 sm:p-8 shadow-sm">
            {/* Header and Day Picker */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h2 className="font-display text-2xl font-bold flex items-center gap-3">
                <span className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl"><CalendarDays size={20}/></span> 
                Horario Institucional
              </h2>
              
              {/* Day Tabs */}
              <div className="flex bg-surface2/50 backdrop-blur-md p-1.5 rounded-2xl w-full sm:w-auto overflow-x-auto custom-scrollbar">
                {DIAS_SEMANA.map(dia => (
                  <button 
                    key={dia}
                    onClick={() => setSelectedDay(dia)}
                    className={`flex-1 py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl text-[13px] sm:text-sm font-bold transition-all whitespace-nowrap ${selectedDay === dia ? 'bg-white dark:bg-surface text-indigo-600 shadow-sm ring-1 ring-indigo-500/10' : 'text-ink4 hover:text-ink hover:bg-black/5'}`}
                  >
                    {dia}
                  </button>
                ))}
              </div>
            </div>
            
            {myScheduleGrid && myPeriods.length > 0 ? (
              <div className="relative">
                {/* Connecting Line (Desktop) */}
                <div className="absolute top-4 bottom-4 left-[3rem] sm:left-[4.5rem] w-0.5 bg-surface2 rounded-full hidden sm:block" />
                
                <div className="flex flex-col gap-4 relative z-10">
                  {myPeriods.map((periodo: string, pIdx: number) => {
                    const isReceso = myBreaks.has(pIdx)
                    const materia = myScheduleGrid[selectedDay]?.[pIdx] || ''
                    const isVacant = !materia || materia.trim() === ''
                    
                    if (isReceso) {
                      return (
                        <div key={pIdx} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 group">
                          {/* Time Badge */}
                          <div className="w-full sm:w-[9rem] flex-shrink-0 flex sm:justify-end">
                            <span className="text-[11px] sm:text-xs font-bold text-ink4 bg-surface2/50 px-3 py-1.5 rounded-lg border border-surface2 shadow-sm">{periodo}</span>
                          </div>
                          
                          {/* Recess Card */}
                          <div className="flex-1 w-full p-4 rounded-2xl bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.02)_10px,rgba(0,0,0,0.02)_20px)] bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 overflow-hidden shadow-sm flex items-center justify-center sm:justify-start gap-3">
                            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                              ☕
                            </div>
                            <span className="font-black text-amber-600 tracking-[0.2em] text-sm md:text-base uppercase">Receso</span>
                          </div>
                        </div>
                      )
                    }
                    
                    if (isVacant) {
                      return (
                         <div key={pIdx} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 opacity-60">
                           <div className="w-full sm:w-[9rem] flex-shrink-0 flex sm:justify-end">
                             <span className="text-[11px] sm:text-xs font-semibold text-ink4/70 px-3 py-1.5">{periodo}</span>
                           </div>
                           <div className="flex-1 w-full p-4 rounded-2xl border border-dashed border-surface2 bg-bg flex items-center gap-3">
                             <div className="w-2 h-2 rounded-full bg-surface2 flex-shrink-0"/>
                             <span className="text-sm font-medium text-ink4 italic">Hora libre</span>
                           </div>
                         </div>
                      )
                    }

                    // Dynamically generate beautiful pastel backgrounds with high-contrast text
                    let charCodeSum = 0
                    for (let i = 0; i < materia.length; i++) charCodeSum += materia.charCodeAt(i)
                    const colorThemes = [
                      { bg: 'bg-blue-50/60 dark:bg-blue-900/10', border: 'border-blue-100 dark:border-blue-800/30', iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
                      { bg: 'bg-emerald-50/60 dark:bg-emerald-900/10', border: 'border-emerald-100 dark:border-emerald-800/30', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
                      { bg: 'bg-violet-50/60 dark:bg-violet-900/10', border: 'border-violet-100 dark:border-violet-800/30', iconBg: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' },
                      { bg: 'bg-rose-50/60 dark:bg-rose-900/10', border: 'border-rose-100 dark:border-rose-800/30', iconBg: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' },
                      { bg: 'bg-amber-50/60 dark:bg-amber-900/10', border: 'border-amber-100 dark:border-amber-800/30', iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
                      { bg: 'bg-cyan-50/60 dark:bg-cyan-900/10', border: 'border-cyan-100 dark:border-cyan-800/30', iconBg: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400' },
                    ]
                    const t = colorThemes[charCodeSum % colorThemes.length]

                    return (
                      <div key={pIdx} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 group">
                        <div className="w-full sm:w-[9rem] flex-shrink-0 flex sm:justify-end">
                          <span className={`text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm border transition-all text-ink ${t.bg} ${t.border}`}>{periodo}</span>
                        </div>
                        <div className={`flex-1 w-full p-4 sm:p-5 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 ${t.bg} ${t.border} flex items-center justify-between`}>
                           <div className="flex items-center gap-4">
                             <div className={`hidden sm:flex w-12 h-12 rounded-xl items-center justify-center font-black text-xl shadow-inner ${t.iconBg}`}>
                               {materia.substring(0,2).toUpperCase()}
                             </div>
                             <div>
                               {/* text-ink forces high contrast reading for the class name regardless of background */}
                               <div className="font-bold text-base sm:text-lg md:text-xl text-ink leading-tight mb-1 drop-shadow-sm">{materia}</div>
                               <div className="text-[10px] sm:text-xs font-bold text-ink4 uppercase tracking-wider flex items-center gap-1.5">
                                 <Clock3 size={12}/> {myPeriods[pIdx]}
                               </div>
                             </div>
                           </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 bg-bg rounded-2xl border border-dashed border-surface2 mx-4 sm:mx-0">
                <CalendarDays size={48} className="text-ink4/50 mb-4" />
                <h3 className="font-bold text-ink">Horario no disponible</h3>
                <p className="text-ink3 font-medium max-w-sm mt-1 text-center">La institución aún no ha publicado un horario para tu curso o jornada.</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'calificaciones' && (
          <div className="bg-surface rounded-[2rem] border border-surface2 p-6 sm:p-8 shadow-sm">
            <h2 className="font-display text-2xl font-bold flex items-center gap-3 mb-6">
              <span className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl"><Award size={20}/></span> 
              Libreta de Calificaciones
            </h2>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               {subjects.map((sub:any) => {
                 const myAsgs = assignments.filter((a:any)=>a.subject_id === sub.id)
                 const myGrades = grades.filter((g:any)=>myAsgs.some((a:any)=>a.id===g.assignment_id))
                 const avg = myGrades.length > 0 ? (myGrades.reduce((acc:any, g:any)=>acc+g.score,0)/myGrades.length).toFixed(2) : null
                 
                 return (
                   <div key={sub.id} className="relative overflow-hidden flex flex-col justify-between p-6 rounded-2xl border border-surface2 bg-bg hover:border-blue-400/40 hover:-translate-y-1 transition-all group shadow-sm">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
                     <div className="relative z-10 mb-6">
                       <div className="font-bold text-lg text-ink leading-tight">{sub.name}</div>
                       <div className="text-xs font-semibold text-ink4 mt-1 bg-surface2 inline-block px-2 py-0.5 rounded-md">{sub.teacher?.full_name || 'Sin docente'}</div>
                     </div>
                     <div className="relative z-10 flex items-end justify-between border-t border-surface2 pt-4">
                       <div className="text-[10px] font-black uppercase text-ink4 tracking-widest">Promedio Actual</div>
                       {avg ? (
                          <div className={`text-3xl font-black ${Number(avg) >= 7 ? 'text-emerald-500 drop-shadow-sm' : 'text-rose-500 drop-shadow-sm'}`}>{avg}</div>
                       ) : <span className="text-sm font-medium text-ink4 italic border border-dashed border-surface2 px-2 py-1 rounded-lg">No calculado</span>}
                     </div>
                   </div>
                 )
               })}
             </div>
          </div>
        )}

      </div>

      {/* ── Assignment Detail & Submit Modal ── */}
      {selectedAssignment && (() => {
        const sub = mySubmissions[selectedAssignment.id]
        const subject = subjects.find((s: any) => s.id === selectedAssignment.subject_id)
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md animate-fade-in">
            <div className="bg-surface rounded-3xl border border-surface2 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="relative bg-gradient-to-r from-indigo-600 to-violet-600 p-6">
                <button onClick={() => setSelectedAssignment(null)} className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/10 hover:bg-black/20 rounded-full p-1.5 transition-colors">
                  <X size={20}/>
                </button>
                <div className="flex items-start gap-3 pr-10">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <BookOpen size={20} className="text-white"/>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">{subject?.name || 'Tarea'}</p>
                    <h3 className="font-display text-xl font-bold text-white leading-tight">{selectedAssignment.title}</h3>
                    {selectedAssignment.due_date && (
                      <p className="text-xs text-white/70 mt-1 flex items-center gap-1.5">
                        <CalendarDays size={12}/> Fecha de entrega: {parseLocalDate(selectedAssignment.due_date).toLocaleDateString('es-ES')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 p-6 space-y-5">
                {/* Description */}
                {selectedAssignment.description && (
                  <div className="p-4 bg-bg rounded-2xl border border-surface2">
                    <p className="text-[11px] font-black text-ink4 uppercase tracking-widest mb-2">Descripción</p>
                    <p className="text-sm text-ink3 leading-relaxed">{selectedAssignment.description}</p>
                  </div>
                )}

                {/* Teacher attached files */}
                {Array.isArray(selectedAssignment.attachment_urls) && selectedAssignment.attachment_urls.length > 0 && (
                  <div className="p-4 bg-violet-50/60 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-800/30 rounded-2xl">
                    <p className="text-[11px] font-black text-violet-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Paperclip size={13}/> Material del Docente ({selectedAssignment.attachment_urls.length})
                    </p>
                    <div className="space-y-2">
                      {selectedAssignment.attachment_urls.map((url: string, i: number) => {
                        const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] || `Archivo ${i+1}`)
                        // Detect file type
                        const ext = name.split('.').pop()?.toLowerCase() || ''
                        const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext)
                        return (
                          <a key={i} href={url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-3 p-2.5 bg-white dark:bg-surface border border-violet-100 dark:border-violet-800/30 rounded-xl hover:border-violet-300 transition-colors group">
                            <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black text-violet-600 uppercase">
                              {isImage ? '🖼️' : ext || '📄'}
                            </div>
                            <span className="text-sm text-ink flex-1 truncate group-hover:text-violet-600 transition-colors">{name}</span>
                            <ExternalLink size={13} className="text-ink4 group-hover:text-violet-500 flex-shrink-0 transition-colors"/>
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Already submitted */}
                {sub ? (
                  <div className="p-4 bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-2xl">
                    <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <CheckCircle2 size={14}/> Tarea Entregada
                    </p>
                    <p className="text-xs text-ink4 mb-2">
                      Enviada el {new Date(sub.submitted_at).toLocaleString('es-ES')}
                    </p>
                    {sub.comment && (
                      <div className="bg-white dark:bg-surface p-3 rounded-xl border border-surface2 text-sm text-ink3 italic mb-3">
                        "{sub.comment}"
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {sub.file_url && (
                        <a href={sub.file_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors">
                          <ExternalLink size={14}/> Ver archivo adjunto
                        </a>
                      )}
                      <button 
                        type="button"
                        onClick={() => handleDeleteSubmission(sub.id, selectedAssignment.id)}
                        className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors border border-rose-100 dark:bg-rose-900/10 dark:border-rose-800/30 dark:text-rose-400"
                        title="Eliminar entrega"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                    <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-800/30">
                      <p className="text-xs text-ink4 mb-2">¿Deseas reemplazar tu entrega anterior?</p>
                    </div>
                  </div>
                ) : null}

                {/* Submit form */}
                <form onSubmit={handleSubmitTask} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-black text-ink4 uppercase tracking-widest mb-2 ml-1">
                      {sub ? 'Nueva entrega (reemplaza la anterior)' : 'Tu entrega'}
                    </label>
                    <textarea
                      value={submitComment} onChange={e => setSubmitComment(e.target.value)}
                      className="input-base w-full h-28 resize-none rounded-2xl bg-bg border-surface2 focus:border-violet-500 focus:ring-violet-500/20 shadow-inner text-sm"
                      placeholder="Escribe un comentario, respuesta o descripción de tu trabajo (opcional)..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-ink4 uppercase tracking-widest mb-2 ml-1">
                      Archivo Adjunto (Foto, PDF, Documento)
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="btn-secondary bg-white hover:bg-surface2 px-4 py-2.5 rounded-xl border border-surface2 cursor-pointer flex items-center gap-2 font-bold shadow-sm transition-all text-sm flex-shrink-0">
                        <Paperclip size={16} className="text-violet-500"/> {submitFile ? 'Cambiar' : 'Seleccionar archivo'}
                        <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.ppt,.pptx,.xlsx,.zip" onChange={e => setSubmitFile(e.target.files?.[0] || null)} />
                      </label>
                      {submitFile ? (
                        <div className="flex-1 min-w-0 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 truncate flex items-center gap-2">
                          <Check size={12} className="flex-shrink-0"/> {submitFile.name}
                        </div>
                      ) : (
                        <span className="text-sm text-ink4 italic">Sin archivo...</span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setSelectedAssignment(null)} className="btn-secondary hover:bg-surface2 px-5 py-2.5 rounded-xl font-bold">Cerrar</button>
                    <button type="submit" disabled={isSubmittingTask || (!submitComment.trim() && !submitFile)}
                      className="btn-primary shadow-glow shadow-violet-500/30 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50">
                      {isSubmittingTask ? 'Enviando...' : <><Send size={16}/> {sub ? 'Reenviar Tarea' : 'Entregar Tarea'}</>}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}

'use client'

import { useState } from 'react'
import {
  BookOpen, CalendarDays, BarChart2,
  CheckCircle2, Clock3, ThumbsUp, ThumbsDown,
  Upload, X, Check, Paperclip, AlertTriangle,
  Award, Trophy, Star, Send, ExternalLink, FileText,
  Trash2, ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'
import { FilePreview } from '@/components/ui/FilePreview'
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
  profile, studentProfile, courses, subjects, assignments, grades, categories, attendance, behaviors, scheduleConfig, horariosData
}: any) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<TabType>('resumen')
  const isParentView = profile?.role === 'parent'
  const viewedStudent = studentProfile || profile
  const effectiveStudentId = viewedStudent?.id || profile?.id

  // ── Dynamic theme: emerald/teal for parents, violet/indigo for students
  const theme = isParentView
    ? {
        bannerFrom: 'from-emerald-700',
        bannerVia: 'via-teal-700',
        bannerTo: 'to-emerald-800',
        tabActive: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25 scale-[1.02]',
        tabShadow: 'shadow-emerald-500/20',
        accentText: 'text-emerald-600',
        accentBg: 'bg-emerald-100 dark:bg-emerald-900/30',
        accentBorder: 'border-emerald-200',
        pill: 'bg-white/10 backdrop-blur-md border border-white/20 text-white/90',
        statNum: 'text-emerald-400',
        iconColor: 'text-emerald-300',
      }
    : {
        bannerFrom: 'from-violet-600',
        bannerVia: 'via-indigo-600',
        bannerTo: 'to-purple-700',
        tabActive: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 scale-[1.02]',
        tabShadow: 'shadow-indigo-500/20',
        accentText: 'text-violet-600',
        accentBg: 'bg-violet-100 dark:bg-violet-900/30',
        accentBorder: 'border-violet-200',
        pill: 'bg-white/10 backdrop-blur-md border border-white/20 text-white/90',
        statNum: 'text-emerald-400',
        iconColor: 'text-yellow-300',
      }

  const currentDayIndex = new Date().getDay()
  const defaultDay = currentDayIndex >= 1 && currentDayIndex <= 5 ? DIAS_SEMANA[currentDayIndex - 1] : 'Lunes'
  const [selectedDay, setSelectedDay] = useState<string>(defaultDay)

  // Justification Inline State
  const [expandedJustifyId, setExpandedJustifyId] = useState<string | null>(null)
  const [justifyText, setJustifyText] = useState('')
  const [justifyFile, setJustifyFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localAttendance, setLocalAttendance] = useState<any[]>(attendance || [])
  // Keep modal state for backward compat (used in handleJustifySubmit)
  const [showJustifyModal, setShowJustifyModal] = useState<any>(null)

  // Assignment Submission Modal State
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null)
  const [mySubmissions, setMySubmissions] = useState<Record<string, any>>({})
  const [submitComment, setSubmitComment] = useState('')
  const [submitFile, setSubmitFile] = useState<File | null>(null)
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
  const [loadedSubmissions, setLoadedSubmissions] = useState(false)
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null)

  // Load submissions once when Tareas tab is opened
  async function loadMySubmissions() {
    if (loadedSubmissions) return
    try {
      const suffix = isParentView ? `?student_id=${effectiveStudentId}` : ''
      const res = await fetch(`/api/alumno/submissions${suffix}`)
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
        const fileName = `${effectiveStudentId}-${selectedAssignment.id}-${Date.now()}.${ext}`
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
        body: JSON.stringify({ assignment_id: selectedAssignment.id, student_id: effectiveStudentId, comment: submitComment, file_url })
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
      const suffix = isParentView ? `&student_id=${effectiveStudentId}` : ''
      const res = await fetch(`/api/alumno/submissions?id=${submissionId}${suffix}`, {
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
        const fileName = `justifications/${effectiveStudentId}-${showJustifyModal?.id || Date.now()}-${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('submissions')
          .upload(fileName, justifyFile)

        if (uploadError) throw new Error('Error al subir el archivo: ' + uploadError.message)

        const { data: { publicUrl } } = supabase.storage
          .from('submissions')
          .getPublicUrl(fileName)
        file_url = publicUrl
      }

      const res = await fetch('/api/alumno/attendance/justify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendance_id: showJustifyModal.id,
          student_id: effectiveStudentId,
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
      {isParentView ? (
        /* ── PARENT BANNER: professional, structured, supervisory feel ── */
        <div className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${theme.bannerFrom} ${theme.bannerVia} ${theme.bannerTo} shadow-xl shadow-emerald-900/30 p-8 sm:p-10 mb-8`}>
          {/* Geometric decor - clean lines, no abstract blobs */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 border border-white/10 rounded-full" />
          <div className="absolute -bottom-6 -left-6 w-48 h-48 border border-white/10 rounded-full" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              {/* Label badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-white/80 text-[11px] font-bold uppercase tracking-widest mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                Panel de Representante
              </div>
              <h1 className="font-display text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-sm mb-1">
                {profile.full_name?.split(' ')[0] || 'Representante'}
              </h1>
              <p className="text-white/75 text-sm sm:text-base font-medium">
                Seguimiento académico de <span className="text-white font-bold">{viewedStudent.full_name || 'tu estudiante'}</span>
              </p>
            </div>

            {/* Stats panel */}
            <div className="flex items-stretch gap-3 w-full sm:w-auto">
              {[
                { value: subjects.length, label: 'Materias', color: 'text-white' },
                { value: missingAssignments.length, label: 'Pendientes', color: 'text-amber-300' },
                { value: attendanceIssues.length, label: 'Faltas/Atrasos', color: attendanceIssues.length > 0 ? 'text-rose-300' : 'text-white' },
              ].map((s, i) => (
                <div key={i} className="flex-1 sm:flex-none flex flex-col items-center justify-center bg-black/20 backdrop-blur-md rounded-2xl p-4 sm:px-6 border border-white/10 text-center">
                  <div className={`text-2xl sm:text-3xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-[9px] font-bold text-white/50 uppercase tracking-widest mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── STUDENT BANNER: vibrant, energetic, motivational ── */
        <div className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${theme.bannerFrom} ${theme.bannerVia} ${theme.bannerTo} shadow-xl shadow-indigo-500/20 p-8 sm:p-12 mb-8`}>
          <div className="absolute top-0 right-0 -m-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -m-20 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-cyan-400/20 rounded-full blur-2xl" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
            <div className="text-center sm:text-left">
              <h1 className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-sm mb-2">
                Hola, {profile.full_name?.split(' ')[0] || 'Estudiante'} 👋
              </h1>
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${theme.pill} text-sm font-medium`}>
                <Award size={16} className={theme.iconColor} />
                {courses.map((c: any) => `${c.name} ${c.parallel || ''}`.trim()).join(' / ')}
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-4 bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-inner">
              <div className="text-center px-4 border-r border-white/10">
                <div className="text-3xl font-black text-white">{subjects.length}</div>
                <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">Materias</div>
              </div>
              <div className="text-center px-4">
                <div className={`text-3xl font-black ${theme.statNum}`}>{merits.length}</div>
                <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">Méritos</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODERN TABS ── */}
      <div className="sticky top-4 z-40 p-1.5 bg-surface/80 backdrop-blur-xl border border-surface2 rounded-2xl shadow-sm overflow-x-auto custom-scrollbar flex gap-1">
        {[
          { id: 'resumen', icon: <BarChart2 size={18}/>, label: isParentView ? 'Resumen General' : 'Resumen' },
          { id: 'tareas', icon: <BookOpen size={18}/>, label: isParentView ? 'Tareas' : 'Tareas' },
          { id: 'horario', icon: <CalendarDays size={18}/>, label: isParentView ? 'Horario Escolar' : 'Horario' },
          { id: 'calificaciones', icon: <CheckCircle2 size={18}/>, label: isParentView ? 'Calificaciones' : 'Promedios' },
          { id: 'asistencia', icon: <Clock3 size={18}/>, label: 'Asistencia' },
          { id: 'comportamiento', icon: <Star size={18}/>, label: isParentView ? 'Conducta' : 'Docencia' },
        ].map(t => {
          const isActive = activeTab === t.id
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)}
              className={`flex-1 flex justify-center items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                isActive 
                  ? theme.tabActive
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
              <span className={`p-2 ${theme.accentBg} ${theme.accentText} rounded-xl`}>
                {isParentView ? '👪' : '📊'}
              </span>
              {isParentView ? 'Seguimiento del Estudiante' : 'Visión General'}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Materias Inscritas', value: subjects.length, color: 'from-blue-600 to-cyan-500', numColor: 'text-blue-600', icon: '📚', shadow: 'shadow-blue-500/20' },
                { label: 'Tareas Pendientes', value: missingAssignments.length, color: 'from-amber-500 to-orange-600', numColor: 'text-amber-600', icon: '📝', shadow: 'shadow-orange-500/20' },
                { label: 'Faltas y Atrasos', value: attendanceIssues.length, color: 'from-rose-600 to-red-600', numColor: 'text-rose-600', icon: '⚠️', shadow: 'shadow-rose-500/20' },
                { label: 'Felicitaciones', value: merits.length, color: 'from-emerald-500 to-teal-600', numColor: 'text-emerald-600', icon: '🏆', shadow: 'shadow-emerald-500/20' },
              ].map((stat, i) => (
                <div key={i} className={`relative overflow-hidden bg-surface rounded-[1.5rem] border border-surface2 p-6 shadow-xl ${stat.shadow} hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 group`}>
                  <div className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500`} />
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <div className="text-[11px] font-black text-ink2 uppercase tracking-widest mb-1">{stat.label}</div>
                      <div className={`text-4xl font-black ${stat.numColor}`}>{stat.value}</div>
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

        {activeTab === 'tareas' && (() => {
          const assignmentsBySubject: Record<string, any[]> = {}
          assignments.forEach((a: any) => {
            if (!assignmentsBySubject[a.subject_id]) assignmentsBySubject[a.subject_id] = []
            assignmentsBySubject[a.subject_id].push(a)
          })

          const getSubjectColor = (name: string) => {
            let hash = 0
            for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
            const h = Math.abs(hash) % 360
            return {
              bg: `hsla(${h}, 70%, 95%, 1)`,
              border: `hsla(${h}, 70%, 90%, 1)`,
              text: `hsla(${h}, 80%, 30%, 1)`,
              accent: `hsla(${h}, 80%, 45%, 1)`,
              light: `hsla(${h}, 70%, 97%, 1)`,
              badge: `hsla(${h}, 70%, 92%, 1)`
            }
          }

          return (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="font-display text-2xl font-bold flex items-center gap-3">
                  <span className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl"><BookOpen size={20}/></span> 
                  {isParentView ? `Tareas de ${viewedStudent.full_name?.split(' ')[0] || 'tu hijo/a'}` : 'Historial de Tareas'}
                </h2>
                <div className="flex items-center gap-3 bg-surface p-1.5 rounded-xl border border-surface2">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-lg border border-amber-100">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[10px] font-black uppercase text-amber-700">Pendientes: {missingAssignments.length}</span>
                  </div>
                </div>
              </div>

              {subjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {subjects.map((sub: any) => {
                    const subAssignments = assignmentsBySubject[sub.id] || []
                    if (subAssignments.length === 0) return null
                    const isExpanded = expandedSubjectId === sub.id
                    const color = getSubjectColor(sub.name)
                    const pendingCount = subAssignments.filter((a: any) => !mySubmissions[a.id] && !grades.find((g: any) => g.assignment_id === a.id)).length

                    return (
                      <div 
                        key={sub.id} 
                        className={`group rounded-[2rem] border transition-all duration-500 overflow-hidden flex flex-col ${
                          isExpanded ? 'col-span-full shadow-2xl ring-1 ring-black/5 bg-surface' : 'bg-surface hover:shadow-xl hover:-translate-y-1'
                        }`}
                        style={{ borderColor: isExpanded ? color.accent : color.border }}
                      >
                        <div 
                          onClick={() => setExpandedSubjectId(isExpanded ? null : sub.id)}
                          className={`p-6 cursor-pointer relative overflow-hidden flex justify-between items-center transition-colors ${isExpanded ? 'border-b' : ''}`}
                          style={{ backgroundColor: isExpanded ? color.light : 'transparent', borderColor: isExpanded ? color.border : 'transparent' }}
                        >
                          <div className="absolute right-0 top-0 w-32 h-32 opacity-10 blur-3xl pointer-events-none" style={{ backgroundColor: color.accent }} />
                          <div className="flex items-center gap-4 relative z-10">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner" style={{ backgroundColor: color.bg, color: color.accent }}>
                              {sub.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-lg text-ink leading-tight">{sub.name}</h3>
                              <p className="text-xs font-semibold text-ink4 mt-0.5">{sub.teacher?.full_name || 'Sin docente'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 relative z-10">
                            {pendingCount > 0 && !isExpanded && (
                              <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-sm animate-pulse">
                                {pendingCount} PENDIENTE{pendingCount > 1 ? 'S' : ''}
                              </span>
                            )}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-white shadow-sm' : 'bg-surface2'}`} style={{ color: color.accent }}>
                              <ChevronDown size={18} />
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-6 sm:p-8 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            {subAssignments.map((a: any) => {
                              const grade = grades.find((g: any) => g.assignment_id === a.id)
                              const hasSubmission = !!mySubmissions[a.id]
                              let isPastDue = false
                              if (a.due_date) {
                                const due = parseLocalDate(a.due_date)
                                due.setHours(23, 59, 59, 999)
                                isPastDue = due.getTime() < new Date().getTime()
                              }
                              return (
                                <button key={a.id} onClick={() => handleOpenAssignment(a)}
                                  className="w-full text-left relative overflow-hidden flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-5 rounded-2xl border border-surface2 bg-bg hover:border-violet-400/50 transition-all duration-300 group hover:shadow-md"
                                >
                                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${grade ? 'bg-emerald-400' : hasSubmission ? 'bg-blue-400' : isPastDue ? 'bg-rose-400' : 'bg-amber-400'}`} />
                                  <div className="pl-3">
                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                      <div className="font-bold text-base text-ink">{a.title}</div>
                                      {grade ? ( <span className="px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest bg-emerald-500/10 text-emerald-600 uppercase border border-emerald-500/20">Evaluada</span>
                                      ) : hasSubmission ? ( <span className="px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest bg-blue-500/10 text-blue-600 uppercase border border-blue-500/20">Entregada ✓</span>
                                      ) : isPastDue ? ( <span className="px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest bg-rose-500/10 text-rose-600 uppercase border border-rose-500/20">Atrasada</span>
                                      ) : ( <span className="px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest bg-amber-500/10 text-amber-600 uppercase border border-amber-500/20">Pendiente</span> )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                      {a.due_date && (
                                        <div className={`text-xs font-semibold flex items-center gap-1.5 ${isPastDue && !grade ? 'text-rose-500' : 'text-ink4'}`}>
                                          <CalendarDays size={14}/> Vence: {parseLocalDate(a.due_date).toLocaleDateString('es-ES')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    {grade && (
                                      <div className="bg-surface px-5 py-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-center min-w-[80px]">
                                        <div className="text-2xl font-black text-emerald-500 leading-none">{grade.score}</div>
                                        <div className="text-[9px] text-emerald-700 font-bold uppercase tracking-widest mt-1">Nota Final</div>
                                      </div>
                                    )}
                                    {!grade && ( <div className="hidden sm:flex items-center gap-2 text-ink4 group-hover:text-violet-500 transition-colors text-xs font-bold"> <FileText size={14}/> Ver detalles </div> )}
                                  </div>
                                </button>
                              )
                            })}
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpandedSubjectId(null) }}
                              className="w-full py-3 rounded-xl border border-dashed border-surface2 text-xs font-bold text-ink4 hover:bg-surface2 hover:text-ink transition-all"
                            >
                              Contraer materia
                            </button>
                          </div>
                        )}
                        
                        {!isExpanded && (
                          <div className="px-6 pb-6 mt-auto">
                            <div className="flex items-center justify-between pt-4 border-t border-surface2">
                              <span className="text-[10px] font-bold text-ink4 uppercase tracking-widest flex items-center gap-1.5">
                                <FileText size={12}/> {subAssignments.length} Tareas total
                              </span>
                              <div className="flex -space-x-1.5">
                                {[...Array(Math.min(3, subAssignments.length))].map((_, i) => (
                                  <div key={i} className="w-5 h-2 rounded-full ring-2 ring-white" style={{ backgroundColor: color.accent, opacity: 1 - (i*0.3) }} />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-[2rem] border border-dashed border-surface2">
                  <BookOpen size={48} className="text-ink4/50 mb-4" />
                  <p className="text-ink3 font-medium">No hay tareas publicadas actualmente.</p>
                </div>
              )}
            </div>
          )
        })()}

        {activeTab === 'asistencia' && (() => {
          // ── Build attendance data by subject ──
          const allDates = Array.from(new Set(localAttendance.map((a: any) => a.date) as string[])).sort()
          const totalPresent = localAttendance.filter((a: any) => a.status === 'present').length
          const totalLate = localAttendance.filter((a: any) => a.status === 'late').length
          const totalAbsent = localAttendance.filter((a: any) => a.status === 'absent').length
          const totalRecords = localAttendance.length
          const attendancePct = totalRecords > 0 ? ((totalPresent + totalLate) / totalRecords * 100) : 100

          // Group by subject
          const bySubject: Record<string, { subject: any; records: any[]; present: number; late: number; absent: number }> = {}
          subjects.forEach((s: any) => {
            const recs = localAttendance.filter((a: any) => a.subject_id === s.id)
            bySubject[s.id] = {
              subject: s,
              records: recs,
              present: recs.filter((r: any) => r.status === 'present').length,
              late: recs.filter((r: any) => r.status === 'late').length,
              absent: recs.filter((r: any) => r.status === 'absent').length,
            }
          })

          // Issues for the detail list below
          const issues = localAttendance.filter((a: any) => a.status === 'absent' || a.status === 'late')

          return (
          <div className="space-y-6">
            {/* ── Stats Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="relative overflow-hidden bg-surface rounded-2xl border border-surface2 p-5 shadow-sm">
                <div className="absolute -right-3 -top-3 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl" />
                <div className="text-[10px] font-black text-ink4 uppercase tracking-widest mb-1">Presentes</div>
                <div className="text-3xl font-black text-emerald-500">{totalPresent}</div>
              </div>
              <div className="relative overflow-hidden bg-surface rounded-2xl border border-surface2 p-5 shadow-sm">
                <div className="absolute -right-3 -top-3 w-16 h-16 bg-amber-500/10 rounded-full blur-xl" />
                <div className="text-[10px] font-black text-ink4 uppercase tracking-widest mb-1">Atrasos</div>
                <div className="text-3xl font-black text-amber-500">{totalLate}</div>
              </div>
              <div className="relative overflow-hidden bg-surface rounded-2xl border border-surface2 p-5 shadow-sm">
                <div className="absolute -right-3 -top-3 w-16 h-16 bg-rose-500/10 rounded-full blur-xl" />
                <div className="text-[10px] font-black text-ink4 uppercase tracking-widest mb-1">Faltas</div>
                <div className="text-3xl font-black text-rose-500">{totalAbsent}</div>
              </div>
              <div className="relative overflow-hidden bg-surface rounded-2xl border border-surface2 p-5 shadow-sm">
                <div className="absolute -right-3 -top-3 w-16 h-16 bg-blue-500/10 rounded-full blur-xl" />
                <div className="text-[10px] font-black text-ink4 uppercase tracking-widest mb-1">Asistencia</div>
                <div className={`text-3xl font-black ${attendancePct >= 80 ? 'text-emerald-500' : attendancePct >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                  {attendancePct.toFixed(0)}%
                </div>
              </div>
            </div>

            {/* ── Progress Bar ── */}
            {totalRecords > 0 && (
              <div className="bg-surface rounded-2xl border border-surface2 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-ink3">Porcentaje de asistencia global</span>
                  <span className={`text-sm font-black ${attendancePct >= 80 ? 'text-emerald-500' : attendancePct >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                    {attendancePct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-surface2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500 flex">
                    {totalPresent > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${totalPresent / totalRecords * 100}%` }} />}
                    {totalLate > 0 && <div className="bg-amber-400 h-full" style={{ width: `${totalLate / totalRecords * 100}%` }} />}
                    {totalAbsent > 0 && <div className="bg-rose-500 h-full" style={{ width: `${totalAbsent / totalRecords * 100}%` }} />}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-ink4"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Presente</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-ink4"><span className="w-2 h-2 rounded-full bg-amber-400" /> Atraso</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-ink4"><span className="w-2 h-2 rounded-full bg-rose-500" /> Falta</span>
                </div>
              </div>
            )}

            {/* ── Table by Subject ── */}
            <div className="bg-surface rounded-[2rem] border border-surface2 p-6 sm:p-8 shadow-sm">
              <h2 className="font-display text-2xl font-bold flex items-center gap-3 mb-6">
                <span className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl"><CalendarDays size={20}/></span>
                Registro de Asistencia por Materia
              </h2>

              {Object.values(bySubject).some((s: any) => s.records.length > 0) ? (
                <div className="space-y-4">
                  {Object.values(bySubject).map((data: any) => {
                    const total = data.records.length
                    if (total === 0) return null
                    const pct = total > 0 ? ((data.present + data.late) / total * 100) : 100
                    // Get unique dates for this subject, sorted desc, last 15
                    const subDates = Array.from(new Set(data.records.map((r: any) => r.date) as string[])).sort().reverse().slice(0, 15).reverse()

                    return (
                      <div key={data.subject.id} className="border border-surface2 rounded-2xl overflow-hidden bg-bg">
                        {/* Subject header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface border-b border-surface2">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center text-xs font-black">
                              {data.subject.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-ink">{data.subject.name}</p>
                              <p className="text-[10px] text-ink4">{data.subject.teacher?.full_name || ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">✓ {data.present}</span>
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">⏱ {data.late}</span>
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100">✗ {data.absent}</span>
                            <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${pct >= 80 ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' : pct >= 60 ? 'text-amber-600 bg-amber-50 border border-amber-100' : 'text-rose-600 bg-rose-50 border border-rose-100'}`}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        {/* Date cells */}
                        <div className="p-4 overflow-x-auto custom-scrollbar">
                          <div className="flex gap-2 min-w-max">
                            {subDates.map(date => {
                              const record = data.records.find((r: any) => r.date === date)
                              const status = record?.status || 'unknown'
                              const d = new Date(date + 'T12:00:00')
                              const dayName = d.toLocaleDateString('es-EC', { weekday: 'short' })
                              const dayNum = d.getDate()
                              const month = d.toLocaleDateString('es-EC', { month: 'short' })

                              return (
                                <div key={date} className="flex flex-col items-center gap-1.5 min-w-[52px]">
                                  <span className="text-[9px] font-bold text-ink4 uppercase">{dayName}</span>
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-all ${
                                    status === 'present'
                                      ? 'bg-emerald-100 text-emerald-600 border border-emerald-200 shadow-sm'
                                      : status === 'late'
                                      ? 'bg-amber-100 text-amber-600 border border-amber-200 shadow-sm'
                                      : status === 'absent'
                                      ? 'bg-rose-100 text-rose-600 border border-rose-200 shadow-sm'
                                      : 'bg-surface2 text-ink4 border border-surface2'
                                  }`}>
                                    {status === 'present' ? '✓' : status === 'late' ? '⏱' : status === 'absent' ? '✗' : '·'}
                                  </div>
                                  <span className="text-[9px] font-semibold text-ink4">{dayNum} {month}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 bg-bg rounded-2xl border border-dashed border-surface2">
                  <CalendarDays size={48} className="text-ink4/50 mb-4" />
                  <h3 className="font-bold text-ink">Sin registros de asistencia</h3>
                  <p className="text-ink3 font-medium mt-1">Los docentes aún no han registrado asistencia.</p>
                </div>
              )}
            </div>

            {/* ── Faltas & Atrasos Detail (with inline justify) ── */}
            {issues.length > 0 && (
              <div className="bg-surface rounded-[2rem] border border-surface2 p-6 sm:p-8 shadow-sm">
                <h2 className="font-display text-xl font-bold flex items-center gap-3 mb-2">
                  <span className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-xl"><AlertTriangle size={18}/></span>
                  Faltas y Atrasos
                </h2>
                <p className="text-xs text-ink4 mb-5 ml-1">Selecciona una falta para enviar tu justificación con documentos de respaldo.</p>

                <div className="grid grid-cols-1 gap-4">
                  {issues.map((a: any) => {
                    const subject = subjects.find((s: any) => s.id === a.subject_id)
                    const isLate = a.status === 'late'
                    const isExpanded = expandedJustifyId === a.id
                    const hasJustification = !!a.justification_status

                    return (
                      <div key={a.id} className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
                        isExpanded
                          ? hasJustification
                            ? 'border-amber-200 dark:border-amber-700 shadow-lg shadow-amber-500/10 bg-surface'
                            : 'border-violet-300 dark:border-violet-700 shadow-lg shadow-violet-500/10 bg-surface'
                          : 'border-surface2 bg-bg hover:border-violet-200 hover:shadow-md cursor-pointer'
                      }`}>
                        {/* ── Row header ── */}
                        <div
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedJustifyId(null)
                              setJustifyText('')
                              setJustifyFile(null)
                            } else {
                              setExpandedJustifyId(a.id)
                              setJustifyText('')
                              setJustifyFile(null)
                            }
                          }}
                          className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0 shadow-sm ${
                              isLate ? 'bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600 border border-amber-200'
                                     : 'bg-gradient-to-br from-rose-100 to-rose-50 text-rose-600 border border-rose-200'
                            }`}>
                              {isLate ? '⏱' : '✗'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-ink">{subject?.name || 'Materia'}</span>
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg ${
                                  isLate ? 'text-amber-700 bg-amber-100 border border-amber-200' : 'text-rose-700 bg-rose-100 border border-rose-200'
                                }`}>
                                  {isLate ? 'Atraso' : 'Falta'}
                                </span>
                              </div>
                              <p className="text-xs text-ink4 mt-0.5 flex items-center gap-1.5">
                                <CalendarDays size={12}/>
                                {new Date(a.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {a.justification_status === 'pending' && (
                              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-100">
                                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <span className="text-xs font-bold text-amber-700">En revision</span>
                              </div>
                            )}
                            {a.justification_status === 'approved' && (
                              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                                <CheckCircle2 size={14} className="text-emerald-500" />
                                <span className="text-xs font-bold text-emerald-700">Justificada</span>
                              </div>
                            )}
                            {a.justification_status === 'rejected' && (
                              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 border border-rose-100">
                                <X size={14} className="text-rose-500" />
                                <span className="text-xs font-bold text-rose-700">Rechazada</span>
                              </div>
                            )}
                            {!hasJustification && (
                              <div className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all text-xs font-bold ${
                                isExpanded
                                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                                  : 'bg-violet-50 text-violet-600 border border-violet-100 hover:bg-violet-100'
                              }`}>
                                <Upload size={13}/>
                                {isExpanded ? 'Justificando...' : 'Justificar'}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ── Justification already sent (view details when expanded) ── */}
                        {isExpanded && hasJustification && (
                          <div className="border-t border-amber-100 dark:border-amber-900/30 bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-900/5">
                            <div className="p-5 sm:p-6 space-y-4">
                              {/* Status banner */}
                              <div className={`flex items-start gap-3 p-4 rounded-xl border ${
                                a.justification_status === 'pending'
                                  ? 'bg-amber-50/80 border-amber-100'
                                  : a.justification_status === 'approved'
                                  ? 'bg-emerald-50/80 border-emerald-100'
                                  : 'bg-rose-50/80 border-rose-100'
                              }`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  a.justification_status === 'pending'
                                    ? 'bg-amber-100 text-amber-600'
                                    : a.justification_status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-600'
                                    : 'bg-rose-100 text-rose-600'
                                }`}>
                                  {a.justification_status === 'pending' ? <Clock3 size={16}/> : a.justification_status === 'approved' ? <CheckCircle2 size={16}/> : <X size={16}/>}
                                </div>
                                <div>
                                  <p className={`text-xs font-bold mb-0.5 ${
                                    a.justification_status === 'pending' ? 'text-amber-700' : a.justification_status === 'approved' ? 'text-emerald-700' : 'text-rose-700'
                                  }`}>
                                    {a.justification_status === 'pending' ? 'Justificacion en revision' : a.justification_status === 'approved' ? 'Justificacion aprobada' : 'Justificacion rechazada'}
                                  </p>
                                  <p className={`text-[11px] leading-relaxed ${
                                    a.justification_status === 'pending' ? 'text-amber-600/80' : a.justification_status === 'approved' ? 'text-emerald-600/80' : 'text-rose-600/80'
                                  }`}>
                                    {a.justification_status === 'pending'
                                      ? 'Tu solicitud ha sido recibida y esta siendo revisada por la administracion del plantel.'
                                      : a.justification_status === 'approved'
                                      ? 'Tu falta ha sido justificada exitosamente. No se contabilizara en tu registro.'
                                      : 'Tu justificacion no fue aceptada. Contacta a la administracion para mas detalles.'}
                                  </p>
                                </div>
                              </div>

                              {/* Sent justification details */}
                              {a.justification_text && (
                                <div className="p-4 rounded-xl bg-white dark:bg-surface border border-surface2">
                                  <p className="flex items-center gap-2 text-[10px] font-black text-ink4 uppercase tracking-widest mb-2">
                                    <span className="w-4 h-4 rounded bg-violet-100 text-violet-600 flex items-center justify-center text-[9px] font-black">1</span>
                                    Motivo enviado
                                  </p>
                                  <p className="text-sm text-ink2 leading-relaxed bg-bg p-3 rounded-lg border border-surface2 italic">
                                    "{a.justification_text}"
                                  </p>
                                </div>
                              )}

                              {a.justification_file_url && (
                                <div className="p-4 rounded-xl bg-white dark:bg-surface border border-surface2">
                                  <p className="flex items-center gap-2 text-[10px] font-black text-ink4 uppercase tracking-widest mb-3">
                                    <span className="w-4 h-4 rounded bg-violet-100 text-violet-600 flex items-center justify-center text-[9px] font-black">2</span>
                                    Documento adjunto
                                  </p>
                                  <FilePreview url={a.justification_file_url} name="Justificacion" />
                                </div>
                              )}

                              {!a.justification_text && !a.justification_file_url && (
                                <div className="p-4 rounded-xl bg-bg border border-surface2 text-center">
                                  <p className="text-sm text-ink4">No hay detalles disponibles de esta justificacion.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ── Inline justification form ── */}
                        {isExpanded && !hasJustification && (
                          <div className="border-t border-violet-100 dark:border-violet-900/30 bg-gradient-to-b from-violet-50/50 to-transparent dark:from-violet-900/5">
                            <form
                              onSubmit={async (e) => {
                                e.preventDefault()
                                if (!justifyText.trim()) return
                                setIsSubmitting(true)
                                try {
                                  let file_url = null
                                  if (justifyFile) {
                                    const ext = justifyFile.name.split('.').pop()
                                    const fileName = `justifications/${profile.id}-${a.id}-${Date.now()}.${ext}`
                                    const { error: uploadError } = await supabase.storage.from('submissions').upload(fileName, justifyFile)
                                    if (uploadError) throw new Error('Error al subir: ' + uploadError.message)
                                    const { data: { publicUrl } } = supabase.storage.from('submissions').getPublicUrl(fileName)
                                    file_url = publicUrl
                                  }
                                  const res = await fetch('/api/alumno/attendance/justify', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ attendance_id: a.id, text: justifyText, file_url })
                                  })
                                  const data = await res.json()
                                  if (data.error) throw new Error(data.error)
                                  setLocalAttendance(prev => prev.map(att =>
                                    att.id === a.id ? { ...att, justification_status: 'pending', justification_text: justifyText, justification_file_url: file_url } : att
                                  ))
                                  toast.success('Justificacion enviada correctamente')
                                  setExpandedJustifyId(null)
                                  setJustifyText('')
                                  setJustifyFile(null)
                                } catch (err: any) {
                                  toast.error(err.message)
                                } finally {
                                  setIsSubmitting(false)
                                }
                              }}
                              className="p-5 sm:p-6 space-y-5"
                            >
                              {/* Info banner */}
                              <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50/80 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <AlertTriangle size={16} className="text-indigo-500" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-0.5">Proceso de Justificacion</p>
                                  <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 leading-relaxed">
                                    Describe el motivo de la inasistencia y adjunta un certificado medico, constancia u otro documento probatorio.
                                    Tu solicitud sera revisada por la administracion.
                                  </p>
                                </div>
                              </div>

                              {/* Text area */}
                              <div>
                                <label className="flex items-center gap-2 text-[11px] font-black text-ink3 uppercase tracking-widest mb-2.5">
                                  <span className="w-5 h-5 rounded-md bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-black">1</span>
                                  Motivo de la Inasistencia <span className="text-rose-400">*</span>
                                </label>
                                <textarea
                                  required
                                  autoFocus
                                  value={justifyText}
                                  onChange={e => setJustifyText(e.target.value)}
                                  rows={4}
                                  className="input-base w-full resize-none rounded-2xl bg-white dark:bg-surface border-surface2 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10 text-sm leading-relaxed shadow-sm"
                                  placeholder="Ej: El estudiante presento sintomas de gripe con fiebre alta, por lo que asistio a consulta medica durante el horario de clases..."
                                />
                              </div>

                              {/* File upload */}
                              <div>
                                <label className="flex items-center gap-2 text-[11px] font-black text-ink3 uppercase tracking-widest mb-2.5">
                                  <span className="w-5 h-5 rounded-md bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-black">2</span>
                                  Documento de Respaldo
                                  <span className="text-[9px] font-semibold text-ink4 normal-case tracking-normal ml-1">(opcional)</span>
                                </label>

                                {!justifyFile ? (
                                  <label className="group flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-surface2 hover:border-violet-300 bg-white dark:bg-surface hover:bg-violet-50/30 cursor-pointer transition-all duration-300">
                                    <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/30 text-violet-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm">
                                      <Upload size={24} />
                                    </div>
                                    <div className="text-center">
                                      <p className="text-sm font-bold text-ink2 group-hover:text-violet-600 transition-colors">
                                        Arrastra o haz clic para subir
                                      </p>
                                      <p className="text-[11px] text-ink4 mt-1">
                                        Certificado medico, constancia, foto, PDF · Max 10MB
                                      </p>
                                    </div>
                                    <input
                                      type="file"
                                      className="hidden"
                                      accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.webp"
                                      onChange={e => setJustifyFile(e.target.files?.[0] || null)}
                                    />
                                  </label>
                                ) : (
                                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30">
                                    <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                                      <Paperclip size={18} className="text-emerald-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 truncate">{justifyFile.name}</p>
                                      <p className="text-[10px] text-emerald-600/70 mt-0.5">
                                        {(justifyFile.size / 1024).toFixed(0)} KB · Listo para enviar
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setJustifyFile(null)}
                                      className="w-8 h-8 rounded-lg bg-emerald-100 hover:bg-rose-100 text-emerald-600 hover:text-rose-600 flex items-center justify-center transition-colors flex-shrink-0"
                                    >
                                      <X size={15} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center justify-between pt-2">
                                <button
                                  type="button"
                                  onClick={() => { setExpandedJustifyId(null); setJustifyText(''); setJustifyFile(null) }}
                                  className="text-xs font-bold text-ink4 hover:text-ink transition-colors px-4 py-2.5 rounded-xl hover:bg-surface2"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="submit"
                                  disabled={isSubmitting || !justifyText.trim()}
                                  className="btn-primary px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:shadow-none transition-all"
                                >
                                  {isSubmitting ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                      Enviando...
                                    </>
                                  ) : (
                                    <>
                                      <Send size={15} />
                                      Enviar Justificacion
                                    </>
                                  )}
                                </button>
                              </div>
                            </form>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          )
        })()}

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
                {isParentView ? 'Conducta y Observaciones Docentes' : 'Desempeño y Observaciones'}
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
                <span className={`p-2 ${isParentView ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'} rounded-xl`}><CalendarDays size={20}/></span> 
                {isParentView ? 'Horario Escolar del Estudiante' : 'Horario Institucional'}
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
              <span className={`p-2 ${isParentView ? `${theme.accentBg} ${theme.accentText}` : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'} rounded-xl`}><Award size={20}/></span> 
              {isParentView ? `Rendimiento Académico de ${viewedStudent.full_name?.split(' ')[0] || 'tu hijo/a'}` : 'Libreta de Calificaciones'}
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
                        return (
                          <div key={i} className="bg-white dark:bg-surface border border-violet-100 dark:border-violet-800/30 rounded-xl p-3 space-y-2">
                            <span className="text-sm font-medium text-ink block truncate">{name}</span>
                            <FilePreview url={url} name={name} compact />
                          </div>
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
                      <div className="flex-1">
                        {sub.file_url && (
                          <FilePreview url={sub.file_url} compact />
                        )}
                      </div>
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

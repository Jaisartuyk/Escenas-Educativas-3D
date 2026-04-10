'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  Plus, Users, ClipboardList, BarChart2,
  CheckCircle2, XCircle, Clock3, ThumbsUp, ThumbsDown,
  Star, Trash2, BookOpen, CalendarDays,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
type AttendanceStatus = 'present' | 'absent' | 'late'
type BehaviorType     = 'positive' | 'negative' | 'recommendation'
type DetailTab        = 'asistencia' | 'calificaciones' | 'comportamiento'

// ─── Constants ────────────────────────────────────────────────────────────────
// Inline hex colors — Tailwind purges dynamic class names in production
const CARD_COLORS = [
  '#7C6DFA', '#3B82F6', '#14B8A6',
  '#F59E0B', '#F43F5E', '#6366F1',
  '#10B981', '#F97316', '#EC4899', '#06B6D4',
]
const DAYS_ES   = ['Lun','Mar','Mié','Jue','Vie']
const MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Asigna colores por orden a nombres únicos — garantiza colores distintos por materia
function buildColorMap(subjects: any[]): Record<string, string> {
  const uniqueNames = [...new Set(subjects.map((s: any) => s.name as string))]
  const map: Record<string, string> = {}
  uniqueNames.forEach((name, i) => { map[name] = CARD_COLORS[i % CARD_COLORS.length] })
  return map
}

function getMondayOfWeek(date = new Date()) {
  const d   = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toISO(d: Date) { return d.toISOString().split('T')[0] }

function fmtDayHeader(d: Date) {
  return `${DAYS_ES[d.getDay() - 1]} ${d.getDate()}`
}

function fmtWeekRange(mon: Date) {
  const fri = addDays(mon, 4)
  return `${mon.getDate()} - ${fri.getDate()} ${MONTHS_ES[fri.getMonth()]} ${fri.getFullYear()}`
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function DocenteClient({
  profile, mySubjects, enrollments,
  initialAssignments, initialGrades,
  teacherId,
}: any) {
  // ── Vista activa ─────────────────────────────────────────────────────────
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [activeTab,         setActiveTab]         = useState<DetailTab>('asistencia')

  // ── Assignments / Grades (existentes) ───────────────────────────────────
  const [assignments, setAssignments] = useState<any[]>(initialAssignments)
  const [grades,      setGrades]      = useState<any[]>(initialGrades)
  const supabase = createClient()

  // ── Asistencia ───────────────────────────────────────────────────────────
  const [weekStart,   setWeekStart]   = useState<Date>(() => getMondayOfWeek())
  const [attendance,  setAttendance]  = useState<Record<string, AttendanceStatus>>({}) // "date_studentId" → status
  const [loadingAtt,  setLoadingAtt]  = useState(false)

  // ── Comportamiento ───────────────────────────────────────────────────────
  const [behaviors,       setBehaviors]       = useState<any[]>([])
  const [loadingBeh,      setLoadingBeh]      = useState(false)
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  const [newBehType,      setNewBehType]      = useState<BehaviorType>('positive')
  const [newBehDesc,      setNewBehDesc]      = useState('')
  const [savingBeh,       setSavingBeh]       = useState(false)

  // ── Calificaciones ───────────────────────────────────────────────────────
  const [trimestre,    setTrimestre]    = useState(1)
  const [parcial,      setParcial]      = useState(1)
  const [newAsgTitle,  setNewAsgTitle]  = useState('')
  const [newAsgDesc,   setNewAsgDesc]   = useState('')
  const [newAsgDate,   setNewAsgDate]   = useState('')
  const [editingGrades,setEditingGrades]= useState<Record<string, string>>({})

  const selectedSubject = mySubjects.find((s: any) => s.id === selectedSubjectId)
  const instId   = (profile?.institutions as any)?.id || profile?.institution_id
  const colorMap = buildColorMap(mySubjects)

  // ── Alumnos del curso seleccionado ───────────────────────────────────────
  const students: any[] = selectedSubject
    ? enrollments.filter((e: any) => e.course_id === selectedSubject.course?.id)
        .map((e: any) => e.student).filter(Boolean)
    : []

  // ── Cargar asistencia cuando cambia la semana o el subject ───────────────
  const loadAttendance = useCallback(async (subjectId: string, week: Date) => {
    setLoadingAtt(true)
    try {
      const res = await fetch(`/api/docente/attendance?subjectId=${subjectId}&weekStart=${toISO(week)}`)
      const { data } = await res.json()
      const map: Record<string, AttendanceStatus> = {}
      ;(data || []).forEach((r: any) => {
        map[`${r.date}_${r.student_id}`] = r.status
      })
      setAttendance(map)
    } finally { setLoadingAtt(false) }
  }, [])

  useEffect(() => {
    if (selectedSubjectId && activeTab === 'asistencia') {
      loadAttendance(selectedSubjectId, weekStart)
    }
  }, [selectedSubjectId, weekStart, activeTab, loadAttendance])

  // ── Cargar comportamiento cuando se abre la pestaña ──────────────────────
  const loadBehaviors = useCallback(async (subjectId: string) => {
    setLoadingBeh(true)
    try {
      const res = await fetch(`/api/docente/behavior?subjectId=${subjectId}`)
      const { data } = await res.json()
      setBehaviors(data || [])
    } finally { setLoadingBeh(false) }
  }, [])

  useEffect(() => {
    if (selectedSubjectId && activeTab === 'comportamiento') {
      loadBehaviors(selectedSubjectId)
    }
  }, [selectedSubjectId, activeTab, loadBehaviors])

  // ── Abrir un subject ──────────────────────────────────────────────────────
  function openSubject(id: string) {
    setSelectedSubjectId(id)
    setActiveTab('asistencia')
    setWeekStart(getMondayOfWeek())
    setExpandedStudent(null)
    setNewBehDesc('')
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ASISTENCIA — toggle
  // ════════════════════════════════════════════════════════════════════════
  const NEXT_STATUS: Record<AttendanceStatus, AttendanceStatus> = {
    present: 'absent',
    absent:  'late',
    late:    'present',
  }

  async function toggleAttendance(date: string, studentId: string) {
    const key    = `${date}_${studentId}`
    const current: AttendanceStatus = attendance[key] || 'present'
    const next   = NEXT_STATUS[current]

    setAttendance(prev => ({ ...prev, [key]: next }))

    await fetch('/api/docente/attendance', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        subject_id:     selectedSubjectId,
        student_id:     studentId,
        date,
        status:         next,
        institution_id: instId,
      }),
    })
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CALIFICACIONES — crear tarea
  // ════════════════════════════════════════════════════════════════════════
  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!newAsgTitle.trim() || !selectedSubjectId) return

    const id     = uuidv4()
    const newAsg = {
      id, subject_id: selectedSubjectId,
      title: newAsgTitle, description: newAsgDesc,
      due_date:  newAsgDate || null,
      trimestre, parcial,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setAssignments(prev => [newAsg, ...prev])
    setNewAsgTitle(''); setNewAsgDesc(''); setNewAsgDate('')

    // @ts-ignore
    const { error } = await supabase.from('assignments').insert(newAsg)
    if (error) toast.error('Error al crear tarea')
    else toast.success('✓ Tarea publicada')
  }

  function handleGradeChange(assignmentId: string, studentId: string, value: string) {
    setEditingGrades(prev => ({ ...prev, [`${assignmentId}_${studentId}`]: value }))
  }

  async function handleSaveGrade(assignmentId: string, studentId: string) {
    const key = `${assignmentId}_${studentId}`
    const val = editingGrades[key]
    if (val === undefined) return
    const score = parseFloat(val)
    if (isNaN(score)) return

    const existing = grades.find(
      (g: any) => g.assignment_id === assignmentId && g.student_id === studentId
    )
    if (existing) {
      setGrades(grades.map((g: any) => g.id === existing.id ? { ...g, score } : g))
      // @ts-ignore
      await supabase.from('grades').update({ score }).eq('id', existing.id)
    } else {
      const id = uuidv4()
      const newGrade = { id, assignment_id: assignmentId, student_id: studentId, score,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      setGrades(prev => [...prev, newGrade])
      // @ts-ignore
      await supabase.from('grades').insert(newGrade)
    }
    const updated = { ...editingGrades }
    delete updated[key]
    setEditingGrades(updated)
    toast.success('Nota guardada', { icon: '📝' })
  }

  function getGrade(assignmentId: string, studentId: string): number | null {
    const g = grades.find((g: any) => g.assignment_id === assignmentId && g.student_id === studentId)
    return g != null ? g.score : null
  }

  function gradeColor(s: number | null) {
    if (s === null) return 'text-ink4'
    if (s < 7)   return 'text-rose-500'
    if (s < 8.5) return 'text-amber-500'
    return 'text-emerald-500'
  }
  function gradeBg(s: number | null) {
    if (s === null) return ''
    if (s < 7)   return 'bg-rose-500/10'
    if (s < 8.5) return 'bg-amber-500/10'
    return 'bg-emerald-500/10'
  }

  // ════════════════════════════════════════════════════════════════════════
  //  COMPORTAMIENTO — añadir / eliminar
  // ════════════════════════════════════════════════════════════════════════
  async function addBehavior(studentId: string) {
    if (!newBehDesc.trim()) { toast.error('Escribe una descripción'); return }
    setSavingBeh(true)
    try {
      const res = await fetch('/api/docente/behavior', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          subject_id:     selectedSubjectId,
          student_id:     studentId,
          type:           newBehType,
          description:    newBehDesc,
          date:           toISO(new Date()),
          institution_id: instId,
        }),
      })
      const { data } = await res.json()
      if (data) {
        setBehaviors(prev => [data, ...prev])
        setNewBehDesc('')
        toast.success('Observación guardada')
      }
    } finally { setSavingBeh(false) }
  }

  async function deleteBehavior(id: string) {
    await fetch(`/api/docente/behavior?id=${id}`, { method: 'DELETE' })
    setBehaviors(prev => prev.filter((b: any) => b.id !== id))
    toast.success('Eliminado')
  }

  // ════════════════════════════════════════════════════════════════════════
  //  RENDER: MIS CLASES (cards)
  // ════════════════════════════════════════════════════════════════════════
  if (!selectedSubjectId) {
    return (
      <div className="animate-fade-in max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Panel Docente</h1>
          <p className="text-ink3 text-sm mt-1">Selecciona una clase para gestionar asistencia, calificaciones y comportamiento.</p>
        </div>

        {mySubjects.length === 0 ? (
          <div className="p-14 text-center text-ink3 bg-surface rounded-3xl border border-surface2">
            <BookOpen size={36} className="mx-auto mb-3 text-ink4" />
            <p className="font-semibold">No tienes materias asignadas</p>
            <p className="text-sm text-ink4 mt-1">El administrador debe asignarte en Gestión Académica.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {mySubjects.map((s: any) => {
              const color    = colorMap[s.name] || CARD_COLORS[0]
              const studs    = enrollments.filter((e: any) => e.course_id === s.course?.id)
              const asgCount = assignments.filter((a: any) => a.subject_id === s.id).length
              const initial  = s.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

              return (
                <button
                  key={s.id}
                  onClick={() => openSubject(s.id)}
                  className="bg-surface rounded-2xl border border-surface2 overflow-hidden text-left hover:border-violet/40 hover:shadow-lg transition-all group"
                >
                  {/* Header colorido */}
                  <div style={{ backgroundColor: color }} className="p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-sm leading-tight truncate">{s.name}</div>
                      <div className="text-white/70 text-xs mt-0.5 truncate">
                        {s.course?.name} {s.course?.parallel}
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-ink3">
                      <span className="flex items-center gap-1.5">
                        <Users size={13} /> {studs.length} alumnos
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ClipboardList size={13} /> {asgCount} tareas
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={13} /> {s.weekly_hours}h/sem
                      </span>
                    </div>
                    <div className="text-xs text-violet group-hover:translate-x-1 transition-transform font-medium flex items-center gap-1">
                      Abrir clase →
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  //  RENDER: DETALLE DE CLASE
  // ════════════════════════════════════════════════════════════════════════
  const color = colorMap[selectedSubject?.name || ''] || CARD_COLORS[0]

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-5">

      {/* Header de la clase */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSelectedSubjectId(null)}
          className="w-9 h-9 rounded-xl border border-surface2 flex items-center justify-center text-ink3 hover:text-ink hover:bg-surface2 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ backgroundColor: color }} className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {selectedSubject?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight leading-tight">
            {selectedSubject?.name}
          </h1>
          <p className="text-sm text-ink3">
            {selectedSubject?.course?.name} {selectedSubject?.course?.parallel}
            {' · '}{students.length} alumnos · {selectedSubject?.weekly_hours}h/sem
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-2xl p-1 border border-surface2 w-fit">
        {([
          { id: 'asistencia',      label: 'Asistencia',      icon: CalendarDays  },
          { id: 'calificaciones',  label: 'Calificaciones',  icon: BarChart2     },
          { id: 'comportamiento',  label: 'Comportamiento',  icon: Star          },
        ] as { id: DetailTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap
              ${activeTab === id ? 'bg-violet text-white shadow-glow' : 'text-ink3 hover:text-ink hover:bg-bg'}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── TAB: ASISTENCIA ──────────────────────────────────────────────── */}
      {activeTab === 'asistencia' && (() => {
        const weekDates = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))

        // Conteo de ausencias por alumno
        const absentCount = (studentId: string) =>
          weekDates.filter(d => attendance[`${toISO(d)}_${studentId}`] === 'absent').length
        const lateCount = (studentId: string) =>
          weekDates.filter(d => attendance[`${toISO(d)}_${studentId}`] === 'late').length

        return (
          <div className="space-y-4">
            {/* Navegación semana */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setWeekStart(d => addDays(d, -7))}
                className="w-9 h-9 rounded-xl border border-surface2 flex items-center justify-center text-ink3 hover:text-ink hover:bg-surface2 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-ink min-w-[180px] text-center">
                {fmtWeekRange(weekStart)}
              </span>
              <button
                onClick={() => setWeekStart(d => addDays(d, 7))}
                className="w-9 h-9 rounded-xl border border-surface2 flex items-center justify-center text-ink3 hover:text-ink hover:bg-surface2 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setWeekStart(getMondayOfWeek())}
                className="text-xs text-violet hover:underline font-medium"
              >
                Hoy
              </button>
            </div>

            {students.length === 0 ? (
              <div className="p-10 text-center text-ink4 border border-dashed border-surface2 rounded-2xl">
                No hay alumnos matriculados en este curso.
              </div>
            ) : (
              <div className="bg-surface rounded-2xl border border-surface2 overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap min-w-max">
                  <thead className="bg-bg3 text-xs uppercase tracking-wider border-b border-surface2">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold sticky left-0 bg-bg3 z-10 w-48 shadow-[2px_0_4px_rgba(0,0,0,0.06)]">
                        Estudiante
                      </th>
                      {weekDates.map((d, i) => (
                        <th key={i} className="px-3 py-3 text-center font-medium min-w-[80px] text-ink3">
                          {fmtDayHeader(d)}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center font-bold text-ink3 border-l border-surface2">F</th>
                      <th className="px-3 py-3 text-center font-bold text-ink3 border-l border-surface2/50">A</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface">
                    {students.map((st: any, idx: number) => (
                      <tr key={st.id} className="hover:bg-bg/40 transition-colors">
                        <td className="px-4 py-2.5 sticky left-0 bg-surface hover:bg-bg/40 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.04)] border-r border-surface/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-ink4 w-5 text-right flex-shrink-0">{idx + 1}.</span>
                            <span className="font-medium text-ink text-xs truncate w-36" title={st.full_name}>
                              {st.full_name}
                            </span>
                          </div>
                        </td>
                        {weekDates.map((d) => {
                          const dateStr = toISO(d)
                          const key     = `${dateStr}_${st.id}`
                          const status: AttendanceStatus = attendance[key] || 'present'
                          const isToday = dateStr === toISO(new Date())
                          return (
                            <td key={dateStr} className={`px-2 py-2 text-center border-l border-surface/30 ${isToday ? 'bg-violet/5' : ''}`}>
                              <button
                                onClick={() => toggleAttendance(dateStr, st.id)}
                                title={status}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all
                                  ${status === 'present'
                                    ? 'text-ink4 hover:bg-emerald-500/10 hover:text-emerald-500'
                                    : status === 'absent'
                                      ? 'bg-rose-500/15 text-rose-500 hover:bg-rose-500/25'
                                      : 'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25'}`}
                              >
                                {status === 'present'
                                  ? <CheckCircle2 size={16} className="opacity-30 hover:opacity-100" />
                                  : status === 'absent'
                                    ? <XCircle size={16} />
                                    : <Clock3 size={16} />
                                }
                              </button>
                            </td>
                          )
                        })}
                        {/* Conteos */}
                        <td className="px-3 py-2 text-center border-l border-surface2">
                          <span className={`text-xs font-bold ${absentCount(st.id) > 0 ? 'text-rose-500' : 'text-ink4'}`}>
                            {absentCount(st.id)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center border-l border-surface2/50">
                          <span className={`text-xs font-bold ${lateCount(st.id) > 0 ? 'text-amber-500' : 'text-ink4'}`}>
                            {lateCount(st.id)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Leyenda */}
            <div className="flex items-center gap-5 text-xs text-ink3 px-1">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="opacity-40" /> Presente</span>
              <span className="flex items-center gap-1.5"><XCircle size={13} className="text-rose-500" /> Falta (F)</span>
              <span className="flex items-center gap-1.5"><Clock3 size={13} className="text-amber-500" /> Atraso (A)</span>
            </div>
          </div>
        )
      })()}

      {/* ── TAB: CALIFICACIONES ──────────────────────────────────────────── */}
      {activeTab === 'calificaciones' && (() => {
        const filteredAssignments = assignments.filter(
          (a: any) => a.subject_id === selectedSubjectId
            && a.trimestre === trimestre
            && a.parcial   === parcial
        )

        return (
          <div className="space-y-5">
            {/* Selector Trimestre / Parcial */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 bg-surface rounded-xl p-1 border border-surface2">
                {[1, 2, 3].map(t => (
                  <button key={t} onClick={() => setTrimestre(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${trimestre === t ? 'bg-violet text-white' : 'text-ink3 hover:text-ink hover:bg-bg'}`}>
                    T{t}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 bg-surface rounded-xl p-1 border border-surface2">
                {[1, 2].map(p => (
                  <button key={p} onClick={() => setParcial(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${parcial === p ? 'bg-teal text-white' : 'text-ink3 hover:text-ink hover:bg-bg'}`}>
                    P{p}
                  </button>
                ))}
              </div>
              <span className="text-xs text-ink3">
                Trimestre {trimestre} · Parcial {parcial}
              </span>
            </div>

            {/* Formulario nueva tarea */}
            <div className="bg-surface rounded-2xl border border-surface2 p-4">
              <h3 className="font-bold text-sm text-ink mb-3">
                + Nueva tarea · T{trimestre} P{parcial}
              </h3>
              <form onSubmit={handleCreateAssignment} className="flex flex-wrap gap-3">
                <input required value={newAsgTitle} onChange={e => setNewAsgTitle(e.target.value)}
                  placeholder="Título de la tarea"
                  className="flex-1 min-w-[200px] bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet" />
                <input value={newAsgDesc} onChange={e => setNewAsgDesc(e.target.value)}
                  placeholder="Descripción (opcional)"
                  className="flex-1 min-w-[160px] bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet" />
                <input type="date" value={newAsgDate} onChange={e => setNewAsgDate(e.target.value)}
                  className="bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet w-36" />
                <button type="submit"
                  className="bg-violet hover:bg-violet2 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-glow flex items-center gap-2 flex-shrink-0">
                  <Plus size={14} /> Publicar
                </button>
              </form>
            </div>

            {/* Tabla de notas */}
            {filteredAssignments.length === 0 || students.length === 0 ? (
              <div className="p-10 text-center text-ink4 border border-dashed border-surface2 rounded-2xl">
                {filteredAssignments.length === 0
                  ? `No hay tareas en T${trimestre} P${parcial}. Crea la primera arriba.`
                  : 'No hay alumnos matriculados en este curso.'}
              </div>
            ) : (
              <div className="bg-surface rounded-2xl border border-surface2 overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap min-w-max">
                  <thead className="bg-bg3 text-xs uppercase tracking-wider border-b border-surface2">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold sticky left-0 bg-bg3 z-10 w-48 shadow-[2px_0_4px_rgba(0,0,0,0.06)]">
                        Estudiante
                      </th>
                      {filteredAssignments.map((a: any) => (
                        <th key={a.id} className="px-3 py-3 text-center font-medium min-w-[110px] text-ink3">
                          <div className="text-violet truncate w-24 mx-auto font-semibold" title={a.title}>{a.title}</div>
                          {a.due_date && (
                            <div className="text-[9px] text-ink5 font-normal mt-0.5">
                              {new Date(a.due_date).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                            </div>
                          )}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center font-bold text-ink3 border-l border-surface2 min-w-[70px]">
                        Prom.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface">
                    {students.map((st: any) => {
                      const scores = filteredAssignments.map((a: any) => getGrade(a.id, st.id)).filter((g): g is number => g !== null)
                      const avg    = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null
                      return (
                        <tr key={st.id} className="hover:bg-bg/40 transition-colors group">
                          <td className="px-4 py-2.5 sticky left-0 bg-surface group-hover:bg-bg/40 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.04)] border-r border-surface/50 transition-colors">
                            <span className="font-medium text-xs text-ink truncate block w-40" title={st.full_name}>{st.full_name}</span>
                          </td>
                          {filteredAssignments.map((a: any) => {
                            const key    = `${a.id}_${st.id}`
                            const isEdit = editingGrades[key] !== undefined
                            const cur    = isEdit ? editingGrades[key] : (getGrade(a.id, st.id) ?? '')
                            const score  = cur !== '' ? Number(cur) : null
                            return (
                              <td key={a.id} className={`px-3 py-2 text-center border-l border-surface/30 ${!isEdit && score !== null ? gradeBg(score) : ''}`}>
                                <input
                                  type="number" min="0" max="10" step="0.01"
                                  value={cur}
                                  onChange={e => handleGradeChange(a.id, st.id, e.target.value)}
                                  onBlur={() => handleSaveGrade(a.id, st.id)}
                                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                  placeholder="—"
                                  className={`w-16 h-8 text-center text-sm font-bold bg-transparent border-b-2 rounded-none outline-none transition-all
                                    ${isEdit ? 'border-teal text-teal' : score !== null ? `border-transparent ${gradeColor(score)}` : 'border-transparent text-ink4 hover:border-surface2'}`}
                                />
                              </td>
                            )
                          })}
                          <td className={`px-3 py-2 text-center font-bold text-sm border-l border-surface2 ${avg !== null ? gradeColor(avg) : 'text-ink4'}`}>
                            {avg !== null ? avg.toFixed(1) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                    {/* Fila promedio por tarea */}
                    <tr className="bg-bg3 border-t-2 border-surface2">
                      <td className="px-4 py-2 sticky left-0 bg-bg3 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.04)] border-r border-surface/50">
                        <span className="text-xs font-bold text-ink3 uppercase tracking-wide">Promedio clase</span>
                      </td>
                      {filteredAssignments.map((a: any) => {
                        const sc  = students.map((st: any) => getGrade(a.id, st.id)).filter((g): g is number => g !== null)
                        const avg = sc.length > 0 ? sc.reduce((x: number, y: number) => x + y, 0) / sc.length : null
                        return (
                          <td key={a.id} className={`px-3 py-2 text-center font-bold text-sm border-l border-surface/30 ${avg !== null ? gradeColor(avg) : 'text-ink4'}`}>
                            {avg !== null ? avg.toFixed(1) : '—'}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 border-l border-surface2" />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── TAB: COMPORTAMIENTO ──────────────────────────────────────────── */}
      {activeTab === 'comportamiento' && (() => {
        if (loadingBeh) return (
          <div className="p-10 text-center text-ink4">Cargando registros...</div>
        )

        return (
          <div className="space-y-3">
            {students.length === 0 ? (
              <div className="p-10 text-center text-ink4 border border-dashed border-surface2 rounded-2xl">
                No hay alumnos en este curso.
              </div>
            ) : students.map((st: any, idx: number) => {
              const stuBeh   = behaviors.filter((b: any) => b.student_id === st.id)
              const pos      = stuBeh.filter((b: any) => b.type === 'positive').length
              const neg      = stuBeh.filter((b: any) => b.type === 'negative').length
              const rec      = stuBeh.filter((b: any) => b.type === 'recommendation').length
              const isExpand = expandedStudent === st.id

              return (
                <div key={st.id} className="bg-surface rounded-2xl border border-surface2 overflow-hidden transition-all">
                  {/* Fila del alumno */}
                  <button
                    onClick={() => {
                      setExpandedStudent(isExpand ? null : st.id)
                      if (!isExpand) { setNewBehDesc(''); setNewBehType('positive') }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg/40 transition-colors text-left"
                  >
                    <span className="text-xs text-ink4 w-6 text-right flex-shrink-0">{idx + 1}.</span>
                    <span className="flex-1 font-medium text-sm text-ink truncate">{st.full_name}</span>
                    {/* Badges */}
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${pos > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-bg text-ink4'}`}>
                      <ThumbsUp size={11} /> {pos}
                    </span>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${neg > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-bg text-ink4'}`}>
                      <ThumbsDown size={11} /> {neg}
                    </span>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${rec > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-bg text-ink4'}`}>
                      <Star size={11} /> {rec}
                    </span>
                    <ChevronRight size={14} className={`text-ink4 transition-transform flex-shrink-0 ${isExpand ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Panel expandido */}
                  {isExpand && (
                    <div className="border-t border-surface2 p-4 space-y-4 bg-bg/30">
                      {/* Formulario añadir */}
                      <div className="flex items-start gap-3 flex-wrap">
                        <select
                          value={newBehType}
                          onChange={e => setNewBehType(e.target.value as BehaviorType)}
                          className="bg-surface border border-surface2 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-violet flex-shrink-0"
                        >
                          <option value="positive">👍 Positivo</option>
                          <option value="negative">👎 Negativo</option>
                          <option value="recommendation">⭐ Recomendación</option>
                        </select>
                        <input
                          value={newBehDesc}
                          onChange={e => setNewBehDesc(e.target.value)}
                          placeholder="Describe la observación..."
                          className="flex-1 min-w-[200px] bg-surface border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet"
                        />
                        <button
                          onClick={() => addBehavior(st.id)}
                          disabled={savingBeh}
                          className="bg-violet hover:bg-violet2 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 flex-shrink-0"
                        >
                          <Plus size={14} /> Añadir
                        </button>
                      </div>

                      {/* Lista de registros */}
                      {stuBeh.length === 0 ? (
                        <p className="text-xs text-ink4 text-center py-2">Sin observaciones registradas.</p>
                      ) : (
                        <div className="space-y-2">
                          {stuBeh.map((b: any) => (
                            <div key={b.id} className="flex items-start gap-3 p-3 bg-surface rounded-xl border border-surface2">
                              <span className="text-base flex-shrink-0">
                                {b.type === 'positive' ? '👍' : b.type === 'negative' ? '👎' : '⭐'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-ink">{b.description || '—'}</p>
                                <p className="text-xs text-ink4 mt-0.5">
                                  {new Date(b.date).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                              <button
                                onClick={() => deleteBehavior(b.id)}
                                className="text-ink4 hover:text-rose-500 transition-colors flex-shrink-0 mt-0.5"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}

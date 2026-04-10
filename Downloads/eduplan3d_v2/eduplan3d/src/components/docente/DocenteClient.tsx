'use client'

import { useState } from 'react'
import {
  LayoutDashboard, BookOpen, ClipboardList, BarChart2,
  Plus, ChevronRight, Users, AlertCircle, Calendar,
  GraduationCap, CheckCircle2, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────
type Tab = 'resumen' | 'materias' | 'tareas' | 'calificaciones'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'resumen',        label: 'Resumen',        icon: LayoutDashboard },
  { id: 'materias',       label: 'Mis Materias',   icon: BookOpen },
  { id: 'tareas',         label: 'Tareas',         icon: ClipboardList },
  { id: 'calificaciones', label: 'Calificaciones', icon: BarChart2 },
]

// ─── Helpers de colores de nota ──────────────────────────────────────────────
function gradeColor(score: number | null) {
  if (score === null) return 'text-ink4'
  if (score < 7)   return 'text-rose-500'
  if (score < 8.5) return 'text-amber-500'
  return 'text-emerald-500'
}
function gradeBg(score: number | null) {
  if (score === null) return ''
  if (score < 7)   return 'bg-rose-500/10'
  if (score < 8.5) return 'bg-amber-500/10'
  return 'bg-emerald-500/10'
}

// ─── Sidebar de materias (reutilizable) ──────────────────────────────────────
function MateriaSidebar({
  subjects, activeId, onSelect,
}: { subjects: any[]; activeId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="w-full md:w-56 flex-shrink-0 space-y-1">
      <p className="text-xs uppercase font-bold text-ink4 px-1 mb-3 tracking-wider">Mis Materias</p>
      {subjects.map((s: any) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`w-full text-left px-3 py-2.5 rounded-xl transition-all border text-sm flex items-center gap-3
            ${activeId === s.id
              ? 'bg-violet/10 border-violet/30 text-violet'
              : 'bg-surface border-transparent text-ink3 hover:text-ink hover:bg-surface2'}`}
        >
          <BookOpen size={14} className="flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-xs truncate">{s.name}</div>
            <div className="text-[10px] opacity-60 truncate">{s.course?.name} {s.course?.parallel}</div>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
export function DocenteClient({
  profile, mySubjects, enrollments,
  initialAssignments, initialGrades,
  scheduleConfig, teacherId,
}: any) {
  const [activeTab,       setActiveTab]       = useState<Tab>('resumen')
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(mySubjects[0]?.id || null)
  const [assignments,     setAssignments]     = useState<any[]>(initialAssignments)
  const [grades,          setGrades]          = useState<any[]>(initialGrades)
  const [newTitle,        setNewTitle]        = useState('')
  const [newDesc,         setNewDesc]         = useState('')
  const [newDueDate,      setNewDueDate]      = useState('')
  const [editingGrades,   setEditingGrades]   = useState<Record<string, string>>({})

  const supabase = createClient()

  // ── Helpers de datos ────────────────────────────────────────────────────
  const getStudentsForCourse = (courseId: string) =>
    enrollments.filter((e: any) => e.course_id === courseId).map((e: any) => e.student).filter(Boolean)

  const getAssignmentsForSubject = (subjectId: string) =>
    assignments.filter((a: any) => a.subject_id === subjectId)

  const getGrade = (assignmentId: string, studentId: string): number | null => {
    const g = grades.find((g: any) => g.assignment_id === assignmentId && g.student_id === studentId)
    return g != null ? g.score : null
  }

  const totalStudents = new Set(
    enrollments.map((e: any) => e.student?.id).filter(Boolean)
  ).size

  const ungradedCount = assignments.reduce((acc: number, a: any) => {
    const sub = mySubjects.find((s: any) => s.id === a.subject_id)
    const students = sub?.course ? getStudentsForCourse(sub.course.id) : []
    const graded   = grades.filter((g: any) => g.assignment_id === a.id).length
    return acc + Math.max(0, students.length - graded)
  }, 0)

  const activeSubject = mySubjects.find((s: any) => s.id === activeSubjectId)
  const institutionName = (profile?.institutions as any)?.name || 'Mi Institución'

  // ── Crear tarea ─────────────────────────────────────────────────────────
  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !activeSubjectId) return

    const id = uuidv4()
    const newAsg = {
      id, subject_id: activeSubjectId,
      title: newTitle, description: newDesc,
      due_date: newDueDate || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setAssignments([newAsg, ...assignments])
    setNewTitle(''); setNewDesc(''); setNewDueDate('')

    // @ts-ignore
    const { error } = await supabase.from('assignments').insert(newAsg)
    if (error) toast.error('Error al crear tarea')
    else toast.success('✓ Tarea publicada')
  }

  // ── Guardar nota ────────────────────────────────────────────────────────
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
      const newGrade = {
        id, assignment_id: assignmentId, student_id: studentId, score,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      setGrades([...grades, newGrade])
      // @ts-ignore
      await supabase.from('grades').insert(newGrade)
    }

    const updated = { ...editingGrades }
    delete updated[key]
    setEditingGrades(updated)
    toast.success('Nota guardada', { icon: '📝' })
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TAB: RESUMEN
  // ════════════════════════════════════════════════════════════════════════
  function renderResumen() {
    return (
      <div className="space-y-6">
        {/* Banner de bienvenida */}
        <div className="relative bg-gradient-to-r from-violet/20 via-violet/10 to-transparent rounded-3xl p-6 border border-violet/20 overflow-hidden">
          <div className="absolute right-6 top-0 bottom-0 flex items-center opacity-[0.07] pointer-events-none select-none">
            <GraduationCap size={130} />
          </div>
          <p className="text-sm text-violet font-semibold mb-1">{institutionName}</p>
          <h2 className="font-display text-2xl font-bold text-ink">
            Bienvenido, {profile?.full_name?.split(' ')[0]} 👋
          </h2>
          <p className="text-sm text-ink3 mt-1">Aquí tienes un resumen de tu actividad docente.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Materias asignadas', value: mySubjects.length,    icon: BookOpen,      color: 'violet'  },
            { label: 'Total de alumnos',   value: totalStudents,         icon: Users,         color: 'teal'    },
            { label: 'Tareas publicadas',  value: assignments.length,    icon: ClipboardList, color: 'blue'    },
            { label: 'Sin calificar',      value: ungradedCount,         icon: AlertCircle,   color: ungradedCount > 0 ? 'rose' : 'emerald' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-surface rounded-2xl p-5 border border-surface2 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${color}-500/10 flex-shrink-0`}>
                <Icon size={18} className={`text-${color}-500`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-ink">{value}</div>
                <div className="text-xs text-ink3">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Últimas tareas + mis materias */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Últimas tareas */}
          <div className="bg-surface rounded-2xl border border-surface2 p-5">
            <h3 className="font-bold text-sm text-ink mb-4 flex items-center gap-2">
              <ClipboardList size={15} className="text-violet" /> Últimas tareas
            </h3>
            {assignments.length === 0
              ? <p className="text-ink4 text-sm text-center py-6">Aún no hay tareas publicadas.</p>
              : assignments.slice(0, 5).map((a: any) => {
                const sub = mySubjects.find((s: any) => s.id === a.subject_id)
                return (
                  <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-surface last:border-0">
                    <CheckCircle2 size={14} className="text-teal mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink truncate">{a.title}</div>
                      <div className="text-xs text-ink3">{sub?.name} · {sub?.course?.name}</div>
                    </div>
                    {a.due_date && (
                      <div className="text-xs text-ink4 flex-shrink-0 flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(a.due_date).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                      </div>
                    )}
                  </div>
                )
              })
            }
          </div>

          {/* Mis materias resumen */}
          <div className="bg-surface rounded-2xl border border-surface2 p-5">
            <h3 className="font-bold text-sm text-ink mb-4 flex items-center gap-2">
              <BookOpen size={15} className="text-violet" /> Mis materias
            </h3>
            {mySubjects.length === 0
              ? <p className="text-ink4 text-sm text-center py-6">No tienes materias asignadas aún.</p>
              : mySubjects.map((s: any) => {
                const students = getStudentsForCourse(s.course?.id)
                const asgs     = getAssignmentsForSubject(s.id)
                return (
                  <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-surface last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-violet/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen size={13} className="text-violet" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-ink truncate">{s.name}</div>
                      <div className="text-xs text-ink3">{s.course?.name} · <span className="text-ink4">{s.weekly_hours}h/sem</span></div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-ink3">{students.length} alumnos</div>
                      <div className="text-xs text-ink4">{asgs.length} tareas</div>
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TAB: MIS MATERIAS
  // ════════════════════════════════════════════════════════════════════════
  function renderMaterias() {
    if (mySubjects.length === 0) {
      return (
        <div className="p-14 text-center text-ink3 bg-surface rounded-3xl border border-surface2">
          <BookOpen size={32} className="mx-auto mb-3 text-ink4" />
          <p className="font-semibold">No tienes materias asignadas</p>
          <p className="text-sm text-ink4 mt-1">El administrador debe asignarte en Gestión Académica → Cursos y Materias.</p>
        </div>
      )
    }
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {mySubjects.map((s: any) => {
          const students = getStudentsForCourse(s.course?.id)
          const asgs     = getAssignmentsForSubject(s.id)
          const allGradesForSub = grades.filter((g: any) =>
            asgs.map((a: any) => a.id).includes(g.assignment_id)
          )
          const avg = allGradesForSub.length > 0
            ? (allGradesForSub.reduce((acc: number, g: any) => acc + Number(g.score), 0) / allGradesForSub.length)
            : null

          return (
            <div
              key={s.id}
              className="bg-surface rounded-2xl border border-surface2 p-5 hover:border-violet/40 transition-all group cursor-pointer"
              onClick={() => { setActiveSubjectId(s.id); setActiveTab('tareas') }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-violet/10 flex items-center justify-center">
                  <BookOpen size={20} className="text-violet" />
                </div>
                <span className="text-xs bg-violet/10 text-violet px-2 py-0.5 rounded-full font-semibold">
                  {s.weekly_hours}h/sem
                </span>
              </div>

              <h3 className="font-bold text-ink text-base mb-0.5 leading-tight">{s.name}</h3>
              <p className="text-xs text-ink3 mb-4">{s.course?.name} {s.course?.parallel}</p>

              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div className="bg-bg rounded-xl p-2.5">
                  <div className="text-base font-bold text-ink">{students.length}</div>
                  <div className="text-[10px] text-ink4">Alumnos</div>
                </div>
                <div className="bg-bg rounded-xl p-2.5">
                  <div className="text-base font-bold text-ink">{asgs.length}</div>
                  <div className="text-[10px] text-ink4">Tareas</div>
                </div>
                <div className="bg-bg rounded-xl p-2.5">
                  <div className={`text-base font-bold ${avg !== null ? gradeColor(avg) : 'text-ink4'}`}>
                    {avg !== null ? avg.toFixed(1) : '—'}
                  </div>
                  <div className="text-[10px] text-ink4">Promedio</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 text-xs text-violet opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                Ver tareas <ChevronRight size={12} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TAB: TAREAS
  // ════════════════════════════════════════════════════════════════════════
  function renderTareas() {
    const subjectAssignments = getAssignmentsForSubject(activeSubjectId || '')
    const students           = activeSubject?.course ? getStudentsForCourse(activeSubject.course.id) : []

    return (
      <div className="flex flex-col md:flex-row gap-6">
        <MateriaSidebar subjects={mySubjects} activeId={activeSubjectId} onSelect={setActiveSubjectId} />

        <div className="flex-1 space-y-5 min-w-0">
          {/* Formulario de nueva tarea */}
          <div className="bg-surface rounded-2xl border border-surface2 p-5">
            <h3 className="font-bold text-sm text-ink mb-4">
              Nueva tarea · <span className="text-violet">{activeSubject?.name || '—'}</span>
            </h3>
            <form onSubmit={handleCreateAssignment} className="space-y-3">
              <input
                required value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="Título de la tarea"
                className="w-full bg-bg border border-surface2 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-violet transition-colors"
              />
              <div className="flex flex-wrap gap-3">
                <input
                  value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder="Descripción (opcional)"
                  className="flex-1 min-w-0 bg-bg border border-surface2 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-violet transition-colors"
                />
                <input
                  type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                  className="bg-bg border border-surface2 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-violet transition-colors w-40"
                />
                <button
                  type="submit"
                  className="bg-violet hover:bg-violet2 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-glow flex items-center gap-2 flex-shrink-0"
                >
                  <Plus size={15} /> Publicar
                </button>
              </div>
            </form>
          </div>

          {/* Lista de tareas */}
          {subjectAssignments.length === 0
            ? (
              <div className="p-10 text-center text-ink4 border border-dashed border-surface2 rounded-2xl">
                <ClipboardList size={28} className="mx-auto mb-2 opacity-40" />
                Aún no hay tareas publicadas en esta materia.
              </div>
            )
            : (
              <div className="space-y-3">
                {subjectAssignments.map((a: any) => {
                  const gradedCount = grades.filter((g: any) => g.assignment_id === a.id).length
                  const pending     = Math.max(0, students.length - gradedCount)
                  const isOverdue   = a.due_date && new Date(a.due_date) < new Date()

                  return (
                    <div key={a.id} className="bg-surface rounded-2xl border border-surface2 p-4 flex items-start gap-4">
                      <div className="w-9 h-9 rounded-xl bg-violet/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <ClipboardList size={16} className="text-violet" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-ink">{a.title}</div>
                        {a.description && (
                          <div className="text-xs text-ink3 mt-0.5 truncate">{a.description}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {a.due_date && (
                          <div className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-rose-500' : 'text-ink4'}`}>
                            <Calendar size={11} />
                            {new Date(a.due_date).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium
                          ${pending > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                          {gradedCount}/{students.length} calificados
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TAB: CALIFICACIONES
  // ════════════════════════════════════════════════════════════════════════
  function renderCalificaciones() {
    const subjectAssignments = getAssignmentsForSubject(activeSubjectId || '')
    const students           = activeSubject?.course ? getStudentsForCourse(activeSubject.course.id) : []

    const noData = subjectAssignments.length === 0 || students.length === 0

    return (
      <div className="flex flex-col md:flex-row gap-6">
        <MateriaSidebar subjects={mySubjects} activeId={activeSubjectId} onSelect={setActiveSubjectId} />

        <div className="flex-1 overflow-x-auto min-w-0">
          {noData ? (
            <div className="p-10 text-center text-ink4 border border-dashed border-surface2 rounded-2xl">
              <BarChart2 size={28} className="mx-auto mb-2 opacity-40" />
              {subjectAssignments.length === 0
                ? 'Primero crea tareas en esta materia para registrar calificaciones.'
                : 'No hay alumnos matriculados en este curso aún.'}
            </div>
          ) : (
            <div className="bg-surface rounded-2xl border border-surface2 overflow-hidden">
              <table className="w-full text-sm whitespace-nowrap min-w-max">
                <thead className="bg-bg3 text-ink3 text-xs uppercase tracking-wider border-b border-surface2">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold sticky left-0 bg-bg3 z-10 w-48 shadow-[2px_0_4px_rgba(0,0,0,0.08)]">
                      Estudiante
                    </th>
                    {subjectAssignments.map((a: any) => (
                      <th key={a.id} className="px-3 py-3 font-medium min-w-[110px] text-center">
                        <div className="text-violet truncate w-24 mx-auto font-semibold" title={a.title}>{a.title}</div>
                        {a.due_date && (
                          <div className="text-[9px] text-ink5 mt-0.5 font-normal">
                            {new Date(a.due_date).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                          </div>
                        )}
                      </th>
                    ))}
                    <th className="px-3 py-3 font-bold text-center bg-bg3 text-ink3 border-l border-surface2 min-w-[80px]">
                      Promedio
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface">
                  {students.map((student: any) => {
                    const studentScores = subjectAssignments
                      .map((a: any) => getGrade(a.id, student.id))
                      .filter((g: any): g is number => g !== null)
                    const avg = studentScores.length > 0
                      ? studentScores.reduce((acc, g) => acc + Number(g), 0) / studentScores.length
                      : null

                    return (
                      <tr key={student.id} className="hover:bg-bg/40 transition-colors group">
                        <td className="px-4 py-2.5 sticky left-0 bg-surface group-hover:bg-bg/40 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.04)] border-r border-surface/50 transition-colors">
                          <div className="font-bold text-ink text-xs truncate w-40" title={student.full_name}>
                            {student.full_name}
                          </div>
                        </td>
                        {subjectAssignments.map((a: any) => {
                          const key      = `${a.id}_${student.id}`
                          const isEdit   = editingGrades[key] !== undefined
                          const current  = isEdit ? editingGrades[key] : (getGrade(a.id, student.id) ?? '')
                          const score    = current !== '' ? Number(current) : null

                          return (
                            <td
                              key={a.id}
                              className={`px-3 py-2 text-center border-l border-surface/30 transition-colors
                                ${!isEdit && score !== null ? gradeBg(score) : ''}`}
                            >
                              <input
                                type="number" min="0" max="10" step="0.01"
                                value={current}
                                onChange={e => handleGradeChange(a.id, student.id, e.target.value)}
                                onBlur={() => handleSaveGrade(a.id, student.id)}
                                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                placeholder="—"
                                className={`w-16 h-8 text-center text-sm font-bold bg-transparent border-b-2 rounded-none outline-none transition-all
                                  ${isEdit
                                    ? 'border-teal text-teal'
                                    : score !== null
                                      ? `border-transparent ${gradeColor(score)}`
                                      : 'border-transparent text-ink4 hover:border-surface2'}`}
                              />
                            </td>
                          )
                        })}
                        <td className={`px-3 py-2 text-center font-bold text-sm border-l border-surface2
                          ${avg !== null ? gradeColor(avg) : 'text-ink4'}`}>
                          {avg !== null ? avg.toFixed(1) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Fila de promedio por tarea */}
                  <tr className="bg-bg3 border-t-2 border-surface2">
                    <td className="px-4 py-2.5 sticky left-0 bg-bg3 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.04)] border-r border-surface/50">
                      <div className="font-bold text-ink3 text-xs uppercase tracking-wide">Promedio</div>
                    </td>
                    {subjectAssignments.map((a: any) => {
                      const asgGrades = students
                        .map((s: any) => getGrade(a.id, s.id))
                        .filter((g: any): g is number => g !== null)
                      const asgAvg = asgGrades.length > 0
                        ? asgGrades.reduce((acc, g) => acc + Number(g), 0) / asgGrades.length
                        : null
                      return (
                        <td key={a.id} className={`px-3 py-2 text-center font-bold text-sm border-l border-surface/30 ${asgAvg !== null ? gradeColor(asgAvg) : 'text-ink4'}`}>
                          {asgAvg !== null ? asgAvg.toFixed(1) : '—'}
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
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  //  RENDER PRINCIPAL
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Panel Docente</h1>
        <p className="text-ink3 text-sm mt-1">Gestiona tus materias, tareas y calificaciones.</p>
      </div>

      {/* Barra de tabs */}
      <div className="flex gap-1 bg-surface rounded-2xl p-1 border border-surface2 w-fit overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap
              ${activeTab === id
                ? 'bg-violet text-white shadow-glow'
                : 'text-ink3 hover:text-ink hover:bg-bg'}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido del tab activo */}
      {activeTab === 'resumen'        && renderResumen()}
      {activeTab === 'materias'       && renderMaterias()}
      {activeTab === 'tareas'         && renderTareas()}
      {activeTab === 'calificaciones' && renderCalificaciones()}
    </div>
  )
}

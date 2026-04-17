'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, BookOpen, ClipboardCheck, Users, AlertTriangle, CheckCircle, Clock, XCircle, ThumbsUp, ThumbsDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Props {
  teachers: any[]
  courses: any[]
  subjects: any[]
  enrollments: any[]
  assignments: any[]
  grades: any[]
  categories: any[]
  attendance: any[]
  behaviors: any[]
  parcialesCount: number
  submissions?: any[]
}

type TabKey = 'resumen' | 'tareas' | 'calificaciones' | 'asistencia' | 'comportamiento'

// ─── Helper: MINEDUC qualitative scale ──────────────────────────────────────
function cualitativo(score: number) {
  if (score >= 9) return { label: 'DAR', color: 'text-emerald-400' }
  if (score >= 7) return { label: 'AAR', color: 'text-blue-400' }
  if (score >= 4.01) return { label: 'PAR', color: 'text-amber-400' }
  return { label: 'NAAR', color: 'text-rose-400' }
}

// ─── Component ──────────────────────────────────────────────────────────────
export function SupervisionClient({ teachers, courses, subjects, enrollments, assignments, grades, categories, attendance, behaviors, parcialesCount, submissions = [] }: Props) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabKey>('resumen')
  const [filterTrimestre, setFilterTrimestre] = useState(1)

  // ── Derived data for selected teacher ─────────────────────────────────────
  const teacherSubjects = useMemo(() =>
    subjects.filter(s => s.teacher_id === selectedTeacherId),
    [subjects, selectedTeacherId]
  )

  const selectedSubject = useMemo(() =>
    subjects.find(s => s.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  )

  // Assignments for current subject
  const subjectAssignments = useMemo(() =>
    assignments.filter(a => a.subject_id === selectedSubjectId),
    [assignments, selectedSubjectId]
  )

  // Grades for subject assignments
  const subjectGrades = useMemo(() => {
    const aIds = new Set(subjectAssignments.map(a => a.id))
    return grades.filter(g => aIds.has(g.assignment_id))
  }, [grades, subjectAssignments])

  // Attendance for subject
  const subjectAttendance = useMemo(() =>
    attendance.filter(a => a.subject_id === selectedSubjectId),
    [attendance, selectedSubjectId]
  )

  // Behaviors for subject
  const subjectBehaviors = useMemo(() =>
    behaviors.filter(b => b.subject_id === selectedSubjectId),
    [behaviors, selectedSubjectId]
  )

  // Students enrolled in the subject's course
  const subjectStudents = useMemo(() => {
    if (!selectedSubject) return []
    return enrollments
      .filter(e => e.course_id === selectedSubject.course_id && e.student)
      .map(e => e.student)
      .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name))
  }, [enrollments, selectedSubject])

  // ── Per-teacher summary stats ─────────────────────────────────────────────
  const teacherStats = useMemo(() => {
    const stats: Record<string, { subjects: number; assignments: number; gradesEntered: number; attendanceRecords: number; behaviorRecords: number }> = {}
    teachers.forEach(t => {
      const tSubjects = subjects.filter(s => s.teacher_id === t.id)
      const tSubjectIds = new Set(tSubjects.map(s => s.id))
      const tAssignments = assignments.filter(a => tSubjectIds.has(a.subject_id))
      const tAssignmentIds = new Set(tAssignments.map(a => a.id))
      stats[t.id] = {
        subjects: tSubjects.length,
        assignments: tAssignments.length,
        gradesEntered: grades.filter(g => tAssignmentIds.has(g.assignment_id)).length,
        attendanceRecords: attendance.filter(a => tSubjectIds.has(a.subject_id)).length,
        behaviorRecords: behaviors.filter(b => tSubjectIds.has(b.subject_id)).length,
      }
    })
    return stats
  }, [teachers, subjects, assignments, grades, attendance, behaviors])

  // ── Auto-select first subject when teacher changes ────────────────────────
  function handleSelectTeacher(id: string) {
    setSelectedTeacherId(id)
    const firstSubject = subjects.find(s => s.teacher_id === id)
    setSelectedSubjectId(firstSubject?.id || '')
    setActiveTab('resumen')
  }

  // ── TABs config ───────────────────────────────────────────────────────────
  const tabs: { key: TabKey; label: string; icon: any; count?: number }[] = [
    { key: 'resumen', label: 'Resumen', icon: BookOpen },
    { key: 'tareas', label: 'Tareas', icon: ClipboardCheck, count: subjectAssignments.length },
    { key: 'calificaciones', label: 'Calificaciones', icon: BookOpen, count: subjectGrades.length },
    { key: 'asistencia', label: 'Asistencia', icon: Users, count: subjectAttendance.length },
    { key: 'comportamiento', label: 'Comportamiento', icon: AlertTriangle, count: subjectBehaviors.length },
  ]

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* ── Teacher selector cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {teachers.map(t => {
          const s = teacherStats[t.id] || { subjects: 0, assignments: 0, gradesEntered: 0, attendanceRecords: 0, behaviorRecords: 0 }
          const selected = t.id === selectedTeacherId
          return (
            <button
              key={t.id}
              onClick={() => handleSelectTeacher(t.id)}
              className={`text-left p-4 rounded-2xl border transition-all ${
                selected
                  ? 'bg-[rgba(124,109,250,0.1)] border-[rgba(124,109,250,0.35)] shadow-lg shadow-violet/10'
                  : 'bg-surface border-[rgba(0,0,0,0.05)] hover:bg-[rgba(124,109,250,0.04)] hover:border-[rgba(124,109,250,0.15)]'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  selected ? 'bg-violet2 text-white' : 'bg-[rgba(124,109,250,0.15)] text-violet2'
                }`}>
                  {t.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{t.full_name}</p>
                  <p className="text-[10px] text-ink4 truncate">{t.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                <div className="bg-bg rounded-lg p-1.5">
                  <p className="text-xs font-bold text-violet2">{s.subjects}</p>
                  <p className="text-[9px] text-ink4">Materias</p>
                </div>
                <div className="bg-bg rounded-lg p-1.5">
                  <p className="text-xs font-bold text-teal">{s.assignments}</p>
                  <p className="text-[9px] text-ink4">Tareas</p>
                </div>
                <div className="bg-bg rounded-lg p-1.5">
                  <p className="text-xs font-bold text-amber-400">{s.gradesEntered}</p>
                  <p className="text-[9px] text-ink4">Notas</p>
                </div>
                <div className="bg-bg rounded-lg p-1.5">
                  <p className="text-xs font-bold text-blue-400">{s.attendanceRecords}</p>
                  <p className="text-[9px] text-ink4">Asist.</p>
                </div>
              </div>
            </button>
          )
        })}
        {teachers.length === 0 && (
          <div className="col-span-full text-center py-12 text-ink4">
            <p className="text-lg mb-1">No hay docentes registrados</p>
            <p className="text-sm">Registra docentes en la sección Académico</p>
          </div>
        )}
      </div>

      {/* ── Teacher detail panel ─────────────────────────────────────────── */}
      {selectedTeacherId && (
        <div className="bg-surface rounded-2xl border border-[rgba(0,0,0,0.05)] overflow-hidden shadow-sm">
          {/* Subject selector */}
          <div className="p-4 border-b border-[rgba(0,0,0,0.05)] bg-bg/50">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-bold text-ink3 uppercase tracking-wider">Materia:</label>
              <div className="flex flex-wrap gap-2">
                {teacherSubjects.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedSubjectId(s.id); setActiveTab('resumen') }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      s.id === selectedSubjectId
                        ? 'bg-violet2 text-white shadow-md'
                        : 'bg-bg border border-[rgba(0,0,0,0.06)] text-ink3 hover:text-ink hover:border-violet2/30'
                    }`}
                  >
                    {s.name} — {s.course?.name} {s.course?.parallel || ''}
                  </button>
                ))}
                {teacherSubjects.length === 0 && (
                  <p className="text-xs text-ink4 italic">Este docente no tiene materias asignadas.</p>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          {selectedSubjectId && (
            <>
              <div className="flex border-b border-[rgba(0,0,0,0.05)] overflow-x-auto">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                      activeTab === tab.key
                        ? 'border-violet2 text-violet2 bg-[rgba(124,109,250,0.05)]'
                        : 'border-transparent text-ink3 hover:text-ink hover:bg-[rgba(0,0,0,0.02)]'
                    }`}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                        activeTab === tab.key ? 'bg-violet2/20 text-violet2' : 'bg-bg text-ink4'
                      }`}>{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="p-5">
                {activeTab === 'resumen' && (
                  <ResumenTab
                    subject={selectedSubject}
                    assignments={subjectAssignments}
                    grades={subjectGrades}
                    attendance={subjectAttendance}
                    behaviors={subjectBehaviors}
                    students={subjectStudents}
                    parcialesCount={parcialesCount}
                  />
                )}
                {activeTab === 'tareas' && (
                  <TareasTab
                    assignments={subjectAssignments}
                    grades={subjectGrades}
                    students={subjectStudents}
                    categories={categories}
                    filterTrimestre={filterTrimestre}
                    setFilterTrimestre={setFilterTrimestre}
                    parcialesCount={parcialesCount}
                    submissions={submissions}
                  />
                )}
                {activeTab === 'calificaciones' && (
                  <CalificacionesTab
                    assignments={subjectAssignments}
                    grades={subjectGrades}
                    students={subjectStudents}
                    categories={categories}
                    filterTrimestre={filterTrimestre}
                    setFilterTrimestre={setFilterTrimestre}
                    parcialesCount={parcialesCount}
                  />
                )}
                {activeTab === 'asistencia' && (
                  <AsistenciaTab
                    attendance={subjectAttendance}
                    students={subjectStudents}
                  />
                )}
                {activeTab === 'comportamiento' && (
                  <ComportamientoTab
                    behaviors={subjectBehaviors}
                    students={subjectStudents}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Resumen
// ═══════════════════════════════════════════════════════════════════════════════
function ResumenTab({ subject, assignments, grades, attendance, behaviors, students, parcialesCount }: any) {
  const totalStudents = students.length
  const studentsWithGrades = new Set(grades.map((g: any) => g.student_id)).size
  const totalAttendanceDays = new Set(attendance.map((a: any) => a.date)).size
  const absentCount = attendance.filter((a: any) => a.status === 'absent').length
  const lateCount = attendance.filter((a: any) => a.status === 'late').length
  const presentCount = attendance.filter((a: any) => a.status === 'present').length
  const positiveB = behaviors.filter((b: any) => b.type === 'positive').length
  const negativeB = behaviors.filter((b: any) => b.type === 'negative').length

  // Assignments by trimestre
  const byTrimestre: Record<number, number> = {}
  assignments.forEach((a: any) => {
    byTrimestre[a.trimestre] = (byTrimestre[a.trimestre] || 0) + 1
  })

  // Average score
  const scoredGrades = grades.filter((g: any) => g.score !== null)
  const avgScore = scoredGrades.length > 0
    ? scoredGrades.reduce((sum: number, g: any) => sum + Number(g.score), 0) / scoredGrades.length
    : null

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="📋" label="Tareas Creadas" value={assignments.length} color="violet" />
        <StatCard icon="📝" label="Notas Registradas" value={grades.length} color="teal" />
        <StatCard icon="📅" label="Días con Asistencia" value={totalAttendanceDays} color="blue" />
        <StatCard icon="🎯" label="Promedio General" value={avgScore !== null ? avgScore.toFixed(2) : '—'} color="amber" />
      </div>

      {/* Details row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tareas por trimestre */}
        <div className="bg-bg rounded-xl p-4 border border-[rgba(0,0,0,0.04)]">
          <h4 className="text-xs font-bold text-ink3 uppercase tracking-wider mb-3">Tareas por Trimestre</h4>
          <div className="space-y-2">
            {[1, 2, 3].map(t => (
              <div key={t} className="flex items-center justify-between">
                <span className="text-sm text-ink2">Trimestre {t}</span>
                <span className="text-sm font-bold text-violet2">{byTrimestre[t] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Asistencia resumen */}
        <div className="bg-bg rounded-xl p-4 border border-[rgba(0,0,0,0.04)]">
          <h4 className="text-xs font-bold text-ink3 uppercase tracking-wider mb-3">Asistencia Global</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-400 flex items-center gap-1"><CheckCircle size={12} /> Presentes</span>
              <span className="text-sm font-bold">{presentCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-amber-400 flex items-center gap-1"><Clock size={12} /> Tardanzas</span>
              <span className="text-sm font-bold">{lateCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-rose-400 flex items-center gap-1"><XCircle size={12} /> Ausencias</span>
              <span className="text-sm font-bold">{absentCount}</span>
            </div>
          </div>
        </div>

        {/* Comportamiento resumen */}
        <div className="bg-bg rounded-xl p-4 border border-[rgba(0,0,0,0.04)]">
          <h4 className="text-xs font-bold text-ink3 uppercase tracking-wider mb-3">Comportamiento</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-400">Positivos</span>
              <span className="text-sm font-bold">{positiveB}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-rose-400">Negativos</span>
              <span className="text-sm font-bold">{negativeB}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink3">Alumnos registrados</span>
              <span className="text-sm font-bold">{totalStudents}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Coverage indicator */}
      {totalStudents > 0 && (
        <div className="bg-bg rounded-xl p-4 border border-[rgba(0,0,0,0.04)]">
          <h4 className="text-xs font-bold text-ink3 uppercase tracking-wider mb-3">Cobertura de Calificaciones</h4>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet2 to-teal rounded-full transition-all"
                style={{ width: `${Math.min(100, (studentsWithGrades / totalStudents) * 100)}%` }}
              />
            </div>
            <span className="text-sm font-bold text-ink2">{studentsWithGrades}/{totalStudents} alumnos</span>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    violet: 'from-violet/10 to-violet/5 border-violet/20',
    teal: 'from-teal/10 to-teal/5 border-teal/20',
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20',
  }
  return (
    <div className={`bg-gradient-to-br ${colorMap[color] || colorMap.violet} border rounded-xl p-4`}>
      <p className="text-lg mb-1">{icon}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[10px] text-ink3 font-semibold uppercase tracking-wider">{label}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Tareas
// ═══════════════════════════════════════════════════════════════════════════════
function TareasTab({ assignments, grades, students, categories, filterTrimestre, setFilterTrimestre, parcialesCount, submissions = [] }: any) {
  const filtered = assignments.filter((a: any) => a.trimestre === filterTrimestre)

  // Group by parcial
  const byParcial: Record<number, any[]> = {}
  filtered.forEach((a: any) => {
    const p = a.parcial || 1
    if (!byParcial[p]) byParcial[p] = []
    byParcial[p].push(a)
  })

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Trimestre filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-ink3 uppercase tracking-wider">Trimestre:</span>
        {[1, 2, 3].map(t => (
          <button
            key={t}
            onClick={() => setFilterTrimestre(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterTrimestre === t
                ? 'bg-violet2 text-white'
                : 'bg-bg text-ink3 hover:bg-[rgba(124,109,250,0.1)]'
            }`}
          >
            T{t}
          </button>
        ))}
      </div>

      {Object.keys(byParcial).sort((a, b) => Number(a) - Number(b)).map(parcial => (
        <div key={parcial} className="space-y-2">
          <h4 className="text-sm font-bold text-ink2">
            {Number(parcial) === 0 ? 'Examen Trimestral' : `Parcial ${parcial}`}
          </h4>
          <div className="space-y-2">
            {byParcial[Number(parcial)].map((a: any) => {
              const aGrades = grades.filter((g: any) => g.assignment_id === a.id)
              const scored = aGrades.filter((g: any) => g.score !== null)
              const avg = scored.length > 0
                ? scored.reduce((s: number, g: any) => s + Number(g.score), 0) / scored.length
                : null
              const cat = categories.find((c: any) => c.id === a.category_id)

              return (
                <div key={a.id} className="bg-bg rounded-xl border border-[rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="flex items-start justify-between p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{a.title}</p>
                        {cat && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: cat.color + '20', color: cat.color }}>
                            {cat.name}
                          </span>
                        )}
                      </div>
                      {a.description && <p className="text-xs text-ink3 mt-1 line-clamp-2">{a.description}</p>}
                      {a.due_date && (
                        <p className="text-[10px] text-ink4 mt-1">
                          Vence: {new Date(a.due_date).toLocaleDateString('es-EC')}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-lg font-bold text-violet2">{scored.length}/{students.length}</p>
                      <p className="text-[10px] text-ink4">calificados</p>
                      {avg !== null && (
                        <p className={`text-xs font-bold mt-1 ${cualitativo(avg).color}`}>
                          Prom: {avg.toFixed(1)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Submissions section */}
                  {(() => {
                    const aSubmissions = submissions.filter((s: any) => s.assignment_id === a.id)
                    if (aSubmissions.length === 0) return (
                      <div className="px-4 pb-3 text-xs text-ink4 italic">Sin entregas de alumnos aún.</div>
                    )
                    return (
                      <div className="border-t border-[rgba(0,0,0,0.04)] bg-surface">
                        <p className="text-[10px] font-black uppercase tracking-widest text-ink4 px-4 pt-3 pb-2">
                          Entregas ({aSubmissions.length})
                        </p>
                        <div className="space-y-2 px-4 pb-3">
                          {aSubmissions.map((s: any) => {
                            const student = students.find((st: any) => st.id === s.student_id) ||
                              (s.student as any)
                            return (
                              <div key={s.id} className="flex items-start justify-between gap-3 p-2 rounded-lg bg-bg border border-[rgba(0,0,0,0.04)]">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-ink truncate">{student?.full_name || 'Alumno'}</p>
                                  <p className="text-[10px] text-ink4">{new Date(s.submitted_at).toLocaleString('es-ES')}</p>
                                  {s.comment && <p className="text-xs text-ink3 mt-0.5 line-clamp-2 italic">"{s.comment}"</p>}
                                </div>
                                {s.file_url && (
                                  <a href={s.file_url} target="_blank" rel="noreferrer"
                                    className="flex-shrink-0 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors">
                                    📎 Archivo
                                  </a>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-8 text-ink4">
          <p className="text-sm">No hay tareas en el Trimestre {filterTrimestre}</p>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Calificaciones (grade matrix)
// ═══════════════════════════════════════════════════════════════════════════════
function CalificacionesTab({ assignments, grades, students, categories, filterTrimestre, setFilterTrimestre, parcialesCount }: any) {
  const filtered = assignments.filter((a: any) => a.trimestre === filterTrimestre)

  function getGrade(assignmentId: string, studentId: string) {
    return grades.find((g: any) => g.assignment_id === assignmentId && g.student_id === studentId)
  }

  // Calculate parcial average for student
  function getParcialAvg(studentId: string, parcial: number) {
    const parcialAssignments = filtered.filter((a: any) => a.parcial === parcial)
    if (parcialAssignments.length === 0) return null

    if (categories.length > 0) {
      // Weighted by categories
      let totalWeight = 0
      let weightedSum = 0
      categories.forEach((cat: any) => {
        const catAssignments = parcialAssignments.filter((a: any) => a.category_id === cat.id)
        const catGrades = catAssignments.map((a: any) => getGrade(a.id, studentId)).filter((g: any) => g?.score != null)
        if (catGrades.length > 0) {
          const catAvg = catGrades.reduce((s: number, g: any) => s + Number(g.score), 0) / catGrades.length
          weightedSum += catAvg * (cat.weight_percent / 100)
          totalWeight += cat.weight_percent / 100
        }
      })
      // Uncategorized
      const uncatAssignments = parcialAssignments.filter((a: any) => !a.category_id)
      const uncatGrades = uncatAssignments.map((a: any) => getGrade(a.id, studentId)).filter((g: any) => g?.score != null)
      if (uncatGrades.length > 0) {
        const uncatAvg = uncatGrades.reduce((s: number, g: any) => s + Number(g.score), 0) / uncatGrades.length
        const remainingWeight = Math.max(0, 1 - totalWeight)
        weightedSum += uncatAvg * remainingWeight
        totalWeight += remainingWeight
      }
      return totalWeight > 0 ? weightedSum / totalWeight : null
    } else {
      // Simple average
      const studentGrades = parcialAssignments.map((a: any) => getGrade(a.id, studentId)).filter((g: any) => g?.score != null)
      if (studentGrades.length === 0) return null
      return studentGrades.reduce((s: number, g: any) => s + Number(g.score), 0) / studentGrades.length
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Trimestre filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-ink3 uppercase tracking-wider">Trimestre:</span>
        {[1, 2, 3].map(t => (
          <button
            key={t}
            onClick={() => setFilterTrimestre(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterTrimestre === t ? 'bg-violet2 text-white' : 'bg-bg text-ink3 hover:bg-[rgba(124,109,250,0.1)]'
            }`}
          >
            T{t}
          </button>
        ))}
      </div>

      {filtered.length > 0 && students.length > 0 ? (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-bg">
                <th className="text-left p-2 text-xs font-bold text-ink3 sticky left-0 bg-bg z-10 min-w-[160px]">Alumno</th>
                {filtered.map((a: any) => (
                  <th key={a.id} className="p-2 text-xs font-medium text-ink3 text-center min-w-[60px]" title={a.title}>
                    <div className="truncate max-w-[80px]">{a.title}</div>
                    <div className="text-[9px] text-ink4 font-normal">P{a.parcial}</div>
                  </th>
                ))}
                {Array.from({ length: parcialesCount }, (_, i) => (
                  <th key={`avg-${i}`} className="p-2 text-xs font-bold text-violet2 text-center bg-[rgba(124,109,250,0.05)]">
                    P{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((st: any) => (
                <tr key={st.id} className="border-t border-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.02)]">
                  <td className="p-2 font-medium text-xs sticky left-0 bg-surface z-10">{st.full_name}</td>
                  {filtered.map((a: any) => {
                    const g = getGrade(a.id, st.id)
                    const score = g?.score
                    return (
                      <td key={a.id} className="p-2 text-center">
                        {score != null ? (
                          <span className={`text-xs font-bold ${cualitativo(Number(score)).color}`}>
                            {Number(score).toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-xs text-ink4">—</span>
                        )}
                      </td>
                    )
                  })}
                  {Array.from({ length: parcialesCount }, (_, i) => {
                    const avg = getParcialAvg(st.id, i + 1)
                    return (
                      <td key={`avg-${i}`} className="p-2 text-center bg-[rgba(124,109,250,0.03)]">
                        {avg !== null ? (
                          <span className={`text-xs font-bold ${cualitativo(avg).color}`}>
                            {avg.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-xs text-ink4">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-ink4">
          <p className="text-sm">{filtered.length === 0 ? `No hay tareas en el Trimestre ${filterTrimestre}` : 'No hay alumnos matriculados'}</p>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Asistencia
// ═══════════════════════════════════════════════════════════════════════════════
function AsistenciaTab({ attendance, students }: any) {
  const [expandedJustification, setExpandedJustification] = useState<string | null>(null)
  // Local status overrides for optimistic UI updates: id → new status
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({})
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const supabase = createClient()

  async function handleJustificationAction(id: string, action: 'approved' | 'rejected') {
    setUpdatingId(id)
    const { error } = await (supabase as any)
      .from('attendance')
      .update({ justification_status: action })
      .eq('id', id)
    if (!error) {
      setLocalStatuses(prev => ({ ...prev, [id]: action }))
    }
    setUpdatingId(null)
  }

  // Get unique dates sorted
  const dates = Array.from(new Set(attendance.map((a: any) => a.date) as string[])).sort()

  // Stats per student
  const studentStats = useMemo(() => {
    const stats: Record<string, { present: number; absent: number; late: number; total: number }> = {}
    students.forEach((st: any) => {
      const records = attendance.filter((a: any) => a.student_id === st.id)
      stats[st.id] = {
        present: records.filter((r: any) => r.status === 'present').length,
        absent: records.filter((r: any) => r.status === 'absent').length,
        late: records.filter((r: any) => r.status === 'late').length,
        total: records.length,
      }
    })
    return stats
  }, [attendance, students])

  // Justifications pending review
  const justifications = useMemo(() =>
    attendance.filter((a: any) => a.justification_status),
    [attendance]
  )

  // Merge local status overrides
  const effectiveJustifications = useMemo(() =>
    justifications.map((j: any) => ({
      ...j,
      justification_status: localStatuses[j.id] ?? j.justification_status,
    })),
    [justifications, localStatuses]
  )

  const pendingJustifications = effectiveJustifications.filter((j: any) => j.justification_status === 'pending')

  const statusIcon: Record<string, { icon: string; color: string }> = {
    present: { icon: '✓', color: 'text-emerald-400 bg-emerald-400/10' },
    absent: { icon: '✗', color: 'text-rose-400 bg-rose-400/10' },
    late: { icon: '⏱', color: 'text-amber-400 bg-amber-400/10' },
  }

  if (dates.length === 0) {
    return (
      <div className="text-center py-8 text-ink4 animate-fade-in">
        <p className="text-sm">No hay registros de asistencia para esta materia</p>
      </div>
    )
  }

  // Show last 10 dates for readability
  const recentDates = dates.slice(-10)

  // Student name lookup
  const studentNameMap = new Map<string, string>(students.map((s: any) => [s.id, s.full_name]))

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-xs text-ink3">{dates.length} dias registrados · Mostrando ultimos {recentDates.length}</p>

      {/* ── Attendance Table ── */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-bg">
              <th className="text-left p-2 text-xs font-bold text-ink3 sticky left-0 bg-bg z-10 min-w-[160px]">Alumno</th>
              {recentDates.map(d => (
                <th key={d} className="p-2 text-[10px] font-medium text-ink4 text-center min-w-[40px]">
                  {new Date(d + 'T12:00:00').toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit' })}
                </th>
              ))}
              <th className="p-2 text-xs font-bold text-emerald-400 text-center">%</th>
              <th className="p-2 text-xs font-bold text-rose-400 text-center">Faltas</th>
            </tr>
          </thead>
          <tbody>
            {students.map((st: any) => {
              const stats = studentStats[st.id] || { present: 0, absent: 0, late: 0, total: 0 }
              const pct = stats.total > 0 ? ((stats.present + stats.late) / stats.total * 100) : 0
              return (
                <tr key={st.id} className="border-t border-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.02)]">
                  <td className="p-2 font-medium text-xs sticky left-0 bg-surface z-10">{st.full_name}</td>
                  {recentDates.map(d => {
                    const record = attendance.find((a: any) => a.student_id === st.id && a.date === d)
                    const s = record ? statusIcon[record.status] : null
                    const hasJustification = record?.justification_status
                    return (
                      <td key={d} className="p-1 text-center relative">
                        {s ? (
                          <span className={`inline-flex w-6 h-6 items-center justify-center rounded-md text-[10px] font-bold ${s.color} ${hasJustification ? 'ring-2 ring-offset-1 ring-amber-300' : ''}`}
                            title={hasJustification ? `Justificacion: ${record.justification_status}` : undefined}
                          >
                            {s.icon}
                          </span>
                        ) : (
                          <span className="text-ink4 text-[10px]">·</span>
                        )}
                        {hasJustification && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border border-white" />
                        )}
                      </td>
                    )
                  })}
                  <td className="p-2 text-center">
                    <span className={`text-xs font-bold ${pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <span className="text-xs font-bold text-rose-400">{stats.absent}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Justifications Section ── */}
      {justifications.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-3 mb-3">
            <h4 className="text-sm font-bold text-ink2">Justificaciones Recibidas</h4>
            {pendingJustifications.length > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {pendingJustifications.length} pendiente{pendingJustifications.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {effectiveJustifications.map((j: any) => {
              const isExpanded = expandedJustification === j.id
              const studentName = studentNameMap.get(j.student_id) || 'Alumno'
              const isPending = j.justification_status === 'pending'
              const isApproved = j.justification_status === 'approved'
              const isRejected = j.justification_status === 'rejected'
              const isUpdating = updatingId === j.id

              return (
                <div key={j.id} className={`rounded-xl border overflow-hidden transition-all ${
                  isExpanded
                    ? 'border-violet2/30 shadow-md bg-surface'
                    : 'border-[rgba(0,0,0,0.06)] bg-bg hover:border-violet2/20'
                }`}>
                  {/* Header row */}
                  <button
                    onClick={() => setExpandedJustification(isExpanded ? null : j.id)}
                    className="w-full p-3 flex items-center gap-3 text-left cursor-pointer"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isPending
                        ? 'bg-amber-100 text-amber-600'
                        : isApproved
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-rose-100 text-rose-600'
                    }`}>
                      {isPending ? '⏳' : isApproved ? '✅' : '❌'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-ink">{studentName}</span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          j.status === 'absent' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {j.status === 'absent' ? 'Falta' : 'Atraso'}
                        </span>
                      </div>
                      <p className="text-[10px] text-ink4 mt-0.5">
                        {new Date(j.date + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${
                      isPending
                        ? 'bg-amber-50 text-amber-600 border border-amber-100'
                        : isApproved
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        : 'bg-rose-50 text-rose-600 border border-rose-100'
                    }`}>
                      {isPending ? 'Pendiente' : isApproved ? 'Aprobada' : 'Rechazada'}
                    </span>

                    <ChevronDown size={14} className={`text-ink4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-[rgba(0,0,0,0.05)] space-y-3 pt-3">
                      {j.justification_text ? (
                        <div className="p-3 rounded-lg bg-bg border border-[rgba(0,0,0,0.04)]">
                          <p className="text-[10px] font-bold text-ink4 uppercase tracking-wider mb-1.5">Motivo del estudiante</p>
                          <p className="text-sm text-ink2 leading-relaxed italic">"{j.justification_text}"</p>
                        </div>
                      ) : (
                        <p className="text-xs text-ink4 italic">Sin motivo detallado.</p>
                      )}

                      {j.justification_file_url && (
                        <a
                          href={j.justification_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet2/10 text-violet2 text-xs font-bold hover:bg-violet2/20 transition-colors"
                        >
                          <BookOpen size={13} />
                          Ver documento adjunto →
                        </a>
                      )}

                      {/* ── Approve / Reject Actions ── */}
                      {isPending && (
                        <div className="flex items-center gap-2 pt-1 border-t border-[rgba(0,0,0,0.05)]">
                          <span className="text-[10px] text-ink4 font-semibold flex-1">Resolución:</span>
                          <button
                            onClick={() => handleJustificationAction(j.id, 'approved')}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50 border border-emerald-500/20"
                          >
                            {isUpdating ? (
                              <span className="w-3 h-3 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                            ) : (
                              <ThumbsUp size={12} />
                            )}
                            Aprobar
                          </button>
                          <button
                            onClick={() => handleJustificationAction(j.id, 'rejected')}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 text-xs font-bold hover:bg-rose-500/20 transition-colors disabled:opacity-50 border border-rose-500/20"
                          >
                            {isUpdating ? (
                              <span className="w-3 h-3 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                            ) : (
                              <ThumbsDown size={12} />
                            )}
                            Rechazar
                          </button>
                        </div>
                      )}

                      {/* Status resolved badge */}
                      {!isPending && (
                        <div className={`flex items-center gap-2 text-xs font-semibold pt-1 border-t border-[rgba(0,0,0,0.05)] ${
                          isApproved ? 'text-emerald-500' : 'text-rose-500'
                        }`}>
                          {isApproved ? <CheckCircle size={13} /> : <XCircle size={13} />}
                          Justificación {isApproved ? 'aprobada' : 'rechazada'} por el administrador
                          {localStatuses[j.id] && (
                            <button
                              onClick={() => setLocalStatuses(prev => { const n = {...prev}; delete n[j.id]; return n })}
                              className="ml-auto text-[10px] text-ink4 hover:text-ink3 underline"
                            >
                              Deshacer
                            </button>
                          )}
                        </div>
                      )}
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Comportamiento
// ═══════════════════════════════════════════════════════════════════════════════
function ComportamientoTab({ behaviors, students }: any) {
  const typeConfig: Record<string, { label: string; emoji: string; color: string }> = {
    positive: { label: 'Positivo', emoji: '🌟', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    negative: { label: 'Negativo', emoji: '⚠️', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    recommendation: { label: 'Recomendación', emoji: '💡', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  }

  // Student name lookup
  const studentMap = new Map<string, string>(students.map((s: any) => [s.id, s.full_name]))

  // Stats per student
  const studentBehaviorStats = useMemo(() => {
    const stats: Record<string, { positive: number; negative: number; recommendation: number }> = {}
    students.forEach((st: any) => {
      const records = behaviors.filter((b: any) => b.student_id === st.id)
      stats[st.id] = {
        positive: records.filter((r: any) => r.type === 'positive').length,
        negative: records.filter((r: any) => r.type === 'negative').length,
        recommendation: records.filter((r: any) => r.type === 'recommendation').length,
      }
    })
    return stats
  }, [behaviors, students])

  // Behavior rating
  function getBehaviorLetter(studentId: string) {
    const s = studentBehaviorStats[studentId]
    if (!s) return { letter: '—', color: 'text-ink4' }
    const total = s.positive + s.negative
    if (total === 0) return { letter: '—', color: 'text-ink4' }
    const pct = s.positive / total * 100
    if (pct >= 90) return { letter: 'S', color: 'text-emerald-400' }
    if (pct >= 70) return { letter: 'F', color: 'text-blue-400' }
    if (pct >= 50) return { letter: 'U', color: 'text-amber-400' }
    return { letter: 'N', color: 'text-rose-400' }
  }

  if (behaviors.length === 0) {
    return (
      <div className="text-center py-8 text-ink4 animate-fade-in">
        <p className="text-sm">No hay registros de comportamiento para esta materia</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Summary table */}
      <div className="bg-bg rounded-xl p-4 border border-[rgba(0,0,0,0.04)]">
        <h4 className="text-xs font-bold text-ink3 uppercase tracking-wider mb-3">Resumen por Alumno</h4>
        <div className="space-y-1.5">
          {students.map((st: any) => {
            const s = studentBehaviorStats[st.id] || { positive: 0, negative: 0, recommendation: 0 }
            const total = s.positive + s.negative + s.recommendation
            if (total === 0) return null
            const bl = getBehaviorLetter(st.id)
            return (
              <div key={st.id} className="flex items-center gap-3 py-1.5">
                <span className="text-xs font-medium flex-1 min-w-0 truncate">{st.full_name}</span>
                <span className="text-[10px] text-emerald-400 font-bold">+{s.positive}</span>
                <span className="text-[10px] text-rose-400 font-bold">−{s.negative}</span>
                <span className={`text-xs font-black w-6 text-center ${bl.color}`}>{bl.letter}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent records */}
      <div>
        <h4 className="text-xs font-bold text-ink3 uppercase tracking-wider mb-3">Registros Recientes</h4>
        <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
          {behaviors.slice(0, 30).map((b: any) => {
            const cfg = typeConfig[b.type] || typeConfig.positive
            return (
              <div key={b.id} className={`p-3 rounded-xl border ${cfg.color}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span>{cfg.emoji}</span>
                      <span className="text-xs font-bold">{studentMap.get(b.student_id) || 'Alumno'}</span>
                      <span className="text-[10px] opacity-70">{cfg.label}</span>
                    </div>
                    {b.description && <p className="text-xs mt-1 opacity-80">{b.description}</p>}
                  </div>
                  <span className="text-[10px] opacity-60 flex-shrink-0">
                    {b.date ? new Date(b.date + 'T12:00:00').toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }) : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

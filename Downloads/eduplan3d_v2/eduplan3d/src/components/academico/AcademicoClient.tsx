'use client'

import { useState, useMemo } from 'react'
import { Users, BookOpen, ChevronDown, ChevronRight, GraduationCap, Clock, UserCheck, ArrowUpCircle, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PersonalClient } from './PersonalClient'

interface Props {
  initialCourses: any[]
  initialStudents: any[]
  initialSubjects: any[]
  initialEnrollments: any[]
  initialAssignments: any[]
  initialGrades: any[]
  initialCategories: any[]
  teachers: any[]
  horariosDocentes: any[]
  institutionId: string
  directoryMetadata: any
  tutores: Record<string, string>
}

export function AcademicoClient({
  initialCourses, initialStudents, initialSubjects, initialEnrollments,
  initialAssignments = [], initialGrades = [], initialCategories = [],
  teachers, horariosDocentes, institutionId, directoryMetadata, tutores
}: Props) {
  const [activeTab, setActiveTab] = useState<'cursos' | 'matriculas' | 'personal' | 'promocion'>('cursos')
  const [courses]    = useState(initialCourses)
  const [subjects]   = useState(initialSubjects)
  const [enrollments, setEnrollments] = useState(initialEnrollments)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [promoCourseId, setPromoCourseId] = useState<string>(initialCourses[0]?.id || '')
  const supabase = createClient()

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleEnrollmentChange(student_id: string, course_id: string) {
    const isEnrolled = enrollments.some((e: any) => e.student_id === student_id && e.course_id === course_id)
    if (isEnrolled) {
      setEnrollments(prev => prev.filter((e: any) => !(e.student_id === student_id && e.course_id === course_id)))
      await fetch(`/api/enrollments?student_id=${student_id}&course_id=${course_id}`, { method: 'DELETE' })
    } else {
      setEnrollments(prev => [...prev, { student_id, course_id }])
      await fetch('/api/enrollments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ student_id, course_id }),
      })
    }
  }

  // ── Courses tab ─────────────────────────────────────────────────────────────
  function CursosTab() {
    if (courses.length === 0) {
      return (
        <div className="bg-surface rounded-2xl border border-[rgba(0,0,0,0.02)] p-10 text-center">
          <BookOpen size={32} className="text-ink4 mx-auto mb-3" />
          <p className="font-medium text-ink3">Sin cursos configurados</p>
          <p className="text-xs text-ink4 mt-1">
            Configura los cursos en el{' '}
            <span className="text-violet font-semibold">Generador de Horarios</span> y se sincronizarán aquí automáticamente.
          </p>
        </div>
      )
    }

    return (
      <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] overflow-hidden">
        {/* Encabezado tabla */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_40px] gap-0 bg-[rgba(124,109,250,0.08)] border-b border-[rgba(124,109,250,0.15)] px-5 py-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-violet2">Curso</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-violet2">Tutor</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-violet2 text-center">Materias</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-violet2 text-center">Alumnos</span>
          <span />
        </div>

        <div className="divide-y divide-[rgba(0,0,0,0.04)] bg-surface">
          {courses.map((course: any) => {
            const courseSubjects  = subjects.filter((s: any) => s.course_id === course.id)
            const studentCount    = enrollments.filter((e: any) => e.course_id === course.id).length
            const tutor           = tutores[course.name] || '—'
            const isOpen          = !!expanded[course.id]

            return (
              <div key={course.id}>
                {/* Fila principal del curso */}
                <button
                  onClick={() => toggleExpand(course.id)}
                  className="w-full grid grid-cols-[2fr_2fr_1fr_1fr_40px] gap-0 px-5 py-4 hover:bg-[rgba(124,109,250,0.03)] transition-colors text-left"
                >
                  {/* Nombre del curso */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[rgba(124,109,250,0.12)] flex items-center justify-center flex-shrink-0">
                      <GraduationCap size={15} className="text-violet2" />
                    </div>
                    <span className="font-semibold text-sm text-ink truncate">{course.name}</span>
                  </div>

                  {/* Tutor */}
                  <div className="flex items-center min-w-0">
                    {tutor !== '—' ? (
                      <div className="flex items-center gap-1.5">
                        <UserCheck size={13} className="text-teal flex-shrink-0" />
                        <span className="text-sm text-ink2 truncate">{tutor}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-ink4 italic">Sin tutor asignado</span>
                    )}
                  </div>

                  {/* Nº materias */}
                  <div className="flex items-center justify-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      courseSubjects.length > 0
                        ? 'bg-[rgba(124,109,250,0.12)] text-violet2'
                        : 'bg-surface2 text-ink4'
                    }`}>
                      {courseSubjects.length}
                    </span>
                  </div>

                  {/* Nº alumnos */}
                  <div className="flex items-center justify-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      studentCount > 0
                        ? 'bg-[rgba(38,215,180,0.12)] text-teal'
                        : 'bg-surface2 text-ink4'
                    }`}>
                      {studentCount}
                    </span>
                  </div>

                  {/* Chevron */}
                  <div className="flex items-center justify-center">
                    {isOpen
                      ? <ChevronDown size={16} className="text-violet2" />
                      : <ChevronRight size={16} className="text-ink4" />
                    }
                  </div>
                </button>

                {/* Sub-tabla de materias (expandible) */}
                {isOpen && (
                  <div className="bg-[rgba(0,0,0,0.02)] border-t border-[rgba(0,0,0,0.04)]">
                    {courseSubjects.length === 0 ? (
                      <p className="px-14 py-3 text-xs text-ink4 italic">
                        Sin materias asignadas — guarda el horario desde el Generador para sincronizarlas.
                      </p>
                    ) : (
                      <div>
                        {/* Mini encabezado */}
                        <div className="grid grid-cols-[2fr_2fr_1fr] px-14 py-2 border-b border-[rgba(0,0,0,0.04)]">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-ink4">Materia</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-ink4">Docente</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-ink4 text-center">Horas/sem</span>
                        </div>
                        {courseSubjects.map((sub: any) => (
                          <div
                            key={sub.id}
                            className="grid grid-cols-[2fr_2fr_1fr] px-14 py-2.5 border-b border-[rgba(0,0,0,0.025)] last:border-0 hover:bg-[rgba(124,109,250,0.03)] transition-colors"
                          >
                            <span className="text-sm font-medium text-ink">{sub.name}</span>
                            <span className="text-sm text-ink3">
                              {sub.teacher?.full_name
                                ? <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal flex-shrink-0" />
                                    {sub.teacher.full_name}
                                  </span>
                                : <span className="text-ink4 italic">Sin docente vinculado</span>
                              }
                            </span>
                            <div className="flex items-center justify-center">
                              {sub.weekly_hours > 0
                                ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(124,109,250,0.08)] text-violet2 text-xs font-semibold">
                                    <Clock size={10} /> {sub.weekly_hours}h
                                  </span>
                                : <span className="text-ink4 text-xs">—</span>
                              }
                            </div>
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

        {/* Footer resumen */}
        <div className="bg-[rgba(0,0,0,0.02)] border-t border-[rgba(0,0,0,0.04)] px-5 py-3 flex items-center gap-6">
          <span className="text-xs text-ink4">
            <span className="font-bold text-ink3">{courses.length}</span> cursos
          </span>
          <span className="text-xs text-ink4">
            <span className="font-bold text-ink3">{subjects.length}</span> materias totales
          </span>
          <span className="text-xs text-ink4">
            <span className="font-bold text-ink3">{initialStudents.length}</span> estudiantes registrados
          </span>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-surface">
        <button onClick={() => setActiveTab('cursos')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'cursos' ? 'border-violet text-violet font-bold' : 'border-transparent text-ink3 hover:text-ink2 hover:border-surface2'}`}>
          Cursos y Materias
        </button>
        <button onClick={() => setActiveTab('matriculas')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'matriculas' ? 'border-teal text-teal font-bold' : 'border-transparent text-ink3 hover:text-ink2 hover:border-surface2'}`}>
          Nómina (Vincular)
        </button>
        <button onClick={() => setActiveTab('personal')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'personal' ? 'border-[#F8D25A] text-[#F8D25A] font-bold' : 'border-transparent text-ink3 hover:text-ink2 hover:border-surface2'}`}>
          Gestión de Cuentas (Crear)
        </button>
        <button onClick={() => setActiveTab('promocion')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'promocion' ? 'border-emerald-500 text-emerald-500 font-bold' : 'border-transparent text-ink3 hover:text-ink2 hover:border-surface2'}`}>
          Promoción
        </button>
      </div>

      <div className="mt-8">
        {activeTab === 'cursos' && <CursosTab />}

        {activeTab === 'matriculas' && (
          <div className="bg-surface rounded-2xl border border-[rgba(0,0,0,0.02)] overflow-hidden">
            <div className="p-4 border-b border-surface2 flex justify-between items-center">
              <h3 className="font-bold text-ink flex items-center gap-2">
                <Users size={18} className="text-teal" /> Nómina Estudiantil
              </h3>
              <p className="text-xs text-ink3">Selecciona los cursos a los que pertenece cada estudiante.</p>
            </div>
            {initialStudents.length === 0 ? (
              <div className="p-8 text-center text-ink4 text-sm">
                No hay estudiantes unidos a la institución. Entrégales el código de invitación.
              </div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-bg text-ink3 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">Estudiante</th>
                    <th className="px-6 py-4 font-medium">Cursos Matriculados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface">
                  {initialStudents.map((student: any) => {
                    const studentCourseIds = enrollments
                      .filter((e: any) => e.student_id === student.id)
                      .map((e: any) => e.course_id)
                    return (
                      <tr key={student.id} className="hover:bg-bg/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-ink">{student.full_name}</div>
                          <div className="text-xs text-ink4">{student.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {courses.map((course: any) => {
                              const isEnrolled = studentCourseIds.includes(course.id)
                              return (
                                <button
                                  key={course.id}
                                  onClick={() => handleEnrollmentChange(student.id, course.id)}
                                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                                    isEnrolled
                                      ? 'bg-teal/10 text-teal border-teal/20 shadow-[0_0_8px_rgba(38,215,180,0.15)]'
                                      : 'bg-bg text-ink4 border-surface hover:border-surface2'
                                  }`}
                                >
                                  {course.name}
                                </button>
                              )
                            })}
                            {courses.length === 0 && (
                              <span className="text-xs text-ink4 italic">Debes crear cursos primero</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'personal' && (
          <PersonalClient
            institutionId={institutionId}
            teachers={teachers}
            students={initialStudents}
            horariosDocentes={horariosDocentes}
            directoryMetadata={directoryMetadata}
            courses={courses}
          />
        )}

        {activeTab === 'promocion' && (() => {
          const promoCourse = courses.find((c: any) => c.id === promoCourseId)
          const promoStudents = enrollments.filter((e: any) => e.course_id === promoCourseId)
            .map((e: any) => initialStudents.find((s: any) => s.id === e.student_id)).filter(Boolean)
          const courseSubjects = initialSubjects.filter((s: any) => s.course_id === promoCourseId)

          function getStudentAnnualAvg(studentId: string): { avg: number | null; allPass: boolean; subjectAvgs: { name: string; avg: number | null }[] } {
            const subjectAvgs = courseSubjects.map((sub: any) => {
              const trimestreAvgs: (number | null)[] = []
              for (let t = 1; t <= 3; t++) {
                const asgs = initialAssignments.filter((a: any) =>
                  a.subject_id === sub.id && a.trimestre === t
                )
                if (asgs.length === 0) { trimestreAvgs.push(null); continue }
                if (initialCategories.length === 0) {
                  const scores = asgs.map((a: any) => {
                    const g = initialGrades.find((gr: any) => gr.assignment_id === a.id && gr.student_id === studentId)
                    return g?.score != null ? Number(g.score) : null
                  }).filter((g): g is number => g !== null)
                  trimestreAvgs.push(scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null)
                } else {
                  let totalW = 0, totalWt = 0
                  initialCategories.forEach((cat: any) => {
                    const catAsgs = asgs.filter((a: any) => a.category_id === cat.id)
                    if (catAsgs.length === 0) return
                    const scores = catAsgs.map((a: any) => {
                      const g = initialGrades.find((gr: any) => gr.assignment_id === a.id && gr.student_id === studentId)
                      return g?.score != null ? Number(g.score) : null
                    }).filter((g): g is number => g !== null)
                    if (scores.length === 0) return
                    const catAvg = scores.reduce((a, b) => a + b, 0) / scores.length
                    totalW += catAvg * Number(cat.weight_percent)
                    totalWt += Number(cat.weight_percent)
                  })
                  trimestreAvgs.push(totalWt > 0 ? totalW / totalWt : null)
                }
              }
              const valid = trimestreAvgs.filter((v): v is number => v !== null)
              const avg = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null
              return { name: sub.name, avg }
            })

            const validAvgs = subjectAvgs.filter(s => s.avg !== null).map(s => s.avg!)
            const globalAvg = validAvgs.length > 0 ? validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length : null
            const allPass = subjectAvgs.every(s => s.avg === null || s.avg >= 7)

            return { avg: globalAvg, allPass, subjectAvgs }
          }

          return (
            <div className="space-y-5">
              <div className="p-5 bg-surface rounded-2xl border border-surface2 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px] space-y-1">
                  <label className="text-xs text-ink4 font-medium px-1">Curso a Evaluar</label>
                  <select value={promoCourseId} onChange={e => setPromoCourseId(e.target.value)}
                    className="w-full bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet">
                    {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.parallel}</option>)}
                  </select>
                </div>
                <div className="text-xs text-ink3">
                  <b>Nota mínima para aprobar:</b> 7.00 · <b>Estudiantes:</b> {promoStudents.length}
                </div>
              </div>

              {promoStudents.length === 0 ? (
                <div className="p-10 text-center text-ink3 bg-surface rounded-2xl border border-surface2">
                  <ArrowUpCircle size={36} className="mx-auto mb-3 text-ink4 opacity-40" />
                  <p className="font-semibold text-sm">No hay estudiantes matriculados en este curso</p>
                </div>
              ) : (
                <div className="bg-surface rounded-2xl border border-surface2 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-bg text-ink3 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-3 font-medium">Estudiante</th>
                        {courseSubjects.map((s: any) => (
                          <th key={s.id} className="px-3 py-3 font-medium text-center" title={s.name}>
                            {s.name.length > 10 ? s.name.slice(0, 8) + '…' : s.name}
                          </th>
                        ))}
                        <th className="px-3 py-3 font-medium text-center">Promedio</th>
                        <th className="px-3 py-3 font-medium text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface">
                      {promoStudents.map((student: any) => {
                        const { avg, allPass, subjectAvgs } = getStudentAnnualAvg(student.id)
                        return (
                          <tr key={student.id} className="hover:bg-bg/50 transition-colors">
                            <td className="px-5 py-3">
                              <div className="font-medium">{student.full_name}</div>
                            </td>
                            {subjectAvgs.map((sa, i) => (
                              <td key={i} className={`px-3 py-3 text-center font-semibold ${sa.avg !== null && sa.avg < 7 ? 'text-red-500' : sa.avg !== null && sa.avg >= 9 ? 'text-emerald-500' : ''}`}>
                                {sa.avg !== null ? sa.avg.toFixed(1) : '—'}
                              </td>
                            ))}
                            <td className={`px-3 py-3 text-center font-bold text-base ${avg !== null && avg < 7 ? 'text-red-500' : avg !== null && avg >= 7 ? 'text-emerald-600' : ''}`}>
                              {avg !== null ? avg.toFixed(2) : '—'}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {avg === null ? (
                                <span className="text-xs text-ink4">Sin datos</span>
                              ) : allPass ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                                  <CheckCircle2 size={12} /> Aprobado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                                  <XCircle size={12} /> Reprobado
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

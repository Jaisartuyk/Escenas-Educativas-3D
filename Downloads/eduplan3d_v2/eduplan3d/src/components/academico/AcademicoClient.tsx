'use client'

import { useState } from 'react'
import { Users, BookOpen, ChevronDown, ChevronRight, GraduationCap, Clock, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PersonalClient } from './PersonalClient'

interface Props {
  initialCourses: any[]
  initialStudents: any[]
  initialSubjects: any[]
  initialEnrollments: any[]
  teachers: any[]
  horariosDocentes: any[]
  institutionId: string
  directoryMetadata: any
  tutores: Record<string, string>
}

export function AcademicoClient({
  initialCourses, initialStudents, initialSubjects, initialEnrollments,
  teachers, horariosDocentes, institutionId, directoryMetadata, tutores
}: Props) {
  const [activeTab, setActiveTab] = useState<'cursos' | 'matriculas' | 'personal'>('cursos')
  const [courses]    = useState(initialCourses)
  const [subjects]   = useState(initialSubjects)
  const [enrollments, setEnrollments] = useState(initialEnrollments)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
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
          />
        )}
      </div>
    </div>
  )
}

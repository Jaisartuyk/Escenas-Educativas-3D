'use client'

import { useState } from 'react'
import { Plus, Users, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
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
}

export function AcademicoClient({ initialCourses, initialStudents, initialSubjects, initialEnrollments, teachers, horariosDocentes, institutionId, directoryMetadata }: Props) {
  const [activeTab, setActiveTab] = useState<'cursos' | 'matriculas' | 'personal'>('cursos')
  const [courses, setCourses] = useState(initialCourses)
  const [subjects, setSubjects] = useState(initialSubjects)
  const [enrollments, setEnrollments] = useState(initialEnrollments)
  const supabase = createClient()

  // Acciones Matrículas
  async function handleEnrollmentChange(student_id: string, course_id: string) {
    const isEnrolled = enrollments.some((e: any) => e.student_id === student_id && e.course_id === course_id)
    let newEnrolls = [...enrollments]
    
    if (isEnrolled) {
      newEnrolls = newEnrolls.filter((e: any) => !(e.student_id === student_id && e.course_id === course_id))
      setEnrollments(newEnrolls)
      await supabase.from('enrollments').delete().match({ student_id, course_id })
    } else {
      newEnrolls.push({ student_id, course_id })
      setEnrollments(newEnrolls)
      // @ts-ignore - Bypass never generic errors
      await supabase.from('enrollments').insert({ student_id, course_id })
    }
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-surface">
        <button onClick={() => setActiveTab('cursos')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'cursos' ? 'border-violet text-violet font-bold' : 'border-transparent text-ink3 hover:text-ink2 hover:border-surface2'}`}>Cursos y Materias</button>
        <button onClick={() => setActiveTab('matriculas')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'matriculas' ? 'border-teal text-teal font-bold' : 'border-transparent text-ink3 hover:text-ink2 hover:border-surface2'}`}>Nómina (Vincular)</button>
        <button onClick={() => setActiveTab('personal')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'personal' ? 'border-[#F8D25A] text-[#F8D25A] font-bold' : 'border-transparent text-ink3 hover:text-ink2 hover:border-surface2'}`}>Gestión de Cuentas (Crear)</button>
      </div>

      <div className="mt-8">
        {activeTab === 'cursos' && (
           <div className="bg-surface rounded-2xl border border-[rgba(255,255,255,0.02)] p-6">
             <div className="mb-6">
               <h3 className="font-display font-bold text-lg">Cursos Sincronizados</h3>
               <p className="text-xs text-ink3 mt-1">Los cursos y las materias ahora se manipulan visualmente desde el <span className="text-violet font-semibold">Generador de Horarios</span> para evitar duplicaciones. Cada vez que construyas y guardes tu Horario, los Cursos aparecerán automáticamente aquí listos para Matricular a tus Alumnos.</p>
             </div>
             
             <div className="flex flex-wrap gap-3">
               {courses.map((course: any) => (
                 <div key={course.id} className="px-5 py-3 border border-surface2 bg-bg rounded-xl font-medium text-sm flex items-center gap-2">
                   <BookOpen size={16} className="text-violet" /> {course.name}
                 </div>
               ))}
               {courses.length === 0 && <span className="text-xs text-ink4 italic border border-dashed border-surface2 px-4 py-3 rounded-xl w-full text-center">Configura las etiquetas de tus cursos en el Generador de Horarios.</span>}
             </div>
           </div>
        )}

        {activeTab === 'matriculas' && (
          <div className="bg-surface rounded-2xl border border-[rgba(255,255,255,0.02)] overflow-hidden">
            <div className="p-4 border-b border-surface2 flex justify-between items-center">
              <h3 className="font-bold text-ink flex items-center gap-2"><Users size={18} className="text-teal"/> Nómina Estudiantil</h3>
              <p className="text-xs text-ink3">Selecciona los cursos a los que pertenece cada estudiante.</p>
            </div>
            {initialStudents.length === 0 ? (
              <div className="p-8 text-center text-ink4 text-sm">No hay estudiantes unidos a la institución. Entrégales el código de invitación.</div>
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
                    const studentEnrolls = enrollments.filter((e:any) => e.student_id === student.id).map((e:any) => e.course_id)
                    return (
                      <tr key={student.id} className="hover:bg-bg/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-ink">{student.full_name}</div>
                          <div className="text-xs text-ink4">{student.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {courses.map((course: any) => {
                                const isEnrolled = studentEnrolls.includes(course.id)
                                return (
                                  <button 
                                    key={course.id} 
                                    onClick={() => handleEnrollmentChange(student.id, course.id)}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${isEnrolled ? 'bg-teal/10 text-teal border-teal/20 shadow-[0_0_8px_rgba(38,215,180,0.15)]' : 'bg-bg text-ink4 border-surface hover:border-surface2'}`}
                                  >
                                    {course.name}
                                  </button>
                                )
                            })}
                            {courses.length === 0 && <span className="text-xs text-ink4 italic">Debes crear cursos primero</span>}
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

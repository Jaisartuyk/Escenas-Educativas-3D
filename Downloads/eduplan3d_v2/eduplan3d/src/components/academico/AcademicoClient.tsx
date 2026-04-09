'use client'

import { useState } from 'react'
import { Plus, Users, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/lib/supabase/client'
import { PersonalClient } from './PersonalClient'

export function AcademicoClient({ initialCourses, initialStudents, initialSubjects, initialEnrollments, teachers, horariosDocentes, institutionId }: any) {
  const [activeTab, setActiveTab] = useState<'cursos' | 'matriculas' | 'personal'>('cursos')
  const [courses, setCourses] = useState(initialCourses)
  const [subjects, setSubjects] = useState(initialSubjects)
  const [enrollments, setEnrollments] = useState(initialEnrollments)
  const supabase = createClient()

  const [newCourseName, setNewCourseName] = useState('')
  const [addingSubjectForCourse, setAddingSubjectForCourse] = useState<string | null>(null)
  const [newSubject, setNewSubject] = useState({ name: '', teacher_id: '', weekly_hours: 1 })

  // Acciones Cursos
  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault()
    if (!newCourseName.trim()) return
    const id = uuidv4()
    const newCourse = { id, institution_id: institutionId, name: newCourseName.trim(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    
    // Optimistic UI
    setCourses([...courses, newCourse])
    setNewCourseName('')
    
    // @ts-ignore - Bypass never generic errors
    const { error } = await supabase.from('courses').insert(newCourse)
    if (error) { toast.error('Error al crear curso'); setCourses(courses) }
    else toast.success('Curso creado')
  }

  // Acciones Materias
  async function handleCreateSubject(e: React.FormEvent) {
    e.preventDefault()
    if (!newSubject.name.trim() || !newSubject.teacher_id) return
    const id = uuidv4()
    const teacher = teachers.find((t: any) => t.id === newSubject.teacher_id)
    const newSubj = { 
      id, course_id: addingSubjectForCourse, teacher_id: newSubject.teacher_id, name: newSubject.name, weekly_hours: newSubject.weekly_hours,
      teacher: { full_name: teacher.full_name, email: teacher.email } // para la UI
    }
    
    // Optimistic UI
    setSubjects([...subjects, newSubj])
    setAddingSubjectForCourse(null)
    setNewSubject({ name: '', teacher_id: '', weekly_hours: 1 })

    // @ts-ignore - Bypass never generic errors
    const { error } = await supabase.from('subjects').insert({ id, course_id: newSubj.course_id, teacher_id: newSubj.teacher_id, name: newSubj.name, weekly_hours: newSubj.weekly_hours })
    if (error) toast.error('Error al crear materia')
  }

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
          <div className="space-y-6">
            {/* Form Crear Curso */}
            <form onSubmit={handleCreateCourse} className="flex gap-4 p-4 bg-surface rounded-2xl border border-[rgba(255,255,255,0.02)]">
              <input type="text" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} placeholder="Ej. 1RO BGU Paralelo A" className="flex-1 bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet transition-colors" />
              <button type="submit" className="bg-violet hover:bg-violet2 text-white px-6 py-2 rounded-xl text-sm font-medium transition-all shadow-glow flex items-center gap-2"><Plus size={16}/> Crear Curso</button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.map((course: any) => (
                <div key={course.id} className="p-5 border border-surface bg-bg rounded-2xl">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-surface/50">
                    <h3 className="font-bold text-lg text-ink font-display flex items-center gap-2"><BookOpen size={18} className="text-violet" /> {course.name} {course.parallel}</h3>
                    <span className="text-xs text-ink3">{subjects.filter((s:any)=>s.course_id === course.id).length} materias</span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    {subjects.filter((s:any)=>s.course_id === course.id).map((sub: any) => (
                      <div key={sub.id} className="flex items-center justify-between p-3 bg-surface rounded-xl text-sm border border-[rgba(255,255,255,0.02)]">
                        <span className="font-medium text-ink2">{sub.name} <span className="text-xs text-ink4 ml-2">{sub.weekly_hours}h/sem</span></span>
                        <span className="text-xs text-violet2 bg-violet/10 px-2 py-1 rounded-md">{sub.teacher?.full_name || 'Sin docente'}</span>
                      </div>
                    ))}
                    {subjects.filter((s:any)=>s.course_id === course.id).length === 0 && <p className="text-xs text-ink4 text-center py-2">No hay materias aún</p>}
                  </div>

                  {addingSubjectForCourse === course.id ? (
                    <form onSubmit={handleCreateSubject} className="space-y-3 bg-surface p-3 rounded-xl">
                      <input type="text" required value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} placeholder="Nombre materia" className="w-full bg-bg border border-transparent rounded-lg px-3 py-2 text-sm outline-none focus:border-violet" />
                      <div className="flex gap-2">
                        <select required value={newSubject.teacher_id} onChange={e => setNewSubject({...newSubject, teacher_id: e.target.value})} className="flex-1 bg-bg border border-transparent rounded-lg px-3 py-2 text-sm text-ink3 outline-none focus:border-violet">
                          <option value="">Seleccionar docente...</option>
                          {teachers.map((t:any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                        </select>
                        <input type="number" min="1" max="20" required value={newSubject.weekly_hours} onChange={e => setNewSubject({...newSubject, weekly_hours: parseInt(e.target.value)})} className="w-16 bg-bg border border-transparent rounded-lg px-3 py-2 text-sm outline-none focus:border-violet text-center" title="Horas Semanales" />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setAddingSubjectForCourse(null)} className="text-xs text-ink3 px-3 py-2 hover:text-ink">Cancelar</button>
                        <button type="submit" className="text-xs bg-teal text-[#04342C] font-bold px-3 py-2 rounded-lg">Guardar</button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => setAddingSubjectForCourse(course.id)} className="w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-ink3 hover:text-ink hover:bg-surface rounded-xl transition-colors border border-dashed border-surface2">
                      <Plus size={14} /> Añadir Materia
                    </button>
                  )}
                </div>
              ))}
              {courses.length === 0 && <div className="col-span-full py-12 text-center text-ink4 font-medium">Crea tu primer curso arriba para empezar.</div>}
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
           <PersonalClient institutionId={institutionId} teachers={teachers} students={initialStudents} horariosDocentes={horariosDocentes} />
        )}
      </div>
    </div>
  )
}

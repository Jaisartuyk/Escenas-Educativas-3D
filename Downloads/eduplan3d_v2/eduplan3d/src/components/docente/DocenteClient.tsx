'use client'

import { useState } from 'react'
import { BookOpen, FileText, Plus, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/lib/supabase/client'

export function DocenteClient({ initialSubjects, enrollments, initialAssignments, initialGrades, teacherId }: any) {
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(initialSubjects.length > 0 ? initialSubjects[0].id : null)
  const [assignments, setAssignments] = useState(initialAssignments)
  const [grades, setGrades] = useState(initialGrades)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [editingGrades, setEditingGrades] = useState<Record<string, string>>({}) // "assignId_studentId" -> "score"

  const supabase = createClient()

  const activeSubject = initialSubjects.find((s:any) => s.id === activeSubjectId)
  const activeCourseId = activeSubject?.course?.id
  const studentsInCourse = enrollments.filter((e:any) => e.course_id === activeCourseId).map((e:any) => e.student)
  const activeAssignments = assignments.filter((a:any) => a.subject_id === activeSubjectId)

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !activeSubjectId) return

    const id = uuidv4()
    const newAsg = { id, subject_id: activeSubjectId, title: newTitle, description: newDesc, due_date: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    
    setAssignments([newAsg, ...assignments])
    setNewTitle('')
    setNewDesc('')

    const { error } = await supabase.from('assignments').insert(newAsg as any)
    if (error) toast.error('Error al crear tarea')
    else toast.success('Tarea publicada')
  }

  function handleGradeChange(assignmentId: string, studentId: string, value: string) {
    const key = `${assignmentId}_${studentId}`
    setEditingGrades(prev => ({ ...prev, [key]: value }))
  }

  async function handleSaveGrade(assignmentId: string, studentId: string) {
    const key = `${assignmentId}_${studentId}`
    const valObj = editingGrades[key]
    if (valObj === undefined) return
    const score = parseFloat(valObj)
    if (isNaN(score)) return

    // Find existing grade
    const existing = grades.find((g:any) => g.assignment_id === assignmentId && g.student_id === studentId)
    
    // Optimistic UI
    if (existing) {
      setGrades(grades.map((g:any) => g.id === existing.id ? { ...g, score } : g))
      await supabase.from('grades').update({ score } as any).eq('id', existing.id)
    } else {
      const id = uuidv4()
      const newGrade = { id, assignment_id: assignmentId, student_id: studentId, score, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      setGrades([...grades, newGrade])
      await supabase.from('grades').insert(newGrade as any)
    }
    
    const newEditing = {...editingGrades}
    delete newEditing[key]
    setEditingGrades(newEditing)
    toast.success('Nota guardada', { icon: '📝' })
  }

  function getGrade(assignmentId: string, studentId: string) {
    const existing = grades.find((g:any) => g.assignment_id === assignmentId && g.student_id === studentId)
    return existing ? existing.score : ''
  }

  if (initialSubjects.length === 0) {
    return <div className="p-12 text-center text-ink3 bg-surface rounded-3xl border border-surface2">No tienes materias asignadas actualmente. El administrador debe asignarte al menos una en la pestaña Académico.</div>
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar de Materias */}
      <div className="w-full md:w-64 space-y-2 flex-shrink-0">
        <h3 className="text-xs uppercase font-bold text-ink4 mb-4 tracking-wider">Mis Materias</h3>
        {initialSubjects.map((sub: any) => (
          <button 
            key={sub.id} 
            onClick={() => setActiveSubjectId(sub.id)}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all border flex items-center gap-3 ${activeSubjectId === sub.id ? 'bg-violet/10 border-violet/30 text-violet shadow-glow' : 'bg-surface border-transparent text-ink3 hover:text-ink hover:bg-surface2'}`}
          >
            <BookOpen size={16} />
            <div>
              <div className="font-bold text-sm">{sub.name}</div>
              <div className="text-[10px] opacity-70">{sub.course.name} {sub.course.parallel}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Contenido de la Materia */}
      <div className="flex-1 space-y-6">
        <div className="flex gap-4 p-4 bg-surface rounded-2xl border border-[rgba(255,255,255,0.02)]">
          <form className="flex-1 space-y-3" onSubmit={handleCreateAssignment}>
             <h3 className="text-sm font-bold text-ink">Crear nueva tarea en {activeSubject?.name}</h3>
             <input required type="text" value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Ej. Ensayo sobre la célula" className="w-full bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet transition-colors" />
             <div className="flex gap-3">
               <input type="text" value={newDesc} onChange={e=>setNewDesc(e.target.value)} placeholder="Descripción opcional" className="flex-1 bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet transition-colors" />
               <button type="submit" className="bg-violet hover:bg-violet2 text-white px-6 py-2 rounded-xl text-sm font-medium transition-all shadow-glow flex items-center gap-2 flex-shrink-0"><Plus size={16}/> Publicar Tarea</button>
             </div>
          </form>
        </div>

        {/* Creador de notas tipo tabla Excel */}
        {activeAssignments.length === 0 ? (
          <div className="p-8 text-center text-ink4 border border-dashed border-surface2 rounded-2xl">Aún no hay tareas publicadas en esta materia.</div>
        ) : (
          <div className="bg-surface rounded-2xl border border-[rgba(255,255,255,0.02)] overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-max">
              <thead className="bg-[#1a1b26] text-ink3 text-xs uppercase tracking-wider relative border-b border-surface2">
                <tr>
                  <th className="px-4 py-3 font-bold sticky left-0 bg-[#1a1b26] z-10 w-48 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">Estudiante</th>
                  {activeAssignments.map((a:any) => (
                    <th key={a.id} className="px-4 py-3 font-medium min-w-[120px]">
                      <div className="text-violet2 truncate w-32" title={a.title}>{a.title}</div>
                      <div className="text-[9px] text-ink5 mt-0.5">{new Date(a.created_at).toLocaleDateString()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface relative">
                {studentsInCourse.map((student: any) => (
                  <tr key={student.id} className="hover:bg-bg/40 transition-colors">
                    <td className="px-4 py-3 sticky left-0 bg-surface hover:bg-bg/40 z-10 w-48 shadow-[2px_0_4px_rgba(0,0,0,0.05)] border-r border-surface/50">
                      <div className="font-bold text-ink text-xs truncate" title={student.full_name}>{student.full_name}</div>
                    </td>
                    {activeAssignments.map((a:any) => {
                      const key = `${a.id}_${student.id}`
                      const isEditing = editingGrades[key] !== undefined
                      const currentVal = isEditing ? editingGrades[key] : getGrade(a.id, student.id)
                      return (
                        <td key={a.id} className="px-4 py-2 border-l border-surface/30">
                           <div className="flex items-center gap-1">
                             <input 
                               type="number" 
                               min="0" max="10" step="0.01"
                               value={currentVal}
                               onChange={(e) => handleGradeChange(a.id, student.id, e.target.value)}
                               onBlur={() => handleSaveGrade(a.id, student.id)}
                               onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
                               placeholder="-"
                               className={`w-16 h-8 text-center text-sm font-bold bg-transparent border-b-2 rounded-none outline-none transition-all ${isEditing ? 'border-teal text-teal' : currentVal !== '' ? 'border-violet/20 text-ink' : 'border-transparent text-ink4 hover:border-surface2'}`}
                             />
                           </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {studentsInCourse.length === 0 && (
                  <tr><td colSpan={activeAssignments.length + 1} className="p-4 text-center text-ink4 italic">No hay estudiantes matriculados en este curso aún.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

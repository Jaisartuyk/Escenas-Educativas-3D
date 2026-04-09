'use client'

import { useState } from 'react'
import { BookOpen, CheckCircle, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/lib/supabase/client'

export function AlumnoClient({ courses, subjects, assignments, initialGrades, studentId }: any) {
  const [grades, setGrades] = useState(initialGrades)
  const [submittingAsg, setSubmittingAsg] = useState<string | null>(null)
  const [submissionUrl, setSubmissionUrl] = useState('')

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent, assignmentId: string) {
    e.preventDefault()
    if (!submissionUrl.trim()) return

    const existingId = grades.find((g:any) => g.assignment_id === assignmentId)?.id
    
    // optimistically update UI
    let newGrades = [...grades]
    if (existingId) {
       newGrades = newGrades.map(g => g.id === existingId ? { ...g, submitted_url: submissionUrl } : g)
       setGrades(newGrades)
       setSubmittingAsg(null)
       toast.success('Entrega actualizada')
       // @ts-ignore
       await supabase.from('grades').update({ submitted_url: submissionUrl }).eq('id', existingId)
    } else {
       const id = uuidv4()
       const newGrade = { id, assignment_id: assignmentId, student_id: studentId, score: null, submitted_url: submissionUrl, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
       setGrades([...grades, newGrade])
       setSubmittingAsg(null)
       toast.success('Tarea entregada correctamente')
       // @ts-ignore
       await supabase.from('grades').insert(newGrade)
    }
    setSubmissionUrl('')
  }

  function getMyGrade(assignmentId: string) {
    return grades.find((g:any) => g.assignment_id === assignmentId)
  }

  if (courses.length === 0) {
    return <div className="p-12 text-center text-ink3 bg-surface rounded-3xl border border-surface2">No estás matriculado en ningún curso aún.</div>
  }

  return (
    <div className="space-y-8">
      {courses.map((course: any) => {
        const courseSubjects = subjects.filter((s:any) => s.course_id === course.id)
        
        return (
          <div key={course.id} className="bg-surface rounded-2xl border border-[rgba(0,0,0,0.02)] overflow-hidden">
             <div className="bg-bg3 p-5 border-b border-surface2">
                <h2 className="text-lg font-bold font-display text-ink flex items-center gap-2"><BookOpen size={20} className="text-violet"/> {course.name} {course.parallel}</h2>
             </div>
             
             <div className="p-5 space-y-6">
                {courseSubjects.map((sub:any) => {
                  const subjectAssignments = assignments.filter((a:any) => a.subject_id === sub.id)
                  
                  return (
                    <div key={sub.id} className="border border-surface2 rounded-xl p-4 bg-bg">
                       <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-ink2">{sub.name}</h3>
                         <span className="text-xs text-ink4">Prof: {sub.teacher?.full_name}</span>
                       </div>
                       
                       <div className="space-y-3">
                         {subjectAssignments.map((asg:any) => {
                           const myData = getMyGrade(asg.id)
                           const isGraded = myData && myData.score !== null
                           const isSubmitted = myData && myData.submitted_url
                           
                           return (
                             <div key={asg.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 bg-surface rounded-lg">
                                <div>
                                  <h4 className="text-sm font-semibold text-ink2">{asg.title}</h4>
                                  {asg.description && <p className="text-xs text-ink4 mt-1">{asg.description}</p>}
                                </div>
                                
                                <div className="flex items-center gap-4">
                                   {/* Score badge */}
                                   {isGraded ? (
                                      <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-ink3 uppercase tracking-wider">Calificación</span>
                                        <span className="font-bold text-teal text-lg">{myData.score} <span className="text-xs text-ink4 font-normal">/10</span></span>
                                      </div>
                                   ) : (
                                      <span className="text-xs text-ink4">Sin calificar</span>
                                   )}
                                   
                                   {/* Submission box */}
                                   <div className="min-w-[200px]">
                                     {submittingAsg === asg.id ? (
                                        <form onSubmit={(e) => handleSubmit(e, asg.id)} className="flex gap-2">
                                          <input required type="url" placeholder="Pega el link de tu trabajo..." autoFocus value={submissionUrl} onChange={e=>setSubmissionUrl(e.target.value)} className="w-full bg-bg border border-violet/30 rounded-lg px-3 py-1.5 text-xs text-ink outline-none focus:border-violet transition-colors" />
                                          <button type="submit" className="bg-violet hover:bg-violet2 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-glow">Enviar</button>
                                        </form>
                                     ) : (
                                       <div className="flex flex-col items-end gap-2">
                                          {isSubmitted ? (
                                             <div className="flex items-center gap-2 text-xs text-teal bg-teal/10 px-3 py-1.5 rounded-lg border border-teal/20">
                                               <CheckCircle size={14}/> Entregado
                                             </div>
                                          ) : (
                                            <button onClick={() => { setSubmittingAsg(asg.id); setSubmissionUrl(myData?.submitted_url || '') }} className="flex items-center gap-2 text-xs font-medium text-violet hover:text-violet2 bg-violet/10 hover:bg-violet/20 px-3 py-1.5 rounded-lg transition-colors border border-violet/20">
                                              <Upload size={14}/> {isSubmitted ? 'Actualizar entrega' : 'Subir tarea'}
                                            </button>
                                          )}
                                       </div>
                                     )}
                                   </div>
                                </div>
                             </div>
                           )
                         })}
                         {subjectAssignments.length === 0 && <div className="text-xs text-ink4 italic py-2">No hay tareas pendientes en esta materia.</div>}
                       </div>
                    </div>
                  )
                })}
             </div>
          </div>
        )
      })}
    </div>
  )
}

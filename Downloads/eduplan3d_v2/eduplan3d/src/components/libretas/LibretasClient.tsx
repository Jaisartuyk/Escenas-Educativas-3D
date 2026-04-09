'use client'

import { useState } from 'react'
import { Printer, UserCircle } from 'lucide-react'

export function LibretasClient({ role, institutionName, courses, students, subjects, assignments, grades }: any) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses.length > 0 ? courses[0].id : '')
  const [selectedStudentId, setSelectedStudentId] = useState<string>(role === 'student' ? students[0]?.id : '')

  // Encontrar la lista de estudiantes para el curso seleccionado (solo si soy admin/docente)
  const studentsInCourse = role === 'student' ? students : students.filter((st:any) => true) // Por simplicidad, todos los students listados temporalmente
  // Idealmente en el page.tsx sacamos solo los enlazados, o aquí lo cruzamos.

  const currentCourse = courses.find((c:any) => c.id === selectedCourseId)
  const currentStudent = students.find((s:any) => s.id === selectedStudentId)

  // Filtrar las materias que corresponden al estudiante (según el curso en el que asumimos está viendo la libreta)
  const courseSubjects = role === 'student' 
    ? subjects // Ya vinieron filtradas a las de mis cursos
    : subjects.filter((s:any) => s.course_id === selectedCourseId)

  const subjectAverages = courseSubjects.map((sub: any) => {
    // Buscar tareas de esta materia
    const subAssignments = assignments.filter((a:any) => a.subject_id === sub.id)
    if (subAssignments.length === 0) return { subject: sub.name, avg: null }

    // Buscar notas de ese estudiante en estas tareas
    let totalScore = 0
    let gradedCount = 0

    subAssignments.forEach((asg: any) => {
      const g = grades.find((gr:any) => gr.assignment_id === asg.id && gr.student_id === selectedStudentId)
      if (g && g.score !== null) {
        totalScore += parseFloat(g.score)
        gradedCount++
      }
    })

    const avg = gradedCount === 0 ? null : (totalScore / gradedCount).toFixed(2)
    return { subject: sub.name, avg }
  })

  const globalTotal = subjectAverages.reduce((acc: number, curr: any) => acc + (curr.avg ? parseFloat(curr.avg) : 0), 0)
  const countWithGrades = subjectAverages.filter((s:any) => s.avg !== null).length
  const finalGPA = countWithGrades === 0 ? null : (globalTotal / countWithGrades).toFixed(2)

  return (
    <div className="space-y-6">
      {/* Controles (ocultos en impresión) */}
      <div className="print:hidden p-5 bg-surface rounded-2xl border border-[rgba(0,0,0,0.02)] flex flex-wrap gap-4 items-end">
        {role !== 'student' && (
          <div className="flex-1 min-w-[200px] space-y-1">
             <label className="text-xs text-ink4 font-medium px-1">Seleccionar Curso</label>
             <select value={selectedCourseId} onChange={e=>setSelectedCourseId(e.target.value)} className="w-full bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet">
               <option value="" disabled>Elige un curso...</option>
               {courses.map((c:any) => <option key={c.id} value={c.id}>{c.name} {c.parallel}</option>)}
             </select>
          </div>
        )}
        
        {role !== 'student' && (
          <div className="flex-1 min-w-[200px] space-y-1">
             <label className="text-xs text-ink4 font-medium px-1">Estudiante</label>
             <select value={selectedStudentId} onChange={e=>setSelectedStudentId(e.target.value)} className="w-full bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet">
               <option value="" disabled>Elige un estudiante...</option>
               {students.map((s:any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
             </select>
          </div>
        )}

        <button 
           onClick={() => window.print()}
           disabled={!selectedCourseId && role !== 'student'}
           className="bg-violet hover:bg-violet2 disabled:opacity-50 text-white px-6 py-2 h-10 rounded-xl text-sm font-medium transition-all shadow-glow flex items-center gap-2"
        >
           <Printer size={16}/> Imprimir Boletín
        </button>
      </div>

      {/* Papel de Imprimir */}
      {selectedStudentId && (role === 'student' || currentCourse) ? (
        <div className="bg-white text-black p-8 rounded-xl shadow-lg border border-transparent print:shadow-none print:p-0">
          
          <div className="text-center border-b-2 border-black pb-4 mb-6">
             <h2 className="text-2xl font-bold uppercase tracking-wider">{institutionName || 'Unidad Educativa'}</h2>
             <p className="text-sm font-semibold tracking-widest text-gray-500 mt-1">BOLETÍN DE CALIFICACIONES</p>
          </div>

          <div className="flex justify-between items-end mb-6 text-sm">
             <div>
                <p><span className="font-bold">Estudiante:</span> {currentStudent?.full_name}</p>
                {role !== 'student' && <p><span className="font-bold">Curso:</span> {currentCourse?.name} {currentCourse?.parallel}</p>}
             </div>
             <div className="text-right">
                <p><span className="font-bold">Fecha:</span> {new Date().toLocaleDateString()}</p>
             </div>
          </div>

          <table className="w-full text-left text-sm border-collapse border border-gray-300">
             <thead>
               <tr className="bg-gray-100">
                 <th className="border border-gray-300 px-4 py-2 font-bold w-2/3">Asignatura</th>
                 <th className="border border-gray-300 px-4 py-2 font-bold text-center">Promedio (10)</th>
               </tr>
             </thead>
             <tbody>
                {subjectAverages.map((sub:any, i:number) => {
                  const val = sub.avg ? parseFloat(sub.avg) : null
                  const isLow = val !== null && val < 7
                  return (
                    <tr key={i}>
                      <td className="border border-gray-300 px-4 py-2 font-medium">{sub.subject}</td>
                      <td className={`border border-gray-300 px-4 py-2 text-center font-bold ${isLow ? 'text-red-600' : ''}`}>
                         {sub.avg || '-'}
                      </td>
                    </tr>
                  )
                })}
             </tbody>
             <tfoot>
                <tr className="bg-gray-100">
                   <td className="border border-gray-300 px-4 py-3 font-bold text-right uppercase text-xs">Promedio General</td>
                   <td className="border border-gray-300 px-4 py-3 text-center font-bold text-lg">
                      {finalGPA || '-'}
                   </td>
                </tr>
             </tfoot>
          </table>

          <div className="mt-24 flex justify-around text-xs font-bold uppercase text-gray-500">
             <div className="text-center">
                <div className="w-48 border-t border-gray-500 pt-2">Firma del Rector/a</div>
             </div>
             <div className="text-center">
                <div className="w-48 border-t border-gray-500 pt-2">Firma del Representante</div>
             </div>
          </div>

        </div>
      ) : (
        <div className="p-12 text-center text-ink3">Por favor selecciona un curso y un estudiante para visualizar su reporte de notas.</div>
      )}

    </div>
  )
}

'use client'

import { useState, useMemo, useTransition } from 'react'
import { Printer, FileText, Eye, EyeOff } from 'lucide-react'
import { updateLibretasVisibility } from '@/lib/actions/institution'
import { isQualitativeSubject, getQualitativeGradeForNumber } from '@/lib/qualitative-grades'
import { calculateWeightedAssignmentAverage } from '@/lib/grade-calculations'
import toast from 'react-hot-toast'

// â”€â”€ Escala cualitativa MINEDUC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function cualitativo(score: number | null): string {
  if (score === null) return ''
  if (score >= 9) return 'DAR'    // Domina los aprendizajes
  if (score >= 7) return 'AAR'    // Alcanza los aprendizajes
  if (score >= 4.01) return 'PAR' // Proximo a alcanzar
  return 'NAAR'                   // No alcanza los aprendizajes
}

function comportamientoLetra(positive: number, negative: number): string {
  const ratio = positive + negative > 0 ? positive / (positive + negative) : 1
  if (ratio >= 0.9) return 'S'  // Satisfactorio
  if (ratio >= 0.7) return 'F'  // Favorable (en proceso)
  if (ratio >= 0.5) return 'U'  // Poco satisfactorio
  return 'N'                    // Necesita mejora
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface Props {
  role: string
  institutionName: string
  courses: any[]
  enrollments: any[]
  subjects: any[]
  assignments: any[]
  grades: any[]
  categories: any[]
  currentUserId: string
  parcialesCount?: number
  tutores?: Record<string, string>
  attendance?: any[]
  behaviors?: any[]
  libretasPublished?: boolean
  institutionId?: string
}

export function LibretasClient({
  role, institutionName, courses, enrollments, subjects, assignments, grades,
  categories, currentUserId, parcialesCount = 2, tutores = {},
  attendance = [], behaviors = [], libretasPublished = false, institutionId,
}: Props) {
  const isFamilyRole = role === 'student' || role === 'parent'
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '')
  const [selectedStudentId, setSelectedStudentId] = useState<string>(isFamilyRole ? currentUserId : '')
  const [trimestre, setTrimestre] = useState(1)
  const [view, setView] = useState<'mensual' | 'trimestral' | 'anual'>('mensual')
  const [parcialSel, setParcialSel] = useState(1)
  
  const [isPending, startTransition] = useTransition()
  const [isPublished, setIsPublished] = useState(libretasPublished)

  const handleTogglePublish = () => {
    if (!institutionId) return
    const newState = !isPublished
    setIsPublished(newState)
    startTransition(async () => {
      const { error } = await updateLibretasVisibility(institutionId, newState)
      if (error) {
        toast.error('Error al actualizar: ' + error)
        setIsPublished(!newState) // revert
      } else {
        toast.success(newState ? 'Libretas visibles para padres' : 'Libretas ocultas para padres')
      }
    })
  }

  // â”€â”€ Derived data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const studentsInCourse = useMemo(() => {
    if (isFamilyRole) return enrollments.map((e: any) => e.student).filter(Boolean)
    return enrollments
      .filter((e: any) => e.course_id === selectedCourseId)
      .map((e: any) => e.student).filter(Boolean)
      .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''))
  }, [enrollments, selectedCourseId, isFamilyRole])

  const courseSubjects = useMemo(() => {
    if (isFamilyRole) {
      const myCourseIds = enrollments.map((e: any) => e.course_id)
      return subjects.filter((s: any) => myCourseIds.includes(s.course_id))
    }
    return subjects.filter((s: any) => s.course_id === selectedCourseId)
  }, [subjects, selectedCourseId, enrollments, isFamilyRole])

  const currentCourse = courses.find((c: any) => c.id === selectedCourseId)
  const currentStudent = studentsInCourse.find((s: any) => s.id === selectedStudentId)

  // â”€â”€ Grade helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function getGrade(assignmentId: string, studentId: string): number | null {
    const g = grades.find((gr: any) => gr.assignment_id === assignmentId && gr.student_id === studentId)
    return g?.score != null ? Number(g.score) : null
  }

  function getCatAvg(studentId: string, subjectId: string, t: number, p: number, catId: string | null): number | null {
    const asgs = assignments.filter((a: any) =>
      String(a.subject_id) === String(subjectId) && Number(a.trimestre) === t && Number(a.parcial) === p
      && (catId ? String(a.category_id) === String(catId) : !a.category_id)
    )
    const scores = asgs.map(a => getGrade(a.id, studentId)).filter((g): g is number => g !== null)
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  }

  function getParcialAvg(studentId: string, subjectId: string, t: number, p: number): number | null {
    const pAsgs = assignments.filter((a: any) =>
      String(a.subject_id) === String(subjectId) && Number(a.trimestre) === t && Number(a.parcial) === p
    )
    return calculateWeightedAssignmentAverage(
      pAsgs,
      categories,
      (assignment: any) => getGrade(assignment.id, studentId),
    )
  }

  function getExamScore(studentId: string, subjectId: string, t: number): number | null {
    const examAsgs = assignments.filter((a: any) =>
      String(a.subject_id) === String(subjectId) && Number(a.trimestre) === t && Number(a.parcial) === 0
    )
    const scores = examAsgs.map(a => getGrade(a.id, studentId)).filter((g): g is number => g !== null)
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  }

  function getParcialMean(studentId: string, subjectId: string, t: number): number | null {
    const avgs: number[] = []
    for (let p = 1; p <= parcialesCount; p++) {
      const a = getParcialAvg(studentId, subjectId, t, p)
      if (a !== null) avgs.push(a)
    }
    return avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null
  }

  function getTrimestreAvg(studentId: string, subjectId: string, t: number): number | null {
    const pm = getParcialMean(studentId, subjectId, t)
    const exam = getExamScore(studentId, subjectId, t)
    if (pm !== null && exam !== null) return pm * 0.7 + exam * 0.3
    return pm
  }

  function getAnnualAvg(studentId: string, subjectId: string): number | null {
    const avgs: number[] = []
    for (let t = 1; t <= 3; t++) {
      const a = getTrimestreAvg(studentId, subjectId, t)
      if (a !== null) avgs.push(a)
    }
    return avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null
  }

  // Attendance counts for a student
  // status: 'present' | 'absent' | 'late'
  // absent = faltas, late = atrasos, present = no se cuenta
  function getAttendanceCounts(studentId: string) {
    const studentAtt = attendance.filter((a: any) => a.student_id === studentId)
    const faltas = studentAtt.filter((a: any) => a.status === 'absent').length
    const atrasos = studentAtt.filter((a: any) => a.status === 'late').length
    return {
      faltas,
      atrasos,
      total: studentAtt.length,
      presentes: studentAtt.filter((a: any) => a.status === 'present').length,
    }
  }

  // Behavior for a student
  function getBehavior(studentId: string) {
    const studentBeh = behaviors.filter((b: any) => b.student_id === studentId)
    const pos = studentBeh.filter((b: any) => b.type === 'positive').length
    const neg = studentBeh.filter((b: any) => b.type === 'negative').length
    return comportamientoLetra(pos, neg)
  }

  const gradeClass = (val: number | null) => {
    if (val === null) return ''
    if (val >= 9) return 'text-emerald-700'
    if (val >= 7) return 'text-black'
    return 'text-red-600 font-bold'
  }

  const fmt = (val: number | null) => val !== null ? val.toFixed(2) : ''
  const yearLabel = `${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`
  const tutorName = currentCourse ? (tutores[`${currentCourse.name} ${currentCourse.parallel || ''}`.trim()] || '') : ''
  // DOCENTE debe ser el tutor del curso, no el primer docente de la lista de materias
  const docenteName = tutorName || courseSubjects[0]?.teacher?.full_name || ''

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RENDER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  return (
    <div className="space-y-6">
      {/* â”€â”€ Controls (hidden on print) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="print:hidden space-y-4">
        <div className="p-5 bg-surface rounded-2xl border border-surface2 flex flex-wrap gap-4 items-end">
          {!isFamilyRole && (
            <div className="flex-1 min-w-[180px] space-y-1">
              <label className="text-xs text-ink4 font-medium px-1">Curso</label>
              <select value={selectedCourseId} onChange={e => { setSelectedCourseId(e.target.value); setSelectedStudentId('') }}
                className="w-full bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet">
                <option value="" disabled>Seleccionar curso...</option>
                {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.parallel}</option>)}
              </select>
            </div>
          )}
          {!isFamilyRole && (
            <div className="flex-1 min-w-[180px] space-y-1">
              <label className="text-xs text-ink4 font-medium px-1">Estudiante</label>
              <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}
                className="w-full bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet">
                <option value="" disabled>Seleccionar estudiante...</option>
                {studentsInCourse.map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs text-ink4 font-medium px-1">Tipo de Libreta</label>
            <div className="flex gap-1 bg-bg rounded-xl p-1 border border-surface2">
              {(['mensual', 'trimestral', 'anual'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize
                    ${view === v ? 'bg-violet text-white' : 'text-ink3 hover:text-ink'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          {view !== 'anual' && (
            <div className="space-y-1">
              <label className="text-xs text-ink4 font-medium px-1">Trimestre</label>
              <div className="flex gap-1 bg-bg rounded-xl p-1 border border-surface2">
                {[1, 2, 3].map(t => (
                  <button key={t} onClick={() => setTrimestre(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${trimestre === t ? 'bg-teal text-white' : 'text-ink3 hover:text-ink'}`}>
                    T{t}
                  </button>
                ))}
              </div>
            </div>
          )}
          {view === 'mensual' && (
            <div className="space-y-1">
              <label className="text-xs text-ink4 font-medium px-1">Parcial</label>
              <div className="flex gap-1 bg-bg rounded-xl p-1 border border-surface2">
                {Array.from({ length: parcialesCount }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setParcialSel(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${parcialSel === p ? 'bg-amber-500 text-white' : 'text-ink3 hover:text-ink'}`}>
                    P{p}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => window.print()} disabled={!selectedStudentId}
            className="bg-violet hover:bg-violet2 disabled:opacity-50 text-white px-5 py-2 h-10 rounded-xl text-sm font-medium transition-all shadow-glow flex items-center gap-2">
            <Printer size={16} /> Imprimir
          </button>
          
          {['admin', 'secretary', 'rector'].includes(role) && (
            <button
              onClick={handleTogglePublish}
              disabled={isPending}
              className={`flex items-center gap-2 px-5 py-2 h-10 rounded-xl text-sm font-bold transition-all border ${
                isPublished 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isPublished ? (
                <>
                  <Eye className="w-4 h-4" />
                  Visible a Padres
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4" />
                  Oculto a Padres
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* â”€â”€ Report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {selectedStudentId && (isFamilyRole || currentCourse) ? (
        <div className="bg-white text-black rounded-xl shadow-lg border print:shadow-none print:border-none print:rounded-none text-[11px]">

          {/* â•â•â• HEADER COMUN â•â•â• */}
          <div className="p-6 pb-2 print:p-3">
            <div className="flex items-center gap-4 border-b-2 border-black pb-3 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon/logo-institucion.png" alt="Logo" className="w-16 h-16 object-contain print:w-14 print:h-14" />
              <div className="flex-1 text-center">
                <h2 className="text-sm font-bold uppercase tracking-wider">{institutionName || 'Unidad Educativa'}</h2>
                <p className="text-[10px] font-semibold tracking-widest text-gray-600 mt-0.5 uppercase">
                  {view === 'mensual' && `Notas del Parcial ${parcialSel}`}
                  {view === 'trimestral' && `Acta General de Calificacion del ${trimestre === 1 ? 'Primer' : trimestre === 2 ? 'Segundo' : 'Tercer'} Trimestre`}
                  {view === 'anual' && 'Libreta de Calificacion Anual'}
                </p>
              </div>
              <div className="w-16" /> {/* spacer */}
            </div>

            {/* Info del estudiante */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10px] mb-3">
              <p><b>AÃ‘O LECTIVO:</b> {yearLabel}</p>
              <p><b>TRIMESTRE:</b> {view === 'anual' ? 'ANUAL' : `${trimestre === 1 ? 'PRIMERO' : trimestre === 2 ? 'SEGUNDO' : 'TERCERO'}`}</p>
              <p><b>ESTUDIANTE:</b> {currentStudent?.full_name}</p>
              <p><b>JORNADA:</b> {currentCourse?.shift === 'vespertino' ? 'VESPERTINA' : 'MATUTINA'}</p>
              <p><b>CURSO:</b> {currentCourse?.name} {currentCourse?.parallel}</p>
              <p><b>DOCENTE:</b> {docenteName}</p>
            </div>
          </div>

          {/* â•â•â• LIBRETA MENSUAL (POR PARCIAL) â•â•â• */}
          {view === 'mensual' && (
            <div className="px-6 pb-6 print:px-3 print:pb-3">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-400 px-2 py-1.5 font-bold text-left" rowSpan={2}>NÂ°</th>
                    <th className="border border-gray-400 px-2 py-1.5 font-bold text-left" rowSpan={2}>MATERIAS</th>
                    {categories.map((cat: any) => (
                      <th key={cat.id} className="border border-gray-400 px-1 py-1 font-bold text-center text-[8px] uppercase" colSpan={2}>
                        {cat.name}
                      </th>
                    ))}
                    <th className="border border-gray-400 px-1 py-1 font-bold text-center bg-cyan-100" rowSpan={2}>P. 70%</th>
                    <th className="border border-gray-400 px-1 py-1 font-bold text-center bg-pink-100" rowSpan={2}>P. PARCIAL</th>
                    <th className="border border-gray-400 px-1 py-1 font-bold text-center bg-green-100" rowSpan={2}>CUALIT.</th>
                  </tr>
                  <tr className="bg-gray-100">
                    {categories.map((cat: any) => (
                      <>
                        <th key={`${cat.id}-n`} className="border border-gray-400 px-1 py-1 text-center text-[8px]">Nota</th>
                        <th key={`${cat.id}-p`} className="border border-gray-400 px-1 py-1 text-center text-[8px] bg-cyan-50">PROM</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {courseSubjects.map((sub: any, idx: number) => {
                    const parcAvg = getParcialAvg(selectedStudentId, sub.id, trimestre, parcialSel)
                    const isQuali = isQualitativeSubject(sub.name)
                    const displayGrade = (val: number | null) => isQuali && val !== null ? getQualitativeGradeForNumber(val)?.id || '' : fmt(val)
                    return (
                      <tr key={sub.id} className={idx % 2 === 0 ? '' : 'bg-gray-50'}>
                        <td className="border border-gray-400 px-2 py-1 text-center font-semibold">{idx + 1}</td>
                        <td className="border border-gray-400 px-2 py-1 font-medium uppercase">{sub.name}</td>
                        {categories.map((cat: any) => {
                          const catAvg = getCatAvg(selectedStudentId, sub.id, trimestre, parcialSel, cat.id)
                          return (
                            <>
                              <td key={`${cat.id}-n`} className={`border border-gray-400 px-1 py-1 text-center ${isQuali ? '' : gradeClass(catAvg)}`}>
                                {displayGrade(catAvg)}
                              </td>
                              <td key={`${cat.id}-p`} className={`border border-gray-400 px-1 py-1 text-center font-semibold bg-cyan-50 ${isQuali ? '' : gradeClass(catAvg)}`}>
                                {displayGrade(catAvg)}
                              </td>
                            </>
                          )
                        })}
                        <td className={`border border-gray-400 px-1 py-1 text-center font-bold bg-cyan-100 ${isQuali ? '' : gradeClass(parcAvg)}`}>
                          {displayGrade(parcAvg)}
                        </td>
                        <td className={`border border-gray-400 px-1 py-1 text-center font-bold bg-pink-100 ${isQuali ? '' : gradeClass(parcAvg)}`}>
                          {displayGrade(parcAvg)}
                        </td>
                        <td className="border border-gray-400 px-1 py-1 text-center font-bold bg-green-100">
                          {isQuali && parcAvg !== null ? getQualitativeGradeForNumber(parcAvg)?.id || '' : cualitativo(parcAvg)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Comportamiento + Firma */}
              <div className="mt-6 flex justify-between items-start text-[10px]">
                <div>
                  <table className="border-collapse">
                    <tbody>
                      <tr>
                        <td className="border border-gray-400 px-3 py-1 font-bold bg-gray-100">COMPORT.</td>
                        <td className="border border-gray-400 px-3 py-1 font-bold text-center">{getBehavior(selectedStudentId)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="text-center">
                  <div className="w-48 border-t border-gray-400 pt-1 mt-8 font-bold text-[9px]">FIRMA DEL TUTOR</div>
                </div>
              </div>
            </div>
          )}

          {/* â•â•â• ACTA TRIMESTRAL â•â•â• */}
          {view === 'trimestral' && (
            <div className="px-6 pb-6 print:px-3 print:pb-3">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-400 px-1 py-1.5 font-bold text-center w-6" rowSpan={2}>NÂ°</th>
                    <th className="border border-gray-400 px-2 py-1.5 font-bold text-left" rowSpan={2}>ASIGNATURAS</th>
                    {Array.from({ length: parcialesCount }, (_, i) => (
                      <th key={i} className="border border-gray-400 px-1 py-1 font-bold text-center text-[9px]" colSpan={2}>
                        PARCIAL {i + 1}
                      </th>
                    ))}
                    <th className="border border-gray-400 px-1 py-1 font-bold text-center bg-orange-100 text-[9px]" rowSpan={2}>
                      PROM.<br/>PARCIALES<br/><span className="text-[8px] font-normal">70%</span>
                    </th>
                    <th className="border border-gray-400 px-1 py-1 font-bold text-center bg-amber-100 text-[9px]" rowSpan={2}>
                      EXAMEN<br/>TRIMESTRAL<br/><span className="text-[8px] font-normal">30%</span>
                    </th>
                    <th className="border border-gray-400 px-1 py-1 font-bold text-center bg-cyan-100 text-[9px]" rowSpan={2}>
                      PROMEDIO<br/>TRIMESTRAL
                    </th>
                    <th className="border border-gray-400 px-1 py-1 font-bold text-center bg-green-100 text-[9px]" rowSpan={2}>
                      CUALIT.
                    </th>
                  </tr>
                  <tr className="bg-gray-100">
                    {Array.from({ length: parcialesCount }, (_, i) => (
                      <>
                        <th key={`n-${i}`} className="border border-gray-400 px-1 py-1 text-center text-[8px]">Nota</th>
                        <th key={`p-${i}`} className="border border-gray-400 px-1 py-1 text-center text-[8px] bg-cyan-50">PROM</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {courseSubjects.map((sub: any, idx: number) => {
                    const pm = getParcialMean(selectedStudentId, sub.id, trimestre)
                    const exam = getExamScore(selectedStudentId, sub.id, trimestre)
                    const triAvg = getTrimestreAvg(selectedStudentId, sub.id, trimestre)
                    const isQuali = isQualitativeSubject(sub.name)
                    const displayGrade = (val: number | null) => isQuali && val !== null ? getQualitativeGradeForNumber(val)?.id || '' : fmt(val)
                    return (
                      <tr key={sub.id} className={idx % 2 === 0 ? '' : 'bg-gray-50'}>
                        <td className="border border-gray-400 px-1 py-1 text-center font-semibold">{idx + 1}</td>
                        <td className="border border-gray-400 px-2 py-1 font-medium uppercase text-[9px]">{sub.name}</td>
                        {Array.from({ length: parcialesCount }, (_, i) => {
                          const pAvg = getParcialAvg(selectedStudentId, sub.id, trimestre, i + 1)
                          return (
                            <>
                              <td key={`n-${i}`} className={`border border-gray-400 px-1 py-1 text-center ${isQuali ? '' : gradeClass(pAvg)}`}>
                                {displayGrade(pAvg)}
                              </td>
                              <td key={`p-${i}`} className={`border border-gray-400 px-1 py-1 text-center font-semibold bg-cyan-50 ${isQuali ? '' : gradeClass(pAvg)}`}>
                                {displayGrade(pAvg)}
                              </td>
                            </>
                          )
                        })}
                        <td className={`border border-gray-400 px-1 py-1 text-center font-bold bg-orange-100 ${isQuali ? '' : gradeClass(pm)}`}>
                          {displayGrade(pm)}
                        </td>
                        <td className={`border border-gray-400 px-1 py-1 text-center font-bold bg-amber-100 ${isQuali ? '' : gradeClass(exam)}`}>
                          {displayGrade(exam)}
                        </td>
                        <td className={`border border-gray-400 px-1 py-1 text-center font-bold bg-cyan-100 ${isQuali ? '' : gradeClass(triAvg)}`}>
                          {displayGrade(triAvg)}
                        </td>
                        <td className="border border-gray-400 px-1 py-1 text-center font-bold bg-green-100">
                          {isQuali && triAvg !== null ? getQualitativeGradeForNumber(triAvg)?.id || '' : cualitativo(triAvg)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Firmas */}
              <div className="mt-12 flex justify-around text-[9px] font-bold uppercase text-gray-500 gap-8 print:mt-16">
                <div className="text-center">
                  <div className="w-44 border-t border-gray-400 pt-1">Firma del Rector/a</div>
                </div>
                <div className="text-center">
                  <div className="w-44 border-t border-gray-400 pt-1">Tutor/a de Curso</div>
                </div>
                <div className="text-center">
                  <div className="w-44 border-t border-gray-400 pt-1">Representante Legal</div>
                </div>
              </div>
            </div>
          )}

          {/* â•â•â• LIBRETA ANUAL â•â•â• */}
          {view === 'anual' && (
            <div className="px-6 pb-6 print:px-3 print:pb-3">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-400 px-1 py-1.5 font-bold text-left" rowSpan={2}>MATERIAS</th>
                    <th className="border border-gray-400 px-1 py-1 font-bold text-center text-[9px]" colSpan={2}>
                      PRIMER TRIMESTRE
                    </th>
                    <th className="border border-gray-400 px-1 py-1 font-bold text-center text-[9px]" colSpan={2}>
                      SEGUNDO TRIMESTRE
                    </th>
                    <th className="border border-gray-400 px-1 py-1 font-bold text-center text-[9px] bg-cyan-100" colSpan={parcialesCount + 2}>
                      TERCER TRIMESTRE
                    </th>
                    <th className="border border-gray-400 px-1 py-1 font-bold text-center bg-orange-100 text-[9px]" rowSpan={2}>
                      PROM.<br/>ANUAL
                    </th>
                    <th className="border border-gray-400 px-1 py-1 font-bold text-center bg-green-100 text-[9px]" rowSpan={2}>
                      CUALIT.
                    </th>
                  </tr>
                  <tr className="bg-gray-100 text-[8px]">
                    <th className="border border-gray-400 px-1 py-1 text-center">Prom T1</th>
                    <th className="border border-gray-400 px-1 py-1 text-center">Cual.</th>
                    <th className="border border-gray-400 px-1 py-1 text-center">Prom T2</th>
                    <th className="border border-gray-400 px-1 py-1 text-center">Cual.</th>
                    {Array.from({ length: parcialesCount }, (_, i) => (
                      <th key={i} className="border border-gray-400 px-1 py-1 text-center bg-cyan-50">P{i + 1}</th>
                    ))}
                    <th className="border border-gray-400 px-1 py-1 text-center bg-amber-50">Examen</th>
                    <th className="border border-gray-400 px-1 py-1 text-center bg-cyan-100">Prom T3</th>
                  </tr>
                </thead>
                <tbody>
                  {courseSubjects.map((sub: any, idx: number) => {
                    const t1 = getTrimestreAvg(selectedStudentId, sub.id, 1)
                    const t2 = getTrimestreAvg(selectedStudentId, sub.id, 2)
                    const t3 = getTrimestreAvg(selectedStudentId, sub.id, 3)
                    const exam3 = getExamScore(selectedStudentId, sub.id, 3)
                    const annual = getAnnualAvg(selectedStudentId, sub.id)
                    const isQuali = isQualitativeSubject(sub.name)
                    const displayGrade = (val: number | null) => isQuali && val !== null ? getQualitativeGradeForNumber(val)?.id || '' : fmt(val)
                    return (
                      <tr key={sub.id} className={idx % 2 === 0 ? '' : 'bg-gray-50'}>
                        <td className="border border-gray-400 px-2 py-1 font-medium uppercase text-[9px]">{sub.name}</td>
                        <td className={`border border-gray-400 px-1 py-1 text-center font-semibold ${isQuali ? '' : gradeClass(t1)}`}>{displayGrade(t1)}</td>
                        <td className="border border-gray-400 px-1 py-1 text-center">{isQuali && t1 !== null ? getQualitativeGradeForNumber(t1)?.id || '' : cualitativo(t1)}</td>
                        <td className={`border border-gray-400 px-1 py-1 text-center font-semibold ${isQuali ? '' : gradeClass(t2)}`}>{displayGrade(t2)}</td>
                        <td className="border border-gray-400 px-1 py-1 text-center">{isQuali && t2 !== null ? getQualitativeGradeForNumber(t2)?.id || '' : cualitativo(t2)}</td>
                        {Array.from({ length: parcialesCount }, (_, i) => {
                          const pAvg = getParcialAvg(selectedStudentId, sub.id, 3, i + 1)
                          return (
                            <td key={i} className={`border border-gray-400 px-1 py-1 text-center bg-cyan-50 ${isQuali ? '' : gradeClass(pAvg)}`}>
                              {displayGrade(pAvg)}
                            </td>
                          )
                        })}
                        <td className={`border border-gray-400 px-1 py-1 text-center bg-amber-50 font-semibold ${isQuali ? '' : gradeClass(exam3)}`}>
                          {displayGrade(exam3)}
                        </td>
                        <td className={`border border-gray-400 px-1 py-1 text-center font-bold bg-cyan-100 ${isQuali ? '' : gradeClass(t3)}`}>
                          {displayGrade(t3)}
                        </td>
                        <td className={`border border-gray-400 px-1 py-1 text-center font-bold bg-orange-100 ${isQuali ? '' : gradeClass(annual)}`}>
                          {displayGrade(annual)}
                        </td>
                        <td className="border border-gray-400 px-1 py-1 text-center font-bold bg-green-100">
                          {isQuali && annual !== null ? getQualitativeGradeForNumber(annual)?.id || '' : cualitativo(annual)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200 font-bold">
                    <td className="border border-gray-400 px-2 py-1.5 text-right uppercase" colSpan={parcialesCount + 6}>
                      Promedio General
                    </td>
                    {(() => {
                      const avgs = courseSubjects.filter((s: any) => !isQualitativeSubject(s.name)).map((s: any) => getAnnualAvg(selectedStudentId, s.id)).filter((v): v is number => v !== null)
                      const globalAvg = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null
                      return (
                        <>
                          <td className={`border border-gray-400 px-1 py-1.5 text-center bg-orange-100 ${gradeClass(globalAvg)}`}>
                            {fmt(globalAvg)}
                          </td>
                          <td className="border border-gray-400 px-1 py-1.5 text-center bg-green-100">
                            {cualitativo(globalAvg)}
                          </td>
                        </>
                      )
                    })()}
                  </tr>
                </tfoot>
              </table>

              {/* Comportamiento + Asistencia */}
              <div className="mt-6 grid grid-cols-2 gap-6 text-[10px]">
                {/* Comportamiento */}
                <div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border border-gray-400 px-2 py-1 text-left" colSpan={2}>COMPORTAMIENTO</th>
                        <th className="border border-gray-400 px-2 py-1 text-center font-bold">{getBehavior(selectedStudentId)}</th>
                      </tr>
                    </thead>
                  </table>
                  <table className="w-full border-collapse mt-2">
                    <thead>
                      <tr className="bg-cyan-100">
                        <th className="border border-gray-400 px-2 py-1 text-center font-bold" colSpan={3}>ESCALA DE COMPORTAMIENTO</th>
                      </tr>
                    </thead>
                    <tbody className="text-[9px]">
                      <tr><td className="border border-gray-400 px-2 py-0.5 font-bold text-center w-8">S</td><td className="border border-gray-400 px-2 py-0.5" colSpan={2}>Transforma los desacuerdos en oportunidades de crecimiento y cooperacion.</td></tr>
                      <tr><td className="border border-gray-400 px-2 py-0.5 font-bold text-center">F</td><td className="border border-gray-400 px-2 py-0.5" colSpan={2}>Se involucra y participa en iniciativas que favorecen la convivencia pacifica.</td></tr>
                      <tr><td className="border border-gray-400 px-2 py-0.5 font-bold text-center">U</td><td className="border border-gray-400 px-2 py-0.5" colSpan={2}>Demuestra habilidades para llegar a acuerdos y asumir compromisos.</td></tr>
                      <tr><td className="border border-gray-400 px-2 py-0.5 font-bold text-center">N</td><td className="border border-gray-400 px-2 py-0.5" colSpan={2}>Requiere acompanamiento comportamental.</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Asistencia */}
                <div>
                  {(() => {
                    const att = getAttendanceCounts(selectedStudentId)
                    return (
                      <table className="border-collapse">
                        <tbody>
                          <tr>
                            <td className="border border-gray-400 px-3 py-1 font-bold bg-gray-100">FALTAS</td>
                            <td className="border border-gray-400 px-3 py-1 text-center font-bold">{att.faltas}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-400 px-3 py-1 font-bold bg-gray-100">ATRASOS</td>
                            <td className="border border-gray-400 px-3 py-1 text-center font-bold">{att.atrasos}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-400 px-3 py-1 font-bold bg-gray-100">ASISTENCIAS</td>
                            <td className="border border-gray-400 px-3 py-1 text-center font-bold">{att.presentes}</td>
                          </tr>
                        </tbody>
                      </table>
                    )
                  })()}
                </div>
              </div>

              {/* Escala cualitativa */}
              <div className="mt-4 text-[9px] border border-gray-300 rounded p-2">
                <p className="font-bold mb-1">ESCALA CUALITATIVA:</p>
                <div className="flex flex-wrap gap-4">
                  <span><b>DAR</b> (9.00-10.00) Domina los aprendizajes</span>
                  <span><b>AAR</b> (7.00-8.99) Alcanza los aprendizajes</span>
                  <span><b>PAR</b> (4.01-6.99) Proximo a alcanzar</span>
                  <span><b>NAAR</b> (0-4.00) No alcanza</span>
                </div>
              </div>

              {/* Firmas */}
              <div className="mt-12 flex justify-around text-[9px] font-bold uppercase text-gray-500 gap-8 print:mt-16">
                <div className="text-center">
                  <div className="w-44 border-t border-gray-400 pt-1">{tutorName || 'TUTORA'}</div>
                  <div className="text-[8px] font-normal">TUTOR/A</div>
                </div>
                <div className="text-center">
                  <div className="w-44 border-t border-gray-400 pt-1">RECTOR/A</div>
                  <div className="text-[8px] font-normal">RECTOR</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-12 text-center text-ink3 bg-surface rounded-2xl border border-surface2">
          <FileText size={40} className="mx-auto mb-4 text-ink4 opacity-40" />
          <p className="font-semibold text-sm mb-1">Selecciona un curso y estudiante</p>
          <p className="text-xs text-ink4">Para generar e imprimir la libreta de calificaciones.</p>
        </div>
      )}
    </div>
  )
}




'use client'

import { useState, useMemo } from 'react'
import { Printer, FileText, ChevronDown } from 'lucide-react'

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
}

export function LibretasClient({ role, institutionName, courses, enrollments, subjects, assignments, grades, categories, currentUserId, parcialesCount = 2 }: Props) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '')
  const [selectedStudentId, setSelectedStudentId] = useState<string>(role === 'student' ? currentUserId : '')
  const [trimestre, setTrimestre] = useState(1)

  // ── Derived data ────────────────────────────────────────────────────────
  const studentsInCourse = useMemo(() => {
    if (role === 'student') {
      return enrollments.map((e: any) => e.student).filter(Boolean)
    }
    return enrollments
      .filter((e: any) => e.course_id === selectedCourseId)
      .map((e: any) => e.student)
      .filter(Boolean)
      .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''))
  }, [enrollments, selectedCourseId, role])

  const courseSubjects = useMemo(() => {
    if (role === 'student') {
      const myCourseIds = enrollments.map((e: any) => e.course_id)
      return subjects.filter((s: any) => myCourseIds.includes(s.course_id))
    }
    return subjects.filter((s: any) => s.course_id === selectedCourseId)
  }, [subjects, selectedCourseId, enrollments, role])

  const currentCourse = courses.find((c: any) => c.id === selectedCourseId)
  const currentStudent = studentsInCourse.find((s: any) => s.id === selectedStudentId)

  // ── Grade helper ────────────────────────────────────────────────────────
  function getGrade(assignmentId: string, studentId: string): number | null {
    const g = grades.find((gr: any) => gr.assignment_id === assignmentId && gr.student_id === studentId)
    return g?.score != null ? Number(g.score) : null
  }

  // ── Weighted average per subject per trimestre ─────────────────────────
  function getSubjectAvg(subjectId: string, studentId: string, t: number): { weighted: number | null; parcials: (number | null)[] } {
    const parcials: (number | null)[] = []
    
    for (let p = 1; p <= parcialesCount; p++) {
      const filteredAsgs = assignments.filter((a: any) =>
        a.subject_id === subjectId && a.trimestre === t && a.parcial === p
      )
      if (filteredAsgs.length === 0) { parcials.push(null); continue }

      if (categories.length === 0) {
        // Simple average
        const scores = filteredAsgs.map((a: any) => getGrade(a.id, studentId)).filter((g): g is number => g !== null)
        parcials.push(scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null)
      } else {
        // Weighted average by category
        let totalWeighted = 0
        let totalWeight = 0
        categories.forEach((cat: any) => {
          const catAsgs = filteredAsgs.filter((a: any) => a.category_id === cat.id)
          if (catAsgs.length === 0) return
          const scores = catAsgs.map((a: any) => getGrade(a.id, studentId)).filter((g): g is number => g !== null)
          if (scores.length === 0) return
          const catAvg = scores.reduce((a, b) => a + b, 0) / scores.length
          totalWeighted += catAvg * Number(cat.weight_percent)
          totalWeight += Number(cat.weight_percent)
        })
        parcials.push(totalWeight > 0 ? totalWeighted / totalWeight : null)
      }
    }

    // Average of all parcials
    const validParcials = parcials.filter((p): p is number => p !== null)
    const weighted = validParcials.length > 0 ? validParcials.reduce((a, b) => a + b, 0) / validParcials.length : null
    return { weighted, parcials }
  }

  // ── Build report data ──────────────────────────────────────────────────
  const reportData = useMemo(() => {
    if (!selectedStudentId) return []
    return courseSubjects.map((sub: any) => {
      const { weighted, parcials } = getSubjectAvg(sub.id, selectedStudentId, trimestre)
      return {
        subject: sub.name,
        subjectId: sub.id,
        parcials,
        avg: weighted,
      }
    })
  }, [courseSubjects, selectedStudentId, trimestre, assignments, grades, categories, parcialesCount])

  // Annual average (all 3 trimesters)
  const annualData = useMemo(() => {
    if (!selectedStudentId) return []
    return courseSubjects.map((sub: any) => {
      const trimestreAvgs: (number | null)[] = []
      for (let t = 1; t <= 3; t++) {
        const { weighted } = getSubjectAvg(sub.id, selectedStudentId, t)
        trimestreAvgs.push(weighted)
      }
      const valid = trimestreAvgs.filter((v): v is number => v !== null)
      const annual = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null
      return {
        subject: sub.name,
        t1: trimestreAvgs[0],
        t2: trimestreAvgs[1],
        t3: trimestreAvgs[2],
        annual,
      }
    })
  }, [courseSubjects, selectedStudentId, assignments, grades, categories])

  const globalAvg = useMemo(() => {
    const avgs = reportData.filter(r => r.avg !== null).map(r => r.avg!)
    return avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null
  }, [reportData])

  const annualGlobalAvg = useMemo(() => {
    const avgs = annualData.filter(r => r.annual !== null).map(r => r.annual!)
    return avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null
  }, [annualData])

  const gradeClass = (val: number | null) => {
    if (val === null) return ''
    if (val >= 9) return 'text-emerald-600'
    if (val >= 7) return 'text-black'
    return 'text-red-600 font-bold'
  }

  const [view, setView] = useState<'trimestre' | 'anual'>('trimestre')

  return (
    <div className="space-y-6">
      {/* ── Controls (hidden on print) ─────────────────────────────────── */}
      <div className="print:hidden space-y-4">
        <div className="p-5 bg-surface rounded-2xl border border-surface2 flex flex-wrap gap-4 items-end">
          {role !== 'student' && (
            <div className="flex-1 min-w-[180px] space-y-1">
              <label className="text-xs text-ink4 font-medium px-1">Curso</label>
              <select value={selectedCourseId} onChange={e => { setSelectedCourseId(e.target.value); setSelectedStudentId('') }}
                className="w-full bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet">
                <option value="" disabled>Seleccionar curso...</option>
                {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.parallel}</option>)}
              </select>
            </div>
          )}
          {role !== 'student' && (
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
            <label className="text-xs text-ink4 font-medium px-1">Vista</label>
            <div className="flex gap-1 bg-bg rounded-xl p-1 border border-surface2">
              <button onClick={() => setView('trimestre')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'trimestre' ? 'bg-violet text-white' : 'text-ink3 hover:text-ink'}`}>
                Trimestre
              </button>
              <button onClick={() => setView('anual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'anual' ? 'bg-teal text-white' : 'text-ink3 hover:text-ink'}`}>
                Anual
              </button>
            </div>
          </div>
          {view === 'trimestre' && (
            <div className="space-y-1">
              <label className="text-xs text-ink4 font-medium px-1">Trimestre</label>
              <div className="flex gap-1 bg-bg rounded-xl p-1 border border-surface2">
                {[1, 2, 3].map(t => (
                  <button key={t} onClick={() => setTrimestre(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${trimestre === t ? 'bg-violet text-white' : 'text-ink3 hover:text-ink'}`}>
                    T{t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => window.print()} disabled={!selectedStudentId}
            className="bg-violet hover:bg-violet2 disabled:opacity-50 text-white px-5 py-2 h-10 rounded-xl text-sm font-medium transition-all shadow-glow flex items-center gap-2">
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>

      {/* ── Report Card ────────────────────────────────────────────────── */}
      {selectedStudentId && (role === 'student' || currentCourse) ? (
        <div className="bg-white text-black rounded-xl shadow-lg border print:shadow-none print:border-none print:rounded-none">
          {/* Header */}
          <div className="p-8 pb-0 print:p-4">
            <div className="text-center border-b-2 border-black pb-4 mb-6">
              <h2 className="text-xl lg:text-2xl font-bold uppercase tracking-wider">{institutionName || 'Unidad Educativa'}</h2>
              <p className="text-sm font-semibold tracking-widest text-gray-500 mt-1">
                {view === 'anual' ? 'RÉCORD ACADÉMICO ANUAL' : `BOLETÍN DE CALIFICACIONES — TRIMESTRE ${trimestre}`}
              </p>
            </div>

            <div className="flex flex-wrap justify-between items-end mb-6 text-sm gap-2">
              <div>
                <p><span className="font-bold">Estudiante:</span> {currentStudent?.full_name}</p>
                {role !== 'student' && currentCourse && (
                  <p><span className="font-bold">Curso:</span> {currentCourse.name} {currentCourse.parallel}</p>
                )}
              </div>
              <div className="text-right">
                <p><span className="font-bold">Fecha:</span> {new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                <p><span className="font-bold">Año Lectivo:</span> {new Date().getFullYear()} - {new Date().getFullYear() + 1}</p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="px-8 pb-8 print:px-4 print:pb-4">
            {view === 'trimestre' ? (
              /* ── Trimestre view ── */
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2.5 font-bold">Asignatura</th>
                    {Array.from({ length: parcialesCount }, (_, i) => (
                      <th key={i} className="border border-gray-300 px-3 py-2.5 font-bold text-center w-24">P{i + 1}</th>
                    ))}
                    <th className="border border-gray-300 px-3 py-2.5 font-bold text-center w-28 bg-gray-200">Promedio T{trimestre}</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-4 py-2 font-medium">{row.subject}</td>
                      {row.parcials.map((pVal: number | null, pi: number) => (
                        <td key={pi} className={`border border-gray-300 px-3 py-2 text-center font-semibold ${gradeClass(pVal)}`}>
                          {pVal !== null ? pVal.toFixed(2) : '—'}
                        </td>
                      ))}
                      <td className={`border border-gray-300 px-3 py-2 text-center font-bold text-base bg-gray-50 ${gradeClass(row.avg)}`}>
                        {row.avg !== null ? row.avg.toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200">
                    <td className="border border-gray-300 px-4 py-3 font-bold text-right uppercase text-xs" colSpan={parcialesCount + 1}>
                      Promedio General Trimestre {trimestre}
                    </td>
                    <td className={`border border-gray-300 px-3 py-3 text-center font-bold text-lg ${gradeClass(globalAvg)}`}>
                      {globalAvg !== null ? globalAvg.toFixed(2) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              /* ── Annual view ── */
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2.5 font-bold">Asignatura</th>
                    <th className="border border-gray-300 px-3 py-2.5 font-bold text-center w-20">T1</th>
                    <th className="border border-gray-300 px-3 py-2.5 font-bold text-center w-20">T2</th>
                    <th className="border border-gray-300 px-3 py-2.5 font-bold text-center w-20">T3</th>
                    <th className="border border-gray-300 px-3 py-2.5 font-bold text-center w-28 bg-gray-200">Promedio Anual</th>
                  </tr>
                </thead>
                <tbody>
                  {annualData.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-4 py-2 font-medium">{row.subject}</td>
                      <td className={`border border-gray-300 px-3 py-2 text-center font-semibold ${gradeClass(row.t1)}`}>
                        {row.t1 !== null ? row.t1.toFixed(2) : '—'}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-center font-semibold ${gradeClass(row.t2)}`}>
                        {row.t2 !== null ? row.t2.toFixed(2) : '—'}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-center font-semibold ${gradeClass(row.t3)}`}>
                        {row.t3 !== null ? row.t3.toFixed(2) : '—'}
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 text-center font-bold text-base bg-gray-50 ${gradeClass(row.annual)}`}>
                        {row.annual !== null ? row.annual.toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200">
                    <td className="border border-gray-300 px-4 py-3 font-bold text-right uppercase text-xs" colSpan={4}>
                      Promedio General Anual
                    </td>
                    <td className={`border border-gray-300 px-3 py-3 text-center font-bold text-lg ${gradeClass(annualGlobalAvg)}`}>
                      {annualGlobalAvg !== null ? annualGlobalAvg.toFixed(2) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* Escala de calificaciones */}
            <div className="mt-6 text-xs text-gray-500 border-t border-gray-200 pt-4">
              <p className="font-bold mb-1">Escala de Calificaciones (sobre 10):</p>
              <div className="flex flex-wrap gap-4">
                <span>🟢 <b>9.00 – 10.00</b> Domina</span>
                <span>🔵 <b>7.00 – 8.99</b> Alcanza</span>
                <span>🟡 <b>4.01 – 6.99</b> Próximo a alcanzar</span>
                <span>🔴 <b>≤ 4.00</b> No alcanza</span>
              </div>
            </div>

            {/* Firmas */}
            <div className="mt-16 flex flex-wrap justify-around text-xs font-bold uppercase text-gray-500 gap-8 print:mt-24">
              <div className="text-center">
                <div className="w-48 border-t border-gray-400 pt-2">Firma del Rector/a</div>
              </div>
              <div className="text-center">
                <div className="w-48 border-t border-gray-400 pt-2">Tutor/a de Curso</div>
              </div>
              <div className="text-center">
                <div className="w-48 border-t border-gray-400 pt-2">Representante Legal</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-ink3 bg-surface rounded-2xl border border-surface2">
          <FileText size={40} className="mx-auto mb-4 text-ink4 opacity-40" />
          <p className="font-semibold text-sm mb-1">Selecciona un curso y estudiante</p>
          <p className="text-xs text-ink4">Para generar e imprimir el boletín de calificaciones.</p>
        </div>
      )}
    </div>
  )
}

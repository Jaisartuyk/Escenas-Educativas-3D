'use client'

import { useState, useMemo } from 'react'
import { AlertTriangle, TrendingUp, Filter, Users, Medal, ChevronDown } from 'lucide-react'

// Formula para obtener promedio de una materia en un periodo dado
function getAverage(studentId: string, subjectId: string, assignments: any[], grades: any[], categories: any[]) {
  const subjectAssignments = assignments.filter((a: any) => a.subject_id === subjectId)
  if (subjectAssignments.length === 0) return null

  let categoryTotals: Record<string, { sum: number; count: number }> = {}

  subjectAssignments.forEach((a: any) => {
    const grade = grades.find((g: any) => g.assignment_id === a.id && g.student_id === studentId)
    // Si no hay nota, se evalúa como 0
    const score = grade && grade.score !== null ? Number(grade.score) : 0
    
    if (!categoryTotals[a.category_id]) {
      categoryTotals[a.category_id] = { sum: 0, count: 0 }
    }
    categoryTotals[a.category_id].sum += score
    categoryTotals[a.category_id].count += 1
  })

  // Calcular el peso final
  let calculatedScore = 0
  let isAnyCategoryEvaluated = false

  // Aplicar pesos (weight) de las categorías
  Object.keys(categoryTotals).forEach(catId => {
    const category = categories.find((c: any) => c.id === catId)
    if (category) {
      const avgCategory = categoryTotals[catId].sum / categoryTotals[catId].count
      calculatedScore += avgCategory * (Number(category.weight) / 100)
      isAnyCategoryEvaluated = true
    }
  })

  return isAnyCategoryEvaluated ? calculatedScore : null
}

const HEAT_COLORS = {
  HIGH: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
  LOW: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
  EMPTY: 'bg-surface2 text-ink4'
}

function getStyleForScore(score: number | null) {
  if (score === null) return HEAT_COLORS.EMPTY
  if (score < 7) return HEAT_COLORS.LOW
  if (score < 9) return HEAT_COLORS.MEDIUM
  return HEAT_COLORS.HIGH
}

export function RendimientoClient({ courses, enrollments, subjects, assignments, grades, categories, parcialesCount }: any) {
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.id || '')
  const [filterTrimestre, setFilterTrimestre] = useState('1')
  const [filterParcial, setFilterParcial] = useState('todos')
  const [riskOnly, setRiskOnly] = useState(false) // Toggle para "Riesgo Académico"

  // Filter active assignments by temporal filters
  const activeAssignments = useMemo(() => {
    return assignments.filter((a: any) => {
      const matchT = a.trimestre === Number(filterTrimestre)
      const matchP = filterParcial === 'todos' || a.parcial === Number(filterParcial)
      return matchT && matchP
    })
  }, [assignments, filterTrimestre, filterParcial])

  // Get active subjects
  const courseSubjects = useMemo(() => {
    return subjects.filter((s: any) => s.course_id === selectedCourse).sort((a: any, b: any) => a.name.localeCompare(b.name))
  }, [subjects, selectedCourse])

  // Get active enrollments
  const courseEnrollments = useMemo(() => {
    return enrollments.filter((e: any) => e.course_id === selectedCourse).sort((a: any, b: any) => 
      (a.student?.full_name || '').localeCompare(b.student?.full_name || '')
    )
  }, [enrollments, selectedCourse])

  // Generate Matrix Data
  const matrixData = useMemo(() => {
    return courseEnrollments.map((en: any) => {
      const stId = en.student_id
      let subjectAverages: Record<string, number | null> = {}
      let globalSum = 0
      let globalCount = 0
      let hasRisk = false

      courseSubjects.forEach((sub: any) => {
        const avg = getAverage(stId, sub.id, activeAssignments, grades, categories)
        subjectAverages[sub.id] = avg
        if (avg !== null) {
          globalSum += avg
          globalCount += 1
          if (avg < 7) hasRisk = true
        }
      })

      return {
        studentId: stId,
        studentName: en.student?.full_name || 'Desconocido',
        averages: subjectAverages,
        globalAvg: globalCount > 0 ? (globalSum / globalCount) : null,
        hasRisk
      }
    })
  }, [courseEnrollments, courseSubjects, activeAssignments, grades, categories])

  const filteredMatrix = useMemo(() => {
    if (!riskOnly) return matrixData
    return matrixData.filter(m => m.hasRisk)
  }, [matrixData, riskOnly])

  // KPIs
  const kpis = useMemo(() => {
    let validAvgs = matrixData.filter(m => m.globalAvg !== null).map(m => m.globalAvg as number)
    const classAvg = validAvgs.length > 0 ? (validAvgs.reduce((a,b)=>a+b,0) / validAvgs.length).toFixed(2) : '--'
    const riskCount = matrixData.filter(m => m.hasRisk).length
    const excelentCount = validAvgs.filter(v => v >= 9).length
    return { classAvg, riskCount, excelentCount }
  }, [matrixData])

  return (
    <div className="space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-4">
        <div className="bg-surface rounded-2xl border border-surface2 p-5 space-y-3">
           <div className="flex items-center gap-2">
             <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-50">
               <TrendingUp size={18} className="text-indigo-600" />
             </div>
             <span className="text-xs font-semibold text-ink3 uppercase tracking-wider">Promedio Curso</span>
           </div>
           <p className="text-2xl font-display font-bold">{kpis.classAvg}</p>
        </div>

        <div className="bg-surface rounded-2xl border border-surface2 p-5 space-y-3">
           <div className="flex items-center gap-2">
             <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-50 border border-rose-100">
               <AlertTriangle size={18} className="text-rose-600" />
             </div>
             <span className="text-xs font-semibold text-ink3 uppercase tracking-wider">En Riesgo (&lt; 7.00)</span>
           </div>
           <p className="text-2xl font-display font-bold text-rose-600">{kpis.riskCount}</p>
           <p className="text-xs text-rose-500 font-medium">Alumnos requiriendo atenci&oacute;n</p>
        </div>

        <div className="bg-surface rounded-2xl border border-surface2 p-5 space-y-3">
           <div className="flex items-center gap-2">
             <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-100">
               <Medal size={18} className="text-emerald-600" />
             </div>
             <span className="text-xs font-semibold text-ink3 uppercase tracking-wider">Alto Redimiento</span>
           </div>
           <p className="text-2xl font-display font-bold text-emerald-600">{kpis.excelentCount}</p>
           <p className="text-xs text-emerald-600 font-medium">Estudiantes sobre 9.00</p>
        </div>

        <div className="bg-surface rounded-2xl border border-surface2 p-5 space-y-3">
           <div className="flex items-center gap-2">
             <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100">
               <Users size={18} className="text-slate-600" />
             </div>
             <span className="text-xs font-semibold text-ink3 uppercase tracking-wider">Matriculados</span>
           </div>
           <p className="text-2xl font-display font-bold text-slate-800">{courseEnrollments.length}</p>
        </div>
      </div>

      {/* Toolbox */}
      <div className="bg-surface border border-surface2 rounded-2xl p-4 mx-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        <div className="flex flex-wrap items-center gap-3">
           <div className="relative">
             <select 
                value={selectedCourse} 
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="appearance-none bg-bg border border-surface2 rounded-xl pl-4 pr-8 py-2 text-sm font-semibold focus:outline-none focus:border-indigo-400"
             >
                {courses.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} {c.parallel || ''}</option>
                ))}
             </select>
             <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
           </div>

           <div className="h-6 w-px bg-surface2 mx-1" />

           <div className="relative">
             <select 
                value={filterTrimestre} 
                onChange={(e) => setFilterTrimestre(e.target.value)}
                className="appearance-none bg-bg border border-surface2 rounded-xl pl-4 pr-8 py-2 text-sm font-semibold focus:outline-none focus:border-indigo-400"
             >
                <option value="1">1er Trimestre</option>
                <option value="2">2do Trimestre</option>
                <option value="3">3er Trimestre</option>
             </select>
             <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
           </div>

           <div className="relative">
             <select 
                value={filterParcial} 
                onChange={(e) => setFilterParcial(e.target.value)}
                className="appearance-none bg-bg border border-surface2 rounded-xl pl-4 pr-8 py-2 text-sm font-semibold focus:outline-none focus:border-indigo-400"
             >
                <option value="todos">Todos los Parciales</option>
                {Array.from({length: parcialesCount}, (_, i) => i + 1).map(p => (
                  <option key={p} value={String(p)}>Parcial {p}</option>
                ))}
             </select>
             <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
           </div>
        </div>

        <button 
          onClick={() => setRiskOnly(!riskOnly)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${
            riskOnly 
              ? 'bg-rose-100 text-rose-700 border-rose-300' 
              : 'bg-surface border-surface2 text-ink3 hover:bg-surface2'
          }`}
        >
          <Filter size={16} />
          {riskOnly ? 'Filtrando Riesgo' : 'Aislar Riesgo'}
        </button>

      </div>

      {/* HEATMAP / DATATABLE */}
      <div className="px-4">
        <div className="bg-surface border border-surface2 rounded-2xl overflow-x-auto shadow-sm">
          {!filteredMatrix.length ? (
            <div className="p-12 text-center text-ink3">
              No hay estudiantes que mostrar con estos filtros.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface2 bg-surface2/30">
                  <th className="px-4 py-3 text-left font-bold text-ink2 uppercase tracking-wide text-xs sticky left-0 bg-surface z-10 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                    Estudiante
                  </th>
                  <th className="px-3 py-3 text-center font-extrabold text-indigo-700 uppercase tracking-wide text-[11px] bg-indigo-50/50 min-w-[80px]">
                    Promedio Global
                  </th>
                  {courseSubjects.map((sub: any) => (
                    <th key={sub.id} className="px-2 py-3 text-center font-bold text-ink3 text-[10px] uppercase tracking-wider min-w-[80px] leading-tight max-w-[120px] truncate" title={sub.name}>
                      {sub.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface2">
                {filteredMatrix.map((row, idx) => (
                  <tr key={row.studentId} className={`hover:bg-bg/50 ${idx % 2 === 0 ? '' : 'bg-surface2/10'}`}>
                    <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap sticky left-0 bg-surface z-10 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                      {row.studentName}
                    </td>
                    <td className="px-3 py-3 text-center bg-indigo-50/20">
                      <span className={`inline-block px-2 py-1 rounded-lg text-xs border ${getStyleForScore(row.globalAvg)}`}>
                        {row.globalAvg !== null ? row.globalAvg.toFixed(2) : '--'}
                      </span>
                    </td>
                    {courseSubjects.map((sub: any) => {
                      const avg = row.averages[sub.id]
                      return (
                        <td key={sub.id} className="px-2 py-2 text-center">
                           {avg !== null ? (
                             <span className={`inline-block w-full px-1.5 py-1.5 rounded-lg text-xs border ${getStyleForScore(avg)}`} title={`${sub.name}: ${avg.toFixed(2)}`}>
                               {avg.toFixed(2)}
                             </span>
                           ) : (
                             <span className="text-ink4 text-xs">—</span>
                           )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-6 px-2 py-4 text-[11px] text-ink3 uppercase font-semibold tracking-wider">
          <span className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></div> Dominio (&ge; 9)</span>
          <span className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></div> Regular (7 - 8.9)</span>
          <span className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-rose-100 border border-rose-300"></div> Riesgo (&lt; 7)</span>
        </div>
      </div>
    </div>
  )
}

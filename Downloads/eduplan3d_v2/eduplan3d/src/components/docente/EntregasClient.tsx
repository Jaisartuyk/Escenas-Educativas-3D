'use client'

import { useState, useMemo } from 'react'
import {
  Inbox, BookOpen, CheckCircle2, Clock3, Filter, ChevronDown,
  Search, FileText, Check, AlertTriangle, ExternalLink, MessageSquare, Award, X
} from 'lucide-react'
import toast from 'react-hot-toast'

function getStatusInfo(sub: any, grades: any[], a: any) {
  const isEvaluated = grades.some((g: any) => g.assignment_id === sub.assignment_id && g.student_id === sub.student_id)
  
  if (isEvaluated) return { label: 'Evaluada', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 }
  return { label: 'Pendiente de Revisión', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock3 }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function EntregasClient({ profile, subjects, assignments, submissions, grades }: any) {
  const [filterCourse, setFilterCourse] = useState('todos')
  const [filterSubject, setFilterSubject] = useState('todos')
  const [filterStatus, setFilterStatus] = useState('todos') // todos, evaluadas, pendientes
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedAsg, setExpandedAsg] = useState<string | null>(null)

  // ── Filtros Derivados ──
  const courses = useMemo(() => {
    const map = new Map()
    subjects.forEach((s: any) => {
      if (s.course) {
        map.set(s.course.id, `${s.course.name} ${s.course.parallel || ''}`)
      }
    })
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [subjects])

  const filteredSubjects = useMemo(() => {
    if (filterCourse === 'todos') return subjects
    return subjects.filter((s: any) => s.course_id === filterCourse)
  }, [subjects, filterCourse])

  const filteredAssignments = useMemo(() => {
    let list = assignments
    // Filtrar por Materia & Curso indirectamente
    if (filterSubject !== 'todos') {
      list = list.filter((a: any) => a.subject_id === filterSubject)
    } else if (filterCourse !== 'todos') {
      const subjIds = filteredSubjects.map((s: any) => s.id)
      list = list.filter((a: any) => subjIds.includes(a.subject_id))
    }

    // Filtrar por busqueda
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter((a: any) => 
        a.title.toLowerCase().includes(q) ||
        submissions.some((sub: any) => sub.assignment_id === a.id && sub.student?.full_name?.toLowerCase().includes(q))
      )
    }

    return list
  }, [assignments, filterCourse, filterSubject, searchTerm, filteredSubjects, submissions])

  // Map submissions to exactly what we need per assignment
  const assignmentsWithSubs = useMemo(() => {
    return filteredAssignments.map((a: any) => {
      const subs = submissions.filter((s: any) => s.assignment_id === a.id)
      
      let finalSubs = subs
      if (filterStatus === 'evaluadas') {
        finalSubs = subs.filter((s: any) => grades.some((g: any) => g.assignment_id === s.assignment_id && g.student_id === s.student_id))
      } else if (filterStatus === 'pendientes') {
        finalSubs = subs.filter((s: any) => !grades.some((g: any) => g.assignment_id === s.assignment_id && g.student_id === s.student_id))
      }

      return {
        ...a,
        submissions: finalSubs,
        subject: subjects.find((s: any) => s.id === a.subject_id)
      }
    }).filter((a: any) => a.submissions.length > 0) // Hide assignments that have 0 submissions matching the filters
  }, [filteredAssignments, submissions, filterStatus, grades, subjects])

  // KPIs
  const kpis = useMemo(() => {
    const totalSubs = submissions.length
    const evaluated = submissions.filter((s: any) => grades.some((g: any) => g.assignment_id === s.assignment_id && g.student_id === s.student_id)).length
    const pending = totalSubs - evaluated
    return { totalSubs, evaluated, pending }
  }, [submissions, grades])

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* ── Header / KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-2xl border border-surface2 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50/50 dark:bg-indigo-900/10 flex items-center justify-center">
              <Inbox size={16} className="text-indigo-600" />
            </div>
            <span className="text-xs font-bold text-ink3 uppercase tracking-wider">Total Entregas</span>
          </div>
          <p className="text-3xl font-display font-bold">{kpis.totalSubs}</p>
        </div>
        <div className="bg-surface rounded-2xl border border-surface2 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 flex items-center justify-center">
              <Clock3 size={16} className="text-amber-600" />
            </div>
            <span className="text-xs font-bold text-ink3 uppercase tracking-wider">Pendientes Revisión</span>
          </div>
          <p className="text-3xl font-display font-bold text-amber-600">{kpis.pending}</p>
        </div>
        <div className="bg-surface rounded-2xl border border-surface2 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-emerald-600" />
            </div>
            <span className="text-xs font-bold text-ink3 uppercase tracking-wider">Evaluadas</span>
          </div>
          <p className="text-3xl font-display font-bold text-emerald-600">{kpis.evaluated}</p>
        </div>
      </div>

      {/* ── Toolbar / Filtros ── */}
      <div className="bg-surface rounded-2xl border border-surface2 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink4" />
            <input
              type="text"
              placeholder="Buscar por nombre de tarea o alumno..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-bg border border-surface2 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-violet/50 transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter size={14} className="text-ink4 mr-1" />
          <span className="text-xs font-semibold text-ink4 uppercase tracking-wider mr-2">Filtros:</span>

          <div className="relative min-w-[140px]">
            <select value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setFilterSubject('todos') }}
              className="appearance-none w-full bg-bg border border-surface2 rounded-lg pl-3 pr-7 py-1.5 text-xs font-medium focus:outline-none cursor-pointer">
              <option value="todos">Todos los Cursos</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
          </div>

          <div className="relative min-w-[140px]">
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
              className="appearance-none w-full bg-bg border border-surface2 rounded-lg pl-3 pr-7 py-1.5 text-xs font-medium focus:outline-none cursor-pointer">
              <option value="todos">Todas las Materias</option>
              {filteredSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
          </div>

          <div className="relative min-w-[140px]">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="appearance-none w-full bg-bg border border-surface2 rounded-lg pl-3 pr-7 py-1.5 text-xs font-medium focus:outline-none cursor-pointer">
              <option value="todos">Todos los Estados</option>
              <option value="pendientes">Pendientes de revisión</option>
              <option value="evaluadas">Evaluadas</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
          </div>

          {(filterCourse !== 'todos' || filterSubject !== 'todos' || filterStatus !== 'todos' || searchTerm) && (
            <button
              onClick={() => { setFilterCourse('todos'); setFilterSubject('todos'); setFilterStatus('todos'); setSearchTerm('') }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink3 hover:text-ink hover:bg-surface2 transition-colors ml-auto"
            >
              <X size={12} /> Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── Content: Tareas y sus Entregas ── */}
      <div className="space-y-4">
        {assignmentsWithSubs.length === 0 ? (
          <div className="p-16 text-center bg-surface rounded-3xl border border-surface2 shadow-sm">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-violet/5">
              <Inbox size={28} className="text-violet" />
            </div>
            <p className="font-semibold text-ink2">No hay entregas para mostrar</p>
            <p className="text-sm text-ink4 mt-1">Ajusta los filtros o verifica más tarde.</p>
          </div>
        ) : (
          assignmentsWithSubs.map((a: any) => {
            const isExpanded = expandedAsg === a.id
            const subjectLabel = a.subject ? a.subject.name : 'Materia desconocida'
            const subsPending = a.submissions.filter((s: any) => !grades.some((g: any) => g.assignment_id === s.assignment_id && g.student_id === s.student_id)).length

            return (
              <div key={a.id} className="bg-surface rounded-2xl border border-surface2 overflow-hidden shadow-sm transition-all hover:border-violet/30">
                {/* Header (Accordion Row) */}
                <div 
                  className="p-4 sm:px-6 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 select-none"
                  onClick={() => setExpandedAsg(isExpanded ? null : a.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-700 tracking-wider uppercase border border-violet-100">
                        {subjectLabel}
                      </span>
                      {subsPending > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Check size={10} /> {subsPending} Nuevas
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-display font-bold text-lg text-ink truncate">{a.title}</h3>
                      <ChevronDown size={18} className={`text-ink4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-ink3 font-medium bg-bg px-3 py-1.5 rounded-lg border border-surface2 flex-shrink-0">
                    <FileText size={16} className="text-indigo-500" />
                    <span>{a.submissions.length} entrega(s)</span>
                  </div>
                </div>

                {/* Body (Table of submissions) */}
                {isExpanded && (
                  <div className="border-t border-surface2 bg-bg/50">
                    {a.submissions.map((sub: any, i: number) => {
                      const st = getStatusInfo(sub, grades, a)
                      const Icon = st.icon
                      const gradeObj = grades.find((g: any) => g.assignment_id === sub.assignment_id && g.student_id === sub.student_id)

                      return (
                        <div key={sub.id} className={`p-4 sm:px-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center hover:bg-surface/60 transition-colors ${i < a.submissions.length - 1 ? 'border-b border-surface2/60' : ''}`}>
                          
                          {/* Student Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-ink truncate">{sub.student?.full_name || 'Estudiante'}</p>
                            <p className="text-xs text-ink4 mt-0.5 flex items-center gap-1.5">
                              Enviado: {formatDate(sub.submitted_at)}
                            </p>
                          </div>

                          {/* Comment & File */}
                          <div className="flex-1 w-full min-w-0 space-y-2">
                            {sub.comment && (
                              <div className="flex gap-2 text-xs text-ink3 bg-white dark:bg-surface border border-surface2 p-2 rounded-lg italic w-full">
                                <MessageSquare size={13} className="text-violet-400 flex-shrink-0 mt-0.5" />
                                <span className="line-clamp-2 truncate whitespace-normal" title={sub.comment}>"{sub.comment}"</span>
                              </div>
                            )}
                            {sub.file_url ? (
                              <div className="flex flex-col gap-2">
                                {/.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(sub.file_url) && (
                                  <a href={sub.file_url} target="_blank" rel="noreferrer" className="block max-w-[200px] max-h-[150px] overflow-hidden rounded-lg border border-surface2 hover:shadow-sm transition-shadow">
                                    <img src={sub.file_url} alt="Preview" className="w-full h-full object-cover" />
                                  </a>
                                )}
                                <a href={sub.file_url} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors border border-indigo-100 max-w-full w-max">
                                  <FileText size={14} className="flex-shrink-0" />
                                  <span className="truncate">Ver archivo adjunto</span>
                                  <ExternalLink size={12} className="ml-1 opacity-60 flex-shrink-0" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-xs text-ink4 block">— Sin archivo —</span>
                            )}
                          </div>

                          {/* Status / Evaluation */}
                          <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase border flex items-center gap-1.5 ${st.bg} ${st.text} ${st.border}`}>
                              <Icon size={12} /> {st.label}
                            </div>
                            
                            {gradeObj ? (
                              <div className="text-sm font-bold text-ink">
                                Nota: <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{gradeObj.score}</span>
                              </div>
                            ) : (
                              <div className="text-xs text-ink4 italic flex items-center gap-1">
                                Ir al panel para evaluar
                              </div>
                            )}
                          </div>

                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

    </div>
  )
}

'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, Users, TrendingUp, CheckSquare, Clock, ArrowLeft, Search, Mail, Phone, Calendar, Download } from 'lucide-react'
import { cualitativo } from '@/lib/utils'
import { RendimientoClient } from '@/components/tutorias/RendimientoClient'
import { DirectorioTutorClient } from '@/components/tutorias/DirectorioTutorClient'

interface Props {
  teachers: any[]
  courses: any[]
  subjects: any[]
  enrollments: any[]
  assignments: any[]
  grades: any[]
  categories: any[]
  attendance: any[]
  parcialesCount: number
  tutoresMapping: Record<string, string>
  role?: string
  institutionSettings?: any
}

export function SupervisionTutoresClient({
  teachers,
  courses,
  subjects,
  enrollments,
  assignments,
  grades,
  categories,
  attendance,
  parcialesCount,
  tutoresMapping,
  role,
  institutionSettings
}: Props) {
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'kpis' | 'rendimiento' | 'estudiantes' | 'asistencia'>('kpis')

  // 1. Identificar tutores reales y sus cursos
  const tutorData = useMemo(() => {
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
    
    // Mapear tutores a sus cursos
    const tutorsWithCourses: any[] = []

    teachers.forEach(teacher => {
      const teacherName = teacher.full_name.trim().toLowerCase()
      const teacherCourses: any[] = []

      // Buscar en el mapping qué cursos tiene este docente
      Object.entries(tutoresMapping).forEach(([cursoName, tutorName]) => {
        if (typeof tutorName === 'string' && tutorName.trim().toLowerCase() === teacherName) {
           // Encontrar el objeto curso real
           const foundCourse = courses.find(c => {
             const cName = c.parallel ? `${c.name} ${c.parallel}`.trim() : c.name
             return normalize(cName) === normalize(cursoName)
           })
           if (foundCourse) teacherCourses.push(foundCourse)
        }
      })

      if (teacherCourses.length > 0) {
        // Calcular KPIs para estos cursos
        const tutorCourseIds = teacherCourses.map(c => c.id)
        const tutorEnrollments = enrollments.filter(e => tutorCourseIds.includes(e.course_id))
        const tutorSubjects = subjects.filter(s => tutorCourseIds.includes(s.course_id))
        const tutorSubjectIds = tutorSubjects.map(s => s.id)
        const tutorAssignments = assignments.filter(a => tutorSubjectIds.includes(a.subject_id))
        const tutorAssignmentIds = tutorAssignments.map(a => a.id)
        const tutorGrades = grades.filter(g => tutorAssignmentIds.includes(g.assignment_id))
        const tutorAttendance = attendance.filter(att => tutorSubjectIds.includes(att.subject_id))

        // Promedio del curso
        const avg = tutorGrades.length > 0 
          ? tutorGrades.reduce((acc, curr) => acc + curr.score, 0) / tutorGrades.length 
          : 0

        // % Asistencia
        const attTotal = tutorAttendance.length
        const attPresent = tutorAttendance.filter(a => a.status === 'present').length
        const attPercent = attTotal > 0 ? (attPresent / attTotal) * 100 : 100

        tutorsWithCourses.push({
          id: teacher.id,
          name: teacher.full_name,
          email: teacher.email,
          courses: teacherCourses,
          metrics: {
            alumnos: tutorEnrollments.length,
            promedio: avg,
            asistencia: attPercent,
            materias: tutorSubjects.length
          }
        })
      }
    })

    return tutorsWithCourses
  }, [teachers, courses, tutoresMapping, enrollments, subjects, assignments, grades, attendance])

  const filteredTutors = tutorData.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.courses.some((c:any) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const selectedTutor = tutorData.find(t => t.id === selectedTutorId)

  if (selectedTutorId && selectedTutor) {
    const tutorCourseIds = selectedTutor.courses.map((c:any) => c.id)
    const tutorEnrollments = enrollments.filter(e => tutorCourseIds.includes(e.course_id))
    const tutorSubjects = subjects.filter(s => tutorCourseIds.includes(s.course_id))
    const tutorAssignments = assignments.filter(a => tutorSubjects.map(s => s.id).includes(a.subject_id))
    const tutorGrades = grades.filter(g => tutorAssignments.map(a => a.id).includes(g.assignment_id))

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedTutorId(null)}
              className="p-2 hover:bg-surface2 rounded-full transition-colors text-ink3"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-ink">{selectedTutor.name}</h2>
              <p className="text-sm text-ink3">Tutor de: {selectedTutor.courses.map((c:any) => `${c.name} ${c.parallel || ''}`).join(', ')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-sm flex items-center gap-2">
              <Download size={16} /> Reporte PDF
            </button>
          </div>
        </div>

        {/* Tabs de Detalle */}
        <div className="flex items-center gap-1 bg-surface border border-surface2 rounded-xl p-1 w-fit">
          {[
            { id: 'kpis', label: 'Resumen', icon: TrendingUp },
            { id: 'rendimiento', label: 'Rendimiento', icon: CheckSquare },
            { id: 'asistencia', label: 'Asistencia', icon: Clock },
            { id: 'estudiantes', label: 'Estudiantes', icon: Users },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-violet2 text-white shadow-sm' : 'text-ink3 hover:bg-surface2'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="animate-fade-in">
          {activeTab === 'kpis' && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               {/* Metrics cards */}
               <div className="card p-5 bg-violet2/5 border-violet2/10">
                 <div className="flex items-center gap-3 mb-3">
                   <div className="w-10 h-10 rounded-lg bg-violet2/10 flex items-center justify-center text-violet2"><TrendingUp size={20}/></div>
                   <div className="text-sm font-bold text-violet2 uppercase tracking-wider">Promedio General</div>
                 </div>
                 <div className="text-3xl font-display font-bold text-ink">{selectedTutor.metrics.promedio.toFixed(2)}</div>
                 <p className="text-xs text-ink4 mt-1">Sugerido para el cierre de parcial.</p>
               </div>
               
               <div className="card p-5 bg-teal/5 border-teal/10">
                 <div className="flex items-center gap-3 mb-3">
                   <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center text-teal"><Clock size={20}/></div>
                   <div className="text-sm font-bold text-teal uppercase tracking-wider">Asistencia</div>
                 </div>
                 <div className="text-3xl font-display font-bold text-ink">{selectedTutor.metrics.asistencia.toFixed(0)}%</div>
                 <p className="text-xs text-ink4 mt-1">Presencia acumulada del curso.</p>
               </div>

               <div className="card p-5 bg-amber/5 border-amber/10">
                 <div className="flex items-center gap-3 mb-3">
                   <div className="w-10 h-10 rounded-lg bg-amber/10 flex items-center justify-center text-amber"><Users size={20}/></div>
                   <div className="text-sm font-bold text-amber uppercase tracking-wider">Estudiantes</div>
                 </div>
                 <div className="text-3xl font-display font-bold text-ink">{selectedTutor.metrics.alumnos}</div>
                 <p className="text-xs text-ink4 mt-1">Población total a cargo.</p>
               </div>

               <div className="card p-5 bg-rose/5 border-rose/10">
                 <div className="flex items-center gap-3 mb-3">
                   <div className="w-10 h-10 rounded-lg bg-rose/10 flex items-center justify-center text-rose"><CheckSquare size={20}/></div>
                   <div className="text-sm font-bold text-rose uppercase tracking-wider">Materias</div>
                 </div>
                 <div className="text-3xl font-display font-bold text-ink">{selectedTutor.metrics.materias}</div>
                 <p className="text-xs text-ink4 mt-1">Total asignaturas dictadas.</p>
               </div>
             </div>
          )}

          {activeTab === 'rendimiento' && (
            <RendimientoClient 
              courses={selectedTutor.courses}
              enrollments={tutorEnrollments}
              subjects={tutorSubjects}
              assignments={tutorAssignments}
              grades={tutorGrades}
              categories={categories}
              parcialesCount={parcialesCount}
            />
          )}

          {activeTab === 'asistencia' && (
             <div className="card p-8 text-center text-ink3">
               <Calendar className="mx-auto mb-4 opacity-20" size={48} />
               <p>Módulo de historial de asistencia detallado del tutor en desarrollo.</p>
               <p className="text-xs mt-2 italic">Puedes ver el reporte de asistencia por materia en el panel de Docencia.</p>
             </div>
          )}

          {activeTab === 'estudiantes' && (
            <DirectorioTutorClient 
              courses={selectedTutor.courses}
              students={tutorEnrollments.map(en => {
                const extra = (institutionSettings?.directory || {})[en.student_id] || {}
                return {
                  ...en.student,
                  ...extra,
                  courseId: en.course_id
                }
              })}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-surface border border-surface2 p-4 rounded-2xl">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink4" size={18} />
          <input 
            type="text"
            placeholder="Buscar por tutor o curso..."
            className="input-base pl-10"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-ink4 text-xs font-bold uppercase tracking-widest whitespace-nowrap">
          {filteredTutors.length} Tutores Encontrados
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTutors.map(tutor => (
          <div 
            key={tutor.id}
            onClick={() => setSelectedTutorId(tutor.id)}
            className="group card bg-surface hover:bg-surface2 border-surface2 transition-all cursor-pointer p-0 overflow-hidden hover:shadow-xl hover:-translate-y-1"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-violet2/10 flex items-center justify-center text-violet2 font-display font-bold text-lg border border-violet2/20">
                    {tutor.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-ink group-hover:text-violet2 transition-colors">{tutor.name}</h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tutor.courses.map((c:any) => (
                        <span key={c.id} className="text-[10px] px-2 py-0.5 rounded-full bg-surface2 text-ink3 font-bold border border-ink4/10">
                          {c.name} {c.parallel}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-bg/50 p-2 rounded-xl border border-[rgba(0,0,0,0.02)] text-center">
                  <p className="text-[10px] text-ink4 font-bold uppercase mb-1">Promedio</p>
                  <p className="text-sm font-bold text-ink">{tutor.metrics.promedio.toFixed(2)}</p>
                </div>
                <div className="bg-bg/50 p-2 rounded-xl border border-[rgba(0,0,0,0.02)] text-center">
                  <p className="text-[10px] text-ink4 font-bold uppercase mb-1">Asist.</p>
                  <p className="text-sm font-bold text-teal">{tutor.metrics.asistencia.toFixed(0)}%</p>
                </div>
                <div className="bg-bg/50 p-2 rounded-xl border border-[rgba(0,0,0,0.02)] text-center">
                  <p className="text-[10px] text-ink4 font-bold uppercase mb-1">Alumnos</p>
                  <p className="text-sm font-bold text-ink">{tutor.metrics.alumnos}</p>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-3 bg-bg/30 border-t border-[rgba(0,0,0,0.05)] flex items-center justify-between group-hover:bg-violet2/5 transition-colors">
              <div className="flex items-center gap-2 text-ink4 text-xs">
                <Mail size={12}/> {tutor.email.split('@')[0]}
              </div>
              <span className="text-[10px] font-bold text-violet2 uppercase group-hover:translate-x-1 transition-transform">Inspeccionar →</span>
            </div>
          </div>
        ))}
      </div>

      {filteredTutors.length === 0 && (
        <div className="py-20 text-center bg-surface border border-dashed border-surface2 rounded-2xl">
          <Users className="mx-auto text-ink4 mb-4" size={48}/>
          <h3 className="font-bold text-lg text-ink">No se encontraron tutores</h3>
          <p className="text-ink3 text-sm">Prueba ajustando los criterios de búsqueda.</p>
        </div>
      )}
    </div>
  )
}

'use client'
// src/components/institucion/InstitucionClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

interface Miembro {
  id: string
  full_name: string
  email: string
  role: string
  created_at: string
}

interface Curso {
  id: string
  name: string
  parallel: string
  level: string
  shift: string
  created_at: string
}

interface Materia {
  id: string
  name: string
  weekly_hours: number
  course_id: string
  teacher_id: string | null
}

interface Props {
  institution: { id: string; name: string; join_code: string; created_at: string }
  members: Miembro[]
  courses: Curso[]
  subjects: Materia[]
  teachers: Miembro[]
  currentUserId: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', teacher: 'Docente', student: 'Alumno', assistant: 'Asistente', horarios_only: 'Asistente'
}
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-[rgba(124,109,250,0.15)] text-violet2',
  teacher: 'bg-[rgba(38,215,180,0.12)] text-teal',
  student: 'bg-[rgba(255,179,71,0.12)] text-amber',
  assistant: 'bg-[rgba(240,98,146,0.12)] text-rose',
  horarios_only: 'bg-[rgba(240,98,146,0.12)] text-rose',
}

export function InstitucionClient({ institution, members, courses, subjects, teachers, currentUserId }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'general' | 'miembros' | 'cursos' | 'materias'>('general')

  // ── Course state ──
  const [showAddCourse, setShowAddCourse] = useState(false)
  const [courseName, setCourseName] = useState('')
  const [courseParallel, setCourseParallel] = useState('A')
  const [courseLevel, setCourseLevel] = useState('Colegio')
  const [courseShift, setCourseShift] = useState('MATUTINA')
  const [savingCourse, setSavingCourse] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingCourse, setEditingCourse] = useState<Curso | null>(null)

  // ── Subject (materia) state ──
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [subjectName, setSubjectName] = useState('')
  const [subjectCourseId, setSubjectCourseId] = useState(courses[0]?.id || '')
  const [subjectHours, setSubjectHours] = useState(1)
  const [subjectTeacherId, setSubjectTeacherId] = useState('')
  const [savingSubject, setSavingSubject] = useState(false)
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null)
  const [editingSubject, setEditingSubject] = useState<Materia | null>(null)
  const [filterCourseId, setFilterCourseId] = useState<string>('all')

  // ── Course actions ──
  async function deleteCourse(id: string, name: string) {
    if (!confirm(`¿Eliminar el curso "${name}"? Esto también eliminará sus materias y datos asociados.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/institucion/courses?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      toast.success('Curso eliminado')
      router.refresh()
    } catch {
      toast.error('No se pudo eliminar el curso')
    } finally {
      setDeletingId(null)
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(institution.join_code)
    toast.success('¡Código copiado al portapapeles!')
  }

  async function addCourse() {
    if (!courseName.trim()) return toast.error('Escribe el nombre del curso')
    setSavingCourse(true)
    try {
      const res = await fetch('/api/institucion/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: institution.id,
          name: courseName,
          parallel: courseParallel,
          level: courseLevel,
          shift: courseShift,
        }),
      })
      if (!res.ok) throw new Error('Error al guardar')
      toast.success('¡Curso creado!')
      setCourseName('')
      setShowAddCourse(false)
      router.refresh()
    } catch {
      toast.error('No se pudo crear el curso')
    } finally {
      setSavingCourse(false)
    }
  }

  async function updateCourse() {
    if (!editingCourse) return
    setSavingCourse(true)
    try {
      const res = await fetch('/api/institucion/courses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCourse.id,
          name: editingCourse.name,
          parallel: editingCourse.parallel,
          level: editingCourse.level,
          shift: editingCourse.shift,
        }),
      })
      if (!res.ok) throw new Error('Error al actualizar')
      toast.success('Curso actualizado')
      setEditingCourse(null)
      router.refresh()
    } catch {
      toast.error('No se pudo actualizar el curso')
    } finally {
      setSavingCourse(false)
    }
  }

  // ── Subject (materia) actions ──
  async function addSubject() {
    if (!subjectName.trim()) return toast.error('Escribe el nombre de la materia')
    if (!subjectCourseId) return toast.error('Selecciona un curso')
    // Check duplicate: same name + same course
    const duplicate = subjects.find(
      s => s.name.trim().toUpperCase() === subjectName.trim().toUpperCase() && s.course_id === subjectCourseId
    )
    if (duplicate) {
      return toast.error(`"${subjectName.trim().toUpperCase()}" ya existe en ${getCourseName(subjectCourseId)}`)
    }
    if (subjectHours < 1 || subjectHours > 20) return toast.error('Las horas deben estar entre 1 y 20')
    setSavingSubject(true)
    try {
      const res = await fetch('/api/institucion/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: institution.id,
          course_id: subjectCourseId,
          name: subjectName,
          weekly_hours: subjectHours,
          teacher_id: subjectTeacherId || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }
      toast.success('¡Materia creada!')
      setSubjectName('')
      setSubjectHours(1)
      setSubjectTeacherId('')
      setShowAddSubject(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'No se pudo crear la materia')
    } finally {
      setSavingSubject(false)
    }
  }

  async function updateSubject() {
    if (!editingSubject) return
    setSavingSubject(true)
    try {
      const res = await fetch('/api/institucion/subjects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSubject.id,
          name: editingSubject.name,
          weekly_hours: editingSubject.weekly_hours,
          teacher_id: editingSubject.teacher_id,
        }),
      })
      if (!res.ok) throw new Error('Error al actualizar')
      toast.success('Materia actualizada')
      setEditingSubject(null)
      router.refresh()
    } catch {
      toast.error('No se pudo actualizar')
    } finally {
      setSavingSubject(false)
    }
  }

  async function deleteSubject(id: string, name: string) {
    if (!confirm(`¿Eliminar la materia "${name}"?`)) return
    setDeletingSubjectId(id)
    try {
      const res = await fetch(`/api/institucion/subjects?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      toast.success('Materia eliminada')
      router.refresh()
    } catch {
      toast.error('No se pudo eliminar')
    } finally {
      setDeletingSubjectId(null)
    }
  }

  // ── Helpers ──
  const getCourseName = (courseId: string) => {
    const c = courses.find(c => c.id === courseId)
    return c ? `${c.name}${c.parallel ? ` ${c.parallel}` : ''}` : '—'
  }

  const getTeacherName = (teacherId: string | null) => {
    if (!teacherId) return '—'
    const t = teachers.find(t => t.id === teacherId)
    return t?.full_name || '—'
  }

  // Get teachers who already teach this subject in any course
  // If nobody teaches it yet, return all teachers so the first assignment can be made
  const getTeachersForSubject = (subjectName: string) => {
    const normalizedName = subjectName.trim().toUpperCase()
    if (!normalizedName) return { associated: [], others: teachers }

    const teacherIdsWithSubject = new Set(
      subjects
        .filter(s => s.name.trim().toUpperCase() === normalizedName && s.teacher_id)
        .map(s => s.teacher_id!)
    )
    const associated = teachers.filter(t => teacherIdsWithSubject.has(t.id))
    // Only show "others" if nobody teaches this subject yet (first assignment)
    const others = associated.length === 0 ? teachers : []
    return { associated, others }
  }

  const filteredSubjects = filterCourseId === 'all'
    ? subjects
    : subjects.filter(s => s.course_id === filterCourseId)

  // Group subjects by course for display
  const subjectsByCourse: Record<string, Materia[]> = {}
  filteredSubjects.forEach(s => {
    if (!subjectsByCourse[s.course_id]) subjectsByCourse[s.course_id] = []
    subjectsByCourse[s.course_id].push(s)
  })

  const tabs = [
    { key: 'general',  label: '⚙️ General'  },
    { key: 'miembros', label: '👥 Miembros' },
    { key: 'cursos',   label: '📚 Cursos'   },
    { key: 'materias', label: '📝 Materias' },
  ] as const

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[rgba(120,100,255,0.14)] pb-0 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px whitespace-nowrap ${
              tab === t.key
                ? 'border-violet2 text-violet2'
                : 'border-transparent text-ink3 hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── GENERAL ─── */}
      {tab === 'general' && (
        <div className="max-w-lg">
          <div className="card p-6 flex flex-col gap-5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-2">Nombre de la Institución</label>
              <div className="input-base">{institution.name}</div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-2">Código de Invitación</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 input-base font-mono text-teal text-lg tracking-[4px] font-bold">{institution.join_code}</code>
                <button onClick={copyCode} className="btn-secondary px-4 py-2 text-sm whitespace-nowrap">📋 Copiar</button>
              </div>
              <p className="text-[11px] text-ink3 mt-2">Comparte este código con tus docentes y alumnos para que se unan.</p>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1">Creada el</label>
              <p className="text-sm text-ink2">{format(new Date(institution.created_at), "d 'de' MMMM, yyyy", { locale: es })}</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── MIEMBROS ─── */}
      {tab === 'miembros' && (
        <div>
          <p className="text-sm text-ink3 mb-4">{members.length} miembro{members.length !== 1 ? 's' : ''} en esta institución</p>
          <div className="flex flex-col gap-3">
            {members.map(m => (
              <div key={m.id} className="card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet to-violet2 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {m.full_name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{m.full_name || 'Sin nombre'} {m.id === currentUserId && <span className="text-ink3 text-xs">(tú)</span>}</p>
                  <p className="text-xs text-ink3 truncate">{m.email}</p>
                </div>
                <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${ROLE_COLORS[m.role] ?? 'bg-surface text-ink3'}`}>
                  {ROLE_LABELS[m.role] ?? m.role}
                </span>
                <span className="text-[11px] text-ink3">{format(new Date(m.created_at), "d MMM yyyy", { locale: es })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── CURSOS ─── */}
      {tab === 'cursos' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-ink3">{courses.length} curso{courses.length !== 1 ? 's' : ''} configurado{courses.length !== 1 ? 's' : ''}</p>
            <button onClick={() => setShowAddCourse(v => !v)} className="btn-primary text-sm px-4 py-2">
              {showAddCourse ? '✕ Cancelar' : '+ Añadir curso'}
            </button>
          </div>

          {showAddCourse && (
            <div className="card p-5 mb-5 border border-[rgba(124,109,250,0.3)]">
              <h3 className="font-bold text-sm mb-4">Nuevo Curso</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nombre del Curso</label>
                  <input value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="Ej: 8vo Básica" className="input-base w-full" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Paralelo</label>
                  <input value={courseParallel} onChange={e => setCourseParallel(e.target.value)} placeholder="A" className="input-base w-full" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nivel</label>
                  <select value={courseLevel} onChange={e => setCourseLevel(e.target.value)} className="input-base w-full">
                    <option value="Colegio">Colegio / BGU</option>
                    <option value="Escuela">Escuela / Básica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Jornada</label>
                  <select value={courseShift} onChange={e => setCourseShift(e.target.value)} className="input-base w-full">
                    <option value="MATUTINA">Matutina</option>
                    <option value="VESPERTINA">Vespertina</option>
                    <option value="AMBAS">Ambas jornadas</option>
                  </select>
                </div>
              </div>
              <button onClick={addCourse} disabled={savingCourse} className="btn-primary text-sm px-6 py-2">
                {savingCourse ? 'Guardando...' : 'Guardar Curso'}
              </button>
            </div>
          )}

          {/* Edit course form */}
          {editingCourse && (
            <div className="card p-5 mb-5 border border-amber-300 bg-amber-50/30">
              <h3 className="font-bold text-sm mb-4">Editar Curso — {editingCourse.name}</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nombre</label>
                  <input value={editingCourse.name} onChange={e => setEditingCourse({ ...editingCourse, name: e.target.value })} className="input-base w-full" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Paralelo</label>
                  <input value={editingCourse.parallel} onChange={e => setEditingCourse({ ...editingCourse, parallel: e.target.value })} className="input-base w-full" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nivel</label>
                  <select value={editingCourse.level} onChange={e => setEditingCourse({ ...editingCourse, level: e.target.value })} className="input-base w-full">
                    <option value="Colegio">Colegio / BGU</option>
                    <option value="Escuela">Escuela / Básica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Jornada</label>
                  <select value={editingCourse.shift} onChange={e => setEditingCourse({ ...editingCourse, shift: e.target.value })} className="input-base w-full">
                    <option value="MATUTINA">Matutina</option>
                    <option value="VESPERTINA">Vespertina</option>
                    <option value="AMBAS">Ambas jornadas</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={updateCourse} disabled={savingCourse} className="btn-primary text-sm px-6 py-2">
                  {savingCourse ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button onClick={() => setEditingCourse(null)} className="btn-secondary text-sm px-4 py-2">Cancelar</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {courses.length === 0 ? (
              <div className="col-span-2 card p-10 text-center text-ink3">
                <p className="text-3xl mb-3">📚</p>
                <p className="text-sm font-medium">Aún no hay cursos</p>
                <p className="text-xs mt-1">Añade tu primer curso con el botón de arriba</p>
              </div>
            ) : courses.map(c => {
              const levelLabel = c.level === 'Escuela' ? '🏫 Escuela' : '🎓 Colegio'
              const shiftLabel = c.shift === 'MATUTINA' ? '🌅 Mat.' : c.shift === 'VESPERTINA' ? '🌇 Vesp.' : '🔄 Ambas'
              const matCount = subjects.filter(s => s.course_id === c.id).length
              return (
                <div key={c.id} className="card p-4 group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm">{c.name} {c.parallel && `— ${c.parallel}`}</h3>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[rgba(124,109,250,0.1)] text-violet2">{levelLabel}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[rgba(38,215,180,0.1)] text-teal">{shiftLabel}</span>
                        <span className="text-[10px] text-ink3">{matCount} materia{matCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingCourse(c); setShowAddCourse(false) }}
                        className="text-xs px-2 py-1 rounded text-violet-600 hover:bg-violet-50 font-semibold"
                        title="Editar curso"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteCourse(c.id, c.name)}
                        disabled={deletingId === c.id}
                        className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50"
                        title="Eliminar curso"
                      >
                        {deletingId === c.id ? '...' : '✕'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── MATERIAS ─── */}
      {tab === 'materias' && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-ink3">{subjects.length} materia{subjects.length !== 1 ? 's' : ''} en total</p>
              {/* Filter by course */}
              <select
                value={filterCourseId}
                onChange={e => {
                  const val = e.target.value
                  setFilterCourseId(val)
                  // Sync course selector in add form if it's open
                  if (showAddSubject && val !== 'all') {
                    setSubjectCourseId(val)
                  }
                }}
                className="input-base text-xs py-1.5 px-3"
              >
                <option value="all">Todos los cursos</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.parallel && c.parallel}</option>
                ))}
              </select>
            </div>
            <button onClick={() => {
              const opening = !showAddSubject
              setShowAddSubject(opening)
              setEditingSubject(null)
              // Auto-select the filtered course when opening the form
              if (opening && filterCourseId !== 'all') {
                setSubjectCourseId(filterCourseId)
              } else if (opening && courses.length > 0) {
                setSubjectCourseId(courses[0].id)
              }
            }} className="btn-primary text-sm px-4 py-2">
              {showAddSubject ? '✕ Cancelar' : '+ Añadir materia'}
            </button>
          </div>

          {/* Add subject form */}
          {showAddSubject && (
            <div className="card p-5 mb-5 border border-[rgba(124,109,250,0.3)]">
              <h3 className="font-bold text-sm mb-4">Nueva Materia</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nombre de la Materia</label>
                  <input
                    value={subjectName}
                    onChange={e => setSubjectName(e.target.value)}
                    placeholder="Ej: MATEMÁTICA"
                    className="input-base w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Curso</label>
                  {filterCourseId !== 'all' ? (
                    <div className="input-base w-full bg-[rgba(124,109,250,0.05)] text-ink2 font-medium flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      {getCourseName(filterCourseId)}
                    </div>
                  ) : (
                    <select
                      value={subjectCourseId}
                      onChange={e => setSubjectCourseId(e.target.value)}
                      className="input-base w-full"
                    >
                      <option value="">Seleccionar curso...</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.parallel && c.parallel}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Horas semanales</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={subjectHours}
                    onChange={e => setSubjectHours(parseInt(e.target.value) || 1)}
                    className="input-base w-full"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Docente (opcional)</label>
                  {(() => {
                    const { associated, others } = getTeachersForSubject(subjectName)
                    return (
                      <select
                        value={subjectTeacherId}
                        onChange={e => setSubjectTeacherId(e.target.value)}
                        className="input-base w-full"
                      >
                        <option value="">Sin asignar</option>
                        {associated.length > 0 && (
                          <optgroup label={`✓ Docentes de ${subjectName.toUpperCase() || 'esta materia'}`}>
                            {associated.map(t => (
                              <option key={t.id} value={t.id}>⭐ {t.full_name || t.email}</option>
                            ))}
                          </optgroup>
                        )}
                        {others.length > 0 && (
                          <optgroup label="Todos los docentes (sin asignación previa)">
                            {others.map(t => (
                              <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    )
                  })()}
                </div>
              </div>
              <button onClick={addSubject} disabled={savingSubject} className="btn-primary text-sm px-6 py-2">
                {savingSubject ? 'Guardando...' : 'Guardar Materia'}
              </button>
            </div>
          )}

          {/* Edit subject inline */}
          {editingSubject && (
            <div className="card p-5 mb-5 border border-amber-300 bg-amber-50/30">
              <h3 className="font-bold text-sm mb-4">Editar Materia</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nombre</label>
                  <input
                    value={editingSubject.name}
                    onChange={e => setEditingSubject({ ...editingSubject, name: e.target.value })}
                    className="input-base w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Horas semanales</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editingSubject.weekly_hours}
                    onChange={e => setEditingSubject({ ...editingSubject, weekly_hours: parseInt(e.target.value) || 1 })}
                    className="input-base w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Docente</label>
                  {(() => {
                    const { associated, others } = getTeachersForSubject(editingSubject.name)
                    return (
                      <select
                        value={editingSubject.teacher_id || ''}
                        onChange={e => setEditingSubject({ ...editingSubject, teacher_id: e.target.value || null })}
                        className="input-base w-full"
                      >
                        <option value="">Sin asignar</option>
                        {associated.length > 0 && (
                          <optgroup label={`✓ Docentes de ${editingSubject.name}`}>
                            {associated.map(t => (
                              <option key={t.id} value={t.id}>⭐ {t.full_name || t.email}</option>
                            ))}
                          </optgroup>
                        )}
                        {others.length > 0 && (
                          <optgroup label="Todos los docentes (sin asignación previa)">
                            {others.map(t => (
                              <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    )
                  })()}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={updateSubject} disabled={savingSubject} className="btn-primary text-sm px-6 py-2">
                  {savingSubject ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button onClick={() => setEditingSubject(null)} className="btn-secondary text-sm px-4 py-2">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Summary per course */}
          {filterCourseId !== 'all' && filteredSubjects.length > 0 && (
            <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-[rgba(124,109,250,0.05)] border border-[rgba(120,100,255,0.12)]">
              <div className="text-sm text-ink2">
                <span className="font-semibold">{getCourseName(filterCourseId)}</span>
                <span className="text-ink3 mx-2">→</span>
                <span className="font-bold text-violet2">{filteredSubjects.reduce((sum, s) => sum + s.weekly_hours, 0)}</span>
                <span className="text-ink3 text-xs ml-1">horas/semana</span>
                <span className="text-ink4 mx-2">•</span>
                <span className="text-ink3 text-xs">{filteredSubjects.length} materia{filteredSubjects.length !== 1 ? 's' : ''}</span>
                <span className="text-ink4 mx-2">•</span>
                <span className="text-ink3 text-xs">{filteredSubjects.filter(s => !s.teacher_id).length} sin docente</span>
              </div>
            </div>
          )}

          {/* Subjects list grouped by course */}
          {Object.keys(subjectsByCourse).length === 0 ? (
            <div className="card p-10 text-center text-ink3">
              <p className="text-3xl mb-3">📝</p>
              <p className="text-sm font-medium">
                {filterCourseId === 'all' ? 'Aún no hay materias' : 'No hay materias en este curso'}
              </p>
              <p className="text-xs mt-1">Añade materias con el botón de arriba</p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(subjectsByCourse).map(([courseId, courseSubjects]) => (
                <div key={courseId}>
                  <h3 className="font-bold text-sm text-ink2 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-violet-500" />
                    {getCourseName(courseId)}
                    <span className="text-[10px] text-ink3 font-normal">({courseSubjects.length} materia{courseSubjects.length !== 1 ? 's' : ''})</span>
                  </h3>
                  <div className="overflow-hidden rounded-xl border border-[rgba(0,0,0,0.06)]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[rgba(124,109,250,0.05)] text-[11px] uppercase tracking-wider text-ink3">
                          <th className="text-left px-4 py-2.5 font-bold">Materia</th>
                          <th className="text-center px-4 py-2.5 font-bold">Horas/Sem</th>
                          <th className="text-left px-4 py-2.5 font-bold">Docente</th>
                          <th className="text-right px-4 py-2.5 font-bold">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courseSubjects.map((s, i) => (
                          <tr key={s.id} className={`border-t border-[rgba(0,0,0,0.04)] ${i % 2 === 0 ? '' : 'bg-[rgba(0,0,0,0.015)]'} hover:bg-[rgba(124,109,250,0.04)] transition-colors`}>
                            <td className="px-4 py-3 font-medium">{s.name}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-violet-50 text-violet-700 text-xs font-bold">
                                {s.weekly_hours}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-ink3">{getTeacherName(s.teacher_id)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => { setEditingSubject(s); setShowAddSubject(false) }}
                                  className="text-xs px-2.5 py-1 rounded-lg text-violet-600 hover:bg-violet-50 transition-colors font-semibold"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => deleteSubject(s.id, s.name)}
                                  disabled={deletingSubjectId === s.id}
                                  className="text-xs px-2.5 py-1 rounded-lg text-red-500 hover:bg-red-50 transition-colors font-semibold"
                                >
                                  {deletingSubjectId === s.id ? '...' : 'Eliminar'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

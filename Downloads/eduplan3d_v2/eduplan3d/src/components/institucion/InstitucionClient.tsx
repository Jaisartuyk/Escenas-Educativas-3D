'use client'
// src/components/institucion/InstitucionClient.tsx

import { useState } from 'react'
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

interface Props {
  institution: { id: string; name: string; join_code: string; created_at: string }
  members: Miembro[]
  courses: Curso[]
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

export function InstitucionClient({ institution, members, courses, currentUserId }: Props) {
  const [tab, setTab] = useState<'general' | 'miembros' | 'cursos'>('general')
  const [showAddCourse, setShowAddCourse] = useState(false)
  const [courseName, setCourseName] = useState('')
  const [courseParallel, setCourseParallel] = useState('A')
  const [courseLevel, setCourseLevel] = useState('Colegio')
  const [courseShift, setCourseShift] = useState('MATUTINA')
  const [savingCourse, setSavingCourse] = useState(false)

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
      window.location.reload()
    } catch {
      toast.error('No se pudo crear el curso')
    } finally {
      setSavingCourse(false)
    }
  }

  const tabs = [
    { key: 'general',  label: '⚙️ General'  },
    { key: 'miembros', label: '👥 Miembros' },
    { key: 'cursos',   label: '📚 Cursos'   },
  ] as const

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[rgba(120,100,255,0.14)] pb-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${
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
                  </select>
                </div>
              </div>
              <button onClick={addCourse} disabled={savingCourse} className="btn-primary text-sm px-6 py-2">
                {savingCourse ? 'Guardando...' : 'Guardar Curso'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {courses.length === 0 ? (
              <div className="col-span-2 card p-10 text-center text-ink3">
                <p className="text-3xl mb-3">📚</p>
                <p className="text-sm font-medium">Aún no hay cursos</p>
                <p className="text-xs mt-1">Añade tu primer curso con el botón de arriba</p>
              </div>
            ) : courses.map(c => (
              <div key={c.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm">{c.name} {c.parallel && `— ${c.parallel}`}</h3>
                    <p className="text-xs text-ink3 mt-1">{c.level} · {c.shift}</p>
                  </div>
                  <span className="text-xl">📖</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

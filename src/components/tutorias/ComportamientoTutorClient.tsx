'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, AlertCircle, CheckCircle, Info, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

export const BEHAVIOR_SCALE = [
  {
    grade: 'S',
    label: 'Lidera y transforma',
    description: 'Transforma los desacuerdos en oportunidades de crecimiento y cooperación.',
    color: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  {
    grade: 'F',
    label: 'Participa activamente',
    description: 'Se involucra y participa en iniciativas que favorecen la convivencia pacífica.',
    color: 'bg-blue-500/10 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300',
  },
  {
    grade: 'U',
    label: 'Asume compromisos',
    description: 'Demuestra habilidades para llegar a acuerdos y asumir compromisos.',
    color: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300',
  },
  {
    grade: 'N',
    label: 'Requiere acompañamiento',
    description: 'Requiere acompañamiento comportamental.',
    color: 'bg-rose-500/10 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300',
  },
]

interface StudentRow {
  id: string
  full_name: string
  cedula?: string
}

interface ExistingNote {
  id?: string
  student_id: string
  trimestre: number
  behavior_grade: string | null
  observation: string | null
}

interface ComportamientoTutorClientProps {
  courses: { id: string; name: string }[]
  initialCourseId: string
  studentsByCourse: Record<string, StudentRow[]>
  existingNotes: ExistingNote[]
  libretasPublished: boolean
  isTutorOnly: boolean
}

export function ComportamientoTutorClient({
  courses,
  initialCourseId,
  studentsByCourse,
  existingNotes,
  libretasPublished,
  isTutorOnly,
}: ComportamientoTutorClientProps) {
  const router = useRouter()
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || courses[0]?.id || '')
  const [selectedTrimestre, setSelectedTrimestre] = useState<number>(1)
  const [saving, setSaving] = useState(false)

  // Local draft state: { [studentId]: { grade: string, observation: string } }
  const [entries, setEntries] = useState<Record<string, { grade: string; observation: string }>>(() => {
    const init: Record<string, { grade: string; observation: string }> = {}
    for (const note of existingNotes) {
      if (note.trimestre === 1) {
        init[note.student_id] = {
          grade: note.behavior_grade || '',
          observation: note.observation || '',
        }
      }
    }
    return init
  })

  // Rebuild local drafts when selectedCourseId or selectedTrimestre changes
  const updateEntriesFor = (courseId: string, trim: number) => {
    const nextEntries: Record<string, { grade: string; observation: string }> = {}
    for (const note of existingNotes) {
      if (note.trimestre === trim) {
        nextEntries[note.student_id] = {
          grade: note.behavior_grade || '',
          observation: note.observation || '',
        }
      }
    }
    setEntries(nextEntries)
  }

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId)
    updateEntriesFor(courseId, selectedTrimestre)
  }

  const handleSelectTrimestre = (t: number) => {
    setSelectedTrimestre(t)
    updateEntriesFor(selectedCourseId, t)
  }

  const students = studentsByCourse[selectedCourseId] || []
  const isLocked = isTutorOnly && libretasPublished

  const handleGradeChange = (studentId: string, grade: string) => {
    if (isLocked) return
    setEntries(prev => ({
      ...prev,
      [studentId]: {
        grade,
        observation: prev[studentId]?.observation || '',
      },
    }))
  }

  const handleObservationChange = (studentId: string, observation: string) => {
    if (isLocked) return
    setEntries(prev => ({
      ...prev,
      [studentId]: {
        grade: prev[studentId]?.grade || '',
        observation,
      },
    }))
  }

  const handleSaveAll = async () => {
    if (!selectedCourseId) {
      toast.error('Selecciona un curso primero')
      return
    }
    if (isLocked) {
      toast.error('Las libretas ya están publicadas y no se permite edición')
      return
    }

    setSaving(true)
    try {
      const items = students.map(st => ({
        student_id: st.id,
        behavior_grade: entries[st.id]?.grade || null,
        observation: entries[st.id]?.observation || '',
      }))

      const res = await fetch('/api/tutorias/comportamiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: selectedCourseId,
          trimestre: selectedTrimestre,
          items,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar')
      }

      toast.success(`Calificaciones de comportamiento del T${selectedTrimestre} guardadas con éxito`)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner de estado de publicación */}
      {libretasPublished ? (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-300/60 dark:border-amber-500/30 rounded-2xl text-amber-800 dark:text-amber-200 text-sm">
          <Lock className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <span className="font-semibold">Libretas publicadas: </span>
            {isTutorOnly
              ? 'La edición de notas de comportamiento y observaciones está bloqueada para tutores. Solo rectoría o administración pueden realizar cambios si es requerido.'
              : 'Las libretas están en estado publicado. Como administrador/rector, tienes permisos para actualizar calificaciones u observaciones si se requiere corregir.'}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-300/60 dark:border-emerald-500/30 rounded-2xl text-emerald-800 dark:text-emerald-200 text-sm">
          <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="flex-1">
            <span className="font-semibold">Periodo de ingreso activo: </span>
            Registra aquí las notas de comportamiento y las observaciones por estudiante para que aparezcan en la libreta escolar antes de su publicación final.
          </div>
        </div>
      )}

      {/* Explicación de la Escala S / F / U / N */}
      <div className="bg-surface rounded-2xl border border-surface2 p-5 space-y-3">
        <div className="flex items-center gap-2 text-ink font-semibold text-sm">
          <Info className="w-4 h-4 text-violet" />
          <span>Significado de la Escala de Comportamiento</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {BEHAVIOR_SCALE.map(item => (
            <div
              key={item.grade}
              className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${item.color}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-base font-black px-2 py-0.5 rounded-lg bg-white/60 dark:bg-black/20">
                  {item.grade}
                </span>
                <span className="font-semibold uppercase tracking-wider text-[10px]">
                  {item.label}
                </span>
              </div>
              <p className="text-[11px] leading-snug opacity-90">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Selectores de Curso, Trimestre y Botón Guardar */}
      <div className="bg-surface rounded-2xl border border-surface2 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink3 mb-1">
              Curso / Grado
            </label>
            <select
              value={selectedCourseId}
              onChange={e => handleSelectCourse(e.target.value)}
              className="bg-bg border border-surface2 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-violet"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink3 mb-1">
              Trimestre
            </label>
            <div className="flex items-center gap-1 bg-bg p-1 rounded-xl border border-surface2">
              {[1, 2, 3].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleSelectTrimestre(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedTrimestre === t
                      ? 'bg-violet text-white shadow-sm'
                      : 'text-ink3 hover:text-ink hover:bg-surface2'
                  }`}
                >
                  Trimestre {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving || isLocked || students.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet hover:bg-violet-dark text-white text-sm font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar Todo el Trimestre'}
        </button>
      </div>

      {/* Tabla de Estudiantes */}
      <div className="bg-surface rounded-2xl border border-surface2 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-surface2 flex items-center justify-between">
          <div className="text-sm font-bold text-ink">
            Estudiantes ({students.length}) &bull; Trimestre {selectedTrimestre}
          </div>
          <span className="text-xs text-ink3">
            El comportamiento y la observación se imprimirán directamente en la libreta
          </span>
        </div>

        {students.length === 0 ? (
          <div className="p-8 text-center text-ink3 text-sm">
            No hay estudiantes inscritos en este curso.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg3 text-xs uppercase tracking-wider border-b border-surface2 text-ink2">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 min-w-[220px]">Estudiante</th>
                  <th className="py-3 px-4 w-44">Nota de Comportamiento</th>
                  <th className="py-3 px-4 min-w-[320px]">Observación / Recomendación del Tutor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface2">
                {students.map((st, idx) => {
                  const currentGrade = entries[st.id]?.grade || ''
                  const currentObs = entries[st.id]?.observation || ''

                  return (
                    <tr key={st.id} className="hover:bg-bg/40 transition-colors">
                      <td className="py-3 px-4 text-center text-xs text-ink3">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-ink">{st.full_name}</div>
                        {st.cedula && <div className="text-[11px] text-ink3">{st.cedula}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          disabled={isLocked}
                          value={currentGrade}
                          onChange={e => handleGradeChange(st.id, e.target.value)}
                          className={`w-full text-sm font-bold rounded-xl px-3 py-2 border outline-none transition-all ${
                            currentGrade === 'S'
                              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300'
                              : currentGrade === 'F'
                              ? 'bg-blue-500/10 text-blue-700 border-blue-300'
                              : currentGrade === 'U'
                              ? 'bg-amber-500/10 text-amber-700 border-amber-300'
                              : currentGrade === 'N'
                              ? 'bg-rose-500/10 text-rose-700 border-rose-300'
                              : 'bg-bg text-ink border-surface2'
                          }`}
                        >
                          <option value="">(Sin definir - Auto)</option>
                          <option value="S">S - Lidera y transforma</option>
                          <option value="F">F - Participa activamente</option>
                          <option value="U">U - Asume compromisos</option>
                          <option value="N">N - Requiere acompañamiento</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <textarea
                          disabled={isLocked}
                          rows={2}
                          value={currentObs}
                          onChange={e => handleObservationChange(st.id, e.target.value)}
                          placeholder="Escribe una observación o recomendación del tutor para este estudiante..."
                          maxLength={350}
                          className="w-full text-xs bg-bg border border-surface2 rounded-xl p-2.5 text-ink outline-none focus:border-violet resize-none placeholder:text-ink4 disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        <div className="text-[10px] text-right text-ink4 mt-0.5">
                          {currentObs.length}/350 caracteres
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

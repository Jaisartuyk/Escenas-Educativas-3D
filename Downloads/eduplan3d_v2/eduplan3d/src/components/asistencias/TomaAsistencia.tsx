'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type SubjectOption = {
  id: string
  name: string
  course?: {
    id?: string
    name?: string | null
    parallel?: string | null
  } | null
}

type StudentOption = {
  id: string
  full_name?: string | null
  email?: string | null
}

type SharedAttendancePolicy = {
  sharedMode: boolean
  authorityTeacherName: string | null
  authoritySubjectName: string | null
  authoritySource: 'tutor' | 'first-hour' | 'fallback'
  canTeacherEdit: boolean
  dayLabel: string
  courseLabel: string
}

export function TomaAsistencia() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [attendance, setAttendance] = useState<Record<string, string>>({})
  const [sharedPolicy, setSharedPolicy] = useState<SharedAttendancePolicy | null>(null)
  const [message, setMessage] = useState({ text: '', type: '' })

  const supabase = createClient()

  useEffect(() => {
    async function loadSubjects() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await (supabase as any)
        .from('subjects')
        .select('id, name, course:courses(id, name, parallel)')
        .eq('teacher_id', user.id as string)

      const nextSubjects = ((data || []) as SubjectOption[])
      setSubjects(nextSubjects)
      if (nextSubjects.length > 0) setSelectedSubject(nextSubjects[0].id)
      setLoading(false)
    }

    loadSubjects()
  }, [supabase])

  useEffect(() => {
    async function loadStudents() {
      if (!selectedSubject) {
        setStudents([])
        setAttendance({})
        setSharedPolicy(null)
        return
      }

      setLoading(true)
      setMessage({ text: '', type: '' })
      const subject = subjects.find(item => item.id === selectedSubject)
      if (!subject?.course?.id) {
        setStudents([])
        setAttendance({})
        setSharedPolicy(null)
        setLoading(false)
        return
      }

      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id, profiles!inner(id, full_name, email)')
        .eq('course_id', subject.course.id)

      const studentList = ((enrollments || []) as any[])
        .map(enrollment => enrollment.profiles)
        .filter(Boolean)
        .sort((a: StudentOption, b: StudentOption) => (a.full_name || '').localeCompare(b.full_name || ''))

      let existingAttendance: Array<{ student_id: string; status: string }> = []
      let nextPolicy: SharedAttendancePolicy | null = null

      try {
        const response = await fetch(`/api/docente/attendance?subjectId=${selectedSubject}&date=${date}`, {
          cache: 'no-store',
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || 'No se pudo cargar la asistencia oficial del curso.')
        }

        existingAttendance = Array.isArray(payload?.data) ? payload.data : []
        nextPolicy = payload?.policy || null
      } catch (error: any) {
        console.error(error)
        setMessage({ text: error.message || 'No se pudo cargar la asistencia oficial del curso.', type: 'error' })
      }

      const nextAttendance: Record<string, string> = {}
      if (existingAttendance.length > 0) {
        existingAttendance.forEach(entry => {
          nextAttendance[entry.student_id] = entry.status
        })
      } else {
        studentList.forEach((student: StudentOption) => {
          nextAttendance[student.id] = 'present'
        })
      }

      setStudents(studentList)
      setAttendance(nextAttendance)
      setSharedPolicy(nextPolicy)
      setLoading(false)
    }

    loadStudents()
  }, [selectedSubject, date, subjects, supabase])

  const handleSave = async () => {
    if (!selectedSubject) return
    setSaving(true)
    setMessage({ text: '', type: '' })

    try {
      const response = await fetch('/api/docente/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_id: selectedSubject,
          date,
          entries: students.map(student => ({
            student_id: student.id,
            status: attendance[student.id] || 'present',
          })),
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo guardar la asistencia.')
      }

      if (payload?.policy) {
        setSharedPolicy(payload.policy)
      }

      setMessage({ text: 'Asistencia guardada correctamente.', type: 'success' })
    } catch (error: any) {
      console.error(error)
      setMessage({ text: 'Error al guardar la asistencia: ' + error.message, type: 'error' })
    }

    setSaving(false)
  }

  const markAllAs = (status: string) => {
    const nextAttendance = { ...attendance }
    students.forEach(student => {
      nextAttendance[student.id] = status
    })
    setAttendance(nextAttendance)
  }

  const editingLocked = !!sharedPolicy && !sharedPolicy.canTeacherEdit
  const authorityContext = sharedPolicy?.authoritySource === 'first-hour' && sharedPolicy.authoritySubjectName
    ? ` desde la primera hora (${sharedPolicy.authoritySubjectName})`
    : sharedPolicy?.authoritySource === 'tutor'
      ? ' como docente titular del curso'
      : ''

  if (loading && subjects.length === 0) {
    return <div className="text-center py-10">Cargando materias...</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-ink2">Materia</label>
          <select
            value={selectedSubject}
            onChange={event => setSelectedSubject(event.target.value)}
            className="h-11 w-full appearance-none rounded-xl border border-surface2 bg-surface px-4 text-ink"
          >
            {subjects.length === 0 && <option value="">No tienes materias asignadas</option>}
            {subjects.map(subject => (
              <option key={subject.id} value={subject.id}>
                {subject.course?.name} - {subject.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-ink2">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={event => setDate(event.target.value)}
            className="h-11 w-full rounded-xl border border-surface2 bg-surface px-4 text-ink"
          />
        </div>
      </div>

      {message.text && (
        <div className={`rounded-xl p-4 text-sm ${message.type === 'success' ? 'bg-teal/10 text-teal' : 'bg-rose/10 text-rose'}`}>
          {message.text}
        </div>
      )}

      {sharedPolicy?.sharedMode && (
        <div className={`rounded-xl border p-4 text-sm ${editingLocked ? 'border-amber/20 bg-amber/10 text-amber' : 'border-sky-200 bg-sky/10 text-sky-700'}`}>
          {editingLocked
            ? `La asistencia oficial de ${sharedPolicy.courseLabel} del ${sharedPolicy.dayLabel} la registra ${sharedPolicy.authorityTeacherName || 'el docente responsable'}${authorityContext}. Aquí verás la misma asistencia que se comparte al resto de materias.`
            : `Estás registrando la asistencia oficial de ${sharedPolicy.courseLabel} para ${sharedPolicy.dayLabel}. Esta toma se reflejará en todas las materias del curso para esta fecha.`}
        </div>
      )}

      {selectedSubject && (
        <div className="overflow-hidden rounded-2xl border border-surface2 bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-surface2 bg-[rgba(0,0,0,0.02)] p-4">
            <h3 className="font-bold text-ink">Estudiantes ({students.length})</h3>
            <div className="flex gap-2">
              <button
                onClick={() => markAllAs('present')}
                disabled={editingLocked}
                className="rounded-lg bg-teal/10 px-3 py-1.5 text-xs text-teal transition-colors hover:bg-teal/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Todos Presentes
              </button>
              <button
                onClick={() => markAllAs('absent')}
                disabled={editingLocked}
                className="rounded-lg bg-rose/10 px-3 py-1.5 text-xs text-rose transition-colors hover:bg-rose/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Todos Ausentes
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-ink3">Cargando estudiantes...</div>
          ) : students.length === 0 ? (
            <div className="p-10 text-center text-ink3">No hay estudiantes inscritos en este curso.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-surface2 text-xs uppercase text-ink3">
                    <th className="min-w-[200px] p-4 font-medium">Estudiante</th>
                    <th className="w-24 p-4 text-center font-medium">Presente</th>
                    <th className="w-24 p-4 text-center font-medium">Atraso</th>
                    <th className="w-24 p-4 text-center font-medium">Falta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface2/50">
                  {students.map(student => (
                    <tr key={student.id} className="transition-colors hover:bg-[rgba(0,0,0,0.01)]">
                      <td className="p-4">
                        <p className="text-sm font-semibold text-ink">{student.full_name || 'Sin nombre'}</p>
                        <p className="truncate text-xs text-ink3">{student.email}</p>
                      </td>
                      <td className="p-4 text-center">
                        <label className="group relative flex cursor-pointer items-center justify-center">
                          <input
                            type="radio"
                            name={`att-${student.id}`}
                            value="present"
                            checked={attendance[student.id] === 'present'}
                            onChange={() => setAttendance(prev => ({ ...prev, [student.id]: 'present' }))}
                            disabled={editingLocked}
                            className="peer absolute h-5 w-5 opacity-0"
                          />
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface2 transition-all peer-checked:border-teal peer-checked:bg-teal">
                            <span className="text-xs text-white opacity-0 peer-checked:opacity-100">✓</span>
                          </div>
                        </label>
                      </td>
                      <td className="p-4 text-center">
                        <label className="group relative flex cursor-pointer items-center justify-center">
                          <input
                            type="radio"
                            name={`att-${student.id}`}
                            value="late"
                            checked={attendance[student.id] === 'late'}
                            onChange={() => setAttendance(prev => ({ ...prev, [student.id]: 'late' }))}
                            disabled={editingLocked}
                            className="peer absolute h-5 w-5 opacity-0"
                          />
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface2 transition-all peer-checked:border-amber peer-checked:bg-amber">
                            <span className="text-xs text-white opacity-0 peer-checked:opacity-100">⏱</span>
                          </div>
                        </label>
                      </td>
                      <td className="p-4 text-center">
                        <label className="group relative flex cursor-pointer items-center justify-center">
                          <input
                            type="radio"
                            name={`att-${student.id}`}
                            value="absent"
                            checked={attendance[student.id] === 'absent'}
                            onChange={() => setAttendance(prev => ({ ...prev, [student.id]: 'absent' }))}
                            disabled={editingLocked}
                            className="peer absolute h-5 w-5 opacity-0"
                          />
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface2 transition-all peer-checked:border-rose peer-checked:bg-rose">
                            <span className="text-xs text-white opacity-0 peer-checked:opacity-100">✕</span>
                          </div>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {students.length > 0 && (
            <div className="flex justify-end border-t border-surface2 bg-[rgba(0,0,0,0.02)] p-4">
              <button
                onClick={handleSave}
                disabled={saving || editingLocked}
                className="rounded-xl bg-violet2 px-6 py-2.5 font-medium text-white shadow-md shadow-violet/20 transition-all hover:bg-violet hover:shadow-violet/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar Asistencia'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function TomaAsistencia() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [students, setStudents] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Record<string, string>>({})
  const [message, setMessage] = useState({ text: '', type: '' })

  const supabase = createClient()

  useEffect(() => {
    async function loadSubjects() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await (supabase as any)
        .from('subjects')
        .select('id, name, course:courses(id, name, parallel)')
        .eq('teacher_id', user.id as string)

      if (data) {
        setSubjects(data)
        if (data.length > 0) setSelectedSubject((data as any[])[0].id)
      }
      setLoading(false)
    }
    loadSubjects()
  }, [])

  useEffect(() => {
    async function loadStudents() {
      if (!selectedSubject) {
        setStudents([])
        return
      }

      setLoading(true)
      const sub = subjects.find(s => s.id === selectedSubject)
      if (!sub?.course?.id) {
        setStudents([])
        setLoading(false)
        return
      }

      // Obtener estudiantes usando la inscripción y luego extraer perfiles
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id, profiles!inner(id, full_name, email)')
        .eq('course_id', sub.course.id)

      const studentList = (enrollments || [])
        .map((e: any) => e.profiles)
        .filter(Boolean)
        // Ordenar alfabéticamente
        .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''))

      // Consultar asistencia existente para la fecha
      const { data: existingAtt } = await (supabase as any)
        .from('attendance')
        .select('student_id, status')
        .eq('subject_id', selectedSubject)
        .eq('date', date)

      const currentAtt: Record<string, string> = {}
      if (existingAtt && existingAtt.length > 0) {
        existingAtt.forEach((a: any) => {
          currentAtt[a.student_id] = a.status
        })
      } else {
        studentList.forEach((s: any) => {
          currentAtt[s.id] = 'present' // Por defecto presentes
        })
      }

      setStudents(studentList)
      setAttendance(currentAtt)
      setLoading(false)
    }

    loadStudents()
  }, [selectedSubject, date, subjects])

  const handleSave = async () => {
    if (!selectedSubject) return
    setSaving(true)
    setMessage({ text: '', type: '' })

    try {
      const sub = subjects.find(s => s.id === selectedSubject)
      let institution_id = null

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await (supabase as any).from('profiles').select('institution_id').eq('id', user.id as string).single()
      if (prof && 'institution_id' in prof) institution_id = (prof as any).institution_id

      // Borrar existentes para esa fecha y materia (para simplificar update/insert)
      await (supabase as any)
        .from('attendance')
        .delete()
        .eq('subject_id', selectedSubject)
        .eq('date', date)

      const inserts = students.map(s => ({
        subject_id: selectedSubject,
        student_id: s.id,
        institution_id,
        date,
        status: attendance[s.id] || 'present'
      }))

      if (inserts.length > 0) {
        const { error } = await (supabase as any).from('attendance').insert(inserts)
        if (error) throw error
      }

      setMessage({ text: 'Asistencia guardada correctamente.', type: 'success' })
    } catch (error: any) {
      console.error(error)
      setMessage({ text: 'Error al guardar la asistencia: ' + error.message, type: 'error' })
    }
    setSaving(false)
  }

  const markAllAs = (status: string) => {
    const newAtt = { ...attendance }
    students.forEach(s => newAtt[s.id] = status)
    setAttendance(newAtt)
  }

  if (loading && subjects.length === 0) return <div className="text-center py-10">Cargando materias...</div>

  return (
    <div className="space-y-6">
      {/* ── Filtros ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-ink2 mb-1.5 uppercase">Materia</label>
          <select
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
            className="w-full h-11 bg-surface text-ink border border-surface2 rounded-xl px-4 appearance-none"
          >
            {subjects.length === 0 && <option value="">No tienes materias asignadas</option>}
            {subjects.map(s => (
              <option key={s.id} value={s.id}>
                {s.course?.name} - {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink2 mb-1.5 uppercase">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full h-11 bg-surface text-ink border border-surface2 rounded-xl px-4"
          />
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm ${message.type === 'success' ? 'bg-teal/10 text-teal' : 'bg-rose/10 text-rose'}`}>
          {message.text}
        </div>
      )}

      {/* ── Lista de estudiantes ── */}
      {selectedSubject && (
        <div className="bg-surface border border-surface2 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-surface2 flex justify-between items-center bg-[rgba(0,0,0,0.02)]">
            <h3 className="font-bold text-ink">Estudiantes ({students.length})</h3>
            <div className="flex gap-2">
              <button onClick={() => markAllAs('present')} className="text-xs bg-teal/10 text-teal px-3 py-1.5 rounded-lg hover:bg-teal/20 transition-colors">Todos Presentes</button>
              <button onClick={() => markAllAs('absent')} className="text-xs bg-rose/10 text-rose px-3 py-1.5 rounded-lg hover:bg-rose/20 transition-colors">Todos Ausentes</button>
            </div>
          </div>
          
          {loading ? (
            <div className="p-10 text-center text-ink3">Cargando estudiantes...</div>
          ) : students.length === 0 ? (
            <div className="p-10 text-center text-ink3">No hay estudiantes inscritos en este curso.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface2 text-xs text-ink3 uppercase">
                    <th className="p-4 font-medium min-w-[200px]">Estudiante</th>
                    <th className="p-4 font-medium text-center w-24">Presente</th>
                    <th className="p-4 font-medium text-center w-24">Atraso</th>
                    <th className="p-4 font-medium text-center w-24">Falta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface2/50">
                  {students.map(s => (
                    <tr key={s.id} className="hover:bg-[rgba(0,0,0,0.01)] transition-colors">
                      <td className="p-4">
                        <p className="font-semibold text-ink text-sm">{s.full_name || 'Sin nombre'}</p>
                        <p className="text-xs text-ink3 truncate">{s.email}</p>
                      </td>
                      <td className="p-4 text-center">
                        <label className="flex items-center justify-center cursor-pointer relative group">
                          <input
                            type="radio"
                            name={`att-${s.id}`}
                            value="present"
                            checked={attendance[s.id] === 'present'}
                            onChange={() => setAttendance(prev => ({ ...prev, [s.id]: 'present' }))}
                            className="peer w-5 h-5 opacity-0 absolute"
                          />
                          <div className="w-6 h-6 rounded-full border-2 border-surface2 peer-checked:border-teal peer-checked:bg-teal flex items-center justify-center transition-all">
                            <span className="text-white text-xs opacity-0 peer-checked:opacity-100">✓</span>
                          </div>
                        </label>
                      </td>
                      <td className="p-4 text-center">
                        <label className="flex items-center justify-center cursor-pointer relative group">
                          <input
                            type="radio"
                            name={`att-${s.id}`}
                            value="late"
                            checked={attendance[s.id] === 'late'}
                            onChange={() => setAttendance(prev => ({ ...prev, [s.id]: 'late' }))}
                            className="peer w-5 h-5 opacity-0 absolute"
                          />
                          <div className="w-6 h-6 rounded-full border-2 border-surface2 peer-checked:border-amber peer-checked:bg-amber flex items-center justify-center transition-all">
                            <span className="text-white text-xs opacity-0 peer-checked:opacity-100">⏱</span>
                          </div>
                        </label>
                      </td>
                      <td className="p-4 text-center">
                        <label className="flex items-center justify-center cursor-pointer relative group">
                          <input
                            type="radio"
                            name={`att-${s.id}`}
                            value="absent"
                            checked={attendance[s.id] === 'absent'}
                            onChange={() => setAttendance(prev => ({ ...prev, [s.id]: 'absent' }))}
                            className="peer w-5 h-5 opacity-0 absolute"
                          />
                          <div className="w-6 h-6 rounded-full border-2 border-surface2 peer-checked:border-rose peer-checked:bg-rose flex items-center justify-center transition-all">
                            <span className="text-white text-xs opacity-0 peer-checked:opacity-100">✗</span>
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
            <div className="p-4 border-t border-surface2 bg-[rgba(0,0,0,0.02)] flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-violet2 hover:bg-violet text-white font-medium py-2.5 px-6 rounded-xl transition-all shadow-md shadow-violet/20 hover:shadow-violet/40 disabled:opacity-50 disabled:cursor-not-allowed"
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

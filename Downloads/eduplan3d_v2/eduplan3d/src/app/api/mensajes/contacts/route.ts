// src/app/api/mensajes/contacts/route.ts
// GET → contactos con los que este usuario puede iniciar conversación directa.
//  - student → devuelve sus tutores
//  - teacher → devuelve los estudiantes de los cursos que tutoriza
//  - admin   → devuelve todos los profesores + estudiantes de la institución
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveTutorsForStudent, resolveStudentsForTutor } from '@/lib/mensajes/access'

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: me } = await (admin as any)
    .from('profiles').select('id, role, institution_id, full_name').eq('id', user.id).single()
  if (!me) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  if (me.role === 'student') {
    const tutors = await resolveTutorsForStudent(admin as any, me.id)
    return NextResponse.json({
      contacts: tutors.map(t => ({
        userId:   t.teacherId,
        fullName: t.teacherName,
        role:     'teacher',
        subtitle: `Tutor · ${t.courseName}`,
      })),
    })
  }
  if (me.role === 'teacher') {
    const students = await resolveStudentsForTutor(admin as any, me.id)
    return NextResponse.json({
      contacts: students.map(s => ({
        userId:   s.studentId,
        fullName: s.studentName,
        role:     'student',
        subtitle: `${s.courseName} · Representante`,
        studentId: s.studentId,
      })),
    })
  }
  if (me.role === 'admin' || me.role === 'assistant') {
    const { data: peers } = await (admin as any)
      .from('profiles').select('id, full_name, role')
      .eq('institution_id', me.institution_id)
      .in('role', ['teacher','student'])
      .order('full_name')
    return NextResponse.json({
      contacts: ((peers || []) as any[]).map(p => ({
        userId:   p.id,
        fullName: p.full_name || 'Sin nombre',
        role:     p.role,
        subtitle: p.role === 'teacher' ? 'Docente' : 'Estudiante',
      })),
    })
  }
  return NextResponse.json({ contacts: [] })
}

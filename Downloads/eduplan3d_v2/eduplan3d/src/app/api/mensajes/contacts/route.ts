// src/app/api/mensajes/contacts/route.ts
// GET → contactos con los que este usuario puede iniciar conversación directa.
// MENSAJERÍA INTERNA STAFF-ONLY:
//  - student → solo sus tutores (docentes que dictan en su curso)
//  - cualquier staff (teacher, admin, assistant, rector, supervisor,
//    horarios_only) → ve a TODO el resto del staff de su institución.
//    Los estudiantes NO aparecen en mensajería interna.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveTutorsForStudent } from '@/lib/mensajes/access'
import { getLinkedChildrenForParent } from '@/lib/parents'

const STAFF_ROLES = ['admin', 'assistant', 'teacher', 'rector', 'supervisor', 'horarios_only']

const ROLE_LABEL: Record<string, string> = {
  admin:          'Administrador',
  assistant:      'Secretaría',
  teacher:        'Docente',
  rector:         'Rector/a',
  supervisor:     'Supervisor/a',
  horarios_only:  'Coordinación de horarios',
}

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: me } = await (admin as any)
    .from('profiles').select('id, role, institution_id, full_name').eq('id', user.id).single()
  if (!me) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  // Estudiantes: ven solo sus tutores (no es mensajería interna)
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

  // Padres: ven a los tutores de sus hijo(s) vinculados.
  if (me.role === 'parent') {
    const children = await getLinkedChildrenForParent(admin as any, me.id)
    if (children.length === 0) return NextResponse.json({ contacts: [] })

    const contacts = new Map<string, { userId: string; fullName: string; role: string; subtitle: string }>()
    for (const child of children) {
      const tutors = await resolveTutorsForStudent(admin as any, child.childId)
      for (const t of tutors) {
        contacts.set(`${t.teacherId}:${child.childId}`, {
          userId: t.teacherId,
          fullName: t.teacherName,
          role: 'teacher',
          subtitle: `${child.relationship} de ${child.fullName} · ${t.courseName}`,
        })
      }
    }
    return NextResponse.json({ contacts: Array.from(contacts.values()) })
  }

  // Cualquier rol del staff → todo el staff de la institución (sin estudiantes
  // ni padres). Excluye al propio usuario.
  if (STAFF_ROLES.includes(me.role)) {
    if (!me.institution_id) {
      return NextResponse.json({ contacts: [] })
    }
    const { data: peers } = await (admin as any)
      .from('profiles')
      .select('id, full_name, role, email')
      .eq('institution_id', me.institution_id)
      .in('role', STAFF_ROLES)
      .neq('id', me.id)
      .order('full_name')

    return NextResponse.json({
      contacts: ((peers || []) as any[]).map(p => ({
        userId:   p.id,
        fullName: p.full_name || p.email || 'Sin nombre',
        role:     p.role,
        subtitle: ROLE_LABEL[p.role] || p.role,
      })),
    })
  }

  return NextResponse.json({ contacts: [] })
}

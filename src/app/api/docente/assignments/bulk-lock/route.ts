import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const { subject_id, trimestre, parcial, is_locked, assignment_ids } = await req.json()

  // Si no es admin y quiere desbloquear, rechazar
  if (!isAdmin && is_locked === false) {
    return NextResponse.json({ error: 'Solo la administración puede desbloquear calificaciones.' }, { status: 403 })
  }

  // Si no es admin, verificar que sea el profesor de la materia
  if (!isAdmin) {
    const { data: subject } = await admin.from('subjects').select('teacher_id').eq('id', subject_id).single()
    if (subject?.teacher_id !== user.id) {
      return NextResponse.json({ error: 'No tienes permiso sobre esta materia' }, { status: 403 })
    }
  }

  let query = admin.from('assignments').update({ is_locked })

  if (Array.isArray(assignment_ids) && assignment_ids.length > 0) {
    query = query.in('id', assignment_ids)
  } else if (subject_id) {
    query = query.eq('subject_id', subject_id)
    if (trimestre) query = query.eq('trimestre', trimestre)
    if (parcial !== undefined && parcial !== null) query = query.eq('parcial', parcial)
  } else {
    return NextResponse.json({ error: 'Parámetros insuficientes' }, { status: 400 })
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, is_locked })
}

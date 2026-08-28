import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { teacherOwnsAssignment } from '@/lib/auth/ownership'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { is_locked } = await req.json()
  const admin = createAdminClient()

  // Verificar si es admin
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  // Si no es admin, verificar que sea el profesor de la materia
  if (!isAdmin) {
    const owns = await teacherOwnsAssignment(user.id, params.id)
    if (!owns) {
      return NextResponse.json({ error: 'No tienes permiso sobre esta tarea' }, { status: 403 })
    }
    // Si intenta desbloquear y no es admin, bloquearlo
    if (is_locked === false) {
      return NextResponse.json({ error: 'Solo administración puede desbloquear la actividad.' }, { status: 403 })
    }
  }

  const { error } = await admin.from('assignments').update({ is_locked }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, is_locked })
}

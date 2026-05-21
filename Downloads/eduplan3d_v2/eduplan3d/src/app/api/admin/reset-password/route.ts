import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth/ownership'

const ALLOWED_ROLES = new Set(['admin', 'rector', 'secretary', 'assistant'])

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) {
    return NextResponse.json({ error: 'Sin institución' }, { status: 400 })
  }
  if (!ALLOWED_ROLES.has(profile.role || '')) {
    return NextResponse.json({ error: 'Sin permiso para restablecer contraseñas' }, { status: 403 })
  }

  const body = await req.json()
  const { userId, newPassword } = body

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verificar que el usuario objetivo pertenece a la misma institución
  const { data: targetProfile, error: profileError } = await admin
    .from('profiles' as any)
    .select('institution_id, role')
    .eq('id', userId)
    .single()

  if (profileError || !targetProfile) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  if ((targetProfile as any).institution_id !== profile.institution_id) {
    return NextResponse.json({ error: 'No puedes modificar usuarios de otra institución' }, { status: 403 })
  }

  // Solo se pueden restablecer contraseñas de padres/representantes
  if ((targetProfile as any).role !== 'parent') {
    return NextResponse.json({ error: 'Solo se puede restablecer la contraseña de representantes' }, { status: 403 })
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword.trim(),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

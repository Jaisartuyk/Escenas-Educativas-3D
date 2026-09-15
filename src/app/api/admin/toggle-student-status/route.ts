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
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { studentId, status } = await req.json()
  if (!studentId || !['active', 'retirado', 'suspendido'].includes(status)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Obtener datos de la institución y directorio
  const { data: inst } = await admin
    .from('institutions')
    .select('id, settings')
    .eq('id', profile.institution_id)
    .single()

  if (!inst) return NextResponse.json({ error: 'Institución no encontrada' }, { status: 404 })

  const settings = inst.settings || {}
  settings.directory = settings.directory || {}
  const studentMeta = settings.directory[studentId] || {}

  studentMeta.status = status
  if (status === 'retirado' || status === 'suspendido') {
    studentMeta.withdrawn_at = new Date().toISOString()
  } else {
    studentMeta.withdrawn_at = null
  }
  settings.directory[studentId] = studentMeta

  await admin.from('institutions').update({ settings }).eq('id', inst.id)

  // 2. Suspender o habilitar cuentas de Auth (alumno y representantes vinculados)
  const isRetiring = status === 'retirado' || status === 'suspendido'
  const banDuration = isRetiring ? '876000h' : 'none'

  // Alumno
  await admin.auth.admin.updateUserById(studentId, { ban_duration: banDuration }).catch(() => {})

  // Representantes vinculados
  const parentIds = [
    studentMeta.mother_parent_user_id,
    studentMeta.father_parent_user_id,
    studentMeta.other_parent_user_id
  ].filter(Boolean)

  for (const pid of parentIds) {
    await admin.auth.admin.updateUserById(pid, { ban_duration: banDuration }).catch(() => {})
  }

  return NextResponse.json({ success: true, status })
}

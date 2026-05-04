import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth/ownership'
import { createStudentFamilyNotifications } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

// Roles autorizados a gestionar pagos
const PAYMENT_ROLES = new Set(['admin', 'assistant'])

// GET — all payments for teacher's/admin's institution
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: [] }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ data: [] })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('payments' as any)
    .select('*')
    .eq('institution_id', profile.institution_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

// POST — create a new payment (solo admin/assistant, forzando institution_id)
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })
  if (!PAYMENT_ROLES.has(profile.role || '')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const body = await req.json()
  const admin = createAdminClient()

  // Forzamos institution_id del usuario autenticado (ignoramos el del body si viene)
  const { data, error } = await admin
    .from('payments' as any)
    .insert({ ...body, institution_id: profile.institution_id })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if ((data as any)?.student_id) {
    await createStudentFamilyNotifications(admin as any, [(data as any).student_id], {
      category: 'finance',
      title: 'Nuevo valor registrado',
      body: `${(data as any).description || 'Secretaría registró un nuevo cobro.'}`,
      href: '/dashboard/finanzas',
      metadata: { paymentId: (data as any).id, type: (data as any).type, amount: (data as any).amount },
    })
  }

  return NextResponse.json({ data })
}

// PATCH — update payment (solo admin/assistant, y verificando institución)
export async function PATCH(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })
  if (!PAYMENT_ROLES.has(profile.role || '')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('payments' as any)
    .select('institution_id, student_id, status, description, amount, type')
    .eq('id', id)
    .single()
  if ((existing as any)?.institution_id !== profile.institution_id) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  // Evitar que se modifique institution_id vía body
  delete (updates as any).institution_id

  const { data, error } = await admin
    .from('payments' as any)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if ((data as any)?.student_id) {
    const becamePaid = (existing as any)?.status !== 'pagado' && (data as any)?.status === 'pagado'
    await createStudentFamilyNotifications(admin as any, [(data as any).student_id], {
      category: 'finance',
      title: becamePaid ? 'Pago registrado' : 'Actualización financiera',
      body: becamePaid
        ? `${(data as any).description || 'Se registró un pago.'}`
        : `${(data as any).description || 'Secretaría actualizó un valor.'}`,
      href: '/dashboard/finanzas',
      metadata: { paymentId: (data as any).id, type: (data as any).type, amount: (data as any).amount, status: (data as any).status },
    })
  }

  return NextResponse.json({ data })
}

// DELETE — remove a payment (solo admin/assistant de la misma institución)
export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })
  if (!PAYMENT_ROLES.has(profile.role || '')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('payments' as any)
    .select('institution_id')
    .eq('id', id)
    .single()
  if ((existing as any)?.institution_id !== profile.institution_id) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { error } = await admin.from('payments' as any).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

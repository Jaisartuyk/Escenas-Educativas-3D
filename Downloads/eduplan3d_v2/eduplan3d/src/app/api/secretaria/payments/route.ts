import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile, canManageFinances } from '@/lib/auth/ownership'
import { createStudentFamilyNotifications } from '@/lib/notifications'
import { attachAbonosToPayments } from '@/lib/payment-progress'
import { getRecurringPaymentPeriodKey } from '@/lib/payment-period'

export const dynamic = 'force-dynamic'

function normalizeRecurringType(type?: string | null) {
  return type === 'matricula' || type === 'pension' || type === 'otro' ? type : null
}

async function findRecurringConflict(admin: ReturnType<typeof createAdminClient>, input: {
  institutionId: string
  studentId?: string | null
  type?: string | null
  due_date?: string | null
  description?: string | null
  excludeId?: string | null
}) {
  if (!input.studentId || (input.type !== 'matricula' && input.type !== 'pension')) return null

  const periodKey = getRecurringPaymentPeriodKey({
    type: input.type,
    due_date: input.due_date,
    description: input.description,
  })

  if (!periodKey) {
    return { error: 'Para matrícula y pensión debes indicar una fecha de vencimiento válida.' }
  }

  const { data: candidates, error } = await admin
    .from('payments' as any)
    .select('id, type, due_date, description')
    .eq('institution_id', input.institutionId)
    .eq('student_id', input.studentId)
    .eq('type', input.type)

  if (error) return { error: error.message }

  const conflict = (candidates || []).find((payment: any) => {
    if (input.excludeId && payment.id === input.excludeId) return false
    return getRecurringPaymentPeriodKey(payment) === periodKey
  })

  if (!conflict) return null

  return {
    error: `Ya existe un cobro de ${input.type} para ese mismo periodo.`,
  }
}

// GET — all payments for teacher's/admin's institution
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: [] }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ data: [] })

  const institutionId = profile.institution_id
  const admin = createAdminClient()
  const { searchParams } = new URL(req.url)
  const studentIds = searchParams
    .get('student_ids')
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) || []
  
  let allData: any[] = []
  let from = 0
  const step = 1000
  while (true) {
    let query = admin
      .from('payments' as any)
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
      .range(from, from + step - 1)

    if (studentIds.length > 0) {
      query = query.in('student_id', studentIds)
    }

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    
    allData = allData.concat(data)
    if (data.length < step) break
    from += step
  }

  async function fetchAllAbonos(paymentIds: string[]): Promise<{ data: any[]; error?: string }> {
    if (paymentIds.length === 0) return { data: [] }

    const chunkSize = 500
    let allAbonos: any[] = []

    for (let start = 0; start < paymentIds.length; start += chunkSize) {
      const chunk = paymentIds.slice(start, start + chunkSize)
      let from = 0
      const step = 1000

      while (true) {
        const { data: abonosData, error: abonosError } = await admin
          .from('payment_abonos' as any)
          .select('*')
          .eq('institution_id', institutionId)
          .in('payment_id', chunk)
          .order('paid_at', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + step - 1)

        if (abonosError) return { error: abonosError.message, data: [] }
        if (!abonosData || abonosData.length === 0) break

        allAbonos = allAbonos.concat(abonosData)
        if (abonosData.length < step) break
        from += step
      }
    }

    return { data: allAbonos }
  }

  const paymentIds = allData.map((payment: any) => payment.id).filter(Boolean)
  const abonosResult = await fetchAllAbonos(paymentIds)
  if ('error' in abonosResult) {
    return NextResponse.json({ error: abonosResult.error }, { status: 500 })
  }
  const abonos = abonosResult.data || []

  return NextResponse.json({ data: attachAbonosToPayments(allData, abonos) })
}

// POST — create a new payment (solo admin/assistant, forzando institution_id)
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })
  if (!canManageFinances(profile.role)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const body = await req.json()
  const admin = createAdminClient()
  const normalizedType = normalizeRecurringType(body?.type)

  if (!normalizedType) {
    return NextResponse.json({ error: 'Tipo de cobro inv??lido.' }, { status: 400 })
  }

  const recurringConflict = await findRecurringConflict(admin, {
    institutionId: profile.institution_id,
    studentId: body?.student_id,
    type: normalizedType,
    due_date: body?.due_date,
    description: body?.description,
  })

  if (recurringConflict?.error) {
    return NextResponse.json({ error: recurringConflict.error }, { status: 409 })
  }

  // Forzamos institution_id del usuario autenticado (ignoramos el del body si viene)
  const { data, error } = await admin
    .from('payments' as any)
    .insert({ ...body, type: normalizedType, institution_id: profile.institution_id })
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
  if (!canManageFinances(profile.role)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('payments' as any)
    .select('institution_id, student_id, status, description, amount, type, due_date')
    .eq('id', id)
    .single()
  if ((existing as any)?.institution_id !== profile.institution_id) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  // Evitar que se modifique institution_id v??a body
  delete (updates as any).institution_id

  const nextType = normalizeRecurringType((updates as any).type ?? (existing as any)?.type)
  if (!nextType) {
    return NextResponse.json({ error: 'Tipo de cobro inv??lido.' }, { status: 400 })
  }

  const recurringConflict = await findRecurringConflict(admin, {
    institutionId: profile.institution_id,
    studentId: (updates as any).student_id ?? (existing as any)?.student_id,
    type: nextType,
    due_date: (updates as any).due_date ?? (existing as any)?.due_date,
    description: (updates as any).description ?? (existing as any)?.description,
    excludeId: id,
  })

  if (recurringConflict?.error) {
    return NextResponse.json({ error: recurringConflict.error }, { status: 409 })
  }

  const { data, error } = await admin
    .from('payments' as any)
    .update({ ...updates, type: nextType, updated_at: new Date().toISOString() })
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
  if (!canManageFinances(profile.role)) {
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

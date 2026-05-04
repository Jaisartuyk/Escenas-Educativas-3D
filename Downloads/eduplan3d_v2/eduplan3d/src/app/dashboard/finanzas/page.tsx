import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ChildScopeSelector } from '@/components/family/ChildScopeSelector'
import { getLinkedChildrenForParent, getPrimaryLinkedChildForParent } from '@/lib/parents'
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, CreditCard, DollarSign } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

function getPaymentStatus(p: any): 'pagado' | 'atrasado' | 'proximo' | 'pendiente' {
  if (p.status === 'pagado') return 'pagado'
  if (!p.due_date) return 'pendiente'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${p.due_date}T00:00:00`)
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'atrasado'
  if (diffDays <= 5) return 'proximo'
  return 'pendiente'
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(`${value}T00:00:00`)
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatType(value?: string | null) {
  if (value === 'matricula') return 'Matrícula'
  if (value === 'pension') return 'Pensión'
  if (value === 'otro') return 'Otro cobro'
  return value || 'Cobro'
}

function statusLabel(status: 'pagado' | 'atrasado' | 'proximo' | 'pendiente') {
  if (status === 'pagado') return 'Pagado'
  if (status === 'atrasado') return 'Atrasado'
  if (status === 'proximo') return 'Por vencer'
  return 'Pendiente'
}

const STATUS_STYLES: Record<'pagado' | 'atrasado' | 'proximo' | 'pendiente', string> = {
  pagado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  atrasado: 'bg-rose-50 text-rose-700 border-rose-200',
  proximo: 'bg-amber-50 text-amber-700 border-amber-200',
  pendiente: 'bg-slate-50 text-slate-600 border-slate-200',
}

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, institution_id, full_name, institutions(name)')
    .eq('id', user.id)
    .single()

  if (!profile || !['parent', 'student'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const params = await Promise.resolve(searchParams || {})
  const requestedChildId = typeof params.child_id === 'string' ? params.child_id : undefined
  const institutionName = Array.isArray(profile.institutions)
    ? profile.institutions[0]?.name
    : (profile.institutions as any)?.name

  let studentId = user.id
  let selectedChildId: string | null = null
  let linkedChildren: Awaited<ReturnType<typeof getLinkedChildrenForParent>> = []

  if (profile.role === 'parent') {
    linkedChildren = await getLinkedChildrenForParent(admin as any, user.id)
    const linkedChild = await getPrimaryLinkedChildForParent(admin as any, user.id, requestedChildId)
    if (!linkedChild) {
      return (
        <div className="max-w-3xl mx-auto p-8 text-center">
          <h1 className="font-display text-3xl font-bold">Finanzas familiares</h1>
          <p className="text-ink3 mt-3">
            Tu cuenta de representante todavía no tiene un estudiante vinculado. Pide a la institución que complete ese enlace.
          </p>
        </div>
      )
    }
    studentId = linkedChild.childId
    selectedChildId = linkedChild.childId
  }

  const [{ data: studentProfile }, { data: enrollments }, { data: payments }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name')
      .eq('id', studentId)
      .single(),
    admin
      .from('enrollments')
      .select('course_id')
      .eq('student_id', studentId),
    admin
      .from('payments' as any)
      .select('id, student_id, type, amount, status, due_date, paid_date, description, created_at')
      .eq('institution_id', profile.institution_id)
      .eq('student_id', studentId)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
  ])

  const courseIds = ((enrollments || []) as any[]).map((e: any) => e.course_id)
  let courseLabel = 'Sin curso asignado'
  if (courseIds.length > 0) {
    const { data: courses } = await admin
      .from('courses')
      .select('name, parallel')
      .in('id', courseIds)
      .limit(1)

    const course = (courses || [])[0] as any
    if (course) {
      courseLabel = `${course.name}${course.parallel ? ` ${course.parallel}` : ''}`
    }
  }

  const enrichedPayments = ((payments || []) as any[]).map((p: any) => ({
    ...p,
    computedStatus: getPaymentStatus(p),
  }))

  const stats = {
    totalPendiente: enrichedPayments
      .filter((p: any) => p.computedStatus !== 'pagado')
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0),
    totalPagado: enrichedPayments
      .filter((p: any) => p.computedStatus === 'pagado')
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0),
    atrasados: enrichedPayments.filter((p: any) => p.computedStatus === 'atrasado'),
    proximos: enrichedPayments.filter((p: any) => p.computedStatus === 'proximo'),
  }

  const nextDue = [...stats.atrasados, ...stats.proximos, ...enrichedPayments.filter((p: any) => p.computedStatus === 'pendiente')]
    .sort((a: any, b: any) => {
      const aTs = a.due_date ? new Date(`${a.due_date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER
      const bTs = b.due_date ? new Date(`${b.due_date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER
      return aTs - bTs
    })[0]

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {profile.role === 'parent' && selectedChildId && (
        <ChildScopeSelector
          childrenOptions={linkedChildren}
          selectedChildId={selectedChildId}
          title="Finanzas por estudiante"
          description="Cambia el hijo para revisar valores pendientes, pagos realizados y próximos vencimientos."
        />
      )}

      <div className="rounded-3xl border border-[rgba(0,0,0,0.06)] bg-bg2 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Finanzas</h1>
            <p className="text-ink3 text-sm mt-1">
              Estado de cuenta de {studentProfile?.full_name || 'tu estudiante'} en {courseLabel}.
            </p>
            <p className="text-ink4 text-xs mt-1">
              {institutionName || 'Institución'} · Vista solo lectura para familias
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p className="font-semibold">Próximo movimiento</p>
            <p className="text-xs mt-1 text-emerald-700">
              {nextDue
                ? `${formatType(nextDue.type)} · ${formatMoney(Number(nextDue.amount || 0))} · vence ${formatDate(nextDue.due_date)}`
                : 'No hay cobros pendientes por ahora.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Pendiente total</p>
              <p className="font-display text-2xl font-bold text-rose-800">{formatMoney(stats.totalPendiente)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Pagado</p>
              <p className="font-display text-2xl font-bold text-emerald-800">{formatMoney(stats.totalPagado)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Clock3 size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Por vencer</p>
              <p className="font-display text-2xl font-bold text-amber-800">{stats.proximos.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-slate-600 flex items-center justify-center border border-slate-200">
              <DollarSign size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Registros</p>
              <p className="font-display text-2xl font-bold text-slate-800">{enrichedPayments.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[rgba(0,0,0,0.06)] bg-bg2 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Estado de cuenta</h2>
            <p className="text-sm text-ink3">Cobros, pagos y vencimientos del estudiante seleccionado.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-ink4">
            <CreditCard size={14} />
            Solo lectura
          </div>
        </div>

        {enrichedPayments.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-slate-100 text-slate-500">
              <CreditCard size={28} />
            </div>
            <p className="text-ink3 font-medium">Todavía no hay cobros registrados</p>
            <p className="text-ink4 text-sm mt-1">Cuando secretaría emita valores, se verán aquí para la familia.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-5 py-3 font-bold text-ink3 uppercase tracking-wide">Concepto</th>
                  <th className="px-5 py-3 font-bold text-ink3 uppercase tracking-wide">Tipo</th>
                  <th className="px-5 py-3 font-bold text-ink3 uppercase tracking-wide">Monto</th>
                  <th className="px-5 py-3 font-bold text-ink3 uppercase tracking-wide">Vencimiento</th>
                  <th className="px-5 py-3 font-bold text-ink3 uppercase tracking-wide">Pago</th>
                  <th className="px-5 py-3 font-bold text-ink3 uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody>
                {enrichedPayments.map((payment: any) => (
                  <tr key={payment.id} className="border-t border-[rgba(0,0,0,0.05)] hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-ink2">{payment.description || 'Cobro institucional'}</p>
                      <p className="text-xs text-ink4 mt-1">Registrado {formatDate(payment.created_at?.slice?.(0, 10) || null)}</p>
                    </td>
                    <td className="px-5 py-4 text-ink3">{formatType(payment.type)}</td>
                    <td className="px-5 py-4 font-semibold text-ink">{formatMoney(Number(payment.amount || 0))}</td>
                    <td className="px-5 py-4 text-ink3">
                      <div className="inline-flex items-center gap-2">
                        <CalendarDays size={14} className="text-ink4" />
                        {formatDate(payment.due_date)}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-ink3">{formatDate(payment.paid_date)}</td>
                    <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLES[payment.computedStatus as keyof typeof STATUS_STYLES]}`}>
                        {statusLabel(payment.computedStatus as keyof typeof STATUS_STYLES)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

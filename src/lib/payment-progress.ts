export type PaymentStatus = 'pagado' | 'parcial' | 'becado' | 'atrasado' | 'proximo' | 'pendiente'

export type PaymentAbono = {
  id?: string
  payment_id?: string
  amount?: number | null
  paid_at?: string | null
  note?: string | null
  created_at?: string | null
}

export type PaymentWithAbonos = {
  id?: string
  type?: string | null
  description?: string | null
  amount?: number | null
  status?: string | null
  due_date?: string | null
  paid_date?: string | null
  scholarship_id?: string | null
  abonos?: PaymentAbono[] | null
}

export function inferPaymentType(payment: { type?: string | null; description?: string | null }) {
  if (payment.type === 'matricula' || payment.type === 'pension' || payment.type === 'otro') {
    return payment.type
  }

  const description = String(payment.description || '').toLowerCase()
  if (description.includes('matricula')) return 'matricula'
  if (description.includes('pension')) return 'pension'
  return payment.type || null
}

export function getAppliedAmount(payment: PaymentWithAbonos) {
  const abonos = Array.isArray(payment.abonos) ? payment.abonos : []
  const abonosTotal = abonos.reduce((sum, abono) => sum + Number(abono.amount || 0), 0)

  if (abonosTotal > 0) return abonosTotal
  if (payment.status === 'pagado') return Number(payment.amount || 0)
  // Si el status en DB es 'parcial' pero los abonos no están cargados,
  // devolvemos un valor mínimo positivo para que el computedStatus sea 'parcial'
  if (payment.status === 'parcial') return 0.001
  return 0
}

export function getRemainingAmount(payment: PaymentWithAbonos) {
  const total = Number(payment.amount || 0)
  const applied = getAppliedAmount(payment)
  return Math.max(total - applied, 0)
}

export function getComputedPaymentStatus(payment: PaymentWithAbonos): PaymentStatus {
  const total = Number(payment.amount || 0)
  const applied = getAppliedAmount(payment)

  if (payment.status === 'pagado' || (total > 0 && applied >= total)) return 'pagado'
  if (applied > 0) return 'parcial'
  if (payment.scholarship_id && total === 0) return 'becado'
  if (!payment.due_date) return 'pendiente'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${payment.due_date}T00:00:00`)
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'atrasado'
  if (diffDays <= 5) return 'proximo'
  return 'pendiente'
}

export function attachAbonosToPayments<T extends { id?: string | null }>(
  payments: T[],
  abonos: PaymentAbono[]
): Array<T & { abonos: PaymentAbono[]; type?: string | null }> {
  const abonosByPayment: Record<string, PaymentAbono[]> = {}

  for (const abono of abonos || []) {
    const paymentId = abono.payment_id
    if (!paymentId) continue
    if (!abonosByPayment[paymentId]) abonosByPayment[paymentId] = []
    abonosByPayment[paymentId].push(abono)
  }

  return payments.map((payment) => ({
    ...payment,
    type: inferPaymentType(payment as any),
    abonos: payment.id ? (abonosByPayment[payment.id] || []) : [],
  }))
}

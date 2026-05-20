export type PaymentStatus = 'pagado' | 'parcial' | 'atrasado' | 'proximo' | 'pendiente'

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
  amount?: number | null
  status?: string | null
  due_date?: string | null
  paid_date?: string | null
  abonos?: PaymentAbono[] | null
}

export function getAppliedAmount(payment: PaymentWithAbonos) {
  const abonos = Array.isArray(payment.abonos) ? payment.abonos : []
  const abonosTotal = abonos.reduce((sum, abono) => sum + Number(abono.amount || 0), 0)

  if (abonosTotal > 0) return abonosTotal
  if (payment.status === 'pagado') return Number(payment.amount || 0)
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
): Array<T & { abonos: PaymentAbono[] }> {
  const abonosByPayment: Record<string, PaymentAbono[]> = {}

  for (const abono of abonos || []) {
    const paymentId = abono.payment_id
    if (!paymentId) continue
    if (!abonosByPayment[paymentId]) abonosByPayment[paymentId] = []
    abonosByPayment[paymentId].push(abono)
  }

  return payments.map((payment) => ({
    ...payment,
    abonos: payment.id ? (abonosByPayment[payment.id] || []) : [],
  }))
}

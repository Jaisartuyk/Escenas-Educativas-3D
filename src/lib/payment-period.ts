const MONTH_NAME_TO_INDEX: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
}

export type RecurringPaymentType = 'matricula' | 'pension'

export type PaymentPeriodInput = {
  type?: string | null
  due_date?: string | null
  description?: string | null
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDateOnly(value?: string | null) {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  if (!Number.isNaN(parsed.getTime())) return parsed

  const fallback = new Date(value)
  if (!Number.isNaN(fallback.getTime())) return fallback

  return null
}

function parseYearFromDescription(description?: string | null) {
  if (!description) return null
  const match = normalizeText(description).match(/\b(20\d{2})\b/)
  return match ? Number(match[1]) : null
}

function parseMonthFromDescription(description?: string | null) {
  if (!description) return null
  const normalized = normalizeText(description)
  return Object.entries(MONTH_NAME_TO_INDEX).find(([monthName]) => normalized.includes(monthName))?.[1] ?? null
}

export function getRecurringPaymentPeriodKey(payment: PaymentPeriodInput) {
  if (payment.type !== 'matricula' && payment.type !== 'pension') return null

  const dueDate = parseDateOnly(payment.due_date)
  if (dueDate) {
    if (payment.type === 'matricula') {
      return `matricula:${dueDate.getFullYear()}`
    }

    const month = String(dueDate.getMonth() + 1).padStart(2, '0')
    return `pension:${dueDate.getFullYear()}-${month}`
  }

  const descriptionYear = parseYearFromDescription(payment.description)
  if (!descriptionYear) return null

  if (payment.type === 'matricula') {
    return `matricula:${descriptionYear}`
  }

  const descriptionMonth = parseMonthFromDescription(payment.description)
  if (descriptionMonth === null) return null

  const month = String(descriptionMonth + 1).padStart(2, '0')
  return `pension:${descriptionYear}-${month}`
}

export function buildRecurringPaymentDescription(type: RecurringPaymentType, year: number, monthIndex: number | null, courseName: string) {
  if (type === 'matricula') {
    return `Matricula ${year} - ${courseName}`.trim()
  }

  if (monthIndex === null) {
    throw new Error('monthIndex is required for pension descriptions')
  }

  const monthName = Object.entries(MONTH_NAME_TO_INDEX).find(([, idx]) => idx === monthIndex)?.[0]
  const label = monthName ? monthName.charAt(0).toUpperCase() + monthName.slice(1) : 'Mes'
  return `Pension ${label} ${year} - ${courseName}`.trim()
}

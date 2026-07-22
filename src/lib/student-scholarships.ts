export type ScholarshipCourseGroup = 'escuela' | 'colegio'

export type StudentScholarship = {
  id: string
  institution_id: string
  student_id: string
  amount_to_pay: number
  applies_to: 'pension'
  active: boolean
  note?: string | null
}

export const SCHOLARSHIP_AMOUNTS: Record<ScholarshipCourseGroup, number[]> = {
  escuela: [0, 30, 35],
  colegio: [0, 30, 40],
}

export function getScholarshipCourseGroup(course?: { name?: string | null; level?: string | null } | null): ScholarshipCourseGroup {
  const value = `${course?.name || ''} ${course?.level || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (/\b(8vo|8avo|octavo|9no|9noveno|noveno|10mo|decimo|bgu|bachiller)\b/.test(value)) {
    return 'colegio'
  }

  return 'escuela'
}

export function getScholarshipAmount(
  scholarship: Pick<StudentScholarship, 'amount_to_pay' | 'active'> | null | undefined,
  baseAmount: number
) {
  if (!scholarship?.active) return baseAmount
  return Number(scholarship.amount_to_pay)
}


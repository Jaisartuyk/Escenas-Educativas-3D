export type AttendanceLike = {
  id?: string
  student_id: string
  date?: string | null
  status?: 'present' | 'late' | 'absent' | string | null
  justification_status?: string | null
  justification_text?: string | null
}

export type DailyAttendanceRecord = {
  student_id: string
  date: string
  status: 'present' | 'late' | 'absent'
  justification_status: string | null
  justification_text: string | null
}

export type AttendanceStudentSummary = {
  present: number
  late: number
  absent: number
  justified: number
  total: number
  attendanceRate: number
  lastStatus: 'present' | 'late' | 'absent' | null
  lastDate: string | null
}

const STATUS_PRIORITY: Record<string, number> = {
  present: 1,
  late: 2,
  absent: 3,
}

function normalizeStatus(status?: string | null): 'present' | 'late' | 'absent' {
  if (status === 'late' || status === 'absent') return status
  return 'present'
}

function isApprovedJustification(status?: string | null) {
  return status === 'approved' || status === 'aprobada' || status === 'justified'
}

export function dedupeAttendanceByStudentAndDate(records: AttendanceLike[]): DailyAttendanceRecord[] {
  const byStudentDate = new Map<string, DailyAttendanceRecord>()

  for (const record of records) {
    if (!record.student_id || !record.date) continue

    const status = normalizeStatus(record.status)
    const key = `${record.student_id}::${record.date}`
    const current = byStudentDate.get(key)
    const next: DailyAttendanceRecord = {
      student_id: record.student_id,
      date: record.date,
      status,
      justification_status: record.justification_status ?? null,
      justification_text: record.justification_text ?? null,
    }

    if (!current) {
      byStudentDate.set(key, next)
      continue
    }

    const currentPriority = STATUS_PRIORITY[current.status] ?? 0
    const nextPriority = STATUS_PRIORITY[next.status] ?? 0

    if (nextPriority > currentPriority) {
      byStudentDate.set(key, {
        ...next,
        justification_status: next.justification_status ?? current.justification_status,
        justification_text: next.justification_text ?? current.justification_text,
      })
      continue
    }

    byStudentDate.set(key, {
      ...current,
      justification_status: current.justification_status ?? next.justification_status,
      justification_text: current.justification_text ?? next.justification_text,
    })
  }

  return Array.from(byStudentDate.values()).sort((a, b) => b.date.localeCompare(a.date))
}

export function buildAttendanceSummaries(records: AttendanceLike[]) {
  const summaries: Record<string, AttendanceStudentSummary> = {}
  const deduped = dedupeAttendanceByStudentAndDate(records)

  for (const record of deduped) {
    if (!summaries[record.student_id]) {
      summaries[record.student_id] = {
        present: 0,
        late: 0,
        absent: 0,
        justified: 0,
        total: 0,
        attendanceRate: 0,
        lastStatus: null,
        lastDate: null,
      }
    }

    const summary = summaries[record.student_id]
    summary.total += 1
    summary[record.status] += 1

    if (isApprovedJustification(record.justification_status)) {
      summary.justified += 1
    }

    if (!summary.lastDate || record.date > summary.lastDate) {
      summary.lastDate = record.date
      summary.lastStatus = record.status
    }
  }

  for (const summary of Object.values(summaries)) {
    const attended = summary.present + summary.late
    summary.attendanceRate = summary.total > 0 ? Math.round((attended / summary.total) * 100) : 0
  }

  return summaries
}

export function getStudentAttendanceHistory(records: AttendanceLike[], studentId: string) {
  return dedupeAttendanceByStudentAndDate(records).filter(record => record.student_id === studentId)
}

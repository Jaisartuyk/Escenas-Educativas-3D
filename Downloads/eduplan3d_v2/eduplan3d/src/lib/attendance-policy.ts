type CourseLike = {
  id: string
  name?: string | null
  parallel?: string | null
}

type InstitutionSettings = Record<string, any>

type SharedAttendancePolicy = {
  sharedMode: boolean
  authorityTeacherName: string | null
  authoritySubjectName: string | null
  authoritySource: 'tutor' | 'first-hour' | 'fallback'
  canTeacherEdit: boolean
  dayLabel: string
  courseLabel: string
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const

function normalizeText(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildCourseLabel(course: CourseLike) {
  return [course.name, course.parallel].filter(Boolean).join(' ').trim()
}

function isSpecialCell(value: string | null | undefined) {
  const normalized = normalizeText(value)
  return !normalized || normalized === 'receso' || normalized === 'acompanamiento' || normalized === 'salida'
}

function isSharedTutorCourse(courseLabel: string) {
  const normalized = normalizeText(courseLabel)
  return normalized.startsWith('inicial') ||
    normalized.startsWith('1ro basica') ||
    normalized.startsWith('2do basica') ||
    normalized.startsWith('3ro basica')
}

function findScheduleSlot(settings: InstitutionSettings, courseLabel: string) {
  const normalizedCourse = normalizeText(courseLabel)

  for (const [key, value] of Object.entries(settings || {})) {
    if (!key.startsWith('horarios')) continue
    const slot = value as any
    const cursos = Array.isArray(slot?.config?.cursos) ? slot.config.cursos : []
    const matched = cursos.find((course: string) => normalizeText(course) === normalizedCourse)
    if (matched) {
      return { key, slot, matchedCourse: matched as string }
    }
  }

  return null
}

function findTutorName(slot: any, courseLabel: string) {
  const tutores = slot?.config?.tutores || {}
  const normalizedCourse = normalizeText(courseLabel)

  for (const [key, value] of Object.entries(tutores)) {
    if (normalizeText(key) === normalizedCourse && typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function findFirstHourAssignment(slot: any, courseLabel: string, dayLabel: string) {
  const normalizedCourse = normalizeText(courseLabel)
  let matchedCourseKey: string | null = null

  for (const key of Object.keys(slot?.horario || {})) {
    if (normalizeText(key) === normalizedCourse) {
      matchedCourseKey = key
      break
    }
  }

  if (!matchedCourseKey) return { subjectName: null as string | null, teacherName: null as string | null }

  const row = slot?.horario?.[matchedCourseKey]?.[dayLabel]
  if (!Array.isArray(row)) return { subjectName: null as string | null, teacherName: null as string | null }

  const docenteMap = slot?.docentePorCurso?.[matchedCourseKey] || {}

  for (const cell of row) {
    if (isSpecialCell(cell)) continue
    const subjectName = String(cell || '').trim()
    const teacherName = docenteMap?.[subjectName] ? String(docenteMap[subjectName]).trim() : null
    return { subjectName, teacherName }
  }

  return { subjectName: null, teacherName: null }
}

export function getSharedAttendancePolicy(params: {
  settings: InstitutionSettings
  course: CourseLike
  date: string
  teacherName: string
  teacherHasFullCourseControl?: boolean
}): SharedAttendancePolicy {
  const courseLabel = buildCourseLabel(params.course)
  const parsedDate = new Date(`${params.date}T12:00:00`)
  const dayLabel = DAY_NAMES[parsedDate.getDay()] || 'Lunes'
  const teacherName = normalizeText(params.teacherName)
  const slotMatch = findScheduleSlot(params.settings, courseLabel)

  let authorityTeacherName: string | null = null
  let authoritySubjectName: string | null = null
  let authoritySource: SharedAttendancePolicy['authoritySource'] = 'fallback'

  if (slotMatch) {
    const tutorName = findTutorName(slotMatch.slot, courseLabel)
    const firstHour = findFirstHourAssignment(slotMatch.slot, courseLabel, dayLabel)

    if (isSharedTutorCourse(courseLabel) && tutorName) {
      authorityTeacherName = tutorName
      authoritySource = 'tutor'
      authoritySubjectName = firstHour.subjectName
    } else if (firstHour.teacherName) {
      authorityTeacherName = firstHour.teacherName
      authoritySubjectName = firstHour.subjectName
      authoritySource = 'first-hour'
    } else if (tutorName) {
      authorityTeacherName = tutorName
      authoritySource = 'tutor'
    }
  }

  const canTeacherEdit =
    Boolean(params.teacherHasFullCourseControl) ||
    !authorityTeacherName ||
    normalizeText(authorityTeacherName) === teacherName

  return {
    sharedMode: true,
    authorityTeacherName,
    authoritySubjectName,
    authoritySource,
    canTeacherEdit,
    dayLabel,
    courseLabel,
  }
}

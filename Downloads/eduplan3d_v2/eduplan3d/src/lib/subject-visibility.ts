type SubjectLike = {
  name?: string | null
}

const LETAMENDI_PLANIFICACION_EXCLUDED = new Set([
  'desarrollo sostenible',
  'desarrollo socio emocional',
  'desarrollo socioemocional',
  'educacion financiera',
  'atencion a padres',
  'educacion ciudadana',
  'emprendimiento',
  'natacion',
  'futbol',
  'laboratorio',
])

const LETAMENDI_LIBRETAS_EXCLUDED = new Set([
  'atencion a padres',
  'natacion',
  'futbol',
])

function normalizeSubjectName(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isLetamendiInstitution(institutionName: string | null | undefined): boolean {
  return (institutionName || '').toUpperCase().includes('LETAMENDI')
}

export function shouldHideSubjectInPlanificaciones(
  institutionName: string | null | undefined,
  subjectName: string | null | undefined,
): boolean {
  if (!isLetamendiInstitution(institutionName)) return false
  return LETAMENDI_PLANIFICACION_EXCLUDED.has(normalizeSubjectName(subjectName))
}

export function shouldHideSubjectInLibretas(
  institutionName: string | null | undefined,
  subjectName: string | null | undefined,
): boolean {
  if (!isLetamendiInstitution(institutionName)) return false
  return LETAMENDI_LIBRETAS_EXCLUDED.has(normalizeSubjectName(subjectName))
}

export function filterSubjectsForPlanificaciones<T extends SubjectLike>(
  institutionName: string | null | undefined,
  subjects: T[],
): T[] {
  return subjects.filter((subject) => !shouldHideSubjectInPlanificaciones(institutionName, subject.name))
}

export function filterSubjectsForLibretas<T extends SubjectLike>(
  institutionName: string | null | undefined,
  subjects: T[],
): T[] {
  return subjects.filter((subject) => !shouldHideSubjectInLibretas(institutionName, subject.name))
}

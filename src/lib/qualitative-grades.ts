export type QualitativeGrade = {
  id: string
  label: string
  description: string
  equivalencia: string
  numericValue: number
}

// Escala cualitativa para Acompañamiento Integral y 1ro de Básica
export const QUALITATIVE_SCALE: QualitativeGrade[] = [
  { id: 'A+', label: 'A+', description: 'Supera con excelencia las metas propuestas para las habilidades socioemocionales', equivalencia: 'Aprendizaje Alcanzado (A)', numericValue: 10 },
  { id: 'A-', label: 'A-', description: 'Es excelente el alcance de las metas propuestas para las habilidades socioemocionales', equivalencia: 'Aprendizaje Alcanzado (A)', numericValue: 9 },
  { id: 'B+', label: 'B+', description: 'Es destacado el alcance de las metas propuestas para las habilidades socioemocionales', equivalencia: 'Aprendizaje Alcanzado (A)', numericValue: 8 },
  { id: 'B-', label: 'B-', description: 'Alcanza las metas propuestas para las habilidades socioemocionales', equivalencia: 'Aprendizaje en Proceso (EP)', numericValue: 7 },
  { id: 'C+', label: 'C+', description: 'En algunas habilidades socioemocionales el alcance de las metas propuestas está en progreso', equivalencia: 'Aprendizaje en Proceso (EP)', numericValue: 6 },
  { id: 'C-', label: 'C-', description: 'En la mayoría de las habilidades socioemocionales el alcance de las metas propuestas está en progreso', equivalencia: 'Aprendizaje en Proceso (EP)', numericValue: 5 },
  { id: 'D+', label: 'D+', description: 'En algunas de las habilidades socioemocionales el alcance de las metas propuestas está en inicio', equivalencia: 'Aprendizaje Iniciado (I)', numericValue: 4 },
  { id: 'D-', label: 'D-', description: 'En algunas de las habilidades socioemocionales el alcance de las metas propuestas está en inicio', equivalencia: 'Aprendizaje Iniciado (I)', numericValue: 3 },
  { id: 'E+', label: 'E+', description: 'Solo en una de las habilidades socioemocionales se alcanza las metas propuestas', equivalencia: 'Aprendizaje Iniciado (I)', numericValue: 2 },
  { id: 'E-', label: 'E-', description: 'Requiere de acompañamiento individualizado para desarrollo y fortalecimiento de habilidades socioemocionales', equivalencia: 'Aprendizaje Iniciado (I)', numericValue: 1 },
]

export const INDICATOR_SCALE = [
  { id: 'SIEMPRE', label: 'SIEMPRE', numericValue: 10 },
  { id: 'FRECUENTEMENTE', label: 'FRECUENTEMENTE', numericValue: 8 },
  { id: 'OCASIONALMENTE', label: 'OCASIONALMENTE', numericValue: 5 },
  { id: 'NUNCA', label: 'NUNCA', numericValue: 2 },
]

export function normalizeName(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Determina si una materia debe ser calificada de forma cualitativa.
 */
export function isQualitativeSubject(subjectName?: string | null, courseName?: string | null): boolean {
  if (!subjectName) return false
  const normSubject = normalizeName(subjectName)

  // Materia específica (Acompañamiento Integral)
  if (normSubject.includes('acompanamiento int') || normSubject.includes('acompanamiento integral')) {
    return true
  }

  return false
}

/**
 * Determina si una materia debe ser EXCLUIDA de las libretas y el cálculo de promedios.
 * Ej: Futbol, Natacion
 */
export function isExcludedSubject(subjectName?: string | null): boolean {
  if (!subjectName) return false
  const normSubject = normalizeName(subjectName)
  return normSubject.includes('futbol') || normSubject.includes('natacion')
}

/**
 * Convierte un valor numérico a su equivalente cualitativo según la tabla de Acompañamiento Integral.
 */
export function getQualitativeGradeForNumber(value: number | null | undefined): QualitativeGrade | null {
  if (value == null) return null
  
  const rounded = Math.round(value)
  return QUALITATIVE_SCALE.find(g => g.numericValue === rounded) || null
}

export function getIndicatorGradeForNumber(value: number | null | undefined): string {
  if (value == null) return ''
  const rounded = Math.round(value)
  const ind = INDICATOR_SCALE.find(g => g.numericValue === rounded)
  return ind ? ind.id : ''
}

/**
 * Convierte un valor cualitativo (A+, B-, etc, o SIEMPRE, FRECUENTEMENTE) a su valor numérico de equivalencia.
 */
export function getNumericValueForQualitative(id: string): number | null {
  let grade: { numericValue: number } | undefined = QUALITATIVE_SCALE.find(g => g.id === id)
  if (!grade) {
    grade = INDICATOR_SCALE.find(g => g.id === id)
  }
  return grade ? grade.numericValue : null
}

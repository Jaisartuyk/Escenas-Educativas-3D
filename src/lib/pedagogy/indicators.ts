// src/lib/pedagogy/indicators.ts

/**
 * Values for indicator-based evaluations
 */
export const INDICATORS = [
  { value: 10, label: 'SIEMPRE', short: 'S' },
  { value: 8, label: 'FRECUENTEMENTE', short: 'F' },
  { value: 5, label: 'OCASIONALMENTE', short: 'O' },
  { value: 2, label: 'NUNCA', short: 'N' },
] as const

export type IndicatorLabel = typeof INDICATORS[number]['label']

/**
 * List of indicators for Integral Accompaniment
 */
export const ACOMPANAMIENTO_INDICATORS = [
  'Describe sus estados de ánimo, sus fortalezas y preferencias.',
  'Hace preguntas para dar solución a desafíos simples que requieran reflexión.',
  'Identifica diferentes opciones y consecuencias a corto plazo y su responsabilidad al elegirlas.',
  'Genera ideas y soluciones diversas a problemas en actividades de arte, música, juego.',
  'Colabora con otros en actividades grupales, compartiendo ideas, escuchando a los demás y respetando las normas del grupo.',
  'Comprende y respeta las diferencias individuales, y muestra actitudes de apoyo y compasión.',
  'Reconoce desacuerdos para buscar soluciones a conflictos; escucha las opiniones de las otras personas y aplica estrategias simples de negociación.',
  'Escucha activamente y expresa opiniones de manera respetuosa.',
  'Reconoce y expresa emociones y sentimientos, y reconoce emociones básicas (tristeza, alegría, ira, miedo) de las otras personas.',
]

/**
 * Determines if a given course name or subject name requires indicator-based grading.
 * E.g. "1ro Basica", "Acompañamiento Integral en el Aula".
 */
export function requiresIndicatorGrading(courseName: string, subjectName: string): boolean {
  if (!courseName && !subjectName) return false

  const cName = (courseName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const sName = (subjectName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  const is1roBasica = cName.includes('1ro') && (cName.includes('basica') || cName.includes('inicial'))
  const isAcompanamiento = sName.includes('acompanamiento')

  return is1roBasica || isAcompanamiento
}

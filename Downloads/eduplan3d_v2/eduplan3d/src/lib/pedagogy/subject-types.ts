// src/lib/pedagogy/subject-types.ts
// Detección de tipo de materia para aplicar estructuras curriculares
// específicas. MinEduc Ecuador 2025-2026:
//   - Lenguas extranjeras (Inglés/Francés/Alemán) usan marco CEFR + 5 destrezas
//   - Lenguas ancestrales (Quechua/Kichwa/Shuar) similar a EFL pero con DCDs propios
//   - Otras materias siguen estructura estándar (Lengua, Mate, CCNN, CCSS, ECA, etc.)

export type SubjectFamily = 'efl' | 'language_other' | 'standard'

const EFL_KEYWORDS = [
  'ingles', 'inglés', 'english', 'efl', 'esl', 'foreign language',
]

const OTHER_LANGUAGE_KEYWORDS = [
  'frances', 'francés', 'french',
  'aleman', 'alemán', 'german',
  'quechua', 'kichwa', 'shuar',
  'portugues', 'portugués', 'portuguese',
  'italiano', 'italian',
]

/**
 * Normaliza string: minúsculas + sin tildes + sin espacios extra.
 */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** ¿Es Inglés (English Foreign Language)? */
export function isEFLSubject(name: string | null | undefined): boolean {
  if (!name) return false
  const n = normalize(name)
  return EFL_KEYWORDS.some(k => n.includes(normalize(k)))
}

/** ¿Es alguna lengua extranjera o ancestral (incluye Inglés)? */
export function isLanguageSubject(name: string | null | undefined): boolean {
  if (!name) return false
  const n = normalize(name)
  return (
    EFL_KEYWORDS.some(k => n.includes(normalize(k))) ||
    OTHER_LANGUAGE_KEYWORDS.some(k => n.includes(normalize(k)))
  )
}

/** Clasifica la familia de la materia. */
export function getSubjectFamily(name: string | null | undefined): SubjectFamily {
  if (!name) return 'standard'
  if (isEFLSubject(name)) return 'efl'
  if (isLanguageSubject(name)) return 'language_other'
  return 'standard'
}

// ─────────────────────────────────────────────────────────────────────────────
// Niveles CEFR alineados al currículo MinEduc EFL 2025-2026
// ─────────────────────────────────────────────────────────────────────────────
export const CEFR_LEVELS = [
  { id: 'A1.1', label: 'A1.1 — Pre-básico (2do EGB)' },
  { id: 'A1.2', label: 'A1.2 — Básico inicial (3ro-4to EGB)' },
  { id: 'A2.1', label: 'A2.1 — Básico (5to-6to EGB)' },
  { id: 'A2.2', label: 'A2.2 — Pre-intermedio (7mo-8vo EGB)' },
  { id: 'B1.1', label: 'B1.1 — Intermedio inicial (9no-10mo EGB)' },
  { id: 'B1.2', label: 'B1.2 — Intermedio (1ro-2do BGU)' },
  { id: 'B2.1', label: 'B2.1 — Intermedio alto (3ro BGU)' },
] as const

export type CEFRLevel = typeof CEFR_LEVELS[number]['id']

/**
 * Sugiere un nivel CEFR por defecto según el grado del curso.
 * Útil para pre-seleccionar en el form.
 */
export function suggestCEFRLevel(grade: string | null | undefined): CEFRLevel | null {
  if (!grade) return null
  const g = normalize(grade)

  // Detectar BGU primero (más específico)
  if (g.includes('bgu') || g.includes('bachillerato')) {
    if (g.match(/\b1|primero|primer/)) return 'B1.2'
    if (g.match(/\b2|segundo/)) return 'B1.2'
    if (g.match(/\b3|tercero|tercer/)) return 'B2.1'
    return 'B1.2'
  }

  // EGB por número
  const m = g.match(/(\d+)/)
  if (!m) return null
  const num = parseInt(m[1], 10)

  if (num >= 1 && num <= 2) return 'A1.1'
  if (num >= 3 && num <= 4) return 'A1.2'
  if (num >= 5 && num <= 6) return 'A2.1'
  if (num >= 7 && num <= 8) return 'A2.2'
  if (num >= 9 && num <= 10) return 'B1.1'
  return 'A1.1'
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 destrezas comunicativas MinEduc EFL
// ─────────────────────────────────────────────────────────────────────────────
export const EFL_SKILLS = [
  { id: 'communication',         label: 'Communication and Cultural Awareness', emoji: '🌍' },
  { id: 'oral',                   label: 'Oral Communication (Listening & Speaking)', emoji: '🗣️' },
  { id: 'reading',                label: 'Reading',                              emoji: '📖' },
  { id: 'writing',                label: 'Writing',                              emoji: '✍️' },
  { id: 'language_through_arts',  label: 'Language through the Arts',            emoji: '🎭' },
] as const

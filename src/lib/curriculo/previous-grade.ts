// src/lib/curriculo/previous-grade.ts
// Mapeo del curso actual al curso ANTERIOR para la Semana de Adaptación.
// Sistema educativo ecuatoriano (MinEduc):
//   - EGB: 1ro–10mo (subniveles: preparatoria 1ro, elemental 2-4,
//          media 5-7, superior 8-10)
//   - BGU: 1ro–3ro
//
// Convenciones de entrada que aceptamos:
//   "1ro EGB", "1ero EGB", "1° EGB", "Primero EGB",
//   "1ro de Básica", "1ro Básica", "1ro B",
//   "8vo EGB", "8vo", "8º EGB",
//   "1ro BGU", "1ro Bachillerato", etc.

export type PreviousGradeInfo = {
  /** Etiqueta legible para mostrar al docente / IA, ej: "7mo EGB". */
  label: string
  /** Número del grado anterior (NULL si no aplica, ej: 1ro EGB). */
  number: number | null
  /** Subnivel del grado anterior: 'preparatoria' | 'elemental' | 'media' | 'superior' | 'bgu' | 'inicial'. */
  subnivel: 'inicial' | 'preparatoria' | 'elemental' | 'media' | 'superior' | 'bgu'
  /** Bloque al que pertenece: 'EGB' o 'BGU'. */
  bloque: 'EGB' | 'BGU' | 'INICIAL'
}

const ORDINAL_TO_NUMBER: Record<string, number> = {
  primero: 1, primer: 1, '1ro': 1, '1ero': 1, '1°': 1, '1º': 1, '1': 1,
  segundo: 2, '2do': 2, '2°': 2, '2º': 2, '2': 2,
  tercero: 3, tercer: 3, '3ro': 3, '3ero': 3, '3°': 3, '3º': 3, '3': 3,
  cuarto: 4, '4to': 4, '4°': 4, '4º': 4, '4': 4,
  quinto: 5, '5to': 5, '5°': 5, '5º': 5, '5': 5,
  sexto: 6, '6to': 6, '6°': 6, '6º': 6, '6': 6,
  septimo: 7, séptimo: 7, '7mo': 7, '7°': 7, '7º': 7, '7': 7,
  octavo: 8, '8vo': 8, '8°': 8, '8º': 8, '8': 8,
  noveno: 9, '9no': 9, '9°': 9, '9º': 9, '9': 9,
  decimo: 10, décimo: 10, '10mo': 10, '10°': 10, '10º': 10, '10': 10,
}

const NUMBER_TO_ORDINAL: Record<number, string> = {
  1: '1ro', 2: '2do', 3: '3ro', 4: '4to', 5: '5to',
  6: '6to', 7: '7mo', 8: '8vo', 9: '9no', 10: '10mo',
}

function detectBloque(grade: string): 'EGB' | 'BGU' | 'INICIAL' {
  const g = grade.toLowerCase()
  if (g.includes('bachillerato') || g.includes('bgu')) return 'BGU'
  if (g.includes('inicial')) return 'INICIAL'
  return 'EGB'  // default — incluye "Básica", "EGB" o solo número
}

function detectNumber(grade: string): number | null {
  const g = grade.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  // Buscar tokens al principio como "8vo", "Primero", etc.
  const tokens = g.split(/\s+/)
  for (const t of tokens) {
    const clean = t.replace(/[°º.]/g, '')
    if (ORDINAL_TO_NUMBER[clean] != null) return ORDINAL_TO_NUMBER[clean]
  }
  // Fallback: primer número que aparezca
  const m = g.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

function subnivelForEGB(n: number): PreviousGradeInfo['subnivel'] {
  if (n === 1) return 'preparatoria'
  if (n >= 2 && n <= 4) return 'elemental'
  if (n >= 5 && n <= 7) return 'media'
  if (n >= 8 && n <= 10) return 'superior'
  return 'preparatoria'
}

/**
 * Devuelve el curso anterior para fines de la Semana de Adaptación.
 *
 * Reglas:
 *   - 1ro EGB     → Inicial / Preparatoria (número null, subnivel inicial)
 *   - 2do–10mo EGB → (n-1)to EGB del subnivel correspondiente
 *   - 1ro BGU     → 10mo EGB (subnivel superior)
 *   - 2do BGU     → 1ro BGU
 *   - 3ro BGU     → 2do BGU
 *   - Casos no reconocidos → "el grado anterior" (label genérico)
 */
export function getPreviousLevel(currentGrade: string): PreviousGradeInfo {
  const bloque = detectBloque(currentGrade)
  const num = detectNumber(currentGrade)

  // Caso INICIAL: no hay anterior real
  if (bloque === 'INICIAL') {
    return { label: 'Inicial', number: null, subnivel: 'inicial' as any, bloque: 'INICIAL' }
  }

  // BGU
  if (bloque === 'BGU') {
    if (num === 1) {
      return { label: '10mo EGB', number: 10, subnivel: 'superior', bloque: 'EGB' }
    }
    if (num === 2) {
      return { label: '1ro BGU', number: 1, subnivel: 'bgu', bloque: 'BGU' }
    }
    if (num === 3) {
      return { label: '2do BGU', number: 2, subnivel: 'bgu', bloque: 'BGU' }
    }
    return { label: 'el grado anterior', number: null, subnivel: 'bgu', bloque: 'BGU' }
  }

  // EGB
  if (num === 1) {
    return { label: 'Inicial / Preparatoria', number: null, subnivel: 'preparatoria', bloque: 'EGB' }
  }
  if (num != null && num >= 2 && num <= 10) {
    const prev = num - 1
    return {
      label: `${NUMBER_TO_ORDINAL[prev]} EGB`,
      number: prev,
      subnivel: subnivelForEGB(prev),
      bloque: 'EGB',
    }
  }

  return { label: 'el grado anterior', number: null, subnivel: 'preparatoria', bloque: 'EGB' }
}

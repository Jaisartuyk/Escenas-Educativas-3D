// src/lib/utils.ts

/**
 * Scale for MINEDUC qualitative grades (New Equivalencies)
 */
export function cualitativo(score: number | null): string {
  if (score === null) return ''
  if (score === 10) return 'A+'
  if (score >= 9) return 'A-'
  if (score >= 8) return 'B+'
  if (score >= 7) return 'B-'
  if (score >= 6) return 'C+'
  if (score >= 5) return 'C-'
  if (score >= 4) return 'D+'
  if (score >= 3) return 'D-'
  if (score >= 2) return 'E+'
  return 'E-'
}

/**
 * Format percentages
 */
export function formatPercent(val: number) {
  return `${val.toFixed(0)}%`
}

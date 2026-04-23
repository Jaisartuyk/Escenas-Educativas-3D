// src/lib/utils.ts

/**
 * Scale for MINEDUC qualitative grades
 */
export function cualitativo(score: number) {
  if (score >= 9) return { label: 'DAR', color: 'text-emerald-400' }
  if (score >= 7) return { label: 'AAR', color: 'text-blue-400' }
  if (score >= 4.01) return { label: 'PAR', color: 'text-amber-400' }
  return { label: 'NAAR', color: 'text-rose-400' }
}

/**
 * Format percentages
 */
export function formatPercent(val: number) {
  return `${val.toFixed(0)}%`
}

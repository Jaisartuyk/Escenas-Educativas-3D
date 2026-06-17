// src/lib/utils.ts

/**
 * Scale for MINEDUC qualitative grades (New Equivalencies)
 */
export function cualitativo(score: number | null) {
  if (score === null) return { label: '', color: 'text-ink4' }
  if (score === 10) return { label: 'A+', color: 'text-emerald-500' }
  if (score >= 9) return { label: 'A-', color: 'text-emerald-400' }
  if (score >= 8) return { label: 'B+', color: 'text-teal-400' }
  if (score >= 7) return { label: 'B-', color: 'text-teal-500' }
  if (score >= 6) return { label: 'C+', color: 'text-blue-400' }
  if (score >= 5) return { label: 'C-', color: 'text-blue-500' }
  if (score >= 4) return { label: 'D+', color: 'text-amber-500' }
  if (score >= 3) return { label: 'D-', color: 'text-orange-400' }
  if (score >= 2) return { label: 'E+', color: 'text-rose-400' }
  return { label: 'E-', color: 'text-rose-600' }
}

/**
 * Format percentages
 */
export function formatPercent(val: number) {
  return `${val.toFixed(0)}%`
}

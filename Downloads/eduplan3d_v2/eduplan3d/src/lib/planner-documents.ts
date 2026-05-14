export type PlannerDocKind = 'pud' | 'pca' | 'general'

export type PlannerDocStats = {
  total: number
  pud: number
  pca: number
  general: number
}

type PlannerDocLike = {
  doc_kind?: string | null
  titulo?: string | null
  file_name?: string | null
}

export const PLANNER_DOC_KIND_OPTIONS: Array<{
  value: PlannerDocKind
  label: string
  description: string
}> = [
  {
    value: 'pud',
    label: 'PUD',
    description: 'Para clase diaria y unidad didactica.',
  },
  {
    value: 'pca',
    label: 'PCA',
    description: 'Para trimestre completo.',
  },
  {
    value: 'general',
    label: 'Apoyo general',
    description: 'Libro, guia o material complementario.',
  },
]

const PUD_PATTERN = /\bPUD\b|PLAN\s+DE\s+UNIDAD|UNIDAD\s+DIDACT/i
const PCA_PATTERN = /\bPCA\b|PLAN(IFICA(CION)?)?\s+CURRICULAR\s+ANUAL|PLANIFICACION\s+ANUAL/i

export function inferPlannerDocKind(input: {
  titulo?: string | null
  fileName?: string | null
}): PlannerDocKind {
  const haystack = `${input.titulo || ''} ${input.fileName || ''}`.trim()
  if (PUD_PATTERN.test(haystack)) return 'pud'
  if (PCA_PATTERN.test(haystack)) return 'pca'
  return 'general'
}

export function normalizePlannerDocKind(
  value?: string | null,
  fallbackInput?: { titulo?: string | null; fileName?: string | null }
): PlannerDocKind {
  if (value === 'pud' || value === 'pca' || value === 'general') return value
  return inferPlannerDocKind(fallbackInput || {})
}

export function getPlannerDocKindMeta(kind: PlannerDocKind) {
  switch (kind) {
    case 'pud':
      return {
        label: 'PUD',
        shortHint: 'Clase diaria y unidad',
        className: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      }
    case 'pca':
      return {
        label: 'PCA',
        shortHint: 'Trimestre completo',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
      }
    default:
      return {
        label: 'Apoyo',
        shortHint: 'Complementario',
        className: 'bg-slate-100 text-slate-700 border-slate-200',
      }
  }
}

export function buildPlannerDocStats(docs: PlannerDocLike[]): PlannerDocStats {
  const stats: PlannerDocStats = { total: 0, pud: 0, pca: 0, general: 0 }

  for (const doc of docs) {
    const kind = normalizePlannerDocKind(doc.doc_kind, {
      titulo: doc.titulo,
      fileName: doc.file_name,
    })
    stats.total += 1
    stats[kind] += 1
  }

  return stats
}

export function filterPlannerDocsForGeneration<T extends PlannerDocLike>(
  docs: T[],
  type?: string | null
) {
  if (!Array.isArray(docs) || docs.length === 0) return []

  const normalizedDocs = docs.map(doc => ({
    doc,
    kind: normalizePlannerDocKind(doc.doc_kind, {
      titulo: doc.titulo,
      fileName: doc.file_name,
    }),
  }))

  const support = normalizedDocs.filter(item => item.kind === 'general')

  if (type === 'trimestre') {
    const pca = normalizedDocs.filter(item => item.kind === 'pca')
    if (pca.length > 0) return [...pca, ...support].map(item => item.doc)
    if (support.length > 0) return support.map(item => item.doc)
    return docs
  }

  if (type === 'clase' || type === 'unidad') {
    const pud = normalizedDocs.filter(item => item.kind === 'pud')
    if (pud.length > 0) return [...pud, ...support].map(item => item.doc)
    if (support.length > 0) return support.map(item => item.doc)
    return docs
  }

  return docs
}

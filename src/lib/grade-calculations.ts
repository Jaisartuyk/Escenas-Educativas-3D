interface WeightedCategoryLike {
  id: string
  weight_percent?: number | null
  weight?: number | null
}

interface WeightedAssignmentLike {
  category_id?: string | null
}

export function calculateWeightedAssignmentAverage<TAssignment extends WeightedAssignmentLike, TCategory extends WeightedCategoryLike>(
  assignments: TAssignment[],
  categories: TCategory[],
  getScore: (assignment: TAssignment) => number | null,
): number | null {
  if (assignments.length === 0) return null

  const normalizedGetScore = (assignment: TAssignment) => {
    const score = getScore(assignment)
    return score !== null && !Number.isNaN(score) ? score : 0
  }

  const scores = assignments.map(normalizedGetScore)

  if (categories.length === 0) {
    return scores.reduce((sum, score) => sum + score, 0) / assignments.length
  }

  const knownCategoryIds = new Set(categories.map((category) => category.id))
  let weightedSum = 0
  let totalWeight = 0

  categories.forEach((category) => {
    const categoryAssignments = assignments.filter((assignment) => String(assignment.category_id) === String(category.id))
    const categoryScores = categoryAssignments.map(normalizedGetScore)

    if (categoryAssignments.length === 0) return

    const categoryAverage = categoryScores.reduce((sum, score) => sum + score, 0) / categoryAssignments.length
    // Support both weight_percent and legacy weight fields
    const categoryWeight = Number(category.weight_percent ?? category.weight ?? 0) / 100

    if (categoryWeight > 0) {
      weightedSum += categoryAverage * categoryWeight
      totalWeight += categoryWeight
    }
  })

  const uncategorizedAssignments = assignments.filter(
    (assignment) => !assignment.category_id || !knownCategoryIds.has(assignment.category_id),
  )
  const uncategorizedScores = uncategorizedAssignments.map(normalizedGetScore)

  if (uncategorizedAssignments.length > 0) {
    const uncategorizedAverage = uncategorizedScores.reduce((sum, score) => sum + score, 0) / uncategorizedAssignments.length
    const configuredWeight = categories.reduce((sum, category) => sum + Number(category.weight_percent ?? category.weight ?? 0) / 100, 0)
    const remainingWeight = Math.max(0, 1 - configuredWeight)

    if (remainingWeight > 0) {
      weightedSum += uncategorizedAverage * remainingWeight
      totalWeight += remainingWeight
    } else if (totalWeight === 0) {
      return uncategorizedAverage
    }
  }

  return totalWeight > 0 ? weightedSum / totalWeight : null
}

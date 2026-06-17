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

  const scores = assignments
    .map(getScore)
    .filter((score): score is number => score !== null && !Number.isNaN(score))

  if (scores.length === 0) return null

  if (categories.length === 0) {
    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }

  const knownCategoryIds = new Set(categories.map((category) => category.id))
  let weightedSum = 0
  let totalWeight = 0

  categories.forEach((category) => {
    const categoryAssignments = assignments.filter((assignment) => assignment.category_id === category.id)
    const categoryScores = categoryAssignments
      .map(getScore)
      .filter((score): score is number => score !== null && !Number.isNaN(score))

    if (categoryScores.length === 0) return

    const categoryAverage = categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length
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
  const uncategorizedScores = uncategorizedAssignments
    .map(getScore)
    .filter((score): score is number => score !== null && !Number.isNaN(score))

  if (uncategorizedScores.length > 0) {
    const uncategorizedAverage = uncategorizedScores.reduce((sum, score) => sum + score, 0) / uncategorizedScores.length
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

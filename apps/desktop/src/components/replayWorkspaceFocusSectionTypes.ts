export type ReplayFocusReviewDecisionMeta = {
  label: string
  description: string
  recommendedRange?: string | null
  recommendedTimeframe?: string | null
  nextAction?: string | null
  chipClass?: string
} | null

export type ReplayFocusReviewLineageMeta = {
  label: string
  detail: string
} | null

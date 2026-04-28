export type BacktestDecisionMeta = {
  label: string
  description: string
  recommendedRange?: string | null
  recommendedTimeframe?: string | null
  nextAction?: string | null
  chipClass?: string
} | null

export type BacktestSampleMeta = {
  label: string
  description: string
  chipClass: string
} | null

export type BacktestWindowMeta = {
  attention: boolean
  truncated?: boolean
  label: string
  description: string
  detail: string
  nextAction?: string | null
  chipClass: string
} | null

export type ReviewLineageMeta = {
  label: string
  detail: string
} | null

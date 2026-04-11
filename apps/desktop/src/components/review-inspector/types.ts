import type { AgentJob, BacktestRun, ChangeRequest, ReviewDocument, StrategyProposal } from '../../types'

export type ReviewInspectorDecisionMeta = {
  label: string
  description: string
  recommendedRange?: string | null
  recommendedTimeframe?: string | null
  nextAction?: string | null
  chipClass?: string
} | null

export type ReviewInspectorLineageMeta = {
  label: string
  detail: string
} | null

export type ReviewInspectorProposalItem = {
  proposal: StrategyProposal
  linkedBacktest: BacktestRun | null
  linkedReview: ReviewDocument | null
  linkedChangeRequest: ChangeRequest | null
  linkedJob: AgentJob | null
  proposalStrategyId: string
  manualFollowupMeta: { label: string; detail: string } | null
  outcomeDetails: string[]
  focusLabels: string[]
  blockedReason: string | null
  isLatestActionable: boolean
}

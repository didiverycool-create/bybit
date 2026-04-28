import type { Dispatch, SetStateAction } from 'react'

import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  SectionKey,
  StrategyProposal,
  StrategySummary,
} from '../types'

export type ScopeFilter = 'all' | 'selected'

export type UseWorkspaceNavigationArgs = {
  strategies: StrategySummary[]
  selectedStrategy: StrategySummary | null
  selectedStrategyId: string | null
  strategyEditorDraftStrategyId: string | null
  parameterDrafts: Record<string, string>
  backtests: BacktestRun[]
  changeRequests: ChangeRequest[]
  proposalCatalog: StrategyProposal[]
  reviewCatalog: ReviewDocument[]
  strategyActivityReviewRecords: ReviewDocument[]
  schedulerJobs: AgentJob[]
  strategyActivityJobRecords: AgentJob[]
  setParameterDrafts: Dispatch<SetStateAction<Record<string, string>>>
  setRiskBudgetDraft: Dispatch<SetStateAction<string>>
  setStrategyEditorDraftStrategyId: Dispatch<SetStateAction<string | null>>
  setActiveSection: Dispatch<SetStateAction<SectionKey>>
  setSelectedStrategyId: Dispatch<SetStateAction<string | null>>
  setSelectedSymbol: Dispatch<SetStateAction<string>>
  setStrategyActivityPanelOpen: Dispatch<SetStateAction<boolean>>
  setStrategyTrackingPanelOpen: Dispatch<SetStateAction<boolean>>
  setStrategyEditorOpen: Dispatch<SetStateAction<boolean>>
  setReplayTrackingScope: Dispatch<SetStateAction<ScopeFilter>>
  setReplayFocusedReviewId: Dispatch<SetStateAction<string | null>>
  setBacktestFilter: Dispatch<SetStateAction<ScopeFilter>>
  setSelectedBacktestId: Dispatch<SetStateAction<string | null>>
  setReviewInspectorOpen: Dispatch<SetStateAction<boolean>>
  setReviewInspectorReviewId: Dispatch<SetStateAction<string | null>>
  setReviewInspectorStrategyId: Dispatch<SetStateAction<string | null>>
  setSelectedChangeRequestId: Dispatch<SetStateAction<string | null>>
  setSelectedProposalId: Dispatch<SetStateAction<string | null>>
  setAiSchedulerFocusedJobId: Dispatch<SetStateAction<string | null>>
  setAlertScopeFilter: Dispatch<SetStateAction<ScopeFilter>>
  setTradeScopeFilter: Dispatch<SetStateAction<ScopeFilter>>
  setAuditScopeFilter: Dispatch<SetStateAction<ScopeFilter>>
}

export function getStrategyPrimarySymbol(strategies: StrategySummary[], strategyId?: string | null) {
  return strategies.find((item) => item.id === strategyId)?.symbols[0] ?? null
}

export function findWorkspaceReviewRecord(
  reviewCatalog: ReviewDocument[],
  strategyActivityReviewRecords: ReviewDocument[],
  reviewId?: string | null,
) {
  return (
    reviewCatalog.find((review) => review.id === reviewId) ??
    strategyActivityReviewRecords.find((review) => review.id === reviewId) ??
    null
  )
}

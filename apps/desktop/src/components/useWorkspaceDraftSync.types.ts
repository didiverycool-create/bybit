import type { Dispatch, SetStateAction } from 'react'

import type {
  BacktestRun,
  ChangeRequest,
  OrderRecord,
  ReviewDocument,
  StrategyProposal,
  StrategySummary,
} from '../types'

export type UseWorkspaceDraftSyncArgs = {
  selectedStrategy: StrategySummary | null
  selectedStrategyId: string | null
  selectedStrategyParameterSignature: string
  strategyEditorDraftStrategyId: string | null
  strategyEditorOpen: boolean
  setParameterDrafts: Dispatch<SetStateAction<Record<string, string>>>
  setRiskBudgetDraft: Dispatch<SetStateAction<string>>
  setStrategyEditorDraftStrategyId: Dispatch<SetStateAction<string | null>>
  watchlist: Array<{ symbol: string; alert_threshold_pct: number }>
  watchlistAlertSignature: string
  setWatchlistAlertDrafts: Dispatch<SetStateAction<Record<string, string>>>
  backtestsForWorkspace: BacktestRun[]
  selectedBacktestId: string | null
  setSelectedBacktestId: Dispatch<SetStateAction<string | null>>
  selectedProposalId: string | null
  reviewsLoaded: boolean
  proposalCatalog: StrategyProposal[]
  setSelectedProposalId: Dispatch<SetStateAction<string | null>>
  reviewInspectorOpen: boolean
  reviewInspectorReviewId: string | null
  reviewInspectorStrategyId: string | null
  reviewCatalog: ReviewDocument[]
  setReviewInspectorOpen: Dispatch<SetStateAction<boolean>>
  setReviewInspectorReviewId: Dispatch<SetStateAction<string | null>>
  setReviewInspectorStrategyId: Dispatch<SetStateAction<string | null>>
  replayFocusedReviewId: string | null
  setReplayFocusedReviewId: Dispatch<SetStateAction<string | null>>
  aiSchedulerFocusedJobId: string | null
  schedulerLoaded: boolean
  schedulerJobs: Array<{ id: string }>
  setAiSchedulerFocusedJobId: Dispatch<SetStateAction<string | null>>
  selectedChangeRequestId: string | null
  changeRequestsLoaded: boolean
  changeRequests: ChangeRequest[]
  setSelectedChangeRequestId: Dispatch<SetStateAction<string | null>>
  editingOrderId: string | null
  editingOrder: OrderRecord | null
  setEditingOrderId: Dispatch<SetStateAction<string | null>>
  setManualTradePanelOpen: Dispatch<SetStateAction<boolean>>
}

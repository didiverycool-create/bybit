import type { Dispatch, SetStateAction } from 'react'

import type {
  BacktestRun,
  ExecutionPreview,
  Mode,
  ReviewDocument,
  SchedulerState,
  StrategyProposal,
  StrategySummary,
  StrategyRuntimeSnapshot,
  WatchlistInstrument,
} from '../types'

export type ActionTone = 'success' | 'warning' | 'error'

export type UseStrategyWorkflowActionsArgs = {
  refreshControlData: () => Promise<void>
  selectedMode: Mode
  selectedStrategy: StrategySummary | null | undefined
  selectedStrategyRuntimePreview: ExecutionPreview | null | undefined
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null | undefined
  watchlist: WatchlistInstrument[]
  strategies: StrategySummary[]
  backtests: BacktestRun[]
  reviewCatalog: ReviewDocument[]
  schedulerState: SchedulerState | null | undefined
  backtestRangeDraft: string
  backtestTimeframeDraft: string
  strategyTrackingKind: 'issue' | 'change'
  strategyTrackingSummary: string
  strategyTrackingDetail: string
  strategyTrackingRequestKey: string
  findProposalById: (proposalId: string) => StrategyProposal | null
  setSelectedStrategyId: Dispatch<SetStateAction<string | null>>
  setBacktestRangeDraft: Dispatch<SetStateAction<string>>
  setBacktestTimeframeDraft: Dispatch<SetStateAction<string>>
  setSelectedBacktestId: Dispatch<SetStateAction<string | null>>
  setSelectedProposalId: Dispatch<SetStateAction<string | null>>
  setStrategyTrackingPanelOpen: Dispatch<SetStateAction<boolean>>
  setStrategyActivityPanelOpen: Dispatch<SetStateAction<boolean>>
  resetStrategyTrackingDraft: (kind?: 'issue' | 'change', nextSummary?: string, nextDetail?: string) => void
  showFeedback: (tone: ActionTone, title: string, detail: string) => void
  openAiSchedulerJob: (jobId: string) => void
  openBacktestDetail: (backtestId: string, strategyId?: string | null) => void
  openChangeRequest: (changeRequestId: string, strategyId?: string | null) => void
}

import type { Dispatch, SetStateAction } from 'react'

import type { AgentJob, ChangeRequest, ReviewDocument, StrategyProposal, StrategySummary } from '../types'

export type UseWorkspaceFocusSyncArgs = {
  activeSection: string
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  proposalCatalog: StrategyProposal[]
  replayFocusedReviewId: string | null
  reviewCatalog: ReviewDocument[]
  reviewInspectorOpen: boolean
  reviewInspectorReviewId: string | null
  reviewInspectorStrategyId: string | null
  aiSchedulerFocusedJobId: string | null
  schedulerJobs: AgentJob[]
  changeRequests: ChangeRequest[]
  strategies: StrategySummary[]
  selectedStrategyCurrentId: string | null
  selectedStrategyId: string | null
  selectedSymbol: string
  setSelectedStrategyId: Dispatch<SetStateAction<string | null>>
  setSelectedSymbol: Dispatch<SetStateAction<string>>
  setReviewInspectorStrategyId: Dispatch<SetStateAction<string | null>>
}

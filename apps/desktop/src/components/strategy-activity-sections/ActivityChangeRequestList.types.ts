import type { ChangeRequest } from '../../types'
import type { StrategyActivityChangeRequestLinkedState } from '../strategyActivityProgressShared'

export type ActivityChangeRequestListProps = {
  strategyId: string
  focusedChangeRequestSupplemented: boolean
  strategyActivityLatestChangeRequestSupplemented: boolean
  strategyActivityLatestActionableChangeRequestSupplemented: boolean
  strategyActivityChangeRequests: ChangeRequest[]
  activityLatestChangeRequest: ChangeRequest | null
  activityLatestActionableChangeRequest: ChangeRequest | null
  selectedChangeRequestId: string | null
  serviceAvailable: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  getStrategyActivityChangeRequestLinkedState: (request?: ChangeRequest | null) => StrategyActivityChangeRequestLinkedState
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string) => void
  onRerunBacktestFromChangeRequest: (request: ChangeRequest) => void
}

export type ActivityChangeRequestListItemProps = {
  strategyId: string
  request: ChangeRequest
  activityLatestChangeRequestId: string | null
  activityLatestActionableChangeRequestId: string | null
  selectedChangeRequestId: string | null
  serviceAvailable: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  linkedState: StrategyActivityChangeRequestLinkedState
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string) => void
  onRerunBacktestFromChangeRequest: (request: ChangeRequest) => void
}

import type { AgentJob, BacktestRun, ChangeRequest, ReviewDocument } from '../types'
import type { ReplayProposalFeedItem } from './replayWorkspaceSectionTypes'

export type ReplayWorkspaceProposalFeedListItemProps = {
  item: ReplayProposalFeedItem
  index: number
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  selectedBacktestId: string | null
  focusedReviewId: string | null
  aiSchedulerFocusedJobId: string | null
  linkedBacktest: BacktestRun | null
  linkedReview: ReviewDocument | null
  linkedChangeRequest: ChangeRequest | null
  linkedJob: AgentJob | null
  schedulerState?: { status?: string; freeze_publish?: boolean } | null
  serviceAvailable: boolean
  proposalMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onRetryAgentJob: (jobId: string, focusJob?: boolean) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
}


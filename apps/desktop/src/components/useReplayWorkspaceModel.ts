import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategySummary,
} from '../types'
import { buildReplayWorkspaceFocusLabelBuilders } from './buildReplayWorkspaceFocusLabelBuilders'
import { buildReplayWorkspaceProposalFeed } from './buildReplayWorkspaceProposalFeed'
import { buildReplayWorkspaceReviewState } from './buildReplayWorkspaceReviewState'

type UseReplayWorkspaceModelArgs = {
  reviews: ReviewDocument[]
  replayTrackingReviewsData?: ReviewDocument[]
  selectedStrategy: StrategySummary | null
  selectedStrategyPrimaryReviews: ReviewDocument[]
  selectedStrategyReviews: ReviewDocument[]
  schedulerJobs: AgentJob[]
  replayTrackingScope: 'all' | 'selected'
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  selectedBacktestId: string | null
  reviewInspectorReviewId: string | null
  replayFocusedReviewId: string | null
  aiSchedulerFocusedJobId: string | null
  proposalBacktestMap: Map<string, BacktestRun>
  proposalReviewMap: Map<string, ReviewDocument>
  proposalChangeRequestMap: Map<string, ChangeRequest>
  proposalAgentJobMap: Map<string, AgentJob>
}

export function useReplayWorkspaceModel({
  reviews,
  replayTrackingReviewsData,
  selectedStrategy,
  selectedStrategyPrimaryReviews,
  selectedStrategyReviews,
  schedulerJobs,
  replayTrackingScope,
  selectedProposalId,
  selectedChangeRequestId,
  selectedBacktestId,
  reviewInspectorReviewId,
  replayFocusedReviewId,
  aiSchedulerFocusedJobId,
}: UseReplayWorkspaceModelArgs) {
  const {
    replayPrimaryReviews,
    replayTrackingReviews,
    scopedReplayPrimaryReviews,
    filteredReplayTrackingReviews,
    latestReview,
    latestTrackingReview,
    replayTrackingJobs,
    filteredReplayTrackingJobs,
    replayVisibleReviews,
    replayFocusReview,
    replayFocusReviewLineageMeta,
    replayFocusReviewDecisionMeta,
  } = buildReplayWorkspaceReviewState({
    reviews,
    replayTrackingReviewsData,
    selectedStrategy,
    selectedStrategyPrimaryReviews,
    selectedStrategyReviews,
    schedulerJobs,
    replayTrackingScope,
    replayFocusedReviewId,
  })

  const { backtestFocusLabels, proposalFocusLabels } = buildReplayWorkspaceFocusLabelBuilders({
    selectedProposalId,
    selectedChangeRequestId,
    selectedBacktestId,
    reviewInspectorReviewId,
    replayFocusedReviewId,
    aiSchedulerFocusedJobId,
  })

  const replayProposalFeed = buildReplayWorkspaceProposalFeed(scopedReplayPrimaryReviews)

  return {
    replayPrimaryReviews,
    replayTrackingReviews,
    scopedReplayPrimaryReviews,
    filteredReplayTrackingReviews,
    latestReview,
    latestTrackingReview,
    replayTrackingJobs,
    filteredReplayTrackingJobs,
    replayVisibleReviews,
    replayFocusReview,
    replayFocusReviewLineageMeta,
    replayFocusReviewDecisionMeta,
    backtestFocusLabels,
    proposalFocusLabels,
    replayProposalFeed,
  }
}

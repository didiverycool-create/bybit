import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  SchedulerState,
  StrategyProposal,
  StrategySummary,
} from '../types'
import { getReviewFocusStrategyId, isStrategyTrackingReview } from '../utils/app-helpers'
import type { StrategyActivitySnapshotViewModel } from './strategyActivitySelectors'

export type UseStrategyActivityDecisionModelArgs = {
  strategyActivitySnapshotModel: StrategyActivitySnapshotViewModel
  selectedStrategy: StrategySummary | null
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  selectedBacktestId: string | null
  reviewInspectorReviewId: string | null
  replayFocusedReviewId: string | null
  aiSchedulerFocusedJobId: string | null
  schedulerJobs: AgentJob[]
  reviewCatalog: ReviewDocument[]
  strategyProposals: StrategyProposal[]
  proposalBacktestMap: Map<string, BacktestRun>
  proposalReviewMap: Map<string, ReviewDocument>
  proposalChangeRequestMap: Map<string, ChangeRequest>
  proposalAgentJobMap: Map<string, AgentJob>
  schedulerState?: SchedulerState | null
}

export type StrategyActivityProposalLinkedState = {
  linkedBacktest: BacktestRun | null
  linkedReview: ReviewDocument | null
  linkedChangeRequest: ChangeRequest | null
  linkedJob: AgentJob | null
}

export function createStrategyActivityDecisionContext({
  strategyActivitySnapshotModel,
  reviewCatalog,
  replayFocusedReviewId,
}: Pick<
  UseStrategyActivityDecisionModelArgs,
  'strategyActivitySnapshotModel' | 'reviewCatalog' | 'replayFocusedReviewId'
>) {
  const focusedReplayReview =
    replayFocusedReviewId != null
      ? reviewCatalog.find((review) => review.id === replayFocusedReviewId) ?? null
      : null
  const focusedTrackingReviewId =
    focusedReplayReview && isStrategyTrackingReview(focusedReplayReview.period) ? focusedReplayReview.id : null
  const focusedPrimaryReviewId =
    focusedReplayReview && !isStrategyTrackingReview(focusedReplayReview.period) ? focusedReplayReview.id : null
  const activityStrategyId = strategyActivitySnapshotModel.strategyId
  const {
    latestProposal: latestProposalSource,
    latestActionableProposal: latestActionableProposalSource,
    latestProposalChangeRequest: latestProposalChangeRequestSource,
    latestActionableProposalChangeRequest: latestActionableProposalChangeRequestSource,
    latestProposalBacktestRecord: latestProposalBacktestRecordSource,
    latestActionableProposalBacktestRecord: latestActionableProposalBacktestRecordSource,
    latestProposalReviewRecord: latestProposalReviewRecordSource,
    latestActionableProposalReviewRecord: latestActionableProposalReviewRecordSource,
    latestProposalJobRecord: latestProposalJobRecordSource,
    latestActionableProposalJobRecord: latestActionableProposalJobRecordSource,
  } = strategyActivitySnapshotModel.proposalSources
  const {
    latestActionableBacktestReview: latestActionableBacktestReviewSource,
    latestActionableBacktestJob: latestActionableBacktestJobSource,
    latestBacktestReviewRecord: latestBacktestReviewRecordSource,
    latestActionableBacktestReviewRecord: latestActionableBacktestReviewRecordSource,
    latestBacktestJobRecord: latestBacktestJobRecordSource,
    latestActionableBacktestJobRecord: latestActionableBacktestJobRecordSource,
  } = strategyActivitySnapshotModel.backtestSources
  const {
    latestPrimaryReview: latestPrimaryReviewSource,
    latestActionablePrimaryReview: latestActionablePrimaryReviewSource,
    latestPrimaryReviewRecord: latestPrimaryReviewRecordSource,
    latestActionablePrimaryReviewRecord: latestActionablePrimaryReviewRecordSource,
  } = strategyActivitySnapshotModel.reviewSources
  const {
    latestTrackingReview: latestTrackingReviewSource,
    latestTrackingJob: latestTrackingJobSource,
    latestRetryableTrackingJob: latestRetryableTrackingJobSource,
    latestTrackingReviewRecord: latestTrackingReviewRecordSource,
    latestTrackingJobRecord: latestTrackingJobRecordSource,
    latestRetryableTrackingJobRecord: latestRetryableTrackingJobRecordSource,
  } = strategyActivitySnapshotModel.trackingSources
  const { recentReviews, recentAgentJobs, recentProposals } = strategyActivitySnapshotModel.collections

  const isReviewFocusedOnActivityStrategy = (
    review: ReviewDocument | null | undefined,
    selectedStrategyId: string | null,
  ) => {
    if (!review || !activityStrategyId) {
      return false
    }
    const focusedStrategyId = getReviewFocusStrategyId(review, selectedStrategyId)
    return Boolean(focusedStrategyId && focusedStrategyId === activityStrategyId)
  }

  return {
    focusedReplayReview,
    focusedTrackingReviewId,
    focusedPrimaryReviewId,
    activityStrategyId,
    latestProposalSource,
    latestActionableProposalSource,
    latestProposalChangeRequestSource,
    latestActionableProposalChangeRequestSource,
    latestProposalBacktestRecordSource,
    latestActionableProposalBacktestRecordSource,
    latestProposalReviewRecordSource,
    latestActionableProposalReviewRecordSource,
    latestProposalJobRecordSource,
    latestActionableProposalJobRecordSource,
    latestActionableBacktestReviewSource,
    latestActionableBacktestJobSource,
    latestBacktestReviewRecordSource,
    latestActionableBacktestReviewRecordSource,
    latestBacktestJobRecordSource,
    latestActionableBacktestJobRecordSource,
    latestPrimaryReviewSource,
    latestActionablePrimaryReviewSource,
    latestPrimaryReviewRecordSource,
    latestActionablePrimaryReviewRecordSource,
    latestTrackingReviewSource,
    latestTrackingJobSource,
    latestRetryableTrackingJobSource,
    latestTrackingReviewRecordSource,
    latestTrackingJobRecordSource,
    latestRetryableTrackingJobRecordSource,
    recentReviews,
    recentAgentJobs,
    recentProposals,
    isReviewFocusedOnActivityStrategy,
  }
}

export type StrategyActivityDecisionContext = ReturnType<typeof createStrategyActivityDecisionContext>

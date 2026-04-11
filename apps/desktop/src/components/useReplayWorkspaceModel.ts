import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyActivityBacktestSummary,
  StrategyProposal,
  StrategySummary,
} from '../types'
import {
  backtestDecisionReadinessMeta,
  backtestLineageMeta,
  getAgentJobStrategyId,
  isStrategyTrackingReview,
} from '../utils/app-helpers'

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
  const replayPrimaryReviews = reviews.filter((review) => !isStrategyTrackingReview(review.period))
  const replayTrackingReviews =
    replayTrackingReviewsData ?? reviews.filter((review) => isStrategyTrackingReview(review.period))
  const scopedReplayPrimaryReviews =
    replayTrackingScope === 'selected' && selectedStrategy ? selectedStrategyPrimaryReviews : replayPrimaryReviews
  const filteredReplayTrackingReviews =
    replayTrackingScope === 'selected' && selectedStrategy
      ? replayTrackingReviews.filter(
          (review) =>
            review.strategy_id === selectedStrategy.id ||
            review.proposals.some((proposal) => proposal.strategy_id === selectedStrategy.id),
        )
      : replayTrackingReviews
  const latestReview = scopedReplayPrimaryReviews[0] ?? null
  const latestTrackingReview = filteredReplayTrackingReviews[0] ?? null
  const replayTrackingJobs = schedulerJobs.filter(
    (job) => job.job_type === 'review_strategy_issue' || job.job_type === 'review_strategy_change',
  )
  const filteredReplayTrackingJobs =
    replayTrackingScope === 'selected' && selectedStrategy
      ? replayTrackingJobs.filter((job) => getAgentJobStrategyId(job) === selectedStrategy.id)
      : replayTrackingJobs
  const replayVisibleReviews =
    replayTrackingScope === 'selected' && selectedStrategy ? selectedStrategyReviews : reviews
  const replayFocusReview =
    replayVisibleReviews.find((review) => review.id === replayFocusedReviewId) ??
    latestReview ??
    latestTrackingReview ??
    null
  const replayFocusReviewLineageMeta =
    replayFocusReview?.period === 'backtest' ? backtestLineageMeta(replayFocusReview) : null
  const replayFocusReviewDecisionMeta =
    replayFocusReview?.period === 'backtest' &&
    (
      replayFocusReview.decision_readiness ||
      replayFocusReview.decision_readiness_detail ||
      replayFocusReview.decision_readiness_action ||
      replayFocusReview.decision_recommended_data_range ||
      replayFocusReview.decision_recommended_timeframe
    )
      ? backtestDecisionReadinessMeta(replayFocusReview)
      : null

  const backtestFocusLabels = (
    backtest: StrategyActivityBacktestSummary,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ): string[] => {
    const labels: string[] = []
    const focusedReviewId = reviewInspectorReviewId ?? replayFocusedReviewId
    if (selectedBacktestId === backtest.id) {
      labels.push('当前回测')
    }
    if (backtest.source_change_request_id && selectedChangeRequestId === backtest.source_change_request_id) {
      labels.push('当前变更')
    }
    if (
      focusedReviewId &&
      ((linkedReview && focusedReviewId === linkedReview.id) || focusedReviewId === backtest.source_review_id)
    ) {
      labels.push('当前复盘')
    }
    if (linkedJob && aiSchedulerFocusedJobId === linkedJob.id) {
      labels.push('当前任务')
    }
    return labels
  }

  const proposalFocusLabels = (
    proposal: StrategyProposal,
    linkedChangeRequest?: ChangeRequest | null,
    linkedBacktest?: BacktestRun | null,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ): string[] => {
    const labels: string[] = []
    if (selectedProposalId === proposal.id) {
      labels.push('当前提案')
    }
    if (linkedChangeRequest && selectedChangeRequestId === linkedChangeRequest.id) {
      labels.push('当前变更')
    }
    if (linkedBacktest && selectedBacktestId === linkedBacktest.id) {
      labels.push('当前回测')
    }
    if (
      linkedReview &&
      (reviewInspectorReviewId === linkedReview.id || replayFocusedReviewId === linkedReview.id)
    ) {
      labels.push('当前复盘')
    }
    if (linkedJob && aiSchedulerFocusedJobId === linkedJob.id) {
      labels.push('当前任务')
    }
    return labels
  }

  const replayProposalFeed = scopedReplayPrimaryReviews.flatMap((review) =>
    review.proposals.map((proposal) => ({
      reviewId: review.id,
      reviewTitle: review.title,
      reviewPeriod: review.period,
      proposal,
    })),
  )

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

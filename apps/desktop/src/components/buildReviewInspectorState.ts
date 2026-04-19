import { backtestDecisionReadinessMeta, backtestLineageMeta } from '../utils/app-helpers'
import { buildReviewInspectorProposalItems } from './buildReviewInspectorProposalItems'
import { findReviewInspectorReview } from './findReviewInspectorReview'
import type { ReviewInspectorState, UseReviewInspectorModelArgs } from './useReviewInspectorModel.types'

function hasBacktestDecisionReadiness(review: ReviewInspectorState['review']) {
  return Boolean(
    review &&
      review.period === 'backtest' &&
      (
        review.decision_readiness ||
        review.decision_readiness_detail ||
        review.decision_readiness_action ||
        review.decision_recommended_data_range ||
        review.decision_recommended_timeframe
      ),
  )
}

export function buildReviewInspectorState({
  reviewCatalog,
  strategyActivityReviewRecords,
  reviewInspectorReviewId,
  reviewInspectorStrategyId,
  strategyNameMap,
  proposalBacktestMap,
  proposalReviewMap,
  proposalChangeRequestMap,
  proposalAgentJobMap,
  proposalFocusLabels,
  latestActionableProposalId,
  schedulerState,
}: UseReviewInspectorModelArgs): ReviewInspectorState {
  const review = findReviewInspectorReview({
    reviewCatalog,
    strategyActivityReviewRecords,
    reviewInspectorReviewId,
  })
  const strategyId = reviewInspectorStrategyId ?? review?.strategy_id ?? null
  const strategyLabel = strategyId ? strategyNameMap.get(strategyId) ?? strategyId : null
  const lineageMeta = review?.period === 'backtest' ? backtestLineageMeta(review) : null
  const decisionMeta = hasBacktestDecisionReadiness(review)
    ? backtestDecisionReadinessMeta(review)
    : null

  return {
    review,
    strategyId,
    strategyLabel,
    lineageMeta,
    decisionMeta,
    proposalItems: buildReviewInspectorProposalItems({
      review,
      proposalBacktestMap,
      proposalReviewMap,
      proposalChangeRequestMap,
      proposalAgentJobMap,
      proposalFocusLabels,
      latestActionableProposalId,
      schedulerState,
    }),
  }
}

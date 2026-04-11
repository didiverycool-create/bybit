import type { ComponentProps } from 'react'

import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  SchedulerState,
  StrategyProposal,
} from '../types'
import {
  backtestDecisionReadinessMeta,
  backtestLineageMeta,
  getChangeRequestStrategyId,
  proposalAcceptBlockedReason,
  proposalManualFollowupMeta,
  proposalOutcomeDetails,
} from '../utils/app-helpers'
import ReviewInspectorPanel from './ReviewInspectorPanel'

type ReviewInspectorState = Pick<
  ComponentProps<typeof ReviewInspectorPanel>,
  | 'review'
  | 'strategyId'
  | 'strategyLabel'
  | 'lineageMeta'
  | 'decisionMeta'
  | 'proposalItems'
>

type ProposalFocusLabels = (
  proposal: StrategyProposal,
  linkedChangeRequest?: ChangeRequest | null,
  linkedBacktest?: BacktestRun | null,
  linkedReview?: ReviewDocument | null,
  linkedJob?: AgentJob | null,
) => string[]

type UseReviewInspectorModelArgs = {
  reviewCatalog: ReviewDocument[]
  strategyActivityReviewRecords: ReviewDocument[]
  reviewInspectorReviewId: string | null
  reviewInspectorStrategyId: string | null
  strategyNameMap: Map<string, string>
  proposalBacktestMap: Map<string, BacktestRun>
  proposalReviewMap: Map<string, ReviewDocument>
  proposalChangeRequestMap: Map<string, ChangeRequest>
  proposalAgentJobMap: Map<string, AgentJob>
  proposalFocusLabels: ProposalFocusLabels
  latestActionableProposalId: string | null
  schedulerState?: SchedulerState | null
}

export function useReviewInspectorModel({
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
  const review =
    reviewCatalog.find((item) => item.id === reviewInspectorReviewId) ??
    strategyActivityReviewRecords.find((item) => item.id === reviewInspectorReviewId) ??
    null
  const strategyId = reviewInspectorStrategyId ?? review?.strategy_id ?? null
  const strategyLabel = strategyId ? strategyNameMap.get(strategyId) ?? strategyId : null
  const lineageMeta = review?.period === 'backtest' ? backtestLineageMeta(review) : null
  const decisionMeta =
    review?.period === 'backtest' &&
    (
      review.decision_readiness ||
      review.decision_readiness_detail ||
      review.decision_readiness_action ||
      review.decision_recommended_data_range ||
      review.decision_recommended_timeframe
    )
      ? backtestDecisionReadinessMeta(review)
      : null
  const proposalItems = review
    ? review.proposals.map((proposal) => {
        const linkedBacktest = proposalBacktestMap.get(proposal.id) ?? null
        const linkedReview = proposalReviewMap.get(proposal.id) ?? null
        const linkedChangeRequest = proposalChangeRequestMap.get(proposal.id) ?? null
        const linkedJob = proposalAgentJobMap.get(proposal.id) ?? null
        return {
          proposal,
          linkedBacktest,
          linkedReview,
          linkedChangeRequest,
          linkedJob,
          proposalStrategyId: getChangeRequestStrategyId(linkedChangeRequest, proposal.strategy_id),
          manualFollowupMeta: proposalManualFollowupMeta(proposal, linkedChangeRequest),
          outcomeDetails: proposalOutcomeDetails(
            proposal,
            linkedChangeRequest,
            linkedBacktest,
            linkedReview,
            linkedJob,
          ),
          focusLabels: proposalFocusLabels(
            proposal,
            linkedChangeRequest,
            linkedBacktest,
            linkedReview,
            linkedJob,
          ),
          blockedReason: proposalAcceptBlockedReason(proposal.proposal_type, schedulerState),
          isLatestActionable: latestActionableProposalId === proposal.id,
        }
      })
    : []

  return {
    review,
    strategyId,
    strategyLabel,
    lineageMeta,
    decisionMeta,
    proposalItems,
  }
}

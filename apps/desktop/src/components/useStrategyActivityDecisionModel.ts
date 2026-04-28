import { buildStrategyActivityProposalDecisionModel } from './buildStrategyActivityProposalDecisionModel'
import { buildStrategyActivityReviewJobDecisionCollections } from './buildStrategyActivityReviewJobDecisionCollections'
import {
  createStrategyActivityDecisionContext,
  type UseStrategyActivityDecisionModelArgs,
} from './strategyActivityDecisionShared'

export function useStrategyActivityDecisionModel({
  selectedStrategy,
  selectedProposalId,
  selectedChangeRequestId,
  selectedBacktestId,
  reviewInspectorReviewId,
  replayFocusedReviewId,
  aiSchedulerFocusedJobId,
  schedulerJobs,
  strategyProposals,
  proposalBacktestMap,
  proposalReviewMap,
  proposalChangeRequestMap,
  proposalAgentJobMap,
  schedulerState,
  ...contextArgs
}: UseStrategyActivityDecisionModelArgs) {
  const decisionContext = createStrategyActivityDecisionContext({
    ...contextArgs,
    replayFocusedReviewId,
  })
  const reviewJobDecisionCollections = buildStrategyActivityReviewJobDecisionCollections(
    {
      selectedStrategy,
      aiSchedulerFocusedJobId,
      schedulerJobs,
    },
    decisionContext,
  )
  const proposalDecisionModel = buildStrategyActivityProposalDecisionModel(
    {
      selectedProposalId,
      selectedChangeRequestId,
      selectedBacktestId,
      reviewInspectorReviewId,
      replayFocusedReviewId,
      aiSchedulerFocusedJobId,
      strategyProposals,
      proposalBacktestMap,
      proposalReviewMap,
      proposalChangeRequestMap,
      proposalAgentJobMap,
      schedulerState,
    },
    decisionContext,
  )

  return {
    focusedReplayReview: decisionContext.focusedReplayReview,
    focusedTrackingReviewId: decisionContext.focusedTrackingReviewId,
    focusedPrimaryReviewId: decisionContext.focusedPrimaryReviewId,
    ...reviewJobDecisionCollections,
    ...proposalDecisionModel,
  }
}

import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useReplayWorkspaceModel } from './useReplayWorkspaceModel'
import type { useStrategyWorkspaceCompositeModel } from './useStrategyWorkspaceCompositeModel'

type BuildReplayWorkspaceModelArgs = Parameters<typeof useReplayWorkspaceModel>[0]
type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type StrategyWorkspaceCompositeModel = ReturnType<typeof useStrategyWorkspaceCompositeModel>

export type BuildReplayWorkspaceModelArgsInput =
  AppWorkspaceBootstrapState &
  ControlDataQueryModel &
  StrategyWorkspaceCompositeModel

export function buildReplayWorkspaceModelArgs({
  reviews,
  replayTrackingReviewsQuery,
  selectedStrategy,
  selectedStrategyPrimaryReviews,
  selectedStrategyReviews,
  scheduler,
  replayTrackingScope,
  selectedProposalId,
  selectedChangeRequestId,
  selectedBacktestId,
  reviewInspectorReviewId,
  replayFocusedReviewId,
  aiSchedulerFocusedJobId,
  proposalBacktestMap,
  proposalReviewMap,
  proposalChangeRequestMap,
  proposalAgentJobMap,
}: BuildReplayWorkspaceModelArgsInput): BuildReplayWorkspaceModelArgs {
  return {
    reviews,
    replayTrackingReviewsData: replayTrackingReviewsQuery.data,
    selectedStrategy,
    selectedStrategyPrimaryReviews,
    selectedStrategyReviews,
    schedulerJobs: scheduler?.jobs ?? [],
    replayTrackingScope,
    selectedProposalId,
    selectedChangeRequestId,
    selectedBacktestId,
    reviewInspectorReviewId,
    replayFocusedReviewId,
    aiSchedulerFocusedJobId,
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
  }
}

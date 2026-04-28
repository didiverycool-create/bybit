import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { UseStrategyWorkspaceCompositeModelArgs } from './useStrategyWorkspaceCompositeModel.types'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>

export type BuildStrategyWorkspaceCompositeModelArgsInput =
  AppWorkspaceBootstrapState &
  ControlDataQueryModel

export function buildStrategyWorkspaceCompositeModelArgs({
  selectedStrategy,
  selectedStrategyActivity,
  selectedProposalId,
  selectedChangeRequestId,
  selectedBacktestId,
  backtestFilter,
  reviewInspectorReviewId,
  replayFocusedReviewId,
  aiSchedulerFocusedJobId,
  backtests,
  reviews,
  selectedStrategyReviewsQuery,
  selectedBacktestReviewsQuery,
  replayTrackingReviewsQuery,
  changeRequests,
  scheduler,
  snapshot,
  selectedMode,
}: BuildStrategyWorkspaceCompositeModelArgsInput): UseStrategyWorkspaceCompositeModelArgs {
  return {
    selectedStrategy,
    selectedStrategyActivity,
    selectedProposalId,
    selectedChangeRequestId,
    selectedBacktestId,
    backtestFilter,
    reviewInspectorReviewId,
    replayFocusedReviewId,
    aiSchedulerFocusedJobId,
    backtests,
    reviews,
    selectedStrategyReviewsData: selectedStrategyReviewsQuery.data,
    selectedBacktestReviewsData: selectedBacktestReviewsQuery.data,
    replayTrackingReviewsData: replayTrackingReviewsQuery.data,
    changeRequests,
    schedulerJobs: scheduler?.jobs ?? [],
    schedulerState: snapshot?.scheduler ?? null,
    selectedMode,
  }
}

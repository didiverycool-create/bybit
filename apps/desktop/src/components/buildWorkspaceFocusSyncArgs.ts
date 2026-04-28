import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useStrategyWorkspaceCompositeModel } from './useStrategyWorkspaceCompositeModel'
import type { UseWorkspaceFocusSyncArgs } from './useWorkspaceFocusSync.types'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type StrategyWorkspaceCompositeModel = ReturnType<typeof useStrategyWorkspaceCompositeModel>

export type BuildWorkspaceFocusSyncArgsInput =
  AppWorkspaceBootstrapState &
  ControlDataQueryModel &
  StrategyWorkspaceCompositeModel

export function buildWorkspaceFocusSyncArgs({
  activeSection,
  selectedProposalId,
  selectedChangeRequestId,
  proposalCatalog,
  replayFocusedReviewId,
  reviewCatalog,
  reviewInspectorOpen,
  reviewInspectorReviewId,
  reviewInspectorStrategyId,
  aiSchedulerFocusedJobId,
  scheduler,
  changeRequests,
  strategies,
  selectedStrategy,
  selectedStrategyId,
  selectedSymbol,
  setSelectedStrategyId,
  setSelectedSymbol,
  setReviewInspectorStrategyId,
}: BuildWorkspaceFocusSyncArgsInput): UseWorkspaceFocusSyncArgs {
  return {
    activeSection,
    selectedProposalId,
    selectedChangeRequestId,
    proposalCatalog,
    replayFocusedReviewId,
    reviewCatalog,
    reviewInspectorOpen,
    reviewInspectorReviewId,
    reviewInspectorStrategyId,
    aiSchedulerFocusedJobId,
    schedulerJobs: scheduler?.jobs ?? [],
    changeRequests,
    strategies,
    selectedStrategyCurrentId: selectedStrategy?.id ?? null,
    selectedStrategyId,
    selectedSymbol,
    setSelectedStrategyId,
    setSelectedSymbol,
    setReviewInspectorStrategyId,
  }
}

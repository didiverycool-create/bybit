import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useMarketWorkspaceModel } from './useMarketWorkspaceModel'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'
import type { useStrategyWorkspaceCompositeModel } from './useStrategyWorkspaceCompositeModel'
import type { UseWorkspaceDraftSyncArgs } from './useWorkspaceDraftSync.types'

type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type MarketWorkspaceModel = ReturnType<typeof useMarketWorkspaceModel>
type RuntimeAndSettingsModel = ReturnType<typeof useRuntimeAndSettingsModel>
type StrategyWorkspaceCompositeModel = ReturnType<typeof useStrategyWorkspaceCompositeModel>

export type BuildWorkspaceDraftSyncArgsInput =
  AppWorkspaceBootstrapState &
  ControlDataQueryModel &
  MarketWorkspaceModel &
  RuntimeAndSettingsModel &
  StrategyWorkspaceCompositeModel

export function buildWorkspaceDraftSyncArgs({
  selectedStrategy,
  selectedStrategyId,
  selectedStrategyParameterSignature,
  strategyEditorDraftStrategyId,
  strategyEditorOpen,
  setParameterDrafts,
  setRiskBudgetDraft,
  setStrategyEditorDraftStrategyId,
  watchlist,
  watchlistAlertSignature,
  setWatchlistAlertDrafts,
  backtestsForWorkspace,
  selectedBacktestId,
  setSelectedBacktestId,
  selectedProposalId,
  reviewsQuery,
  proposalCatalog,
  setSelectedProposalId,
  reviewInspectorOpen,
  reviewInspectorReviewId,
  reviewInspectorStrategyId,
  reviewCatalog,
  setReviewInspectorOpen,
  setReviewInspectorReviewId,
  setReviewInspectorStrategyId,
  replayFocusedReviewId,
  setReplayFocusedReviewId,
  aiSchedulerFocusedJobId,
  schedulerQuery,
  scheduler,
  setAiSchedulerFocusedJobId,
  selectedChangeRequestId,
  changeRequestsQuery,
  changeRequests,
  setSelectedChangeRequestId,
  editingOrderId,
  editingOrder,
  setEditingOrderId,
  setManualTradePanelOpen,
}: BuildWorkspaceDraftSyncArgsInput): UseWorkspaceDraftSyncArgs {
  return {
    selectedStrategy,
    selectedStrategyId,
    selectedStrategyParameterSignature,
    strategyEditorDraftStrategyId,
    strategyEditorOpen,
    setParameterDrafts,
    setRiskBudgetDraft,
    setStrategyEditorDraftStrategyId,
    watchlist,
    watchlistAlertSignature,
    setWatchlistAlertDrafts,
    backtestsForWorkspace,
    selectedBacktestId,
    setSelectedBacktestId,
    selectedProposalId,
    reviewsLoaded: reviewsQuery.data !== undefined,
    proposalCatalog,
    setSelectedProposalId,
    reviewInspectorOpen,
    reviewInspectorReviewId,
    reviewInspectorStrategyId,
    reviewCatalog,
    setReviewInspectorOpen,
    setReviewInspectorReviewId,
    setReviewInspectorStrategyId,
    replayFocusedReviewId,
    setReplayFocusedReviewId,
    aiSchedulerFocusedJobId,
    schedulerLoaded: schedulerQuery.data !== undefined,
    schedulerJobs: scheduler?.jobs ?? [],
    setAiSchedulerFocusedJobId,
    selectedChangeRequestId,
    changeRequestsLoaded: changeRequestsQuery.data !== undefined,
    changeRequests,
    setSelectedChangeRequestId,
    editingOrderId,
    editingOrder,
    setEditingOrderId,
    setManualTradePanelOpen,
  }
}

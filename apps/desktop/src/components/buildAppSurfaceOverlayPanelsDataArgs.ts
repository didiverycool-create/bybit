import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppOverlayPanelsSurfaceArgsInput } from './buildAppOverlayPanelsSurfaceArgs'

export type BuildAppSurfaceOverlayPanelsDataArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildAppSurfaceOverlayPanelsDataArgs({
  source,
}: BuildAppSurfaceOverlayPanelsDataArgsInput): Omit<
  BuildAppOverlayPanelsSurfaceArgsInput,
  | 'statusInspectorOpen'
  | 'watchlistManagerOpen'
  | 'schedulerControlsOpen'
  | 'grafanaPreviewOpen'
  | 'manualTradePanelOpen'
  | 'orderHistoryPanelOpen'
  | 'accountInspectorOpen'
  | 'strategyEditorOpen'
  | 'strategyTrackingPanelOpen'
  | 'reviewInspectorOpen'
  | 'setStatusInspectorOpen'
  | 'setWatchlistManagerOpen'
  | 'setSchedulerControlsOpen'
  | 'setGrafanaPreviewOpen'
  | 'setManualTradePanelOpen'
  | 'setOrderHistoryPanelOpen'
  | 'setAccountInspectorOpen'
  | 'setStrategyEditorOpen'
  | 'setStrategyTrackingPanelOpen'
  | 'setReviewInspectorOpen'
  | 'setWatchlistDraftSymbol'
  | 'setWatchlistDraftMarket'
  | 'setWatchlistAlertDrafts'
  | 'setManualOrder'
  | 'setTradeOriginFilter'
  | 'setTradeScopeFilter'
  | 'setParameterDrafts'
  | 'setRiskBudgetDraft'
  | 'setStrategyTrackingKind'
  | 'setStrategyTrackingSummary'
  | 'setStrategyTrackingDetail'
  | 'setActiveSection'
  | 'setReplayFocusedReviewId'
  | 'workspaceNavigation'
> {
  const {
    selectedMode,
    selectedSymbol,
    reviewInspectorReviewId,
    reviewInspectorStrategyId,
    strategyTrackingKind,
    strategyTrackingSummary,
    strategyTrackingDetail,
    watchlistDraftSymbol,
    watchlistDraftMarket,
    watchlistAlertDrafts,
    parameterDrafts,
    riskBudgetDraft,
    tradeOriginFilter,
    tradeScopeFilter,
    manualOrder,
    snapshot,
    watchlist,
    selectedStrategy,
    accountOverview,
    editingOrder,
    settings,
    metricsPreviewLines,
    bybitPrivateStatus,
    bybitPublicStatus,
    serviceAvailable,
    grafanaStatus,
    pendingAlertsCount,
    filteredOrderHistory,
    strategyWorkflowActions,
    workspaceControlActions,
    reviewInspectorModel,
    parameterDraftPatchCount,
    hasParameterDraftChanges,
    riskBudgetChanged,
    strategyWorkspaceActions,
    workspaceStatusModel,
    manualTradePreviewQuery,
    manualTradePreview,
    manualTradingBlockedReason,
    tradeProbeResult,
    tradeProbePending,
    manualTradeMutationPending,
    exchangeOrderMutationPending,
    paperOrderMutationPending,
    replacePaperOrderPending,
    replaceExchangeOrderPending,
    cancelPaperOrderPending,
    cancelExchangeOrderPending,
    tradingExecutionActions,
  } = source

  return {
    workspaceStatusModel,
    workspaceControlActions,
    tradingExecutionActions,
    strategyWorkspaceActions,
    strategyWorkflowActions,
    reviewInspectorModel,
    snapshotScheduler: snapshot?.scheduler,
    serviceAvailable,
    settings,
    grafanaStatus,
    metricsPreviewLines,
    pendingAlertsCount,
    selectedMode,
    selectedSymbol,
    editingOrder,
    manualOrder,
    manualTradePreviewLoading: manualTradePreviewQuery.isLoading,
    manualTradePreview,
    manualTradingBlockedReason: manualTradingBlockedReason ?? null,
    watchlist,
    watchlistDraftSymbol,
    watchlistDraftMarket,
    watchlistAlertDrafts,
    accountOverview,
    bybitPrivateStatus,
    bybitPublicStatus,
    tradeProbeResult,
    tradeProbePending,
    parameterDrafts,
    riskBudgetDraft,
    hasParameterDraftChanges,
    parameterDraftPatchCount,
    riskBudgetChanged,
    selectedStrategy,
    strategyTrackingKind,
    strategyTrackingSummary,
    strategyTrackingDetail,
    reviewInspectorReviewId,
    reviewInspectorStrategyId,
    tradeOriginFilter,
    tradeScopeFilter,
    filteredOrderHistory,
    changeRequestMutationPending: strategyWorkflowActions.changeRequestMutationPending,
    schedulerMutationPending: workspaceControlActions.schedulerMutationPending,
    watchlistAddPending: workspaceControlActions.watchlistAddPending,
    watchlistRemovePending: workspaceControlActions.watchlistRemovePending,
    manualTradeMutationPending,
    exchangeOrderMutationPending,
    paperOrderMutationPending,
    replacePaperOrderPending,
    replaceExchangeOrderPending,
    cancelPaperOrderPending,
    cancelExchangeOrderPending,
    strategyTrackingMutationPending: strategyWorkflowActions.strategyTrackingMutationPending,
    backtestMutationPending: strategyWorkflowActions.backtestMutationPending,
    retryAgentJobMutationPending: strategyWorkflowActions.retryAgentJobMutationPending,
    proposalMutationPending: strategyWorkflowActions.proposalMutationPending,
  }
}

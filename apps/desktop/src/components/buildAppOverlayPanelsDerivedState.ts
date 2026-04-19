import type { BuildAppOverlayPanelsPropsArgs } from './buildAppOverlayPanelsProps'

type AppOverlayPanelsDataState = BuildAppOverlayPanelsPropsArgs['dataState']
type AppOverlayPanelsPendingState = BuildAppOverlayPanelsPropsArgs['pendingState']

export type BuildAppOverlayPanelsDerivedStateArgs = {
  dataState: Omit<AppOverlayPanelsDataState, 'watchlistControlsDisabled'>
  pendingState: AppOverlayPanelsPendingState
}

export type BuildAppOverlayPanelsDerivedStateResult = Pick<
  BuildAppOverlayPanelsPropsArgs,
  'dataState' | 'pendingState'
>

export function buildAppOverlayPanelsDerivedState({
  dataState,
  pendingState,
}: BuildAppOverlayPanelsDerivedStateArgs): BuildAppOverlayPanelsDerivedStateResult {
  return {
    dataState: {
      snapshotScheduler: dataState.snapshotScheduler,
      serviceAvailable: dataState.serviceAvailable,
      settings: dataState.settings,
      grafanaStatus: dataState.grafanaStatus,
      metricsPreviewLines: dataState.metricsPreviewLines,
      pendingAlertsCount: dataState.pendingAlertsCount,
      selectedMode: dataState.selectedMode,
      selectedSymbol: dataState.selectedSymbol,
      editingOrder: dataState.editingOrder,
      manualOrder: dataState.manualOrder,
      manualTradePreviewLoading: dataState.manualTradePreviewLoading,
      manualTradePreview: dataState.manualTradePreview,
      manualTradingBlockedReason: dataState.manualTradingBlockedReason,
      watchlist: dataState.watchlist,
      watchlistDraftSymbol: dataState.watchlistDraftSymbol,
      watchlistDraftMarket: dataState.watchlistDraftMarket,
      watchlistAlertDrafts: dataState.watchlistAlertDrafts,
      watchlistControlsDisabled:
        !dataState.serviceAvailable || pendingState.changeRequestMutationPending,
      accountOverview: dataState.accountOverview,
      bybitPrivateStatus: dataState.bybitPrivateStatus,
      bybitPublicStatus: dataState.bybitPublicStatus,
      tradeProbeResult: dataState.tradeProbeResult,
      tradeProbePending: dataState.tradeProbePending,
      parameterDrafts: dataState.parameterDrafts,
      riskBudgetDraft: dataState.riskBudgetDraft,
      hasParameterDraftChanges: dataState.hasParameterDraftChanges,
      parameterDraftPatchCount: dataState.parameterDraftPatchCount,
      riskBudgetChanged: dataState.riskBudgetChanged,
      selectedStrategy: dataState.selectedStrategy,
      strategyTrackingKind: dataState.strategyTrackingKind,
      strategyTrackingSummary: dataState.strategyTrackingSummary,
      strategyTrackingDetail: dataState.strategyTrackingDetail,
      reviewInspectorReviewId: dataState.reviewInspectorReviewId,
      reviewInspectorStrategyId: dataState.reviewInspectorStrategyId,
      tradeOriginFilter: dataState.tradeOriginFilter,
      tradeScopeFilter: dataState.tradeScopeFilter,
      filteredOrderHistory: dataState.filteredOrderHistory,
    },
    pendingState: {
      changeRequestMutationPending: pendingState.changeRequestMutationPending,
      schedulerMutationPending: pendingState.schedulerMutationPending,
      watchlistAddPending: pendingState.watchlistAddPending,
      watchlistRemovePending: pendingState.watchlistRemovePending,
      manualTradeMutationPending: pendingState.manualTradeMutationPending,
      exchangeOrderMutationPending: pendingState.exchangeOrderMutationPending,
      paperOrderMutationPending: pendingState.paperOrderMutationPending,
      replacePaperOrderPending: pendingState.replacePaperOrderPending,
      replaceExchangeOrderPending: pendingState.replaceExchangeOrderPending,
      cancelPaperOrderPending: pendingState.cancelPaperOrderPending,
      cancelExchangeOrderPending: pendingState.cancelExchangeOrderPending,
      strategyTrackingMutationPending: pendingState.strategyTrackingMutationPending,
      backtestMutationPending: pendingState.backtestMutationPending,
      retryAgentJobMutationPending: pendingState.retryAgentJobMutationPending,
      proposalMutationPending: pendingState.proposalMutationPending,
    },
  }
}

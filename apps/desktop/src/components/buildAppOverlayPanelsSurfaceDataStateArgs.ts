import type { BuildAppSurfaceModelsArgsInput } from './buildAppSurfaceModelsArgs'

type AppOverlayPanelsSurfaceArgs = BuildAppSurfaceModelsArgsInput['appOverlayPanels']
type AppOverlayPanelsDataState = AppOverlayPanelsSurfaceArgs['dataState']

export type BuildAppOverlayPanelsSurfaceDataStateArgsInput = {
  snapshotScheduler: AppOverlayPanelsDataState['snapshotScheduler']
  serviceAvailable: AppOverlayPanelsDataState['serviceAvailable']
  settings: AppOverlayPanelsDataState['settings']
  grafanaStatus: AppOverlayPanelsDataState['grafanaStatus']
  metricsPreviewLines: AppOverlayPanelsDataState['metricsPreviewLines']
  pendingAlertsCount: AppOverlayPanelsDataState['pendingAlertsCount']
  selectedMode: AppOverlayPanelsDataState['selectedMode']
  selectedSymbol: AppOverlayPanelsDataState['selectedSymbol']
  editingOrder: AppOverlayPanelsDataState['editingOrder']
  manualOrder: AppOverlayPanelsDataState['manualOrder']
  manualTradePreviewLoading: AppOverlayPanelsDataState['manualTradePreviewLoading']
  manualTradePreview: AppOverlayPanelsDataState['manualTradePreview']
  manualTradingBlockedReason: AppOverlayPanelsDataState['manualTradingBlockedReason']
  watchlist: AppOverlayPanelsDataState['watchlist']
  watchlistDraftSymbol: AppOverlayPanelsDataState['watchlistDraftSymbol']
  watchlistDraftMarket: AppOverlayPanelsDataState['watchlistDraftMarket']
  watchlistAlertDrafts: AppOverlayPanelsDataState['watchlistAlertDrafts']
  accountOverview: AppOverlayPanelsDataState['accountOverview']
  bybitPrivateStatus: AppOverlayPanelsDataState['bybitPrivateStatus']
  bybitPublicStatus: AppOverlayPanelsDataState['bybitPublicStatus']
  tradeProbeResult: AppOverlayPanelsDataState['tradeProbeResult']
  tradeProbePending: AppOverlayPanelsDataState['tradeProbePending']
  parameterDrafts: AppOverlayPanelsDataState['parameterDrafts']
  riskBudgetDraft: AppOverlayPanelsDataState['riskBudgetDraft']
  hasParameterDraftChanges: AppOverlayPanelsDataState['hasParameterDraftChanges']
  parameterDraftPatchCount: AppOverlayPanelsDataState['parameterDraftPatchCount']
  riskBudgetChanged: AppOverlayPanelsDataState['riskBudgetChanged']
  selectedStrategy: AppOverlayPanelsDataState['selectedStrategy']
  strategyTrackingKind: AppOverlayPanelsDataState['strategyTrackingKind']
  strategyTrackingSummary: AppOverlayPanelsDataState['strategyTrackingSummary']
  strategyTrackingDetail: AppOverlayPanelsDataState['strategyTrackingDetail']
  reviewInspectorReviewId: AppOverlayPanelsDataState['reviewInspectorReviewId']
  reviewInspectorStrategyId: AppOverlayPanelsDataState['reviewInspectorStrategyId']
  tradeOriginFilter: AppOverlayPanelsDataState['tradeOriginFilter']
  tradeScopeFilter: AppOverlayPanelsDataState['tradeScopeFilter']
  filteredOrderHistory: AppOverlayPanelsDataState['filteredOrderHistory']
}

export function buildAppOverlayPanelsSurfaceDataStateArgs({
  snapshotScheduler,
  serviceAvailable,
  settings,
  grafanaStatus,
  metricsPreviewLines,
  pendingAlertsCount,
  selectedMode,
  selectedSymbol,
  editingOrder,
  manualOrder,
  manualTradePreviewLoading,
  manualTradePreview,
  manualTradingBlockedReason,
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
}: BuildAppOverlayPanelsSurfaceDataStateArgsInput): AppOverlayPanelsDataState {
  return {
    snapshotScheduler,
    serviceAvailable,
    settings,
    grafanaStatus,
    metricsPreviewLines,
    pendingAlertsCount,
    selectedMode,
    selectedSymbol,
    editingOrder,
    manualOrder,
    manualTradePreviewLoading,
    manualTradePreview,
    manualTradingBlockedReason,
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
  }
}

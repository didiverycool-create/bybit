import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppOverlayPanelsSurfaceArgsInput } from './buildAppOverlayPanelsSurfaceArgs'

export type BuildAppSurfaceOverlayPanelsPanelArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildAppSurfaceOverlayPanelsPanelArgs({
  source,
}: BuildAppSurfaceOverlayPanelsPanelArgsInput): Pick<
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
    setActiveSection,
    setStatusInspectorOpen,
    accountInspectorOpen,
    setAccountInspectorOpen,
    watchlistManagerOpen,
    setWatchlistManagerOpen,
    schedulerControlsOpen,
    setSchedulerControlsOpen,
    grafanaPreviewOpen,
    setGrafanaPreviewOpen,
    manualTradePanelOpen,
    setManualTradePanelOpen,
    orderHistoryPanelOpen,
    setOrderHistoryPanelOpen,
    strategyEditorOpen,
    setStrategyEditorOpen,
    strategyTrackingPanelOpen,
    setStrategyTrackingPanelOpen,
    reviewInspectorOpen,
    setReviewInspectorOpen,
    setReplayFocusedReviewId,
    setWatchlistDraftSymbol,
    setWatchlistDraftMarket,
    setWatchlistAlertDrafts,
    setParameterDrafts,
    setRiskBudgetDraft,
    setTradeOriginFilter,
    setTradeScopeFilter,
    setManualOrder,
    statusInspectorOpen,
    workspaceNavigation,
    setStrategyTrackingKind,
    setStrategyTrackingSummary,
    setStrategyTrackingDetail,
  } = source

  return {
    statusInspectorOpen,
    watchlistManagerOpen,
    schedulerControlsOpen,
    grafanaPreviewOpen,
    manualTradePanelOpen,
    orderHistoryPanelOpen,
    accountInspectorOpen,
    strategyEditorOpen,
    strategyTrackingPanelOpen,
    reviewInspectorOpen,
    setStatusInspectorOpen,
    setWatchlistManagerOpen,
    setSchedulerControlsOpen,
    setGrafanaPreviewOpen,
    setManualTradePanelOpen,
    setOrderHistoryPanelOpen,
    setAccountInspectorOpen,
    setStrategyEditorOpen,
    setStrategyTrackingPanelOpen,
    setReviewInspectorOpen,
    setWatchlistDraftSymbol,
    setWatchlistDraftMarket,
    setWatchlistAlertDrafts,
    setManualOrder,
    setTradeOriginFilter,
    setTradeScopeFilter,
    setParameterDrafts,
    setRiskBudgetDraft,
    setStrategyTrackingKind,
    setStrategyTrackingSummary,
    setStrategyTrackingDetail,
    setActiveSection,
    setReplayFocusedReviewId,
    workspaceNavigation,
  }
}

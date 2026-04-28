import type { BuildAppSurfaceModelsArgsInput } from './buildAppSurfaceModelsArgs'
import type { useWorkspaceNavigation } from './useWorkspaceNavigation'

type AppOverlayPanelsSurfaceArgs = BuildAppSurfaceModelsArgsInput['appOverlayPanels']
type AppOverlayPanelsPanelState = AppOverlayPanelsSurfaceArgs['panelState']
type AppOverlayPanelsPanelSetters = AppOverlayPanelsSurfaceArgs['panelSetters']
type WorkspaceNavigationModel = ReturnType<typeof useWorkspaceNavigation>

export type BuildAppOverlayPanelsSurfaceStateArgsInput = {
  statusInspectorOpen: AppOverlayPanelsPanelState['statusInspectorOpen']
  watchlistManagerOpen: AppOverlayPanelsPanelState['watchlistManagerOpen']
  schedulerControlsOpen: AppOverlayPanelsPanelState['schedulerControlsOpen']
  grafanaPreviewOpen: AppOverlayPanelsPanelState['grafanaPreviewOpen']
  manualTradePanelOpen: AppOverlayPanelsPanelState['manualTradePanelOpen']
  orderHistoryPanelOpen: AppOverlayPanelsPanelState['orderHistoryPanelOpen']
  accountInspectorOpen: AppOverlayPanelsPanelState['accountInspectorOpen']
  strategyEditorOpen: AppOverlayPanelsPanelState['strategyEditorOpen']
  strategyTrackingPanelOpen: AppOverlayPanelsPanelState['strategyTrackingPanelOpen']
  reviewInspectorOpen: AppOverlayPanelsPanelState['reviewInspectorOpen']
  setStatusInspectorOpen: AppOverlayPanelsPanelSetters['setStatusInspectorOpen']
  setWatchlistManagerOpen: AppOverlayPanelsPanelSetters['setWatchlistManagerOpen']
  setSchedulerControlsOpen: AppOverlayPanelsPanelSetters['setSchedulerControlsOpen']
  setGrafanaPreviewOpen: AppOverlayPanelsPanelSetters['setGrafanaPreviewOpen']
  setManualTradePanelOpen: AppOverlayPanelsPanelSetters['setManualTradePanelOpen']
  setOrderHistoryPanelOpen: AppOverlayPanelsPanelSetters['setOrderHistoryPanelOpen']
  setAccountInspectorOpen: AppOverlayPanelsPanelSetters['setAccountInspectorOpen']
  setStrategyEditorOpen: AppOverlayPanelsPanelSetters['setStrategyEditorOpen']
  setStrategyTrackingPanelOpen: AppOverlayPanelsPanelSetters['setStrategyTrackingPanelOpen']
  setReviewInspectorOpen: AppOverlayPanelsPanelSetters['setReviewInspectorOpen']
  setWatchlistDraftSymbol: AppOverlayPanelsPanelSetters['setWatchlistDraftSymbol']
  setWatchlistDraftMarket: AppOverlayPanelsPanelSetters['setWatchlistDraftMarket']
  setWatchlistAlertDrafts: AppOverlayPanelsPanelSetters['setWatchlistAlertDrafts']
  setManualOrder: AppOverlayPanelsPanelSetters['setManualOrder']
  setTradeOriginFilter: AppOverlayPanelsPanelSetters['setTradeOriginFilter']
  setTradeScopeFilter: AppOverlayPanelsPanelSetters['setTradeScopeFilter']
  setParameterDrafts: AppOverlayPanelsPanelSetters['setParameterDrafts']
  setRiskBudgetDraft: AppOverlayPanelsPanelSetters['setRiskBudgetDraft']
  setStrategyTrackingKind: AppOverlayPanelsPanelSetters['setStrategyTrackingKind']
  setStrategyTrackingSummary: AppOverlayPanelsPanelSetters['setStrategyTrackingSummary']
  setStrategyTrackingDetail: AppOverlayPanelsPanelSetters['setStrategyTrackingDetail']
  setActiveSection: AppOverlayPanelsPanelSetters['setActiveSection']
  setReplayFocusedReviewId: AppOverlayPanelsPanelSetters['setReplayFocusedReviewId']
  workspaceNavigation: Pick<
    WorkspaceNavigationModel,
    | 'openSection'
    | 'openStrategyActivity'
    | 'openStrategyReplay'
    | 'openReviewInspector'
    | 'openChangeRequest'
    | 'openBacktestDetail'
    | 'openSourceReview'
    | 'openStrategyProposal'
    | 'openAiSchedulerJob'
  >
}

export function buildAppOverlayPanelsSurfaceStateArgs({
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
}: BuildAppOverlayPanelsSurfaceStateArgsInput): Pick<
  AppOverlayPanelsSurfaceArgs,
  'panelState' | 'panelSetters' | 'navigationActions'
> {
  return {
    panelState: {
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
    },
    panelSetters: {
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
    },
    navigationActions: {
      onOpenSection: workspaceNavigation.openSection,
      onOpenStrategyActivity: workspaceNavigation.openStrategyActivity,
      onOpenStrategyReplay: workspaceNavigation.openStrategyReplay,
      onOpenReviewInspector: workspaceNavigation.openReviewInspector,
      onOpenChangeRequest: workspaceNavigation.openChangeRequest,
      onOpenBacktestDetail: workspaceNavigation.openBacktestDetail,
      onOpenSourceReview: workspaceNavigation.openSourceReview,
      onOpenStrategyProposal: workspaceNavigation.openStrategyProposal,
      onOpenAiSchedulerJob: workspaceNavigation.openAiSchedulerJob,
    },
  }
}

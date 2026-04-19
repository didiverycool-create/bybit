import type { BuildAppOverlayPanelsAssemblerArgs } from './buildAppOverlayPanelsAssembler'
import { buildAppOverlayPanelsControlProps } from './buildAppOverlayPanelsControlProps'

export function buildAppOverlayPanelsControlSection({
  panelState,
  panelSetters,
  navigationActions,
  workspaceStatusModel,
  workspaceControlActions,
  dataState,
  pendingState,
}: BuildAppOverlayPanelsAssemblerArgs) {
  return buildAppOverlayPanelsControlProps({
    panelState: {
      statusInspectorOpen: panelState.statusInspectorOpen,
      watchlistManagerOpen: panelState.watchlistManagerOpen,
      schedulerControlsOpen: panelState.schedulerControlsOpen,
      grafanaPreviewOpen: panelState.grafanaPreviewOpen,
    },
    panelSetters: {
      setStatusInspectorOpen: panelSetters.setStatusInspectorOpen,
      setWatchlistManagerOpen: panelSetters.setWatchlistManagerOpen,
      setSchedulerControlsOpen: panelSetters.setSchedulerControlsOpen,
      setGrafanaPreviewOpen: panelSetters.setGrafanaPreviewOpen,
      setWatchlistDraftSymbol: panelSetters.setWatchlistDraftSymbol,
      setWatchlistDraftMarket: panelSetters.setWatchlistDraftMarket,
      setWatchlistAlertDrafts: panelSetters.setWatchlistAlertDrafts,
    },
    navigationActions: {
      onOpenSection: navigationActions.onOpenSection,
    },
    workspaceStatusModel,
    workspaceControlActions,
    dataState: {
      snapshotScheduler: dataState.snapshotScheduler,
      serviceAvailable: dataState.serviceAvailable,
      grafanaStatus: dataState.grafanaStatus,
      metricsPreviewLines: dataState.metricsPreviewLines,
      pendingAlertsCount: dataState.pendingAlertsCount,
      watchlist: dataState.watchlist,
      watchlistDraftSymbol: dataState.watchlistDraftSymbol,
      watchlistDraftMarket: dataState.watchlistDraftMarket,
      watchlistAlertDrafts: dataState.watchlistAlertDrafts,
      watchlistControlsDisabled: dataState.watchlistControlsDisabled,
    },
    pendingState: {
      schedulerMutationPending: pendingState.schedulerMutationPending,
      watchlistAddPending: pendingState.watchlistAddPending,
      watchlistRemovePending: pendingState.watchlistRemovePending,
    },
  })
}

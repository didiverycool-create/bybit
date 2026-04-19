import type { AppOverlayPanelsContainerProps } from './AppOverlayPanelsContainer.types'
import type { AppOverlayPanelsHostProps } from './AppOverlayPanelsHost'

type AppOverlayPanelsControlHostPropsArgs = Pick<
  AppOverlayPanelsContainerProps,
  'statusInspectorState' | 'statusInspectorActions' | 'watchlistManagerState' | 'watchlistManagerActions' | 'schedulerControlsState' | 'schedulerControlsActions' | 'grafanaPreviewState' | 'grafanaPreviewActions'
>

export function buildAppOverlayPanelsControlHostProps({
  statusInspectorState,
  statusInspectorActions,
  watchlistManagerState,
  watchlistManagerActions,
  schedulerControlsState,
  schedulerControlsActions,
  grafanaPreviewState,
  grafanaPreviewActions,
}: AppOverlayPanelsControlHostPropsArgs): Pick<
  AppOverlayPanelsHostProps,
  'statusInspectorPanelProps' | 'watchlistManagerPanelProps' | 'schedulerControlsPanelProps' | 'grafanaPreviewPanelProps'
> {
  return {
    statusInspectorPanelProps: {
      ...statusInspectorState,
      onClose: () => statusInspectorActions.setOpen(false),
      onOpenAlerts: () => {
        statusInspectorActions.setOpen(false)
        statusInspectorActions.onOpenSection('alerts')
      },
      onOpenScheduler: () => {
        statusInspectorActions.setOpen(false)
        statusInspectorActions.onOpenSection('scheduler')
      },
      onOpenSettings: () => {
        statusInspectorActions.setOpen(false)
        statusInspectorActions.onOpenSection('settings')
      },
    },
    watchlistManagerPanelProps: {
      ...watchlistManagerState,
      onClose: () => watchlistManagerActions.setOpen(false),
      onDraftSymbolChange: watchlistManagerActions.setDraftSymbol,
      onDraftMarketChange: watchlistManagerActions.setDraftMarket,
      onSubmit: watchlistManagerActions.onSubmit,
      onAlertDraftChange: (symbol, value) =>
        watchlistManagerActions.setAlertDrafts((current) => ({
          ...current,
          [symbol]: value,
        })),
      onUpdateAlertRule: watchlistManagerActions.onUpdateAlertRule,
      onToggleAlertRule: (item) =>
        watchlistManagerActions.onUpdateAlertRule(item, {
          alertEnabled: !item.alert_enabled,
        }),
      onRemove: watchlistManagerActions.onRemove,
    },
    schedulerControlsPanelProps: {
      ...schedulerControlsState,
      onClose: () => schedulerControlsActions.setOpen(false),
      onCancelAll: schedulerControlsActions.onCancelAll,
      onFreezePublish: schedulerControlsActions.onFreezePublish,
      onEnterManualOverride: schedulerControlsActions.onEnterManualOverride,
      onOpenGrafana: () => {
        schedulerControlsActions.setOpen(false)
        schedulerControlsActions.setGrafanaPreviewOpen(true)
      },
    },
    grafanaPreviewPanelProps: {
      ...grafanaPreviewState,
      onClose: () => grafanaPreviewActions.setOpen(false),
      onOpenMetrics: grafanaPreviewActions.onOpenMetrics,
      onOpenGrafana: grafanaPreviewActions.onOpenGrafana,
    },
  }
}

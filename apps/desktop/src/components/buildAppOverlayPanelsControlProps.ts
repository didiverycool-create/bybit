import type { ComponentProps, Dispatch, SetStateAction } from 'react'

import { CONTROL_API_BASE } from '../apiHttp'
import type { SchedulerState, SectionKey } from '../types'
import { schedulerLabel } from '../utils/app-helpers'
import AppOverlayPanelsContainer from './AppOverlayPanelsContainer'
import type { useWorkspaceControlActions } from './useWorkspaceControlActions'
import type { useWorkspaceStatusModel } from './useWorkspaceStatusModel'

type AppOverlayPanelsProps = ComponentProps<typeof AppOverlayPanelsContainer>
type WorkspaceStatusModel = ReturnType<typeof useWorkspaceStatusModel>
type WorkspaceControlActionsModel = ReturnType<typeof useWorkspaceControlActions>

export type BuildAppOverlayPanelsControlPropsArgs = {
  panelState: {
    statusInspectorOpen: boolean
    watchlistManagerOpen: boolean
    schedulerControlsOpen: boolean
    grafanaPreviewOpen: boolean
  }
  panelSetters: {
    setStatusInspectorOpen: Dispatch<SetStateAction<boolean>>
    setWatchlistManagerOpen: Dispatch<SetStateAction<boolean>>
    setSchedulerControlsOpen: Dispatch<SetStateAction<boolean>>
    setGrafanaPreviewOpen: Dispatch<SetStateAction<boolean>>
    setWatchlistDraftSymbol: Dispatch<SetStateAction<string>>
    setWatchlistDraftMarket: Dispatch<SetStateAction<'spot' | 'perp'>>
    setWatchlistAlertDrafts: Dispatch<SetStateAction<Record<string, string>>>
  }
  navigationActions: {
    onOpenSection: (section: SectionKey) => void
  }
  workspaceStatusModel: WorkspaceStatusModel
  workspaceControlActions: WorkspaceControlActionsModel
  dataState: {
    snapshotScheduler?: SchedulerState | null
    serviceAvailable: boolean
    grafanaStatus: {
      metrics_path?: string | null
      dashboard_url?: string | null
      configured?: boolean | null
      note?: string | null
    } | null | undefined
    metricsPreviewLines: string[]
    pendingAlertsCount: number
    watchlist: AppOverlayPanelsProps['watchlistManagerState']['watchlist']
    watchlistDraftSymbol: string
    watchlistDraftMarket: 'spot' | 'perp'
    watchlistAlertDrafts: Record<string, string>
    watchlistControlsDisabled: boolean
  }
  pendingState: {
    schedulerMutationPending: boolean
    watchlistAddPending: boolean
    watchlistRemovePending: boolean
  }
}

export function buildAppOverlayPanelsControlProps({
  panelState,
  panelSetters,
  navigationActions,
  workspaceStatusModel,
  workspaceControlActions,
  dataState,
  pendingState,
}: BuildAppOverlayPanelsControlPropsArgs): Pick<
  AppOverlayPanelsProps,
  | 'statusInspectorState'
  | 'statusInspectorActions'
  | 'watchlistManagerState'
  | 'watchlistManagerActions'
  | 'schedulerControlsState'
  | 'schedulerControlsActions'
  | 'grafanaPreviewState'
  | 'grafanaPreviewActions'
> {
  const grafanaMetricsUrl = `${CONTROL_API_BASE}${dataState.grafanaStatus?.metrics_path ?? '/metrics'}`
  const grafanaPreviewNote =
    dataState.grafanaStatus?.note ?? 'Grafana 更适合系统监控，不建议直接替代主交易 K 线。'

  return {
    statusInspectorState: {
      open: panelState.statusInspectorOpen,
      statusCards: workspaceStatusModel.statusInspectorCards,
      latestCommand: workspaceStatusModel.latestSchedulerCommandBanner,
      messageCount: workspaceStatusModel.statusInspectorMessageCount,
      messages: workspaceStatusModel.statusInspectorMessages,
    },
    statusInspectorActions: {
      setOpen: panelSetters.setStatusInspectorOpen,
      onOpenSection: navigationActions.onOpenSection,
    },
    watchlistManagerState: {
      open: panelState.watchlistManagerOpen,
      draftSymbol: dataState.watchlistDraftSymbol,
      draftMarket: dataState.watchlistDraftMarket,
      submitPending: pendingState.watchlistAddPending,
      watchlist: dataState.watchlist,
      alertDrafts: dataState.watchlistAlertDrafts,
      controlsDisabled: dataState.watchlistControlsDisabled,
      removePending: pendingState.watchlistRemovePending,
    },
    watchlistManagerActions: {
      setOpen: panelSetters.setWatchlistManagerOpen,
      setDraftSymbol: panelSetters.setWatchlistDraftSymbol,
      setDraftMarket: panelSetters.setWatchlistDraftMarket,
      setAlertDrafts: panelSetters.setWatchlistAlertDrafts,
      onSubmit: workspaceControlActions.submitWatchlistItem,
      onUpdateAlertRule: workspaceControlActions.submitWatchlistAlertRule,
      onRemove: workspaceControlActions.removeWatchlistItem,
    },
    schedulerControlsState: {
      open: panelState.schedulerControlsOpen,
      currentJobId: dataState.snapshotScheduler?.current_job_id,
      publishGateLabel: workspaceStatusModel.schedulerControlsPublishGateLabel,
      schedulerStatusLabel: schedulerLabel(dataState.snapshotScheduler?.status ?? 'degraded'),
      serviceAvailable: dataState.serviceAvailable,
      pending: pendingState.schedulerMutationPending,
    },
    schedulerControlsActions: {
      setOpen: panelSetters.setSchedulerControlsOpen,
      setGrafanaPreviewOpen: panelSetters.setGrafanaPreviewOpen,
      onCancelAll: () => workspaceControlActions.runSchedulerCommand('cancel_all', '桌面端清空全部任务'),
      onFreezePublish: () =>
        workspaceControlActions.runSchedulerCommand('freeze_publish', '桌面端冻结自动发布'),
      onEnterManualOverride: () =>
        workspaceControlActions.runSchedulerCommand('enter_manual_override', '桌面端进入人工接管'),
    },
    grafanaPreviewState: {
      open: panelState.grafanaPreviewOpen,
      queueDepth: dataState.snapshotScheduler?.queue_depth ?? 0,
      schedulerStatusLabel: schedulerLabel(dataState.snapshotScheduler?.status ?? 'degraded'),
      pendingAlertsCount: dataState.pendingAlertsCount,
      metricsUrl: grafanaMetricsUrl,
      dashboardUrl: dataState.grafanaStatus?.dashboard_url,
      configured: Boolean(dataState.grafanaStatus?.configured),
      note: grafanaPreviewNote,
      metricsPreviewLines: dataState.metricsPreviewLines,
    },
    grafanaPreviewActions: {
      setOpen: panelSetters.setGrafanaPreviewOpen,
      onOpenMetrics: () => window.open(grafanaMetricsUrl, '_blank', 'noopener,noreferrer'),
      onOpenGrafana: () => {
        if (dataState.grafanaStatus?.dashboard_url) {
          window.open(dataState.grafanaStatus.dashboard_url, '_blank', 'noopener,noreferrer')
        }
      },
    },
  }
}

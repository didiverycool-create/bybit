import { useMemo } from 'react'
import type { Mode, SectionKey } from '../types'
import { buildControlDataQueryDerivedState } from './buildControlDataQueryDerivedState'
import { useControlOpsQueries } from './useControlOpsQueries'
import { useControlStatusQueries } from './useControlStatusQueries'
import { useControlStrategyQueries } from './useControlStrategyQueries'

type UseControlDataQueryModelArgs = {
  activeSection: SectionKey
  selectedMode: Mode
  selectedStrategyId: string | null
  selectedBacktestId: string | null
  backtestFilter: 'selected' | 'all'
  replayTrackingScope: 'all' | 'selected'
  strategyActivityPanelOpen: boolean
  grafanaPreviewOpen: boolean
  editingOrderId: string | null
}

export function useControlDataQueryModel({
  activeSection,
  selectedMode,
  selectedStrategyId,
  selectedBacktestId,
  backtestFilter,
  replayTrackingScope,
  strategyActivityPanelOpen,
  grafanaPreviewOpen,
  editingOrderId,
}: UseControlDataQueryModelArgs) {
  const controlStatusQueries = useControlStatusQueries({
    grafanaPreviewOpen,
  })
  const controlStrategyQueries = useControlStrategyQueries({
    activeSection,
    selectedMode,
    selectedStrategyId,
    selectedBacktestId,
    backtestFilter,
    replayTrackingScope,
    strategyActivityPanelOpen,
  })
  const controlOpsQueries = useControlOpsQueries({
    activeSection,
    editingOrderId,
  })

  const snapshot = controlStatusQueries.snapshotQuery.data
  const derivedState = useMemo(
    () =>
      buildControlDataQueryDerivedState({
        healthOk: Boolean(controlStatusQueries.healthQuery.data?.ok),
        settings: controlStatusQueries.settingsQuery.data,
        metricsPreviewText: controlStatusQueries.metricsPreviewQuery.data,
        snapshotLatestSchedulerCommand: snapshot?.latest_scheduler_command,
        schedulerLatestSchedulerCommand: controlOpsQueries.scheduler?.latest_scheduler_command,
        opsLiveLatestSchedulerCommand: controlOpsQueries.opsLive?.latest_scheduler_command,
        auditEvents: controlOpsQueries.auditEvents,
        bybitPublicStatus: controlStatusQueries.bybitPublicQuery.data,
      }),
    [
      controlOpsQueries.auditEvents,
      controlOpsQueries.opsLive?.latest_scheduler_command,
      controlOpsQueries.scheduler?.latest_scheduler_command,
      controlStatusQueries.bybitPublicQuery.data,
      controlStatusQueries.healthQuery.data?.ok,
      controlStatusQueries.metricsPreviewQuery.data,
      controlStatusQueries.settingsQuery.data,
      snapshot?.latest_scheduler_command,
    ],
  )
  const grafanaStatus = controlStatusQueries.grafanaQuery.data
  const settings = controlStatusQueries.settingsQuery.data
  const workspacePreferences = controlStatusQueries.workspaceQuery.data
  const openClawStatus = controlStatusQueries.openClawQuery.data
  const bybitPrivateStatus = controlStatusQueries.bybitPrivateQuery.data
  const bybitPublicStatus = controlStatusQueries.bybitPublicQuery.data

  return {
    ...controlStatusQueries,
    ...controlStrategyQueries,
    ...controlOpsQueries,
    bybitPrivateQuery: controlStatusQueries.bybitPrivateQuery,
    bybitPrivateStatus,
    bybitPublicIssueDiagnostics: derivedState.bybitPublicIssueDiagnostics,
    bybitPublicQuery: controlStatusQueries.bybitPublicQuery,
    bybitPublicStatus,
    bybitPublicVisibleDiagnostics: derivedState.bybitPublicVisibleDiagnostics,
    grafanaStatus,
    latestSchedulerCommand: derivedState.latestSchedulerCommand,
    metricsPreviewLines: derivedState.metricsPreviewLines,
    notificationQuietHoursActive: derivedState.notificationQuietHoursActive,
    openClawStatus,
    serviceAvailable: derivedState.serviceAvailable,
    settings,
    snapshot,
    workspacePreferences,
  }
}

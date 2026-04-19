import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppWorkspaceModelsArgsInput } from './buildAppWorkspaceModelsArgs'

export type BuildAlertsWorkspaceSurfaceArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildAlertsWorkspaceSurfaceArgs({
  source,
}: BuildAlertsWorkspaceSurfaceArgsInput): BuildAppWorkspaceModelsArgsInput['alertsWorkspace'] {
  const {
    opsLive,
    pendingAlertsCount,
    settings,
    alertSeverityFilter,
    alertStatusFilter,
    alertScopeFilter,
    selectedSymbol,
    filteredAlerts,
    workspaceControlActions,
  } = source

  return {
    summaryState: {
      pendingAlertsCount: opsLive?.summary.pending_alerts ?? pendingAlertsCount,
      p0AlertsCount: opsLive?.summary.p0_alerts ?? 0,
      notificationChannelsLabel: settings?.notification_channels.join(' / ') ?? '',
    },
    filterState: {
      alertSeverityFilter,
      alertStatusFilter,
      alertScopeFilter,
      selectedSymbol,
    },
    alertsState: {
      filteredAlerts,
      alertMutationPending: workspaceControlActions.alertMutationPending,
    },
  }
}

import { CONTROL_API_BASE } from '../api'
import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppWorkspaceModelsArgsInput } from './buildAppWorkspaceModelsArgs'

export type BuildSettingsWorkspaceSurfaceArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildSettingsWorkspaceSurfaceArgs({
  source,
}: BuildSettingsWorkspaceSurfaceArgsInput): BuildAppWorkspaceModelsArgsInput['settingsWorkspace'] {
  const {
    selectedMode,
    layoutPreset,
    serviceAvailable,
    runtimeWorkerNeedsRecovery,
    runtimeWorkerRestoreHint,
    runtimeWorkerStatus,
    snapshotExecutionHealth,
    workspaceMutationPending,
    selectedStrategy,
    settingsQuery,
    settingsDraftDirty,
    settingsDraft,
    settings,
    notificationQuietHoursActive,
    bybitPrivateStatus,
    openClawStatus,
    bybitPublicStatus,
    bybitPublicVisibleDiagnostics,
    grafanaStatus,
    workspaceControlActions,
  } = source

  const grafanaMetricsUrl = `${CONTROL_API_BASE}${grafanaStatus?.metrics_path ?? '/metrics'}`

  return {
    workspaceState: {
      workspaceDirty: source.workspaceDirty,
      selectedMode,
      layoutPreset,
      serviceAvailable,
      schedulerMutationPending: workspaceControlActions.schedulerMutationPending,
      currentSchedulerJobId: source.snapshot?.scheduler.current_job_id ?? null,
      schedulerFreezePublish: source.snapshot?.scheduler.freeze_publish,
      runtimeWorkerNeedsRecovery,
      runtimeWorkerRestartPending: workspaceControlActions.restartRuntimeWorkerPending,
      runtimeWorkerRestoreHint,
      runtimeWorkerStatus,
      snapshotExecutionHealth,
      workspaceMutationPending,
      selectedStrategy,
    },
    settingsState: {
      settingsMutationPending: workspaceControlActions.settingsMutationPending,
      settingsQueryLoading: settingsQuery.isLoading,
      settingsDraftDirty,
      settingsDraft,
      settings,
      notificationQuietHoursActive,
      bybitPrivateStatus,
      openClawStatus,
      bybitPublicStatus,
      bybitPublicVisibleDiagnostics,
      grafanaStatus,
      grafanaMetricsUrl,
    },
  }
}

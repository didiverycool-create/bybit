import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useDesktopNotificationEffects } from './useDesktopNotificationEffects'
import type { useDesktopUiActions } from './useDesktopUiActions'
import type { useRuntimeAndSettingsModel } from './useRuntimeAndSettingsModel'

type BuildDesktopNotificationEffectsArgs = Parameters<typeof useDesktopNotificationEffects>[0]
type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>
type RuntimeAndSettingsModel = ReturnType<typeof useRuntimeAndSettingsModel>
type DesktopUiActions = ReturnType<typeof useDesktopUiActions>

export type BuildDesktopNotificationEffectsArgsInput =
  AppWorkspaceBootstrapState &
  ControlDataQueryModel &
  RuntimeAndSettingsModel &
  DesktopUiActions

export function buildDesktopNotificationEffectsArgs({
  desktopNotificationsEnabled,
  alertsNotificationBootstrapReady,
  jobsNotificationBootstrapReady,
  opsNotificationBootstrapReady,
  alerts,
  scheduler,
  auditEvents,
  notificationBootstrapRef,
  seenAlertNotificationIdsRef,
  seenAgentJobStatusRef,
  seenOpsNotificationIdsRef,
  lastSchedulerStatusRef,
  dispatchDesktopNotification,
}: BuildDesktopNotificationEffectsArgsInput): BuildDesktopNotificationEffectsArgs {
  return {
    desktopNotificationsEnabled,
    alertsNotificationBootstrapReady,
    jobsNotificationBootstrapReady,
    opsNotificationBootstrapReady,
    alerts,
    schedulerJobs: scheduler?.jobs ?? [],
    schedulerState: scheduler?.scheduler ?? null,
    auditEvents,
    notificationBootstrapRef,
    seenAlertNotificationIdsRef,
    seenAgentJobStatusRef,
    seenOpsNotificationIdsRef,
    lastSchedulerStatusRef,
    dispatchDesktopNotification,
  }
}

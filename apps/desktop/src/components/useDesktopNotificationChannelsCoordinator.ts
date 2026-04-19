import { useDesktopNotificationAlertsEffects } from './useDesktopNotificationEffectsAlerts'
import { useDesktopNotificationOpsEffects } from './useDesktopNotificationEffectsOps'
import type { UseDesktopNotificationEffectsArgs } from './useDesktopNotificationEffects.types'
import { useDesktopNotificationStatusEffects } from './useDesktopNotificationStatusEffects'

export function useDesktopNotificationChannelsCoordinator({
  desktopNotificationsEnabled,
  alertsNotificationBootstrapReady,
  jobsNotificationBootstrapReady,
  opsNotificationBootstrapReady,
  alerts,
  schedulerJobs,
  schedulerState,
  auditEvents,
  notificationBootstrapRef,
  seenAlertNotificationIdsRef,
  seenAgentJobStatusRef,
  seenOpsNotificationIdsRef,
  lastSchedulerStatusRef,
  dispatchDesktopNotification,
}: UseDesktopNotificationEffectsArgs) {
  useDesktopNotificationAlertsEffects({
    desktopNotificationsEnabled,
    alertsNotificationBootstrapReady,
    alerts,
    notificationBootstrapRef,
    seenAlertNotificationIdsRef,
    dispatchDesktopNotification,
  })
  useDesktopNotificationStatusEffects({
    desktopNotificationsEnabled,
    jobsNotificationBootstrapReady,
    schedulerJobs,
    schedulerState,
    notificationBootstrapRef,
    seenAgentJobStatusRef,
    lastSchedulerStatusRef,
    dispatchDesktopNotification,
  })
  useDesktopNotificationOpsEffects({
    desktopNotificationsEnabled,
    opsNotificationBootstrapReady,
    auditEvents,
    notificationBootstrapRef,
    seenOpsNotificationIdsRef,
    dispatchDesktopNotification,
  })
}

import type { UseDesktopNotificationEffectsArgs } from './useDesktopNotificationEffects.types'
import { useDesktopNotificationJobsEffects } from './useDesktopNotificationEffectsJobs'
import { useDesktopNotificationSchedulerEffects } from './useDesktopNotificationEffectsScheduler'

type UseDesktopNotificationStatusEffectsArgs = Pick<
  UseDesktopNotificationEffectsArgs,
  | 'desktopNotificationsEnabled'
  | 'jobsNotificationBootstrapReady'
  | 'schedulerJobs'
  | 'schedulerState'
  | 'notificationBootstrapRef'
  | 'seenAgentJobStatusRef'
  | 'lastSchedulerStatusRef'
  | 'dispatchDesktopNotification'
>

export function useDesktopNotificationStatusEffects({
  desktopNotificationsEnabled,
  jobsNotificationBootstrapReady,
  schedulerJobs,
  schedulerState,
  notificationBootstrapRef,
  seenAgentJobStatusRef,
  lastSchedulerStatusRef,
  dispatchDesktopNotification,
}: UseDesktopNotificationStatusEffectsArgs) {
  useDesktopNotificationJobsEffects({
    desktopNotificationsEnabled,
    jobsNotificationBootstrapReady,
    schedulerJobs,
    notificationBootstrapRef,
    seenAgentJobStatusRef,
    dispatchDesktopNotification,
  })
  useDesktopNotificationSchedulerEffects({
    desktopNotificationsEnabled,
    schedulerState,
    notificationBootstrapRef,
    lastSchedulerStatusRef,
    dispatchDesktopNotification,
  })
}

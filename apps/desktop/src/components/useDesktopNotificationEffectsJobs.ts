import { useEffect } from 'react'

import {
  buildInitialSeenAgentJobStatuses,
  resolveAgentJobStatusNotifications,
} from './desktopNotificationJobStatusHelpers'
import type { DesktopNotificationJobsEffectsArgs } from './useDesktopNotificationEffects.types'

export function useDesktopNotificationJobsEffects({
  desktopNotificationsEnabled,
  jobsNotificationBootstrapReady,
  schedulerJobs,
  notificationBootstrapRef,
  seenAgentJobStatusRef,
  dispatchDesktopNotification,
}: DesktopNotificationJobsEffectsArgs) {
  useEffect(() => {
    if (!desktopNotificationsEnabled || !jobsNotificationBootstrapReady) {
      return
    }

    if (!notificationBootstrapRef.current.jobs) {
      seenAgentJobStatusRef.current = buildInitialSeenAgentJobStatuses(schedulerJobs)
      notificationBootstrapRef.current.jobs = true
      return
    }

    const { nextStatuses, notifications } = resolveAgentJobStatusNotifications(
      schedulerJobs,
      seenAgentJobStatusRef.current,
    )
    seenAgentJobStatusRef.current = nextStatuses

    notifications.forEach((notification) => {
      void dispatchDesktopNotification(notification)
    })
  }, [
    desktopNotificationsEnabled,
    dispatchDesktopNotification,
    jobsNotificationBootstrapReady,
    notificationBootstrapRef,
    schedulerJobs,
    seenAgentJobStatusRef,
  ])
}

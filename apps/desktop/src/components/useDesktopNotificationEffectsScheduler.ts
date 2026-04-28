import { useEffect } from 'react'

import { resolveSchedulerStatusNotification } from './desktopNotificationSchedulerStatusHelpers'
import type { DesktopNotificationSchedulerEffectsArgs } from './useDesktopNotificationEffects.types'

export function useDesktopNotificationSchedulerEffects({
  desktopNotificationsEnabled,
  schedulerState,
  notificationBootstrapRef,
  lastSchedulerStatusRef,
  dispatchDesktopNotification,
}: DesktopNotificationSchedulerEffectsArgs) {
  useEffect(() => {
    if (!desktopNotificationsEnabled) {
      return
    }

    const nextStatus = schedulerState?.status
    if (!nextStatus) {
      return
    }

    if (!notificationBootstrapRef.current.scheduler) {
      lastSchedulerStatusRef.current = nextStatus
      notificationBootstrapRef.current.scheduler = true
      return
    }

    const previousStatus = lastSchedulerStatusRef.current
    lastSchedulerStatusRef.current = nextStatus

    const notification = resolveSchedulerStatusNotification(previousStatus, schedulerState)
    if (notification) {
      void dispatchDesktopNotification(notification)
    }
  }, [
    desktopNotificationsEnabled,
    dispatchDesktopNotification,
    lastSchedulerStatusRef,
    notificationBootstrapRef,
    schedulerState,
  ])
}

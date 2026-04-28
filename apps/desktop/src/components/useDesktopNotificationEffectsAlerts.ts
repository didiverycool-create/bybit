import { buildAlertNotification } from '../utils/app-helpers'
import type {
  DesktopNotificationAlertsEffectsArgs,
} from './useDesktopNotificationEffects.types'
import { useDesktopNotificationTrackedFeedEffect } from './useDesktopNotificationTrackedFeedEffect'

const getAlertNotificationId = (alert: DesktopNotificationAlertsEffectsArgs['alerts'][number]) => alert.id

export function useDesktopNotificationAlertsEffects({
  desktopNotificationsEnabled,
  alertsNotificationBootstrapReady,
  alerts,
  notificationBootstrapRef,
  seenAlertNotificationIdsRef,
  dispatchDesktopNotification,
}: DesktopNotificationAlertsEffectsArgs) {
  const importantAlerts = alerts.filter(
    (alert) => !alert.acknowledged && (alert.severity === 'P0' || alert.severity === 'P1'),
  )

  useDesktopNotificationTrackedFeedEffect({
    desktopNotificationsEnabled,
    bootstrapReady: alertsNotificationBootstrapReady,
    items: importantAlerts,
    notificationBootstrapRef,
    seenIdsRef: seenAlertNotificationIdsRef,
    bootstrapKey: 'alerts',
    dispatchDesktopNotification,
    getId: getAlertNotificationId,
    buildNotification: buildAlertNotification,
  })
}

import { useEffect } from 'react'

import type {
  DesktopNotificationDispatcher,
  NotificationBootstrapRef,
  SeenAlertNotificationIdsRef,
  SeenOpsNotificationIdsRef,
  UseDesktopNotificationTrackedFeedEffectArgs,
} from './useDesktopNotificationEffects.types'

type SeenIdsRef = SeenAlertNotificationIdsRef | SeenOpsNotificationIdsRef

type TrackedBootstrapKey = 'alerts' | 'ops'

type NotificationPayload = Parameters<DesktopNotificationDispatcher>[0]

type TrackedFeedEffectArgs<TItem> = UseDesktopNotificationTrackedFeedEffectArgs<TItem> & {
  notificationBootstrapRef: NotificationBootstrapRef
  seenIdsRef: SeenIdsRef
  bootstrapKey: TrackedBootstrapKey
  dispatchDesktopNotification: DesktopNotificationDispatcher
  getId: (item: TItem) => string
  buildNotification: (item: TItem) => NotificationPayload
}

export function useDesktopNotificationTrackedFeedEffect<TItem>({
  desktopNotificationsEnabled,
  bootstrapReady,
  items,
  notificationBootstrapRef,
  seenIdsRef,
  bootstrapKey,
  dispatchDesktopNotification,
  getId,
  buildNotification,
}: TrackedFeedEffectArgs<TItem>) {
  useEffect(() => {
    if (!desktopNotificationsEnabled || !bootstrapReady) {
      return
    }

    if (!notificationBootstrapRef.current[bootstrapKey]) {
      items.forEach((item) => {
        seenIdsRef.current.add(getId(item))
      })
      notificationBootstrapRef.current[bootstrapKey] = true
      return
    }

    items.forEach((item) => {
      const itemId = getId(item)
      if (seenIdsRef.current.has(itemId)) {
        return
      }
      seenIdsRef.current.add(itemId)
      void dispatchDesktopNotification(buildNotification(item))
    })
  }, [
    bootstrapKey,
    bootstrapReady,
    buildNotification,
    desktopNotificationsEnabled,
    dispatchDesktopNotification,
    getId,
    items,
    notificationBootstrapRef,
    seenIdsRef,
  ])
}

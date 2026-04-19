import { buildOpsEventNotification } from '../utils/app-helpers'
import type { DesktopNotificationOpsEffectsArgs } from './useDesktopNotificationEffects.types'
import { useDesktopNotificationTrackedFeedEffect } from './useDesktopNotificationTrackedFeedEffect'

const INTERESTING_OPS_EVENT_TYPES = new Set([
  'exchange_order.created',
  'exchange_order.replaced',
  'exchange_order.cancelled',
  'exchange_order.cancelled_all',
  'exchange_position.close_submitted',
  'exchange_position.close_all_submitted',
  'strategy.exchange_order.submitted',
  'strategy.paper_trade.executed_manual',
  'paper_order.filled',
  'paper_order.cancelled_all',
  'manual_trade.positions_closed_all',
])

const getOpsNotificationId = (event: DesktopNotificationOpsEffectsArgs['auditEvents'][number]) => event.id

export function useDesktopNotificationOpsEffects({
  desktopNotificationsEnabled,
  opsNotificationBootstrapReady,
  auditEvents,
  notificationBootstrapRef,
  seenOpsNotificationIdsRef,
  dispatchDesktopNotification,
}: DesktopNotificationOpsEffectsArgs) {
  const interestingEvents = auditEvents.filter((event) => INTERESTING_OPS_EVENT_TYPES.has(event.event_type))

  useDesktopNotificationTrackedFeedEffect({
    desktopNotificationsEnabled,
    bootstrapReady: opsNotificationBootstrapReady,
    items: interestingEvents,
    notificationBootstrapRef,
    seenIdsRef: seenOpsNotificationIdsRef,
    bootstrapKey: 'ops',
    dispatchDesktopNotification,
    getId: getOpsNotificationId,
    buildNotification: buildOpsEventNotification,
  })
}

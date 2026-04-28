import type { AlertRecord, Mode, OrderRecord } from '../types'
import { orderActivitySummary, orderAppearsActive } from '../utils/app-helpers'

type ResolveStrategyActivityActiveOrderStateArgs = {
  selectedMode: Mode
  strategyActivityActiveOrders: OrderRecord[]
  latestActiveOrderRecord: OrderRecord | null
  activityLatestOrder: OrderRecord | null
  activityLatestAlert: AlertRecord | null
  activityLatestPendingAlert: AlertRecord | null
  activityLatestHistoricalOrder: OrderRecord | null
}

export function resolveStrategyActivityActiveOrderState({
  selectedMode,
  strategyActivityActiveOrders,
  latestActiveOrderRecord,
  activityLatestOrder,
  activityLatestAlert,
  activityLatestPendingAlert,
  activityLatestHistoricalOrder,
}: ResolveStrategyActivityActiveOrderStateArgs) {
  const activityLatestActiveOrder = latestActiveOrderRecord ?? strategyActivityActiveOrders[0] ?? null
  const activityLatestActiveOrderSummary = activityLatestActiveOrder
    ? `${orderActivitySummary(activityLatestActiveOrder)} · ${activityLatestActiveOrder.status}`
    : null
  const activityLatestActiveOrderEditable = Boolean(
    activityLatestActiveOrder &&
      ((activityLatestActiveOrder.source === 'paper' && selectedMode === 'paper') ||
        (activityLatestActiveOrder.source === 'bybit_private' && selectedMode !== 'paper')),
  )
  const activityLatestActiveOrderCancellable =
    activityLatestActiveOrderEditable && orderAppearsActive(activityLatestActiveOrder)

  return {
    activityLatestActiveOrder,
    activityLatestActiveOrderSummary,
    activityLatestActiveOrderEditable,
    activityLatestActiveOrderCancellable,
    activityLatestActiveOrderDiffersFromLatest: Boolean(
      activityLatestActiveOrder && activityLatestActiveOrder.order_id !== activityLatestOrder?.order_id,
    ),
    activityLatestPendingAlertDiffersFromLatest: Boolean(
      activityLatestPendingAlert && activityLatestPendingAlert.id !== activityLatestAlert?.id,
    ),
    activityLatestHistoricalOrderDiffersFromLatest: Boolean(
      activityLatestHistoricalOrder && activityLatestHistoricalOrder.order_id !== activityLatestOrder?.order_id,
    ),
    activityLatestOrderActionLabelPrefix:
      activityLatestActiveOrder && activityLatestActiveOrder.order_id === activityLatestOrder?.order_id
        ? '最新'
        : '当前',
  }
}

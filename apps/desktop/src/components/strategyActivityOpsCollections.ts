import type { AlertRecord, ExecutionEvent, OrderRecord, TradeRecord } from '../types'
import { orderAppearsActive, prependUniqueActivityItem } from '../utils/app-helpers'

type BuildStrategyActivityOpsCollectionsArgs = {
  activityAlerts: AlertRecord[]
  activityEvents: ExecutionEvent[]
  activityOrders: OrderRecord[]
  activityTrades: TradeRecord[]
  activityActiveOrders: OrderRecord[]
  latestAlertRecord: AlertRecord | null
  latestPendingAlertRecord: AlertRecord | null
  latestAuditEventRecord: ExecutionEvent | null
  latestHistoricalOrderRecord: OrderRecord | null
  latestTradeRecord: TradeRecord | null
  latestActiveOrderRecord: OrderRecord | null
}

function isSupplementedById<T extends { [key: string]: unknown }>(
  collection: T[],
  record: T | null,
  getId: (item: T) => string | null | undefined,
): boolean {
  if (!record) {
    return false
  }
  return !collection.some((item) => getId(item) === getId(record))
}

export function buildStrategyActivityAlerts(
  alerts: AlertRecord[],
  latestAlertRecord: AlertRecord | null,
  latestPendingAlertRecord: AlertRecord | null,
) {
  return prependUniqueActivityItem(
    prependUniqueActivityItem(alerts, latestAlertRecord, (alert) => alert.id, 8),
    latestPendingAlertRecord,
    (alert) => alert.id,
    8,
  )
}

export function buildStrategyActivityAuditEvents(
  auditEvents: ExecutionEvent[],
  latestAuditEventRecord: ExecutionEvent | null,
) {
  if (!latestAuditEventRecord || auditEvents.some((event) => event.id === latestAuditEventRecord.id)) {
    return auditEvents
  }
  return [latestAuditEventRecord, ...auditEvents.slice(0, 7)]
}

export function buildStrategyActivityOrders(
  orders: OrderRecord[],
  latestHistoricalOrderRecord: OrderRecord | null,
) {
  if (!latestHistoricalOrderRecord || orders.some((order) => order.order_id === latestHistoricalOrderRecord.order_id)) {
    return orders
  }
  return [latestHistoricalOrderRecord, ...orders.slice(0, 7)]
}

export function buildStrategyActivityTrades(
  trades: TradeRecord[],
  latestTradeRecord: TradeRecord | null,
) {
  if (!latestTradeRecord || trades.some((trade) => trade.id === latestTradeRecord.id)) {
    return trades
  }
  return [latestTradeRecord, ...trades.slice(0, 7)]
}

export function buildStrategyActivityActiveOrders(
  activeOrders: OrderRecord[],
  latestActiveOrderRecord: OrderRecord | null,
) {
  if (!orderAppearsActive(latestActiveOrderRecord)) {
    return activeOrders
  }
  if (activeOrders.some((order) => order.order_id === latestActiveOrderRecord.order_id)) {
    return activeOrders
  }
  return [latestActiveOrderRecord, ...activeOrders.slice(0, 19)]
}

export function buildStrategyActivityOpsCollections({
  activityAlerts,
  activityEvents,
  activityOrders,
  activityTrades,
  activityActiveOrders,
  latestAlertRecord,
  latestPendingAlertRecord,
  latestAuditEventRecord,
  latestHistoricalOrderRecord,
  latestTradeRecord,
  latestActiveOrderRecord,
}: BuildStrategyActivityOpsCollectionsArgs) {
  return {
    strategyActivityAlerts: buildStrategyActivityAlerts(activityAlerts, latestAlertRecord, latestPendingAlertRecord),
    strategyActivityAuditEvents: buildStrategyActivityAuditEvents(activityEvents, latestAuditEventRecord),
    strategyActivityOrders: buildStrategyActivityOrders(activityOrders, latestHistoricalOrderRecord),
    strategyActivityTrades: buildStrategyActivityTrades(activityTrades, latestTradeRecord),
    strategyActivityActiveOrders: buildStrategyActivityActiveOrders(activityActiveOrders, latestActiveOrderRecord),
  }
}

export function buildStrategyActivityOpsSupplementedFlags({
  activityAlerts,
  activityEvents,
  activityOrders,
  activityTrades,
  activityActiveOrders,
  latestAlertRecord,
  latestPendingAlertRecord,
  latestAuditEventRecord,
  latestHistoricalOrderRecord,
  latestTradeRecord,
  latestActiveOrderRecord,
}: BuildStrategyActivityOpsCollectionsArgs) {
  return {
    strategyActivityLatestAlertSupplemented: isSupplementedById(activityAlerts, latestAlertRecord, (item) => item.id),
    strategyActivityLatestPendingAlertSupplemented: isSupplementedById(
      activityAlerts,
      latestPendingAlertRecord,
      (item) => item.id,
    ),
    strategyActivityLatestAuditSupplemented: isSupplementedById(
      activityEvents,
      latestAuditEventRecord,
      (item) => item.id,
    ),
    strategyActivityLatestHistoricalOrderSupplemented: isSupplementedById(
      activityOrders,
      latestHistoricalOrderRecord,
      (item) => item.order_id,
    ),
    strategyActivityLatestTradeSupplemented: isSupplementedById(
      activityTrades,
      latestTradeRecord,
      (item) => item.id,
    ),
    strategyActivityLatestActiveOrderSupplemented: isSupplementedById(
      activityActiveOrders,
      latestActiveOrderRecord,
      (item) => item.order_id,
    ),
  }
}

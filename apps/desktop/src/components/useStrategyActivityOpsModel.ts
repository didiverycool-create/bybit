import { useMemo } from 'react'

import type { Mode, StrategyActivitySnapshot } from '../types'
import {
  getAuditBacktestId,
  getAuditChangeRequestId,
  getAuditJobId,
  getAuditLinkedReviewId,
  getAuditSourceBacktestId,
  getAuditSourceProposalId,
  getAuditSourceReviewId,
  getAuditStrategyId,
  orderActivitySummary,
  orderAppearsActive,
  pickLatestKeyAuditEvent,
  prependUniqueActivityItem,
  strategyActivityLatestAlertSummary,
  strategyActivityLatestAuditSummary,
  strategyActivityLatestHistoricalOrderSummary,
  strategyActivityLatestOrderSummary,
  strategyActivityLatestPendingAlertSummary,
  strategyActivityLatestTradeSummary,
} from '../utils/app-helpers'

type UseStrategyActivityOpsModelArgs = {
  selectedStrategyActivity?: StrategyActivitySnapshot | null
  selectedMode: Mode
}

export function useStrategyActivityOpsModel({
  selectedStrategyActivity,
  selectedMode,
}: UseStrategyActivityOpsModelArgs) {
  const strategyActivityAlerts = useMemo(() => {
    const activityAlerts = selectedStrategyActivity?.recent_alerts ?? []
    const latestAlertRecord = selectedStrategyActivity?.latest_alert_record ?? null
    const latestPendingAlertRecord = selectedStrategyActivity?.latest_pending_alert_record ?? null
    return prependUniqueActivityItem(
      prependUniqueActivityItem(activityAlerts, latestAlertRecord, (alert) => alert.id, 8),
      latestPendingAlertRecord,
      (alert) => alert.id,
      8,
    )
  }, [
    selectedStrategyActivity?.recent_alerts,
    selectedStrategyActivity?.latest_alert_record,
    selectedStrategyActivity?.latest_pending_alert_record,
  ])

  const strategyActivityAuditEvents = useMemo(() => {
    const activityEvents = selectedStrategyActivity?.recent_audit_events ?? []
    const latestAuditRecord = selectedStrategyActivity?.latest_audit_event_record ?? null
    if (!latestAuditRecord || activityEvents.some((event) => event.id === latestAuditRecord.id)) {
      return activityEvents
    }
    return [latestAuditRecord, ...activityEvents.slice(0, 7)]
  }, [selectedStrategyActivity?.recent_audit_events, selectedStrategyActivity?.latest_audit_event_record])

  const strategyActivityOrders = useMemo(() => {
    const activityOrders = selectedStrategyActivity?.recent_orders ?? []
    const latestHistoricalOrderRecord = selectedStrategyActivity?.latest_historical_order_record ?? null
    if (
      !latestHistoricalOrderRecord ||
      activityOrders.some((order) => order.order_id === latestHistoricalOrderRecord.order_id)
    ) {
      return activityOrders
    }
    return [latestHistoricalOrderRecord, ...activityOrders.slice(0, 7)]
  }, [selectedStrategyActivity?.recent_orders, selectedStrategyActivity?.latest_historical_order_record])

  const strategyActivityTrades = useMemo(() => {
    const activityTrades = selectedStrategyActivity?.recent_trades ?? []
    const latestTradeRecord = selectedStrategyActivity?.latest_trade_record ?? null
    if (!latestTradeRecord || activityTrades.some((trade) => trade.id === latestTradeRecord.id)) {
      return activityTrades
    }
    return [latestTradeRecord, ...activityTrades.slice(0, 7)]
  }, [selectedStrategyActivity?.recent_trades, selectedStrategyActivity?.latest_trade_record])

  const activityLatestAuditEvent =
    strategyActivityAuditEvents[0] ??
    selectedStrategyActivity?.latest_audit_event_record ??
    pickLatestKeyAuditEvent(selectedStrategyActivity?.recent_audit_events ?? [])
  const activityLatestAlert = strategyActivityAlerts[0] ?? selectedStrategyActivity?.latest_alert_record ?? null
  const activityLatestPendingAlert =
    selectedStrategyActivity?.latest_pending_alert_record ??
    strategyActivityAlerts.find((alert) => !alert.acknowledged) ??
    null
  const activityLatestHistoricalOrder =
    strategyActivityOrders[0] ?? selectedStrategyActivity?.latest_historical_order_record ?? null
  const activityLatestOrder = selectedStrategyActivity?.latest_order_record ?? activityLatestHistoricalOrder ?? null
  const activityLatestTrade = strategyActivityTrades[0] ?? selectedStrategyActivity?.latest_trade_record ?? null
  const activityLatestAuditSummary = strategyActivityLatestAuditSummary(
    selectedStrategyActivity,
    activityLatestAuditEvent,
  )
  const activityLatestAlertSummary = strategyActivityLatestAlertSummary(selectedStrategyActivity, activityLatestAlert)
  const activityLatestPendingAlertSummary = strategyActivityLatestPendingAlertSummary(
    selectedStrategyActivity,
    activityLatestPendingAlert,
  )
  const activityLatestOrderSummary = strategyActivityLatestOrderSummary(selectedStrategyActivity, activityLatestOrder)
  const activityLatestHistoricalOrderSummary = strategyActivityLatestHistoricalOrderSummary(
    selectedStrategyActivity,
    activityLatestHistoricalOrder,
  )
  const activityLatestTradeSummary = strategyActivityLatestTradeSummary(selectedStrategyActivity, activityLatestTrade)
  const activityLatestAuditStrategyId =
    (activityLatestAuditEvent ? getAuditStrategyId(activityLatestAuditEvent.payload) : null) ??
    selectedStrategyActivity?.strategy_id ??
    null
  const activityLatestAuditJobId = activityLatestAuditEvent ? getAuditJobId(activityLatestAuditEvent.payload) : null
  const activityLatestAuditLinkedReviewId = activityLatestAuditEvent
    ? getAuditLinkedReviewId(activityLatestAuditEvent.payload)
    : null
  const activityLatestAuditChangeRequestId = activityLatestAuditEvent
    ? getAuditChangeRequestId(activityLatestAuditEvent.payload)
    : null
  const activityLatestAuditBacktestId = activityLatestAuditEvent
    ? getAuditBacktestId(activityLatestAuditEvent.payload)
    : null
  const activityLatestAuditSourceBacktestId = activityLatestAuditEvent
    ? getAuditSourceBacktestId(activityLatestAuditEvent.payload)
    : null
  const activityLatestAuditSourceReviewId = activityLatestAuditEvent
    ? getAuditSourceReviewId(activityLatestAuditEvent.payload)
    : null
  const activityLatestAuditSourceProposalId = activityLatestAuditEvent
    ? getAuditSourceProposalId(activityLatestAuditEvent.payload)
    : null
  const activityLatestActiveOrderRecord = selectedStrategyActivity?.latest_active_order_record ?? null

  const strategyActivityActiveOrders = useMemo(() => {
    const activeOrders = selectedStrategyActivity?.active_orders ?? []
    if (!orderAppearsActive(activityLatestActiveOrderRecord)) {
      return activeOrders
    }
    if (activeOrders.some((order) => order.order_id === activityLatestActiveOrderRecord?.order_id)) {
      return activeOrders
    }
    return [activityLatestActiveOrderRecord!, ...activeOrders.slice(0, 19)]
  }, [selectedStrategyActivity?.active_orders, activityLatestActiveOrderRecord])

  const activityLatestActiveOrder = activityLatestActiveOrderRecord ?? strategyActivityActiveOrders[0] ?? null
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
  const activityLatestActiveOrderDiffersFromLatest = Boolean(
    activityLatestActiveOrder && activityLatestActiveOrder.order_id !== activityLatestOrder?.order_id,
  )
  const activityLatestPendingAlertDiffersFromLatest = Boolean(
    activityLatestPendingAlert && activityLatestPendingAlert.id !== activityLatestAlert?.id,
  )
  const activityLatestHistoricalOrderDiffersFromLatest = Boolean(
    activityLatestHistoricalOrder && activityLatestHistoricalOrder.order_id !== activityLatestOrder?.order_id,
  )
  const activityLatestOrderActionLabelPrefix =
    activityLatestActiveOrder && activityLatestActiveOrder.order_id === activityLatestOrder?.order_id ? '最新' : '当前'

  return {
    strategyActivityAlerts,
    strategyActivityAuditEvents,
    strategyActivityOrders,
    strategyActivityTrades,
    strategyActivityActiveOrders,
    strategyActivityLatestAlertSupplemented: Boolean(
      selectedStrategyActivity?.latest_alert_record &&
        !(selectedStrategyActivity?.recent_alerts ?? []).some(
          (alert) => alert.id === selectedStrategyActivity.latest_alert_record?.id,
        ),
    ),
    strategyActivityLatestPendingAlertSupplemented: Boolean(
      selectedStrategyActivity?.latest_pending_alert_record &&
        !(selectedStrategyActivity?.recent_alerts ?? []).some(
          (alert) => alert.id === selectedStrategyActivity.latest_pending_alert_record?.id,
        ),
    ),
    strategyActivityLatestAuditSupplemented: Boolean(
      selectedStrategyActivity?.latest_audit_event_record &&
        !(selectedStrategyActivity?.recent_audit_events ?? []).some(
          (event) => event.id === selectedStrategyActivity.latest_audit_event_record?.id,
        ),
    ),
    strategyActivityLatestHistoricalOrderSupplemented: Boolean(
      selectedStrategyActivity?.latest_historical_order_record &&
        !(selectedStrategyActivity?.recent_orders ?? []).some(
          (order) => order.order_id === selectedStrategyActivity.latest_historical_order_record?.order_id,
        ),
    ),
    strategyActivityLatestTradeSupplemented: Boolean(
      selectedStrategyActivity?.latest_trade_record &&
        !(selectedStrategyActivity?.recent_trades ?? []).some(
          (trade) => trade.id === selectedStrategyActivity.latest_trade_record?.id,
        ),
    ),
    strategyActivityLatestActiveOrderSupplemented: Boolean(
      activityLatestActiveOrderRecord &&
        !(selectedStrategyActivity?.active_orders ?? []).some(
          (order) => order.order_id === activityLatestActiveOrderRecord.order_id,
        ),
    ),
    activityLatestAuditEvent,
    activityLatestAlert,
    activityLatestPendingAlert,
    activityLatestHistoricalOrder,
    activityLatestOrder,
    activityLatestTrade,
    activityLatestAuditSummary,
    activityLatestAlertSummary,
    activityLatestPendingAlertSummary,
    activityLatestOrderSummary,
    activityLatestHistoricalOrderSummary,
    activityLatestTradeSummary,
    activityLatestAuditStrategyId,
    activityLatestAuditJobId,
    activityLatestAuditLinkedReviewId,
    activityLatestAuditChangeRequestId,
    activityLatestAuditBacktestId,
    activityLatestAuditSourceBacktestId,
    activityLatestAuditSourceReviewId,
    activityLatestAuditSourceProposalId,
    activityLatestActiveOrderRecord,
    activityLatestActiveOrder,
    activityLatestActiveOrderSummary,
    activityLatestActiveOrderEditable,
    activityLatestActiveOrderCancellable,
    activityLatestActiveOrderDiffersFromLatest,
    activityLatestPendingAlertDiffersFromLatest,
    activityLatestHistoricalOrderDiffersFromLatest,
    activityLatestOrderActionLabelPrefix,
  }
}

import type { AlertRecord, ExecutionEvent, OrderRecord, StrategyActivitySnapshot, TradeRecord } from '../types'
import {
  orderActivitySummary,
  summarizeAuditEvent,
  tradeActivitySummary,
} from '../utils/app-helpers'
import { resolveStrategyActivityLatestOps } from './strategyActivitySelectorBase'
import {
  preferStrategyActivityLatestPriority,
} from './strategyActivitySelectorPriority'

export type StrategyActivityOpsSources = {
  latestActiveOrderRecord: OrderRecord | null
  latestHistoricalOrderRecord: OrderRecord | null
  latestOrderRecord: OrderRecord | null
  latestPendingAlertRecord: AlertRecord | null
  latestTradeRecord: TradeRecord | null
  latestAlertRecord: AlertRecord | null
  latestAuditEventRecord: ExecutionEvent | null
}

export function resolveStrategyActivityOpsSources(activity?: StrategyActivitySnapshot | null) {
  const latestOps = resolveStrategyActivityLatestOps(activity)
  return {
    latestActiveOrderRecord: preferStrategyActivityLatestPriority(
      latestOps?.latest_active_order_record,
    ),
    latestHistoricalOrderRecord: preferStrategyActivityLatestPriority(
      latestOps?.latest_historical_order_record,
    ),
    latestOrderRecord: preferStrategyActivityLatestPriority(
      latestOps?.latest_order_record,
    ),
    latestPendingAlertRecord: preferStrategyActivityLatestPriority(
      latestOps?.latest_pending_alert_record,
    ),
    latestTradeRecord: preferStrategyActivityLatestPriority(
      latestOps?.latest_trade_record,
    ),
    latestAlertRecord: preferStrategyActivityLatestPriority(
      latestOps?.latest_alert_record,
    ),
    latestAuditEventRecord: preferStrategyActivityLatestPriority(
      latestOps?.latest_audit_event_record,
    ),
  } satisfies StrategyActivityOpsSources
}

export type StrategyActivityOpsSummaries = {
  latestOrderSummary: string | null
  latestHistoricalOrderSummary: string | null
  latestTradeSummary: string | null
  latestAlertSummary: string | null
  latestPendingAlertSummary: string | null
  latestAuditSummary: string | null
}

function joinAlertSummaryDetail(alert?: AlertRecord | null) {
  return [alert?.description, alert?.suggested_action].filter(Boolean).join(' · ')
}

export function resolveStrategyActivityOpsSummaries(
  activity?: StrategyActivitySnapshot | null,
): StrategyActivityOpsSummaries {
  const latestOps = resolveStrategyActivityLatestOps(activity)
  const latestOrderRecord =
    preferStrategyActivityLatestPriority(
      latestOps?.latest_order_record,
      activity?.recent_orders[0],
    )
  const latestHistoricalOrderRecord =
    preferStrategyActivityLatestPriority(
      latestOps?.latest_historical_order_record,
      activity?.recent_orders[0],
    )
  const latestTradeRecord =
    preferStrategyActivityLatestPriority(
      latestOps?.latest_trade_record,
      activity?.recent_trades[0],
    )
  const latestAlertRecord =
    preferStrategyActivityLatestPriority(
      latestOps?.latest_alert_record,
      activity?.recent_alerts[0],
    )
  const latestPendingAlertRecord =
    preferStrategyActivityLatestPriority(
      latestOps?.latest_pending_alert_record,
      activity?.recent_alerts.find((item) => !item.acknowledged),
    )
  const latestAuditEventRecord =
    preferStrategyActivityLatestPriority(
      latestOps?.latest_audit_event_record,
      activity?.recent_audit_events[0],
    )
  const latestAlertDetail = joinAlertSummaryDetail(latestAlertRecord)
  const latestPendingAlertDetail = joinAlertSummaryDetail(latestPendingAlertRecord)

  return {
    latestOrderSummary:
      latestOps?.latest_order ??
      (latestOrderRecord ? `${orderActivitySummary(latestOrderRecord)} · ${latestOrderRecord.status}` : null),
    latestHistoricalOrderSummary:
      latestOps?.latest_historical_order ??
      (latestHistoricalOrderRecord
        ? `${orderActivitySummary(latestHistoricalOrderRecord)} · ${latestHistoricalOrderRecord.status}`
        : null),
    latestTradeSummary:
      latestOps?.latest_trade ??
      (latestTradeRecord
        ? `${tradeActivitySummary(latestTradeRecord)} · ${latestTradeRecord.status ?? 'filled'} · pnl ${latestTradeRecord.pnl}`
        : null),
    latestAlertSummary:
      latestOps?.latest_alert ??
      (latestAlertRecord
        ? `${latestAlertRecord.severity} ${latestAlertRecord.title}${latestAlertDetail ? ` · ${latestAlertDetail}` : ''}`
        : null),
    latestPendingAlertSummary:
      latestOps?.latest_pending_alert ??
      (latestPendingAlertRecord
        ? `${latestPendingAlertRecord.severity} ${latestPendingAlertRecord.title}${
            latestPendingAlertDetail ? ` · ${latestPendingAlertDetail}` : ''
          }`
        : null),
    latestAuditSummary:
      latestOps?.latest_audit_event ??
      (latestAuditEventRecord
        ? `${latestAuditEventRecord.event_type} · ${summarizeAuditEvent(latestAuditEventRecord)}`
        : null),
  }
}

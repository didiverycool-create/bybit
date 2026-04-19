import type {
  StrategyActivityLatestOpsSnapshot,
  StrategyActivitySnapshot,
} from './types'

function hasLatestOpsValue(snapshot: StrategyActivityLatestOpsSnapshot) {
  return Object.values(snapshot).some((value) => value !== null && value !== undefined)
}

export function buildStrategyActivityLatestOpsSnapshot(
  latestOps: StrategyActivityLatestOpsSnapshot | null | undefined,
): StrategyActivityLatestOpsSnapshot | null {
  const mergedSnapshot: StrategyActivityLatestOpsSnapshot = {
    latest_active_order: latestOps?.latest_active_order ?? null,
    latest_historical_order: latestOps?.latest_historical_order ?? null,
    latest_order: latestOps?.latest_order ?? null,
    latest_pending_alert: latestOps?.latest_pending_alert ?? null,
    latest_trade: latestOps?.latest_trade ?? null,
    latest_alert: latestOps?.latest_alert ?? null,
    latest_audit_event: latestOps?.latest_audit_event ?? null,
    latest_active_order_record: latestOps?.latest_active_order_record ?? null,
    latest_historical_order_record: latestOps?.latest_historical_order_record ?? null,
    latest_order_record: latestOps?.latest_order_record ?? null,
    latest_pending_alert_record: latestOps?.latest_pending_alert_record ?? null,
    latest_trade_record: latestOps?.latest_trade_record ?? null,
    latest_alert_record: latestOps?.latest_alert_record ?? null,
    latest_audit_event_record: latestOps?.latest_audit_event_record ?? null,
  }

  return hasLatestOpsValue(mergedSnapshot) ? mergedSnapshot : null
}

export function resolveStrategyActivityLatestOpsSnapshot(
  activity?: StrategyActivitySnapshot | null,
): StrategyActivityLatestOpsSnapshot | null {
  return buildStrategyActivityLatestOpsSnapshot(activity?.latest_ops ?? activity?.latest_runtime?.latest_ops ?? null)
}

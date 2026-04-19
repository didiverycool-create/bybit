import type {
  AlertRecord,
  ExecutionEvent,
  OrderRecord,
  StrategyActivityLatestRuntimeSnapshot,
  StrategyActivitySnapshot,
  StrategyRuntimeSnapshot,
  StrategySummary,
  TradeRecord,
} from './types'
import {
  buildEmptyStrategyActivityLatestOpsSnapshot,
  buildEmptyStrategyActivityLineageFields,
  buildFallbackStrategyActivityRecentCollections,
} from './strategyActivitySnapshotDefaults'
import { normalizeStrategyActivitySnapshot } from './strategyActivitySnapshotNormalization'

export interface StrategyActivityFallbackContext {
  strategies: StrategySummary[]
  runtime: StrategyRuntimeSnapshot[]
  orders: OrderRecord[]
  trades: TradeRecord[]
  alerts: AlertRecord[]
  audit: ExecutionEvent[]
}

export type FetchJsonLike = <T>(path: string, fallback: T) => Promise<T>

export function fallbackStrategyActivity(
  strategyId: string,
  context: StrategyActivityFallbackContext,
): StrategyActivitySnapshot {
  const strategy = context.strategies.find((item) => item.id === strategyId)
  const runtime = context.runtime.find((item) => item.strategy_id === strategyId) ?? null
  const latestOps = buildEmptyStrategyActivityLatestOpsSnapshot()
  const latestRuntime: StrategyActivityLatestRuntimeSnapshot | null =
    runtime || Object.values(latestOps).some((value) => value !== null && value !== undefined)
      ? {
          runtime,
          latest_ops: latestOps,
        }
      : null

  return {
    strategy_id: strategyId,
    strategy_name: strategy?.name ?? '策略活动',
    symbol: strategy?.symbols?.[0] ?? 'BTCUSDT',
    market: 'perp',
    mode: strategy?.mode ?? 'paper',
    runtime,
    latest_runtime: latestRuntime,
    latest_ops: latestOps,
    decision_context: null,
    activity_sections: null,
    ...buildEmptyStrategyActivityLineageFields(),
    ...buildFallbackStrategyActivityRecentCollections({
      strategyId,
      orders: context.orders,
      trades: context.trades,
      alerts: context.alerts,
      audit: context.audit,
    }),
    generated_at: new Date().toISOString(),
  }
}

export async function fetchStrategyActivitySnapshot(
  fetchJson: FetchJsonLike,
  strategyId: string,
  context: StrategyActivityFallbackContext,
): Promise<StrategyActivitySnapshot> {
  return normalizeStrategyActivitySnapshot(
    await fetchJson(
      `/api/strategies/${encodeURIComponent(strategyId)}/activity`,
      fallbackStrategyActivity(strategyId, context),
    ),
  )
}

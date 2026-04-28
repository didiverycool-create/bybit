import type { WatchlistInstrument } from '../types'

import { resolveErrorMessage } from '../utils/app-helpers'

export type ActionTone = 'success' | 'warning' | 'error'

export type SubmitStrategyRequest = (
  type: string,
  summary: string,
  payload: Record<string, unknown>,
  priority?: 'low' | 'normal' | 'high' | 'critical',
) => Promise<void>

export function normalizeWatchlistSymbol(value: string) {
  return String(value || '')
    .toUpperCase()
    .replace(/\//g, '')
    .replace(/-/g, '')
    .trim()
}

export function resolveWatchlistAlertThreshold(
  item: WatchlistInstrument,
  watchlistAlertDrafts: Record<string, string>,
) {
  const rawThreshold = watchlistAlertDrafts[item.symbol] ?? item.alert_threshold_pct.toFixed(1)
  const threshold = Number(rawThreshold)
  return Number.isFinite(threshold) && threshold > 0 ? threshold : null
}

export function buildWatchlistAlertRulePayload(item: WatchlistInstrument, threshold: number, alertEnabled: boolean) {
  return {
    symbol: item.symbol,
    threshold_pct: Number(threshold.toFixed(2)),
    alert_enabled: alertEnabled,
  }
}

export function buildAlertAcknowledgementFeedback(
  acknowledged: boolean,
  result: { symbol: string; title: string },
) {
  return {
    tone: 'success' as const,
    title: acknowledged ? '提醒已确认' : '提醒已恢复待处理',
    detail: `${result.symbol} · ${result.title}`,
  }
}

export function buildWatchlistAddFeedback(symbol: string) {
  return {
    tone: 'success' as const,
    title: '自选已更新',
    detail: `${symbol} 已加入自选列表。`,
  }
}

export function buildWatchlistRemoveFeedback(symbol: string) {
  return {
    tone: 'success' as const,
    title: '自选已移除',
    detail: `${symbol} 已从自选列表移除。`,
  }
}

export function buildWatchlistAlertRuleErrorDetail(error: unknown) {
  return resolveErrorMessage(error)
}

export function buildWatchlistAlertRuleValidationFeedback() {
  return {
    tone: 'warning' as const,
    title: '提醒阈值无效',
    detail: '请输入大于 0 的百分比阈值，例如 2.5。',
  }
}

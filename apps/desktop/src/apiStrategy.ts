import type {
  AgentJob,
  ExecutionPreview,
  StrategyExecutionResult,
  StrategyLiveSnapshot,
} from './types'
import { apiFallbacks } from './apiFallbacks'
import {
  CONTROL_API_BASE,
  fetchJson,
  postJson,
} from './apiHttp'
import { fetchStrategyActivitySnapshot } from './strategyActivityApiHelpers'

function normalizeExecutionPreview(preview: ExecutionPreview): ExecutionPreview {
  return {
    ...preview,
    warnings: Array.isArray(preview?.warnings)
      ? preview.warnings.filter((item): item is string => typeof item === 'string')
      : [],
  }
}

export const strategyApi = {
  getStrategies: () => fetchJson('/api/strategies', apiFallbacks.strategies),
  getStrategyRuntime: () => fetchJson('/api/strategies/live', apiFallbacks.strategyRuntime),
  getStrategyActivity: (strategyId: string) =>
    fetchStrategyActivitySnapshot(fetchJson, strategyId, {
      strategies: apiFallbacks.strategies,
      runtime: apiFallbacks.strategyRuntime,
      orders: apiFallbacks.orders,
      trades: apiFallbacks.trades,
      alerts: apiFallbacks.alerts,
      audit: apiFallbacks.audit,
    }),
  getStrategyExecutionPreview: async (
    strategyId: string,
    mode?: 'paper' | 'demo' | 'live',
  ) => {
    const path = `/api/strategies/${encodeURIComponent(strategyId)}/execution-preview${
      mode ? `?mode=${encodeURIComponent(mode)}` : ''
    }`
    try {
      const response = await fetch(`${CONTROL_API_BASE}${path}`)
      if (!response.ok) {
        let detail = '当前策略执行预检暂不可用。'
        try {
          const payload = (await response.json()) as { detail?: string }
          if (typeof payload.detail === 'string' && payload.detail.trim()) {
            detail = payload.detail
          }
        } catch {
          // ignore
        }
        return normalizeExecutionPreview({
          ...apiFallbacks.strategyExecutionPreview,
          mode: mode ?? apiFallbacks.strategyExecutionPreview.mode,
          strategy_id: strategyId,
          blocked_reason: detail,
          warnings: [detail],
        })
      }
      return normalizeExecutionPreview((await response.json()) as ExecutionPreview)
    } catch (error) {
      console.warn(`使用本地 fallback: ${path}`, error)
      return normalizeExecutionPreview({
        ...apiFallbacks.strategyExecutionPreview,
        mode: mode ?? apiFallbacks.strategyExecutionPreview.mode,
        strategy_id: strategyId,
      })
    }
  },
  getStrategyLiveSnapshot: () =>
    fetchJson<StrategyLiveSnapshot>('/api/strategies/stream?once=true', {
      items: apiFallbacks.strategyRuntime,
      generated_at: new Date().toISOString(),
    }),
  executeStrategySignal: (
    strategyId: string,
    payload?: { requested_by?: string; note?: string; mode?: 'paper' | 'demo' | 'live' },
  ) =>
    postJson<StrategyExecutionResult>(
      `/api/strategies/${encodeURIComponent(strategyId)}/execute`,
      {
        requested_by: payload?.requested_by ?? 'desktop_operator',
        note: payload?.note ?? null,
        mode: payload?.mode ?? null,
      },
    ),
  createStrategyTrackingReview: (
    strategyId: string,
    payload: {
      review_kind: 'issue' | 'change'
      summary: string
      detail?: string
      requested_by?: string
      request_key?: string
    },
  ) =>
    postJson<AgentJob>(
      `/api/strategies/${encodeURIComponent(strategyId)}/review`,
      payload,
    ),
}

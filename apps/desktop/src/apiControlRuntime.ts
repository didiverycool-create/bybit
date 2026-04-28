import type { RuntimeWorkerActionResult } from './types'
import { apiFallbacks } from './apiFallbacks'
import { fetchJson, postJson } from './apiHttp'

export const controlRuntimeApi = {
  getControlSnapshot: () => fetchJson('/api/control/snapshot', apiFallbacks.snapshot),
  getRuntimeWorkerStatus: () =>
    fetchJson('/api/runtime/strategy-worker/status', apiFallbacks.runtimeWorkerStatus),
  restartStrategyRuntimeWorker: () =>
    postJson<RuntimeWorkerActionResult>('/api/runtime/strategy-worker/restart', {
      requested_by: 'desktop_operator',
      reason: '桌面端恢复策略运行线程',
    }),
}

import type { AlertRecord } from './types'
import { apiFallbacks } from './apiFallbacks'
import { fetchJson, postJson } from './apiHttp'

export const opsMonitoringApi = {
  getOpsLiveSnapshot: () => fetchJson('/api/ops/live', apiFallbacks.opsLive),
  getNews: () => fetchJson('/api/news', apiFallbacks.news),
  getAlerts: () => fetchJson('/api/alerts', apiFallbacks.alerts),
  acknowledgeAlert: (alertId: string, acknowledged: boolean) =>
    postJson<AlertRecord>(`/api/alerts/${alertId}/acknowledge`, {
      acknowledged,
      requested_by: 'desktop_operator',
    }),
  getAuditEvents: () => fetchJson('/api/audit/events', apiFallbacks.audit),
}

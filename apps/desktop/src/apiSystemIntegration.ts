import type {
  BybitTradeProbeResult,
  SettingsPayload,
  WorkspacePreferences,
} from './types'
import { apiFallbacks } from './apiFallbacks'
import { fetchJson, fetchText, postJson } from './apiHttp'

export const systemIntegrationApi = {
  getSettings: () => fetchJson('/api/settings', apiFallbacks.settings),
  updateSettings: (payload: {
    bybit_web_entry?: string
    api_base_url?: string
    default_mode?: 'paper' | 'demo' | 'live'
    notification_channels?: string[]
    notification_quiet_hours_enabled?: boolean
    notification_quiet_hours_start?: string
    notification_quiet_hours_end?: string
    product_language?: string
    grafana_base_url?: string | null
    grafana_dashboard_uid?: string | null
    grafana_org_id?: number
    grafana_theme?: 'dark' | 'light'
  }) => postJson<SettingsPayload>('/api/settings', payload),
  getGrafanaStatus: () =>
    fetchJson('/api/integrations/grafana', apiFallbacks.grafanaStatus),
  getPrometheusMetrics: () =>
    fetchText('/metrics', apiFallbacks.prometheusMetrics),
  getWorkspacePreferences: () =>
    fetchJson('/api/workspace/preferences', apiFallbacks.workspacePreferences),
  getOpenClawStatus: () =>
    fetchJson('/api/integrations/openclaw', apiFallbacks.openClawStatus),
  getBybitPrivateStatus: () =>
    fetchJson('/api/integrations/bybit-private', apiFallbacks.bybitPrivateStatus),
  getBybitPublicStatus: () =>
    fetchJson('/api/integrations/bybit-public', apiFallbacks.bybitPublicStatus),
  probeBybitTradeRoute: () =>
    postJson<BybitTradeProbeResult>('/api/integrations/bybit-private/probe-trade', {}),
  updateWorkspacePreferences: (payload: {
    active_section: string
    layout_preset: 'balanced' | 'focus' | 'dense'
    selected_mode: 'paper' | 'demo' | 'live'
    selected_symbol: string
    selected_market_timeframe: '15m' | '1h' | '4h' | '1d'
    selected_strategy_id?: string | null
    selected_backtest_id?: string | null
    selected_scheduler_job_id?: string | null
    selected_strategy_detail_panel?: 'activity' | 'tracking' | 'editor' | null
    selected_strategy_tracking_kind?: 'issue' | 'change' | null
    selected_strategy_tracking_summary?: string
    selected_strategy_tracking_detail?: string
    selected_strategy_editor_strategy_id?: string | null
    selected_strategy_editor_parameter_drafts?: Record<string, string>
    selected_strategy_editor_risk_budget_draft?: string
    selected_review_inspector_id?: string | null
    selected_review_inspector_strategy_id?: string | null
    selected_review_id?: string | null
    selected_proposal_id?: string | null
    selected_change_request_id?: string | null
    backtest_filter: 'selected' | 'all'
    replay_tracking_scope: 'all' | 'selected'
    alert_severity_filter: 'all' | 'P0' | 'P1' | 'P2'
    alert_status_filter: 'all' | 'pending' | 'acknowledged'
    alert_scope_filter: 'all' | 'selected'
    trade_mode_filter: 'all' | 'paper' | 'demo' | 'live'
    trade_origin_filter: 'all' | 'manual' | 'strategy' | 'exchange'
    trade_scope_filter: 'all' | 'selected'
    audit_severity_filter: 'all' | 'info' | 'warning' | 'error' | 'critical'
    audit_source_filter: string
    audit_scope_filter: 'all' | 'selected'
    audit_search: string
    overview_card_order: string[]
    overview_visible_cards: string[]
    overview_collapsed_cards: string[]
  }) => postJson<WorkspacePreferences>('/api/workspace/preferences', payload),
}

import { ExternalLink } from 'lucide-react'

import type { GrafanaIntegrationStatus } from '../../types'

export type GrafanaStatusPanelProps = {
  grafanaStatus?: GrafanaIntegrationStatus | null
  grafanaMetricsUrl: string
}

export default function GrafanaStatusPanel({
  grafanaStatus,
  grafanaMetricsUrl,
}: GrafanaStatusPanelProps) {
  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <span className="section-label">Grafana / 监控</span>
          <h3>Grafana-ready 接入</h3>
        </div>
        <span className={`chip ${grafanaStatus?.configured ? 'chip--success' : 'chip--warning'}`}>
          {grafanaStatus?.configured ? '已配置 Grafana' : '未配置 Grafana'}
        </span>
      </div>
      <div className="contract-list">
        <code>{grafanaMetricsUrl}</code>
        <code>{grafanaStatus?.dashboard_url ?? '等待配置 Grafana 仪表盘 URL'}</code>
      </div>
      <p className="panel-note">
        {grafanaStatus?.note ?? 'Grafana 更适合系统监控，不建议直接替代主交易 K 线。'}
      </p>
      <div className="hero-actions hero-actions--compact">
        <button
          type="button"
          className="ghost-button"
          disabled={!grafanaStatus?.dashboard_url}
          onClick={() => {
            if (grafanaStatus?.dashboard_url) {
              window.open(grafanaStatus.dashboard_url, '_blank', 'noopener,noreferrer')
            }
          }}
        >
          <ExternalLink size={14} />
          打开 Grafana
        </button>
      </div>
    </article>
  )
}

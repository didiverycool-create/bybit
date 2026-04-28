import { Bot, ShieldAlert, X } from 'lucide-react'

type GrafanaPreviewPanelProps = {
  open: boolean
  onClose: () => void
  queueDepth: number
  schedulerStatusLabel: string
  pendingAlertsCount: number
  metricsUrl: string
  dashboardUrl?: string | null
  configured: boolean
  note: string
  metricsPreviewLines: string[]
  onOpenMetrics: () => void
  onOpenGrafana: () => void
}

export default function GrafanaPreviewPanel({
  open,
  onClose,
  queueDepth,
  schedulerStatusLabel,
  pendingAlertsCount,
  metricsUrl,
  dashboardUrl,
  configured,
  note,
  metricsPreviewLines,
  onOpenMetrics,
  onOpenGrafana,
}: GrafanaPreviewPanelProps) {
  if (!open) {
    return null
  }

  return (
    <div className="floating-panel-backdrop" onClick={onClose}>
      <aside
        className="floating-panel floating-panel--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Grafana 监控预览"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="floating-panel__head">
          <div>
            <span className="section-label">Grafana / 监控预览</span>
            <h3>AI 调度与系统监控</h3>
          </div>
          <button
            type="button"
            className="icon-button"
            title="关闭监控预览"
            aria-label="关闭监控预览"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="floating-panel__body">
          <div className="floating-panel__grid">
            <div className="floating-status-card">
              <div className="floating-status-card__head">
                <span className="floating-status-card__label">
                  <Bot size={13} />
                  调度队列
                </span>
                <strong>{queueDepth} 个</strong>
              </div>
              <p className="panel-note">当前 AI 调度状态：{schedulerStatusLabel}</p>
            </div>
            <div className="floating-status-card">
              <div className="floating-status-card__head">
                <span className="floating-status-card__label">
                  <ShieldAlert size={13} />
                  风险提醒
                </span>
                <strong>{pendingAlertsCount} 条</strong>
              </div>
              <p className="panel-note">优先用 Grafana 观察服务状态、告警堆积和任务吞吐。</p>
            </div>
          </div>

          <div className="contract-list">
            <code>{metricsUrl}</code>
            <code>{dashboardUrl ?? '未配置 Grafana 仪表盘 URL'}</code>
          </div>

          {configured && dashboardUrl ? (
            <div className="grafana-embed">
              <iframe
                src={dashboardUrl}
                title="Grafana 仪表盘预览"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="console-panel">
              <div className="panel-head panel-head--compact">
                <div>
                  <span className="section-label">Prometheus 指标预览</span>
                  <h3>本地监控端点</h3>
                </div>
              </div>
              <div className="metrics-preview">
                {metricsPreviewLines.map((line) => (
                  <code key={line}>{line}</code>
                ))}
                {!metricsPreviewLines.length && (
                  <div className="empty-state empty-state--inline">当前还没有可展示的监控指标</div>
                )}
              </div>
              <p className="panel-note">
                当前前端只把 Grafana 用在系统监控，不替代主交易图。要嵌入 Grafana 仪表盘，需要在 Grafana 侧开启嵌入并配置仪表盘地址。
              </p>
            </div>
          )}

          <div className="hero-actions hero-actions--compact">
            <button type="button" className="ghost-button" onClick={onOpenMetrics}>
              查看指标端点
            </button>
            <button type="button" className="ghost-button" disabled={!dashboardUrl} onClick={onOpenGrafana}>
              打开 Grafana
            </button>
          </div>
          <p className="panel-note">{note}</p>
        </div>
      </aside>
    </div>
  )
}

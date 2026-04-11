import type { AlertRecord } from '../types'
import { alertSourceMeta, formatPercent, formatTime } from '../utils/app-helpers'

type AlertSeverityFilter = 'all' | 'P0' | 'P1' | 'P2'
type AlertStatusFilter = 'all' | 'pending' | 'acknowledged'
type AlertScopeFilter = 'all' | 'selected'

type AlertsWorkspaceSectionProps = {
  pendingAlertsCount: number
  p0AlertsCount: number
  alertSeverityFilter: AlertSeverityFilter
  onAlertSeverityFilterChange: (value: AlertSeverityFilter) => void
  alertStatusFilter: AlertStatusFilter
  onAlertStatusFilterChange: (value: AlertStatusFilter) => void
  alertScopeFilter: AlertScopeFilter
  selectedSymbol: string
  onToggleAlertScopeFilter: () => void
  notificationChannelsLabel: string
  filteredAlerts: AlertRecord[]
  alertMutationPending: boolean
  onOpenAlertMarket: (symbol: string) => void
  onOpenWatchlistManager: () => void
  onToggleAlertAcknowledged: (alertId: string, nextAcknowledged: boolean) => void
}

export default function AlertsWorkspaceSection({
  pendingAlertsCount,
  p0AlertsCount,
  alertSeverityFilter,
  onAlertSeverityFilterChange,
  alertStatusFilter,
  onAlertStatusFilterChange,
  alertScopeFilter,
  selectedSymbol,
  onToggleAlertScopeFilter,
  notificationChannelsLabel,
  filteredAlerts,
  alertMutationPending,
  onOpenAlertMarket,
  onOpenWatchlistManager,
  onToggleAlertAcknowledged,
}: AlertsWorkspaceSectionProps) {
  return (
    <section className="section-grid section-entrance">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">提醒中心</span>
            <h3>风险、新闻与回测提醒</h3>
          </div>
          <span className="chip chip--warning">未处理 {pendingAlertsCount} · P0 {p0AlertsCount}</span>
        </div>
        <div className="ops-toolbar">
          <div className="ops-toolbar__group">
            <span className="section-label">级别</span>
            {(['all', 'P0', 'P1', 'P2'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`pill pill--compact ${alertSeverityFilter === value ? 'active' : ''}`}
                onClick={() => onAlertSeverityFilterChange(value)}
              >
                {value === 'all' ? '全部' : value}
              </button>
            ))}
          </div>
          <div className="ops-toolbar__group">
            <span className="section-label">状态</span>
            {([
              ['pending', '待处理'],
              ['acknowledged', '已确认'],
              ['all', '全部'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`pill pill--compact ${alertStatusFilter === value ? 'active' : ''}`}
                onClick={() => onAlertStatusFilterChange(value)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className={`pill pill--compact ${alertScopeFilter === 'selected' ? 'active' : ''}`}
              onClick={onToggleAlertScopeFilter}
            >
              {alertScopeFilter === 'selected' ? selectedSymbol : '当前品种'}
            </button>
          </div>
          <span className="chip chip--muted">{notificationChannelsLabel}</span>
        </div>
        <div className="alert-list alert-list--compact">
          {filteredAlerts.map((alert, index) => {
            const sourceMeta = alertSourceMeta(alert.source_type)
            const SourceIcon = sourceMeta.icon
            return (
              <div key={alert.id} className="alert-row alert-row--fade" style={{ animationDelay: `${index * 26}ms` }}>
                <div>
                  <strong>{alert.title}</strong>
                  <p>
                    <span className="alert-row__source">
                      <SourceIcon size={12} />
                      {sourceMeta.label}
                    </span>
                    {typeof alert.trigger_value === 'number' && typeof alert.threshold_value === 'number'
                      ? ` · 触发 ${formatPercent(alert.trigger_value)} / 阈值 ${alert.threshold_value.toFixed(2)}%`
                      : ''}
                    {' · '}
                    {alert.description}
                    {' · '}
                    建议 {alert.suggested_action}
                  </p>
                </div>
                <div className="alert-meta">
                  <span className={`chip ${alert.acknowledged ? 'chip--muted' : 'chip--success'}`}>
                    {alert.acknowledged ? '已确认' : '待处理'}
                  </span>
                  <span className={`status-chip status-${alert.severity.toLowerCase()}`}>{alert.severity}</span>
                  <div className="inline-actions inline-actions--tight">
                    {alert.symbol ? (
                      <button
                        type="button"
                        className="ghost-button ghost-button--inline"
                        onClick={() => onOpenAlertMarket(alert.symbol)}
                      >
                        查看行情
                      </button>
                    ) : null}
                    {alert.source_type === 'rule' ? (
                      <button type="button" className="ghost-button ghost-button--inline" onClick={onOpenWatchlistManager}>
                        自选规则
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="ghost-button ghost-button--inline"
                      disabled={alertMutationPending}
                      onClick={() => onToggleAlertAcknowledged(alert.id, !alert.acknowledged)}
                    >
                      {alert.acknowledged ? '恢复提醒' : '确认已读'}
                    </button>
                  </div>
                  <small>{formatTime(alert.triggered_at)}</small>
                </div>
              </div>
            )
          })}
          {filteredAlerts.length === 0 && <div className="empty-state empty-state--inline">当前筛选下没有提醒</div>}
        </div>
      </article>
    </section>
  )
}

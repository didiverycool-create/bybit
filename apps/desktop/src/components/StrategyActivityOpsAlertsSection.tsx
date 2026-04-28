import type { StrategyActivityOpsAlertsSectionProps } from './strategyActivityOpsSectionTypes'
import { activityAlertToneClass, formatDateTime } from '../utils/app-helpers'

export default function StrategyActivityOpsAlertsSection({
  strategyActivityLatestPendingAlertSupplemented,
  strategyActivityLatestAlertSupplemented,
  strategyActivityAlerts,
  activityLatestAlert,
  activityLatestPendingAlert,
  alertMutationPending,
  serviceAvailable,
  onOpenAlertsSection,
  onOpenMarketSymbol,
  onOpenWatchlistManager,
  onToggleAlertAcknowledged,
}: StrategyActivityOpsAlertsSectionProps) {
  return (
    <>
      <span className="section-label">提醒 / 审计</span>
      {strategyActivityLatestPendingAlertSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_pending_alert_supplemented_hint">
          顶部当前待处理提醒不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续近场确认或恢复。
        </p>
      )}
      {strategyActivityLatestAlertSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_alert_supplemented_hint">
          顶部最新提醒不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿同一提醒排障。
        </p>
      )}
      <div className="trade-list trade-list--dense" data-strategy-activity-action-group="alerts">
        {strategyActivityAlerts.map((alert) => (
          <div key={alert.id} className="trade-row trade-row--fade" data-strategy-activity-row-id={alert.id}>
            <div className="console-row__main">
              <strong className={activityAlertToneClass(alert)}>
                {alert.severity} · {alert.title}
              </strong>
              <p>{alert.description}</p>
            </div>
            <div className="trade-meta">
              {activityLatestAlert?.id === alert.id && (
                <span className="console-tag console-tag--warn">当前最新</span>
              )}
              {activityLatestPendingAlert?.id === alert.id && (
                <span className="console-tag console-tag--warn">当前待处理</span>
              )}
              <button type="button" className="micro-action" onClick={() => onOpenAlertsSection(alert.symbol ?? null)}>
                提醒页
              </button>
              {alert.symbol && (
                <button type="button" className="micro-action" onClick={() => onOpenMarketSymbol(alert.symbol)}>
                  提醒行情
                </button>
              )}
              {alert.source_type === 'rule' && (
                <button type="button" className="micro-action" onClick={onOpenWatchlistManager}>
                  自选规则
                </button>
              )}
              <button
                type="button"
                className="micro-action"
                disabled={!serviceAvailable || alertMutationPending}
                onClick={() => onToggleAlertAcknowledged(alert.id, !alert.acknowledged)}
              >
                {alert.acknowledged ? '恢复提醒' : '确认提醒'}
              </button>
              <small>{formatDateTime(alert.triggered_at)}</small>
            </div>
          </div>
        ))}
        {!strategyActivityAlerts.length && (
          <div className="empty-state empty-state--inline">当前没有未完成的策略提醒。</div>
        )}
      </div>
    </>
  )
}

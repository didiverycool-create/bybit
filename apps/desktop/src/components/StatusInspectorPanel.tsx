import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Bot, X } from 'lucide-react'

type StatusInspectorCard = {
  key: string
  icon: LucideIcon
  label: string
  value: string
  detail: string
  tone: 'warn' | 'good' | 'muted'
}

type StatusInspectorMessage = {
  key: string
  icon: LucideIcon
  title: string
  detail: string
  actions?: ReactNode
}

type StatusInspectorLatestCommand = {
  tone: 'warning' | 'success'
  commandLabel: string
  summary: string
  impactDetail?: string | null
  occurredAt: string
  actions?: ReactNode
}

type StatusInspectorPanelProps = {
  open: boolean
  onClose: () => void
  statusCards: StatusInspectorCard[]
  latestCommand?: StatusInspectorLatestCommand | null
  messageCount: number
  messages: StatusInspectorMessage[]
  onOpenAlerts: () => void
  onOpenScheduler: () => void
  onOpenSettings: () => void
}

export default function StatusInspectorPanel({
  open,
  onClose,
  statusCards,
  latestCommand,
  messageCount,
  messages,
  onOpenAlerts,
  onOpenScheduler,
  onOpenSettings,
}: StatusInspectorPanelProps) {
  if (!open) {
    return null
  }

  return (
    <div className="floating-panel-backdrop" onClick={onClose}>
      <aside
        className="floating-panel"
        role="dialog"
        aria-modal="true"
        aria-label="运行状态窗口"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="floating-panel__head">
          <div>
            <span className="section-label">二级状态窗口</span>
            <h3>运行状态与消息</h3>
          </div>
          <button
            type="button"
            className="icon-button"
            title="关闭状态窗口"
            aria-label="关闭状态窗口"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="floating-panel__body">
          <div className="floating-panel__grid">
            {statusCards.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.key} className={`floating-status-card floating-status-card--${item.tone}`}>
                  <div className="floating-status-card__head">
                    <span className="floating-status-card__label">
                      <Icon size={14} />
                      {item.label}
                    </span>
                    <strong>{item.value}</strong>
                  </div>
                  <small>{item.detail}</small>
                </div>
              )
            })}
          </div>

          {latestCommand && (
            <div
              className={`service-banner service-banner--${latestCommand.tone === 'warning' ? 'warning' : 'success'} service-banner--inline`}
            >
              <Bot size={16} />
              <div>
                <strong>最近调度动作 · {latestCommand.commandLabel}</strong>
                <p>{latestCommand.summary}</p>
                {latestCommand.impactDetail && <p>{latestCommand.impactDetail}</p>}
                <p>发生于 {latestCommand.occurredAt}</p>
                {latestCommand.actions}
              </div>
            </div>
          )}

          <div className="console-panel">
            <div className="watchlist-module__header">
              <span className="section-label">消息与提示</span>
              <strong>{messageCount} 条</strong>
            </div>
            <div className="job-list">
              {messages.length > 0 ? (
                messages.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.key} className="job-row">
                      <div className="console-row__main">
                        <strong>
                          <Icon size={13} />
                          {item.title}
                        </strong>
                        <p>{item.detail}</p>
                      </div>
                      {item.actions ? <div className="job-meta">{item.actions}</div> : null}
                    </div>
                  )
                })
              ) : (
                <div className="empty-state empty-state--inline">当前没有需要单独处理的状态消息。</div>
              )}
            </div>
          </div>

          <div className="inline-actions">
            <button type="button" className="ghost-button ghost-button--inline" onClick={onOpenAlerts}>
              打开提醒中心
            </button>
            <button type="button" className="ghost-button ghost-button--inline" onClick={onOpenScheduler}>
              打开 AI 调度
            </button>
            <button type="button" className="ghost-button ghost-button--inline" onClick={onOpenSettings}>
              打开设置
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

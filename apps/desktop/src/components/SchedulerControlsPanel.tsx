import { Bot, ShieldAlert, X } from 'lucide-react'

type SchedulerControlsPanelProps = {
  open: boolean
  onClose: () => void
  currentJobId?: string | null
  publishGateLabel: string
  schedulerStatusLabel: string
  serviceAvailable: boolean
  pending: boolean
  onCancelAll: () => void
  onFreezePublish: () => void
  onEnterManualOverride: () => void
  onOpenGrafana: () => void
}

export default function SchedulerControlsPanel({
  open,
  onClose,
  currentJobId,
  publishGateLabel,
  schedulerStatusLabel,
  serviceAvailable,
  pending,
  onCancelAll,
  onFreezePublish,
  onEnterManualOverride,
  onOpenGrafana,
}: SchedulerControlsPanelProps) {
  if (!open) {
    return null
  }

  return (
    <div className="floating-panel-backdrop" onClick={onClose}>
      <aside
        className="floating-panel"
        role="dialog"
        aria-modal="true"
        aria-label="AI 调度高级控制"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="floating-panel__head">
          <div>
            <span className="section-label">AI 调度高级控制</span>
            <h3>低频中断与发布门禁</h3>
          </div>
          <button
            type="button"
            className="icon-button"
            title="关闭 AI 调度高级控制"
            aria-label="关闭 AI 调度高级控制"
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
                  当前任务
                </span>
                <strong>{currentJobId ?? 'idle'}</strong>
              </div>
              <small>仅在需要强制介入时再使用下面的中断与门禁控制。</small>
            </div>
            <div className="floating-status-card">
              <div className="floating-status-card__head">
                <span className="floating-status-card__label">
                  <ShieldAlert size={13} />
                  发布门禁
                </span>
                <strong>{publishGateLabel}</strong>
              </div>
              <small>当前调度状态：{schedulerStatusLabel}。人工接管或冻结后，发布类提案不会自动落地。</small>
            </div>
          </div>

          <div className="inline-actions">
            <button type="button" className="ghost-button" disabled={!serviceAvailable || pending} onClick={onCancelAll}>
              终止全部任务
            </button>
            <button type="button" className="ghost-button" disabled={!serviceAvailable || pending} onClick={onFreezePublish}>
              冻结自动发布
            </button>
            <button type="button" className="ghost-button" disabled={!serviceAvailable || pending} onClick={onEnterManualOverride}>
              进入人工接管
            </button>
            <button type="button" className="ghost-button" onClick={onOpenGrafana}>
              监控预览
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

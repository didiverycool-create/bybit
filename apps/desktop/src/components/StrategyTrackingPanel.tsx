import { X } from 'lucide-react'

import type { StrategySummary } from '../types'

type StrategyTrackingPanelProps = {
  open: boolean
  strategy: StrategySummary | null
  kind: 'issue' | 'change'
  onKindChange: (value: 'issue' | 'change') => void
  summary: string
  onSummaryChange: (value: string) => void
  detail: string
  onDetailChange: (value: string) => void
  serviceAvailable: boolean
  pending: boolean
  onSubmit: () => void
  onClose: () => void
}

export default function StrategyTrackingPanel({
  open,
  strategy,
  kind,
  onKindChange,
  summary,
  onSummaryChange,
  detail,
  onDetailChange,
  serviceAvailable,
  pending,
  onSubmit,
  onClose,
}: StrategyTrackingPanelProps) {
  if (!open || !strategy) {
    return null
  }

  return (
    <div className="floating-panel-backdrop" onClick={onClose}>
      <aside
        className="floating-panel"
        role="dialog"
        aria-modal="true"
        aria-label="策略跟踪窗口"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="floating-panel__head">
          <div>
            <span className="section-label">策略跟踪</span>
            <h3>{strategy.name}</h3>
            <p className="panel-note">手动发起问题或变更跟踪，任务会写回策略活动和 AI 复盘。</p>
          </div>
          <button
            type="button"
            className="icon-button"
            title="关闭策略跟踪窗口"
            aria-label="关闭策略跟踪窗口"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="floating-panel__body">
          <div className="chip-row">
            <button
              type="button"
              className={`pill pill--compact ${kind === 'issue' ? 'active' : ''}`}
              onClick={() => onKindChange('issue')}
            >
              问题跟踪
            </button>
            <button
              type="button"
              className={`pill pill--compact ${kind === 'change' ? 'active' : ''}`}
              onClick={() => onKindChange('change')}
            >
              变更跟踪
            </button>
          </div>
          <div className="field-grid backtest-field-grid">
            <label className="field field--wide">
              <span>跟踪摘要</span>
              <input
                value={summary}
                onChange={(event) => onSummaryChange(event.target.value)}
                placeholder={
                  kind === 'issue'
                    ? '例如：ETH 策略最近两次真实执行被风控拦截'
                    : '例如：BTC 趋势策略刚刚调整了参数与风险预算'
                }
              />
            </label>
            <label className="field field--wide">
              <span>补充说明</span>
              <textarea
                value={detail}
                onChange={(event) => onDetailChange(event.target.value)}
                placeholder="补充背景、你的判断或希望 AI 重点跟踪的观察点。"
                rows={4}
              />
            </label>
          </div>
          <div className="hero-actions hero-actions--compact">
            <button
              type="button"
              className="primary-button"
              disabled={!serviceAvailable || pending}
              onClick={onSubmit}
            >
              {kind === 'issue' ? '创建问题跟踪' : '创建变更跟踪'}
            </button>
            <button type="button" className="ghost-button" onClick={onClose}>
              取消
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

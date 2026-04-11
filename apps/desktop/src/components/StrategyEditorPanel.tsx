import { X } from 'lucide-react'

import type { StrategySummary } from '../types'
import { normalizeDraftValue } from '../utils/app-helpers'

type StrategyEditorPanelProps = {
  open: boolean
  strategy: StrategySummary | null
  parameterDrafts: Record<string, string>
  onParameterDraftChange: (key: string, value: string) => void
  riskBudgetDraft: string
  onRiskBudgetDraftChange: (value: string) => void
  hasParameterDraftChanges: boolean
  parameterDraftPatchCount: number
  riskBudgetChanged: boolean
  serviceAvailable: boolean
  pending: boolean
  onSubmitParameterUpdate: () => void
  onSubmitRiskUpdate: () => void
  onClose: () => void
}

export default function StrategyEditorPanel({
  open,
  strategy,
  parameterDrafts,
  onParameterDraftChange,
  riskBudgetDraft,
  onRiskBudgetDraftChange,
  hasParameterDraftChanges,
  parameterDraftPatchCount,
  riskBudgetChanged,
  serviceAvailable,
  pending,
  onSubmitParameterUpdate,
  onSubmitRiskUpdate,
  onClose,
}: StrategyEditorPanelProps) {
  if (!open || !strategy) {
    return null
  }

  return (
    <div className="floating-panel-backdrop" onClick={onClose}>
      <aside
        className="floating-panel floating-panel--wide"
        role="dialog"
        aria-modal="true"
        aria-label="策略参数编辑窗口"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="floating-panel__head">
          <div>
            <span className="section-label">策略参数编辑</span>
            <h3>{strategy.name}</h3>
          </div>
          <button
            type="button"
            className="icon-button"
            title="关闭策略参数编辑窗口"
            aria-label="关闭策略参数编辑窗口"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="floating-panel__body">
          <div className="parameter-grid">
            {strategy.parameters.map((parameter) => (
              <div key={parameter.key} className="parameter-card">
                <span>{parameter.label}</span>
                <input
                  value={parameterDrafts[parameter.key] ?? normalizeDraftValue(parameter.value)}
                  onChange={(event) => onParameterDraftChange(parameter.key, event.target.value)}
                />
                {parameter.unit ? <small>{parameter.unit}</small> : null}
              </div>
            ))}
            <div className="parameter-card">
              <span>风险预算</span>
              <input value={riskBudgetDraft} onChange={(event) => onRiskBudgetDraftChange(event.target.value)} />
              <small>支持直接填写如 18%</small>
            </div>
          </div>

          {(hasParameterDraftChanges || riskBudgetChanged) && (
            <p className="panel-note">
              当前有未提交修改: 参数 {parameterDraftPatchCount} 项，风险预算 {riskBudgetChanged ? '已修改' : '未修改'}。
            </p>
          )}

          <div className="inline-actions">
            <button
              type="button"
              className="primary-button"
              disabled={!serviceAvailable || pending || !hasParameterDraftChanges}
              onClick={onSubmitParameterUpdate}
            >
              提交参数变更
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={!serviceAvailable || pending || !riskBudgetChanged}
              onClick={onSubmitRiskUpdate}
            >
              更新风控
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

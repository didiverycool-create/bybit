import { AlertTriangle } from 'lucide-react'

import type { ManualTradeActionsSectionProps } from './manualTradePanelTypes'

export default function ManualTradeActionsSection({
  editingOrder,
  selectedMode,
  blockedTitle,
  blockedReason,
  serviceAvailable,
  submitPending,
  paperPending,
  replacePending,
  cancelPending,
  onSubmitManual,
  onSubmitPaper,
  onReplace,
  onCancelCurrent,
}: ManualTradeActionsSectionProps) {
  return (
    <>
      <div className="inline-actions">
        {editingOrder ? (
          <>
            <button
              type="button"
              className="primary-button"
              disabled={Boolean(blockedReason) || replacePending}
              onClick={onReplace}
            >
              提交改单
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={!serviceAvailable || cancelPending}
              onClick={onCancelCurrent}
            >
              撤销当前委托
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="primary-button"
              disabled={Boolean(blockedReason) || submitPending}
              onClick={onSubmitManual}
            >
              {selectedMode === 'paper' ? '提交手动交易' : `提交 ${selectedMode.toUpperCase()} 委托`}
            </button>
            {selectedMode === 'paper' && (
              <button
                type="button"
                className="ghost-button"
                disabled={Boolean(blockedReason) || paperPending}
                onClick={onSubmitPaper}
              >
                挂 Paper 限价单
              </button>
            )}
          </>
        )}
      </div>

      {blockedReason && (
        <div className="service-banner service-banner--warning service-banner--inline">
          <AlertTriangle size={16} />
          <div>
            <strong>{blockedTitle}</strong>
            <p>{blockedReason}</p>
          </div>
        </div>
      )}
    </>
  )
}

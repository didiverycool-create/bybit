import { X } from 'lucide-react'

import type { ExecutionPreview, Mode, OrderRecord } from '../types'

import ManualTradeActionsSection from './ManualTradeActionsSection'
import ManualTradeFormSection from './ManualTradeFormSection'
import ManualTradePreviewSection from './ManualTradePreviewSection'

import type { ManualOrderDraft } from './manualTradePanelTypes'

type ManualTradePanelProps = {
  open: boolean
  onClose: () => void
  selectedMode: Mode
  selectedSymbol: string
  editingOrder: OrderRecord | null
  manualOrder: ManualOrderDraft
  onManualOrderChange: (next: ManualOrderDraft) => void
  previewLoading: boolean
  preview?: ExecutionPreview
  blockedReason?: string | null
  serviceAvailable: boolean
  submitPending: boolean
  paperPending: boolean
  replacePending: boolean
  cancelPending: boolean
  onSubmitManual: () => void
  onSubmitPaper: () => void
  onReplace: () => void
  onCancelCurrent: () => void
}

export default function ManualTradePanel({
  open,
  onClose,
  selectedMode,
  selectedSymbol,
  editingOrder,
  manualOrder,
  onManualOrderChange,
  previewLoading,
  preview,
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
}: ManualTradePanelProps) {
  if (!open) {
    return null
  }

  const headerLabel = editingOrder
    ? editingOrder.source === 'paper'
      ? 'Paper 委托改单'
      : `${selectedMode.toUpperCase()} 委托改单`
    : selectedMode === 'paper'
      ? '手动交易'
      : `${selectedMode.toUpperCase()} 委托`

  const headerTitle = editingOrder
    ? editingOrder.source === 'paper'
      ? '修改本地限价委托'
      : '修改 Bybit 真实限价委托'
    : selectedMode === 'paper'
      ? 'Paper 辅助录入'
      : '向 Bybit 提交真实限价委托'

  const blockedTitle = editingOrder
    ? editingOrder.source === 'paper'
      ? '当前不能修改本地限价委托'
      : '当前不能修改真实委托'
    : selectedMode === 'paper'
      ? '手动交易暂不可提交'
      : '真实委托暂不可提交'

  return (
    <div className="floating-panel-backdrop" onClick={onClose}>
      <aside
        className="floating-panel"
        role="dialog"
        aria-modal="true"
        aria-label="手动交易窗口"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="floating-panel__head">
          <div>
            <span className="section-label">{headerLabel}</span>
            <h3>
              {selectedSymbol} · {headerTitle}
            </h3>
          </div>
          <button
            type="button"
            className="icon-button"
            title="关闭手动交易窗口"
            aria-label="关闭手动交易窗口"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="floating-panel__body">
          <ManualTradeFormSection
            editingOrder={editingOrder}
            manualOrder={manualOrder}
            onManualOrderChange={onManualOrderChange}
          />

          <ManualTradePreviewSection
            selectedMode={selectedMode}
            previewLoading={previewLoading}
            preview={preview}
          />

          <ManualTradeActionsSection
            editingOrder={editingOrder}
            selectedMode={selectedMode}
            blockedTitle={blockedTitle}
            blockedReason={blockedReason}
            serviceAvailable={serviceAvailable}
            submitPending={submitPending}
            paperPending={paperPending}
            replacePending={replacePending}
            cancelPending={cancelPending}
            onSubmitManual={onSubmitManual}
            onSubmitPaper={onSubmitPaper}
            onReplace={onReplace}
            onCancelCurrent={onCancelCurrent}
          />
        </div>
      </aside>
    </div>
  )
}

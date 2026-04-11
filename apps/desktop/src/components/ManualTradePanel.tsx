import { AlertTriangle, X } from 'lucide-react'

import type { ExecutionPreview, Mode, OrderRecord } from '../types'
import { positionSideLabel } from '../utils/app-helpers'

type ManualOrderDraft = {
  side: 'buy' | 'sell'
  quantity: string
  price: string
  note: string
}

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
          <div className="field-grid">
            <label className="field">
              <span>方向</span>
              <select
                value={manualOrder.side}
                disabled={Boolean(editingOrder)}
                onChange={(event) =>
                  onManualOrderChange({
                    ...manualOrder,
                    side: event.target.value as 'buy' | 'sell',
                  })
                }
              >
                <option value="buy">买入</option>
                <option value="sell">卖出</option>
              </select>
            </label>
            <label className="field">
              <span>数量</span>
              <input
                value={manualOrder.quantity}
                onChange={(event) =>
                  onManualOrderChange({
                    ...manualOrder,
                    quantity: event.target.value,
                  })
                }
              />
            </label>
            <label className="field">
              <span>价格</span>
              <input
                value={manualOrder.price}
                onChange={(event) =>
                  onManualOrderChange({
                    ...manualOrder,
                    price: event.target.value,
                  })
                }
              />
            </label>
            <label className="field field--wide">
              <span>备注</span>
              <input
                value={manualOrder.note}
                onChange={(event) =>
                  onManualOrderChange({
                    ...manualOrder,
                    note: event.target.value,
                  })
                }
                placeholder="例如：盘中人工接管后的手动对冲"
              />
            </label>
          </div>

          {(previewLoading || preview) && (
            <div className={`execution-preview ${preview?.allowed === false ? 'is-blocked' : ''}`} aria-live="polite">
              <div className="execution-preview__head">
                <span className="section-label">执行预检</span>
                {preview && <strong>{preview.action}</strong>}
              </div>
              {previewLoading && !preview ? (
                <div className="execution-preview__line">
                  正在评估本次成交对{selectedMode === 'paper' ? ' Paper 账户' : '当前 Bybit 账户'}和持仓的影响...
                </div>
              ) : preview ? (
                <>
                  <div className="execution-preview__line">
                    <span>名义价值 {preview.notional}</span>
                    <span>
                      可用余额 {preview.available_balance_before} {'→'} {preview.available_balance_after}
                    </span>
                  </div>
                  <div className="execution-preview__line">
                    <span>
                      当前持仓 {positionSideLabel(preview.current_position_side)} · {preview.current_position_size}
                    </span>
                    <span>
                      成交后 {positionSideLabel(preview.projected_position_side)} · {preview.projected_position_size}
                    </span>
                  </div>
                  <div className="execution-preview__line">
                    <span>参考均价 {preview.current_avg_price}</span>
                    <span>成交后均价 {preview.projected_avg_price}</span>
                    <span>预估已实现 {preview.estimated_realized_pnl}</span>
                  </div>
                  {!preview.allowed && preview.blocked_reason && (
                    <div className="execution-preview__line">
                      <span>{preview.blocked_reason}</span>
                    </div>
                  )}
                  {preview.recommended_action && (
                    <div className="execution-preview__line">
                      <span>建议 {preview.recommended_action}</span>
                    </div>
                  )}
                  {preview.warnings.length > 0 && (
                    <div className="execution-preview__warnings">
                      {preview.warnings.map((warning) => (
                        <span key={warning}>{warning}</span>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}

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
        </div>
      </aside>
    </div>
  )
}

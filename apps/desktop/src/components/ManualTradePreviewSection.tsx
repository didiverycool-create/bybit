import { positionSideLabel } from '../utils/app-helpers'

import type { ManualTradePreviewSectionProps } from './manualTradePanelTypes'

export default function ManualTradePreviewSection({
  selectedMode,
  previewLoading,
  preview,
}: ManualTradePreviewSectionProps) {
  if (!previewLoading && !preview) {
    return null
  }

  return (
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
  )
}

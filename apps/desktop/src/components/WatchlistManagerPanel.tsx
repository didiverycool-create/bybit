import { X } from 'lucide-react'

import type { WatchlistInstrument } from '../types'
import { riskLevelLabel, riskToneClass, signalLabel, signalToneClass } from '../utils/app-helpers'

type WatchlistManagerPanelProps = {
  open: boolean
  onClose: () => void
  draftSymbol: string
  onDraftSymbolChange: (value: string) => void
  draftMarket: 'spot' | 'perp'
  onDraftMarketChange: (value: 'spot' | 'perp') => void
  onSubmit: () => void
  submitPending: boolean
  watchlist: WatchlistInstrument[]
  alertDrafts: Record<string, string>
  onAlertDraftChange: (symbol: string, value: string) => void
  onUpdateAlertRule: (item: WatchlistInstrument) => void
  onToggleAlertRule: (item: WatchlistInstrument) => void
  controlsDisabled: boolean
  removePending: boolean
  onRemove: (symbol: string) => void
}

export default function WatchlistManagerPanel({
  open,
  onClose,
  draftSymbol,
  onDraftSymbolChange,
  draftMarket,
  onDraftMarketChange,
  onSubmit,
  submitPending,
  watchlist,
  alertDrafts,
  onAlertDraftChange,
  onUpdateAlertRule,
  onToggleAlertRule,
  controlsDisabled,
  removePending,
  onRemove,
}: WatchlistManagerPanelProps) {
  if (!open) {
    return null
  }

  return (
    <div className="floating-panel-backdrop" onClick={onClose}>
      <aside
        className="floating-panel"
        role="dialog"
        aria-modal="true"
        aria-label="自选管理"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="floating-panel__head">
          <div>
            <span className="section-label">自选管理</span>
            <h3>新增或移除关注品种</h3>
          </div>
          <button
            type="button"
            className="icon-button"
            title="关闭自选管理"
            aria-label="关闭自选管理"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="floating-panel__body">
          <div className="field-grid">
            <label className="field">
              <span>品种代码</span>
              <input
                value={draftSymbol}
                onChange={(event) => onDraftSymbolChange(event.target.value)}
                placeholder="例如 BTCUSDT"
              />
            </label>
            <label className="field">
              <span>市场类型</span>
              <select value={draftMarket} onChange={(event) => onDraftMarketChange(event.target.value as 'spot' | 'perp')}>
                <option value="perp">永续</option>
                <option value="spot">现货</option>
              </select>
            </label>
            <div className="field">
              <span>动作</span>
              <button type="button" className="primary-button" disabled={submitPending} onClick={onSubmit}>
                添加到自选
              </button>
            </div>
          </div>

          <div className="job-list">
            {watchlist.map((item) => (
              <div key={item.symbol} className="job-row">
                <div className="console-row__main">
                  <strong>{item.symbol}</strong>
                  <p>
                    {item.market === 'perp' ? '永续' : '现货'}
                    {' · '}
                    <span className={signalToneClass(item.signal)}>{signalLabel(item.signal)}</span>
                    {' · '}
                    <span className={riskToneClass(item.risk_level)}>{riskLevelLabel(item.risk_level)}</span>
                    {' · '}
                    {item.alert_enabled ? `提醒 ${item.alert_threshold_pct.toFixed(1)}%` : '提醒已关闭'}
                  </p>
                </div>
                <div className="job-meta job-meta--watchlist">
                  <label className="watchlist-rule-editor">
                    <span>提醒阈值 %</span>
                    <input
                      value={alertDrafts[item.symbol] ?? item.alert_threshold_pct.toFixed(1)}
                      onChange={(event) => onAlertDraftChange(item.symbol, event.target.value)}
                      inputMode="decimal"
                      placeholder="2.5"
                    />
                  </label>
                  <div className="inline-actions inline-actions--tight" data-strategy-activity-top-actions="audit">
                    <button
                      type="button"
                      className="ghost-button ghost-button--inline"
                      disabled={controlsDisabled}
                      onClick={() => onUpdateAlertRule(item)}
                    >
                      更新提醒
                    </button>
                    <button
                      type="button"
                      className="ghost-button ghost-button--inline"
                      disabled={controlsDisabled}
                      onClick={() => onToggleAlertRule(item)}
                    >
                      {item.alert_enabled ? '关闭提醒' : '启用提醒'}
                    </button>
                  </div>
                </div>
                <div className="job-meta">
                  <button
                    type="button"
                    className="ghost-button ghost-button--inline"
                    disabled={removePending}
                    onClick={() => onRemove(item.symbol)}
                  >
                    移除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

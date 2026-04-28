import { AlertTriangle } from 'lucide-react'

import type { MarketWorkspaceTradingSectionProps } from './marketWorkspaceSectionTypes'
import { formatNumber, formatTime, marketTradeSideClass, marketTradeSideLabel } from '../utils/app-helpers'

export default function MarketWorkspaceTradingSection({
  marketDetail,
  selectedWatchAlertLabel,
  manualTradingBlockedReason,
  onOpenManualTrade,
}: MarketWorkspaceTradingSectionProps) {
  const marketPublicTrades = marketDetail?.recent_public_trades ?? []

  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <span className="section-label">盘口与手动交易</span>
          <h3>辅助交易面板</h3>
        </div>
        <div className="chip-row">
          <button type="button" className="ghost-button ghost-button--inline" onClick={onOpenManualTrade}>
            打开手动交易
          </button>
          <span className="chip chip--muted" title="Paper 走本地成交，Demo / Live 走 Bybit 真实限价委托。">
            手动交易入口
          </span>
          <span className="chip chip--muted">{selectedWatchAlertLabel}</span>
        </div>
      </div>
      <div className="market-liquidity-grid market-liquidity-grid--tight">
        <div className="orderbook-column">
          <strong>买盘</strong>
          {marketDetail?.bids.slice(0, 4).map((item) => (
            <div key={`bid-${item.price}`} className="orderbook-row">
              <span>{formatNumber(item.price)}</span>
              <span>{formatNumber(item.size)}</span>
              <span>{formatNumber(item.total)}</span>
            </div>
          ))}
        </div>
        <div className="orderbook-column">
          <strong>卖盘</strong>
          {marketDetail?.asks.slice(0, 4).map((item) => (
            <div key={`ask-${item.price}`} className="orderbook-row">
              <span>{formatNumber(item.price)}</span>
              <span>{formatNumber(item.size)}</span>
              <span>{formatNumber(item.total)}</span>
            </div>
          ))}
        </div>
        <div className="trade-tape-column">
          <div className="trade-tape-column__head">
            <strong>最近成交</strong>
            <span>{marketPublicTrades.length} 条</span>
          </div>
          <div className="trade-tape-list">
            {marketPublicTrades.slice(0, 6).map((item, index) => (
              <div
                key={`${item.occurred_at}-${item.price}-${index}`}
                className="trade-tape-row trade-tape-row--fade"
                style={{ animationDelay: `${index * 24}ms` }}
              >
                <span className={`trade-tape-row__badge ${marketTradeSideClass(item.side)}`}>
                  {marketTradeSideLabel(item.side)}
                </span>
                <strong className={marketTradeSideClass(item.side)}>{formatNumber(item.price)}</strong>
                <span>{formatNumber(item.size)}</span>
                <span>{formatTime(item.occurred_at)}</span>
              </div>
            ))}
            {marketPublicTrades.length === 0 && (
              <div className="empty-state empty-state--inline">当前没有可展示的公共成交流。</div>
            )}
          </div>
        </div>
      </div>

      {manualTradingBlockedReason && (
        <div className="service-banner service-banner--warning service-banner--inline">
          <AlertTriangle size={16} />
          <div>
            <strong>手动交易暂不可提交</strong>
            <p>{manualTradingBlockedReason}</p>
          </div>
        </div>
      )}
    </article>
  )
}

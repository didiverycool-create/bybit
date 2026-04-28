import { formatNumber, formatTime, pnlToneClass, tradeOriginLabel } from '../../utils/app-helpers'
import type { TradesWorkspaceTradesPanelProps } from './types'

export function TradesWorkspaceTradesPanel({ filteredTrades }: TradesWorkspaceTradesPanelProps) {
  return (
    <article className="panel">
      <div className="watchlist-module__header">
        <span className="section-label">最近成交</span>
        <strong>{filteredTrades.length} 条</strong>
      </div>
      <div className="trade-list trade-list--dense">
        {filteredTrades.map((trade, index) => (
          <div key={trade.id} className="trade-row trade-row--fade" style={{ animationDelay: `${index * 24}ms` }}>
            <div className="console-row__main">
              <strong>
                {trade.symbol} · {trade.side === 'buy' ? '买入' : '卖出'}
              </strong>
              <p>
                {formatNumber(trade.price)} · 数量 {formatNumber(trade.quantity)} · {tradeOriginLabel(trade.origin)}
              </p>
            </div>
            <div className="trade-meta">
              <span className={`console-tag ${trade.mode === 'live' ? 'console-tag--warn' : ''}`}>{trade.mode.toUpperCase()}</span>
              <span className="console-tag">{trade.status}</span>
              <small className={pnlToneClass(trade.pnl)}>{trade.pnl !== '--' ? trade.pnl : formatTime(trade.created_at)}</small>
            </div>
          </div>
        ))}
        {filteredTrades.length === 0 && <div className="empty-state empty-state--inline">当前筛选下没有成交记录</div>}
      </div>
    </article>
  )
}

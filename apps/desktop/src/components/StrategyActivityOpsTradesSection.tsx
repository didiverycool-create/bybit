import type { StrategyActivityOpsTradesSectionProps } from './strategyActivityOpsSectionTypes'
import { formatDateTime, tradeActivitySummary } from '../utils/app-helpers'

export default function StrategyActivityOpsTradesSection({
  strategyActivityLatestTradeSupplemented,
  strategyActivityTrades,
  activityLatestTrade,
  onOpenTradesSection,
  onOpenMarketSymbol,
}: StrategyActivityOpsTradesSectionProps) {
  return (
    <div className="trade-list trade-list--dense" data-strategy-activity-action-group="trades">
      {strategyActivityLatestTradeSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_trade_supplemented_hint">
          顶部最新成交不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿同一成交追踪。
        </p>
      )}
      {strategyActivityTrades.map((trade) => (
        <div key={trade.id} className="trade-row trade-row--fade" data-strategy-activity-row-id={trade.id}>
          <div className="console-row__main">
            <strong>{tradeActivitySummary(trade)}</strong>
            <p>{trade.pnl}</p>
          </div>
          <div className="trade-meta">
            {activityLatestTrade?.id === trade.id && <span className="console-tag console-tag--warn">当前最新</span>}
            <span className="console-tag">{trade.mode.toUpperCase()}</span>
            <button type="button" className="micro-action" onClick={() => onOpenTradesSection(trade.symbol)}>
              成交页
            </button>
            <button type="button" className="micro-action" onClick={() => onOpenMarketSymbol(trade.symbol)}>
              成交行情
            </button>
            <small>{formatDateTime(trade.created_at)}</small>
          </div>
        </div>
      ))}
      {!strategyActivityTrades.length && (
        <div className="empty-state empty-state--inline">当前没有策略相关成交记录。</div>
      )}
    </div>
  )
}

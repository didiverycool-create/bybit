import { accountSourceLabel, formatTime, tradeOriginLabel } from '../../utils/app-helpers'
import type { TradesWorkspacePositionsPanelProps } from './types'

export function TradesWorkspacePositionsPanel({
  accountOverview,
  recentTradesCount,
  manualTradesCount,
  onOpenOrderHistory,
  selectedMode,
  tradeModeFilter,
  tradeModeOptions,
  onTradeModeFilterChange,
  tradeOriginFilter,
  tradeOriginOptions,
  onTradeOriginFilterChange,
  tradeScopeFilter,
  selectedSymbol,
  onToggleTradeScopeFilter,
  accountPositions,
  serviceAvailable,
  closeAllPaperPositionsPending,
  closeAllExchangePositionsPending,
  onCloseAllPaperPositions,
  onCloseAllExchangePositions,
  closePaperPositionPending,
  closeExchangePositionPending,
  onClosePaperPosition,
  onCloseExchangePosition,
  filteredAccountOrders,
  cancelAllPaperOrdersPending,
  cancelAllExchangeOrdersPending,
  onCancelAllPaperOrders,
  onCancelAllExchangeOrders,
  replacePaperOrderPending,
  replaceExchangeOrderPending,
  cancelPaperOrderPending,
  cancelExchangeOrderPending,
  onOpenOrderEditor,
  onCancelPaperOrder,
  onCancelExchangeOrder,
}: TradesWorkspacePositionsPanelProps) {
  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <span className="section-label">持仓与委托</span>
          <h3>当前仓位、挂单和成交记录</h3>
        </div>
        <div className="inline-actions inline-actions--tight">
          <span className="chip chip--muted">
            成交 {recentTradesCount} · 手动 {manualTradesCount} · 来源 {accountSourceLabel(accountOverview?.source)}
          </span>
          <button type="button" className="ghost-button ghost-button--inline" onClick={onOpenOrderHistory}>
            历史订单
          </button>
        </div>
      </div>
      <div className="ops-toolbar">
        <div className="ops-toolbar__group">
          <span className="section-label">模式</span>
          {tradeModeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`pill pill--compact ${tradeModeFilter === option.value ? 'active' : ''}`}
              onClick={() => onTradeModeFilterChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="ops-toolbar__group">
          <span className="section-label">来源</span>
          {tradeOriginOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`pill pill--compact ${tradeOriginFilter === option.value ? 'active' : ''}`}
              onClick={() => onTradeOriginFilterChange(option.value)}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            className={`pill pill--compact ${tradeScopeFilter === 'selected' ? 'active' : ''}`}
            onClick={onToggleTradeScopeFilter}
          >
            {tradeScopeFilter === 'selected' ? selectedSymbol : '当前品种'}
          </button>
        </div>
      </div>
      <div className="record-stack record-stack--compact">
        <div className="console-panel console-panel--stream">
          <div className="watchlist-module__header">
            <div>
              <span className="section-label">当前持仓</span>
              <strong>{accountPositions.length} 条</strong>
            </div>
            {selectedMode === 'paper' && accountPositions.some((position) => position.source === 'paper') && (
              <button
                type="button"
                className="ghost-button ghost-button--inline"
                disabled={!serviceAvailable || closeAllPaperPositionsPending}
                onClick={onCloseAllPaperPositions}
              >
                全平
              </button>
            )}
            {selectedMode !== 'paper' && accountPositions.some((position) => position.source === 'bybit_private') && (
              <button
                type="button"
                className="ghost-button ghost-button--inline"
                disabled={!serviceAvailable || closeAllExchangePositionsPending}
                onClick={onCloseAllExchangePositions}
              >
                全平
              </button>
            )}
          </div>
          <div className="trade-list trade-list--dense">
            {accountPositions.map((position, index) => (
              <div key={`${position.symbol}-${position.side}`} className="trade-row trade-row--fade" style={{ animationDelay: `${index * 24}ms` }}>
                <div className="console-row__main">
                  <strong>
                    {position.symbol} · {position.side === 'long' ? '多仓' : '空仓'}
                  </strong>
                  <p>
                    均价 {position.avg_price} · 标记价 {position.mark_price} · 数量 {position.size}
                  </p>
                </div>
                <div className="trade-meta">
                  <span className="console-tag">{position.market === 'perp' ? '永续' : '现货'}</span>
                  <span className="console-tag">{position.leverage}</span>
                  {position.source === 'paper' && selectedMode === 'paper' && (
                    <button
                      type="button"
                      className="micro-action"
                      disabled={!serviceAvailable || closePaperPositionPending}
                      onClick={() => onClosePaperPosition(position.symbol)}
                    >
                      平仓
                    </button>
                  )}
                  {position.source === 'bybit_private' && selectedMode !== 'paper' && (
                    <button
                      type="button"
                      className="micro-action"
                      disabled={!serviceAvailable || closeExchangePositionPending}
                      onClick={() => onCloseExchangePosition(position.symbol)}
                    >
                      平仓
                    </button>
                  )}
                  <small>{position.unrealised_pnl}</small>
                </div>
              </div>
            ))}
            {accountPositions.length === 0 && <div className="empty-state empty-state--inline">当前没有持仓数据</div>}
          </div>
        </div>
        <div className="console-panel">
          <div className="watchlist-module__header">
            <div>
              <span className="section-label">未成交委托</span>
              <strong>{filteredAccountOrders.length} 条</strong>
            </div>
            {selectedMode === 'paper' && filteredAccountOrders.some((order) => order.source === 'paper') && (
              <button
                type="button"
                className="ghost-button ghost-button--inline"
                disabled={!serviceAvailable || cancelAllPaperOrdersPending}
                onClick={onCancelAllPaperOrders}
              >
                全撤
              </button>
            )}
            {selectedMode !== 'paper' && filteredAccountOrders.some((order) => order.source === 'bybit_private') && (
              <button
                type="button"
                className="ghost-button ghost-button--inline"
                disabled={!serviceAvailable || cancelAllExchangeOrdersPending}
                onClick={onCancelAllExchangeOrders}
              >
                全撤
              </button>
            )}
          </div>
          <div className="trade-list trade-list--dense">
            {filteredAccountOrders.map((order, index) => (
              <div key={order.order_id} className="trade-row trade-row--fade" style={{ animationDelay: `${index * 24}ms` }}>
                <div className="console-row__main">
                  <strong>
                    {order.symbol} · {order.side === 'buy' ? '买单' : '卖单'}
                  </strong>
                  <p>
                    {order.order_type} · 价格 {order.price} · 数量 {order.qty}
                    {order.origin === 'strategy' && order.strategy_id ? ` · 策略 ${order.strategy_id}` : ''}
                  </p>
                </div>
                <div className="trade-meta">
                  <span className="console-tag">{order.market === 'perp' ? '永续' : '现货'}</span>
                  <span className="console-tag">{tradeOriginLabel(order.origin)}</span>
                  <span className="console-tag">{order.status}</span>
                  {order.source === 'paper' && selectedMode === 'paper' && (
                    <>
                      <button
                        type="button"
                        className="micro-action"
                        disabled={!serviceAvailable || replacePaperOrderPending}
                        onClick={() => onOpenOrderEditor(order)}
                      >
                        改单
                      </button>
                      <button
                        type="button"
                        className="micro-action"
                        disabled={!serviceAvailable || cancelPaperOrderPending}
                        onClick={() => onCancelPaperOrder(order.order_id)}
                      >
                        撤单
                      </button>
                    </>
                  )}
                  {order.source === 'bybit_private' && selectedMode !== 'paper' && (
                    <>
                      <button
                        type="button"
                        className="micro-action"
                        disabled={!serviceAvailable || replaceExchangeOrderPending}
                        onClick={() => onOpenOrderEditor(order)}
                      >
                        改单
                      </button>
                      <button
                        type="button"
                        className="micro-action"
                        disabled={!serviceAvailable || cancelExchangeOrderPending}
                        onClick={() => onCancelExchangeOrder(order.order_id)}
                      >
                        撤单
                      </button>
                    </>
                  )}
                  <small>{formatTime(order.created_at)}</small>
                </div>
              </div>
            ))}
            {filteredAccountOrders.length === 0 && <div className="empty-state empty-state--inline">当前筛选下没有未成交委托</div>}
          </div>
        </div>
      </div>
    </article>
  )
}

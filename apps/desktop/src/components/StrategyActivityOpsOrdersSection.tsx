import type { StrategyActivityOpsOrdersSectionProps } from './strategyActivityOpsSectionTypes'
import { formatDateTime, orderActivitySummary, orderSourceLabel } from '../utils/app-helpers'

export default function StrategyActivityOpsOrdersSection({
  selectedMode,
  strategyActivityLatestActiveOrderSupplemented,
  strategyActivityActiveOrders,
  activityLatestActiveOrder,
  activityLatestOrder,
  replacePaperOrderPending,
  cancelPaperOrderPending,
  replaceExchangeOrderPending,
  cancelExchangeOrderPending,
  serviceAvailable,
  onOpenTradesSection,
  onOpenMarketSymbol,
  onOpenOrderEditor,
  onCancelPaperOrder,
  onCancelExchangeOrder,
  strategyActivityLatestHistoricalOrderSupplemented,
  strategyActivityOrders,
  activityLatestHistoricalOrder,
}: StrategyActivityOpsOrdersSectionProps) {
  return (
    <>
      <span className="section-label">委托 / 成交</span>
      {strategyActivityLatestActiveOrderSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_active_order_supplemented_section_hint">
          顶部当前活跃委托不在最近活动返回范围内，面板已临时把它补进“活跃委托”视图，便于继续近场改单或撤单。
        </p>
      )}
      <div className="trade-list trade-list--dense" data-strategy-activity-action-group="active-orders">
        {strategyActivityActiveOrders.map((order) => (
          <div
            key={`active-${order.order_id}`}
            className="trade-row trade-row--fade"
            data-strategy-activity-row-id={order.order_id}
          >
            <div className="console-row__main">
              <strong>{orderActivitySummary(order)}</strong>
              <p>{order.status}</p>
            </div>
            <div className="trade-meta">
              {activityLatestActiveOrder?.order_id === order.order_id && (
                <span className="console-tag console-tag--warn">当前活跃</span>
              )}
              {activityLatestOrder?.order_id === order.order_id && (
                <span className="console-tag console-tag--warn">当前最新</span>
              )}
              <span className="console-tag">{order.market.toUpperCase()}</span>
              <button type="button" className="micro-action" onClick={() => onOpenTradesSection(order.symbol)}>
                委托页
              </button>
              <button type="button" className="micro-action" onClick={() => onOpenMarketSymbol(order.symbol)}>
                委托行情
              </button>
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
              <small>{formatDateTime(order.created_at)}</small>
            </div>
          </div>
        ))}
        {!strategyActivityActiveOrders.length && (
          <div className="empty-state empty-state--inline">当前没有活跃的策略关联委托。</div>
        )}
      </div>
      <div className="trade-list trade-list--dense" data-strategy-activity-action-group="historical-orders">
        {strategyActivityLatestHistoricalOrderSupplemented && (
          <p className="panel-note" data-strategy-activity-note-key="latest_historical_order_supplemented_section_hint">
            顶部最新历史委托不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿同一委托追单。
          </p>
        )}
        {strategyActivityOrders.map((order) => (
          <div
            key={`history-${order.order_id}`}
            className="trade-row trade-row--fade"
            data-strategy-activity-row-id={order.order_id}
          >
            <div className="console-row__main">
              <strong>{orderActivitySummary(order)}</strong>
              <p>{order.status}</p>
            </div>
            <div className="trade-meta">
              {activityLatestHistoricalOrder?.order_id === order.order_id && (
                <span className="console-tag console-tag--warn">当前最新历史</span>
              )}
              {activityLatestOrder?.order_id === order.order_id &&
                activityLatestHistoricalOrder?.order_id !== order.order_id && (
                  <span className="console-tag console-tag--warn">当前最新</span>
                )}
              <span className="console-tag">{orderSourceLabel(order.source)}</span>
              <button type="button" className="micro-action" onClick={() => onOpenTradesSection(order.symbol)}>
                委托页
              </button>
              <button type="button" className="micro-action" onClick={() => onOpenMarketSymbol(order.symbol)}>
                委托行情
              </button>
              <small>{formatDateTime(order.created_at)}</small>
            </div>
          </div>
        ))}
        {!strategyActivityOrders.length && (
          <div className="empty-state empty-state--inline">当前没有策略历史委托记录。</div>
        )}
      </div>
    </>
  )
}

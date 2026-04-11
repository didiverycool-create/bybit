import { X } from 'lucide-react'

import type { OrderRecord } from '../types'
import { formatTime, orderSourceLabel, tradeOriginLabel } from '../utils/app-helpers'

type OrderHistoryPanelProps = {
  open: boolean
  onClose: () => void
  tradeOriginFilter: 'all' | 'manual' | 'strategy' | 'exchange'
  onTradeOriginFilterChange: (value: 'all' | 'manual' | 'strategy') => void
  tradeScopeFilter: 'all' | 'selected'
  onTradeScopeToggle: () => void
  selectedSymbol: string
  accountSource?: 'mock' | 'paper' | 'bybit_private' | null
  bybitWebEntry: string
  filteredOrderHistory: OrderRecord[]
}

export default function OrderHistoryPanel({
  open,
  onClose,
  tradeOriginFilter,
  onTradeOriginFilterChange,
  tradeScopeFilter,
  onTradeScopeToggle,
  selectedSymbol,
  accountSource,
  bybitWebEntry,
  filteredOrderHistory,
}: OrderHistoryPanelProps) {
  if (!open) {
    return null
  }

  return (
    <div className="floating-panel-backdrop" onClick={onClose}>
      <aside
        className="floating-panel floating-panel--wide"
        role="dialog"
        aria-modal="true"
        aria-label="历史订单窗口"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="floating-panel__head">
          <div>
            <span className="section-label">历史订单</span>
            <h3>历史订单与当前品种过滤</h3>
          </div>
          <button
            type="button"
            className="icon-button"
            title="关闭历史订单窗口"
            aria-label="关闭历史订单窗口"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="floating-panel__body">
          <div className="inline-actions inline-actions--tight">
            {(['all', 'manual', 'strategy'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`pill pill--compact ${tradeOriginFilter === value ? 'active' : ''}`}
                onClick={() => onTradeOriginFilterChange(value)}
              >
                {value === 'all' ? '全部来源' : value === 'manual' ? '手动单' : '策略单'}
              </button>
            ))}
            <button
              type="button"
              className={`pill pill--compact ${tradeScopeFilter === 'selected' ? 'active' : ''}`}
              onClick={onTradeScopeToggle}
            >
              {tradeScopeFilter === 'selected' ? `${selectedSymbol}` : '当前品种'}
            </button>
            <span className="section-label">
              {accountSource === 'paper'
                ? '当前历史订单来自本地 Paper 成交派生；真实网页登录入口仍使用 '
                : '当前只读历史订单来自程序侧私有 API；网页登录入口仍使用 '}
              {bybitWebEntry}。
            </span>
          </div>
          <div className="trade-list trade-list--dense">
            {filteredOrderHistory.map((order, index) => (
              <div key={`${order.order_id}-${index}`} className="trade-row trade-row--fade" style={{ animationDelay: `${index * 18}ms` }}>
                <div className="console-row__main">
                  <strong>
                    {order.symbol} · {order.side === 'buy' ? '买单' : '卖单'}
                  </strong>
                  <p>
                    {order.order_type} · 价格 {order.price} · 数量 {order.qty} · {order.status}
                    {order.origin === 'strategy' && order.strategy_id ? ` · 策略 ${order.strategy_id}` : ''}
                  </p>
                </div>
                <div className="trade-meta">
                  <span className="console-tag">{orderSourceLabel(order.source)}</span>
                  <span className="console-tag">{order.market === 'perp' ? '永续' : '现货'}</span>
                  <span className="console-tag">{tradeOriginLabel(order.origin)}</span>
                  <small>{formatTime(order.created_at)}</small>
                </div>
              </div>
            ))}
            {filteredOrderHistory.length === 0 && (
              <div className="empty-state empty-state--inline">当前筛选下没有可展示的历史订单。</div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

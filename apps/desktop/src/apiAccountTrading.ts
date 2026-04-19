import type {
  ExecutionPreview,
  ExchangePositionBulkCloseResult,
  OrderRecord,
  TradeRecord,
} from './types'
import { apiFallbacks } from './apiFallbacks'
import { fetchJson, postJson } from './apiHttp'

export const accountTradingApi = {
  getAccountLiveSnapshot: () => fetchJson('/api/account/live', apiFallbacks.accountLive),
  getAccountOverview: () => fetchJson('/api/account/overview', apiFallbacks.accountOverview),
  getAccountPositions: () => fetchJson('/api/account/positions', apiFallbacks.positions),
  getAccountOrders: () => fetchJson('/api/account/orders', apiFallbacks.orders),
  getAccountOrderHistory: () =>
    fetchJson('/api/account/order-history', apiFallbacks.orders),
  getTrades: () => fetchJson('/api/trades', apiFallbacks.trades),
  previewExecution: (payload: {
    symbol: string
    market: 'spot' | 'perp'
    mode: 'paper' | 'demo' | 'live'
    side: 'buy' | 'sell'
    quantity: number
    price: number
    origin?: 'manual' | 'strategy'
    strategy_id?: string
    note?: string
    exclude_order_id?: string
  }) => postJson<ExecutionPreview>('/api/trades/preview', payload),
  createManualTrade: (payload: {
    symbol: string
    market: 'spot' | 'perp'
    mode: 'paper' | 'demo' | 'live'
    side: 'buy' | 'sell'
    quantity: number
    price: number
    note?: string
  }) => postJson<TradeRecord>('/api/trades/manual', payload),
  createExchangeOrder: (payload: {
    symbol: string
    market: 'spot' | 'perp'
    mode: 'paper' | 'demo' | 'live'
    side: 'buy' | 'sell'
    quantity: number
    price: number
    note?: string
  }) => postJson<OrderRecord>('/api/orders/exchange', payload),
  replaceExchangeOrder: (
    orderId: string,
    payload: { quantity: number; price: number; requested_by?: string },
  ) =>
    postJson<OrderRecord>(
      `/api/orders/exchange/${encodeURIComponent(orderId)}/replace`,
      {
        requested_by: payload.requested_by ?? 'desktop_operator',
        quantity: payload.quantity,
        price: payload.price,
      },
    ),
  cancelExchangeOrder: (orderId: string, requested_by = 'desktop_operator') =>
    postJson<OrderRecord>(`/api/orders/exchange/${encodeURIComponent(orderId)}/cancel`, {
      requested_by,
    }),
  cancelAllExchangeOrders: (requested_by = 'desktop_operator') =>
    postJson<{
      cancelled_count: number
      cancelled_order_ids: string[]
      requested_by: string
      updated_at: string
    }>('/api/orders/exchange/cancel-all', { requested_by }),
  createPaperOrder: (payload: {
    symbol: string
    market: 'spot' | 'perp'
    mode: 'paper' | 'demo' | 'live'
    side: 'buy' | 'sell'
    quantity: number
    price: number
    note?: string
  }) => postJson<OrderRecord>('/api/account/paper/orders', payload),
  cancelPaperOrder: (orderId: string, requested_by = 'desktop_operator') =>
    postJson<OrderRecord>(
      `/api/account/paper/orders/${encodeURIComponent(orderId)}/cancel`,
      { requested_by },
    ),
  cancelAllPaperOrders: (requested_by = 'desktop_operator') =>
    postJson<{
      cancelled_count: number
      cancelled_order_ids: string[]
      requested_by: string
      updated_at: string
    }>('/api/account/paper/orders/cancel-all', { requested_by }),
  replacePaperOrder: (
    orderId: string,
    payload: { quantity: number; price: number; requested_by?: string },
  ) =>
    postJson<OrderRecord>(
      `/api/account/paper/orders/${encodeURIComponent(orderId)}/replace`,
      {
        requested_by: payload.requested_by ?? 'desktop_operator',
        quantity: payload.quantity,
        price: payload.price,
      },
    ),
  closePaperPosition: (symbol: string, requested_by = 'desktop_operator') =>
    postJson<TradeRecord>(
      `/api/account/paper/positions/${symbol}/close`,
      { requested_by },
    ),
  closeAllPaperPositions: (requested_by = 'desktop_operator') =>
    postJson<{
      closed_count: number
      trade_ids: string[]
      requested_by: string
      updated_at: string
    }>('/api/account/paper/positions/close-all', { requested_by }),
  closeExchangePosition: (symbol: string, requested_by = 'desktop_operator') =>
    postJson<OrderRecord>(`/api/account/exchange/positions/${symbol}/close`, {
      requested_by,
    }),
  closeAllExchangePositions: (requested_by = 'desktop_operator') =>
    postJson<ExchangePositionBulkCloseResult>(
      '/api/account/exchange/positions/close-all',
      { requested_by },
    ),
}

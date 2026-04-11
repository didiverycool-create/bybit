import type { AccountOverview, Mode, OrderRecord, PositionRecord, TradeRecord } from '../../types'

export type TradeModeFilter = 'all' | Mode
export type TradeOriginFilter = 'all' | 'manual' | 'strategy' | 'exchange'
export type TradeScopeFilter = 'all' | 'selected'

export type TradeFilterOption<T extends string> = {
  value: T
  label: string
}

export type TradesWorkspaceSummaryPanelProps = {
  privateApiReady: boolean
  onOpenAccountInspector: () => void
  accountOverview?: AccountOverview | null
  todayRealizedPnl?: string | null
}

export type TradesWorkspacePositionsPanelProps = {
  accountOverview?: AccountOverview | null
  recentTradesCount: number
  manualTradesCount: number
  onOpenOrderHistory: () => void
  selectedMode: Mode
  tradeModeFilter: TradeModeFilter
  tradeModeOptions: Array<TradeFilterOption<TradeModeFilter>>
  onTradeModeFilterChange: (value: TradeModeFilter) => void
  tradeOriginFilter: TradeOriginFilter
  tradeOriginOptions: Array<TradeFilterOption<TradeOriginFilter>>
  onTradeOriginFilterChange: (value: TradeOriginFilter) => void
  tradeScopeFilter: TradeScopeFilter
  selectedSymbol: string
  onToggleTradeScopeFilter: () => void
  accountPositions: PositionRecord[]
  serviceAvailable: boolean
  closeAllPaperPositionsPending: boolean
  closeAllExchangePositionsPending: boolean
  onCloseAllPaperPositions: () => void
  onCloseAllExchangePositions: () => void
  closePaperPositionPending: boolean
  closeExchangePositionPending: boolean
  onClosePaperPosition: (symbol: string) => void
  onCloseExchangePosition: (symbol: string) => void
  filteredAccountOrders: OrderRecord[]
  cancelAllPaperOrdersPending: boolean
  cancelAllExchangeOrdersPending: boolean
  onCancelAllPaperOrders: () => void
  onCancelAllExchangeOrders: () => void
  replacePaperOrderPending: boolean
  replaceExchangeOrderPending: boolean
  cancelPaperOrderPending: boolean
  cancelExchangeOrderPending: boolean
  onOpenOrderEditor: (order: OrderRecord) => void
  onCancelPaperOrder: (orderId: string) => void
  onCancelExchangeOrder: (orderId: string) => void
}

export type TradesWorkspaceTradesPanelProps = {
  filteredTrades: TradeRecord[]
}

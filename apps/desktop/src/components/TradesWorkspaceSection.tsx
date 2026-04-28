import type { AccountOverview, Mode, OrderRecord, PositionRecord, TradeRecord } from '../types'
import {
  TradesWorkspacePositionsPanel,
  TradesWorkspaceSummaryPanel,
  TradesWorkspaceTradesPanel,
  type TradeFilterOption,
  type TradeModeFilter,
  type TradeOriginFilter,
  type TradeScopeFilter,
} from './trades-workspace'

type TradesWorkspaceSectionProps = {
  privateApiReady: boolean
  onOpenAccountInspector: () => void
  accountOverview?: AccountOverview | null
  todayRealizedPnl?: string | null
  recentTradesCount: number
  manualTradesCount: number
  onOpenOrderHistory: () => void
  selectedMode: Mode
  tradeModeFilter: TradeModeFilter
  onTradeModeFilterChange: (value: TradeModeFilter) => void
  tradeOriginFilter: TradeOriginFilter
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
  filteredTrades: TradeRecord[]
}

const tradeModeOptions: Array<TradeFilterOption<TradeModeFilter>> = [
  { value: 'all', label: '全部' },
  { value: 'paper', label: 'PAPER' },
  { value: 'demo', label: 'DEMO' },
  { value: 'live', label: 'LIVE' },
]

const tradeOriginOptions: Array<TradeFilterOption<TradeOriginFilter>> = [
  { value: 'all', label: '全部' },
  { value: 'manual', label: '手动' },
  { value: 'strategy', label: '策略' },
  { value: 'exchange', label: '交易所' },
]

export default function TradesWorkspaceSection({
  privateApiReady,
  onOpenAccountInspector,
  accountOverview,
  todayRealizedPnl,
  recentTradesCount,
  manualTradesCount,
  onOpenOrderHistory,
  selectedMode,
  tradeModeFilter,
  onTradeModeFilterChange,
  tradeOriginFilter,
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
  filteredTrades,
}: TradesWorkspaceSectionProps) {
  return (
    <section className="section-grid section-entrance">
      <TradesWorkspaceSummaryPanel
        privateApiReady={privateApiReady}
        onOpenAccountInspector={onOpenAccountInspector}
        accountOverview={accountOverview}
        todayRealizedPnl={todayRealizedPnl}
      />
      <TradesWorkspacePositionsPanel
        accountOverview={accountOverview}
        recentTradesCount={recentTradesCount}
        manualTradesCount={manualTradesCount}
        onOpenOrderHistory={onOpenOrderHistory}
        selectedMode={selectedMode}
        tradeModeFilter={tradeModeFilter}
        tradeModeOptions={tradeModeOptions}
        onTradeModeFilterChange={onTradeModeFilterChange}
        tradeOriginFilter={tradeOriginFilter}
        tradeOriginOptions={tradeOriginOptions}
        onTradeOriginFilterChange={onTradeOriginFilterChange}
        tradeScopeFilter={tradeScopeFilter}
        selectedSymbol={selectedSymbol}
        onToggleTradeScopeFilter={onToggleTradeScopeFilter}
        accountPositions={accountPositions}
        serviceAvailable={serviceAvailable}
        closeAllPaperPositionsPending={closeAllPaperPositionsPending}
        closeAllExchangePositionsPending={closeAllExchangePositionsPending}
        onCloseAllPaperPositions={onCloseAllPaperPositions}
        onCloseAllExchangePositions={onCloseAllExchangePositions}
        closePaperPositionPending={closePaperPositionPending}
        closeExchangePositionPending={closeExchangePositionPending}
        onClosePaperPosition={onClosePaperPosition}
        onCloseExchangePosition={onCloseExchangePosition}
        filteredAccountOrders={filteredAccountOrders}
        cancelAllPaperOrdersPending={cancelAllPaperOrdersPending}
        cancelAllExchangeOrdersPending={cancelAllExchangeOrdersPending}
        onCancelAllPaperOrders={onCancelAllPaperOrders}
        onCancelAllExchangeOrders={onCancelAllExchangeOrders}
        replacePaperOrderPending={replacePaperOrderPending}
        replaceExchangeOrderPending={replaceExchangeOrderPending}
        cancelPaperOrderPending={cancelPaperOrderPending}
        cancelExchangeOrderPending={cancelExchangeOrderPending}
        onOpenOrderEditor={onOpenOrderEditor}
        onCancelPaperOrder={onCancelPaperOrder}
        onCancelExchangeOrder={onCancelExchangeOrder}
      />
      <TradesWorkspaceTradesPanel filteredTrades={filteredTrades} />
    </section>
  )
}

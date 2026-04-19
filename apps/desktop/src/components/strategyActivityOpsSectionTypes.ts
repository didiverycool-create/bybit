import type { AlertRecord, ExecutionEvent, Mode, OrderRecord, TradeRecord } from '../types'

export type StrategyActivityOpsSectionProps = {
  strategyId: string
  serviceAvailable: boolean
  selectedMode: Mode
  strategyActivityLatestPendingAlertSupplemented: boolean
  strategyActivityLatestAlertSupplemented: boolean
  strategyActivityAlerts: AlertRecord[]
  activityLatestAlert: AlertRecord | null
  activityLatestPendingAlert: AlertRecord | null
  alertMutationPending: boolean
  onOpenAlertsSection: (symbol?: string | null) => void
  onOpenMarketSymbol: (symbol: string) => void
  onOpenWatchlistManager: () => void
  onToggleAlertAcknowledged: (alertId: string, nextAcknowledged: boolean) => void
  strategyActivityLatestAuditSupplemented: boolean
  strategyActivityAuditEvents: ExecutionEvent[]
  activityLatestAuditEvent: ExecutionEvent | null
  onOpenAuditSection: (symbol?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  strategyActivityLatestActiveOrderSupplemented: boolean
  strategyActivityActiveOrders: OrderRecord[]
  activityLatestActiveOrder: OrderRecord | null
  activityLatestOrder: OrderRecord | null
  replacePaperOrderPending: boolean
  cancelPaperOrderPending: boolean
  replaceExchangeOrderPending: boolean
  cancelExchangeOrderPending: boolean
  onOpenTradesSection: (symbol?: string | null) => void
  onOpenOrderEditor: (order: OrderRecord) => void
  onCancelPaperOrder: (orderId: string) => void
  onCancelExchangeOrder: (orderId: string) => void
  strategyActivityLatestHistoricalOrderSupplemented: boolean
  strategyActivityOrders: OrderRecord[]
  activityLatestHistoricalOrder: OrderRecord | null
  strategyActivityLatestTradeSupplemented: boolean
  strategyActivityTrades: TradeRecord[]
  activityLatestTrade: TradeRecord | null
}

export type StrategyActivityOpsAlertsSectionProps = Pick<
  StrategyActivityOpsSectionProps,
  | 'strategyActivityLatestPendingAlertSupplemented'
  | 'strategyActivityLatestAlertSupplemented'
  | 'strategyActivityAlerts'
  | 'activityLatestAlert'
  | 'activityLatestPendingAlert'
  | 'alertMutationPending'
  | 'serviceAvailable'
  | 'onOpenAlertsSection'
  | 'onOpenMarketSymbol'
  | 'onOpenWatchlistManager'
  | 'onToggleAlertAcknowledged'
>

export type StrategyActivityOpsAuditSectionProps = Pick<
  StrategyActivityOpsSectionProps,
  | 'strategyId'
  | 'strategyActivityLatestAuditSupplemented'
  | 'strategyActivityAuditEvents'
  | 'activityLatestAuditEvent'
  | 'onOpenAuditSection'
  | 'onOpenAiSchedulerJob'
  | 'onOpenReviewInspector'
  | 'onOpenChangeRequest'
  | 'onOpenBacktestDetail'
  | 'onOpenSourceReview'
  | 'onOpenStrategyProposal'
>

export type StrategyActivityOpsOrdersSectionProps = Pick<
  StrategyActivityOpsSectionProps,
  | 'selectedMode'
  | 'strategyActivityLatestActiveOrderSupplemented'
  | 'strategyActivityActiveOrders'
  | 'activityLatestActiveOrder'
  | 'activityLatestOrder'
  | 'replacePaperOrderPending'
  | 'cancelPaperOrderPending'
  | 'replaceExchangeOrderPending'
  | 'cancelExchangeOrderPending'
  | 'serviceAvailable'
  | 'onOpenTradesSection'
  | 'onOpenMarketSymbol'
  | 'onOpenOrderEditor'
  | 'onCancelPaperOrder'
  | 'onCancelExchangeOrder'
  | 'strategyActivityLatestHistoricalOrderSupplemented'
  | 'strategyActivityOrders'
  | 'activityLatestHistoricalOrder'
>

export type StrategyActivityOpsTradesSectionProps = Pick<
  StrategyActivityOpsSectionProps,
  | 'strategyActivityLatestTradeSupplemented'
  | 'strategyActivityTrades'
  | 'activityLatestTrade'
  | 'onOpenTradesSection'
  | 'onOpenMarketSymbol'
>

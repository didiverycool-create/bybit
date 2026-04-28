import StrategyActivityOpsAlertsSection from './StrategyActivityOpsAlertsSection'
import StrategyActivityOpsAuditSection from './StrategyActivityOpsAuditSection'
import StrategyActivityOpsOrdersSection from './StrategyActivityOpsOrdersSection'
import StrategyActivityOpsTradesSection from './StrategyActivityOpsTradesSection'
import type { StrategyActivityOpsSectionProps } from './strategyActivityOpsSectionTypes'

export type { StrategyActivityOpsSectionProps } from './strategyActivityOpsSectionTypes'

export default function StrategyActivityOpsSection({
  strategyId,
  serviceAvailable,
  selectedMode,
  strategyActivityLatestPendingAlertSupplemented,
  strategyActivityLatestAlertSupplemented,
  strategyActivityAlerts,
  activityLatestAlert,
  activityLatestPendingAlert,
  alertMutationPending,
  onOpenAlertsSection,
  onOpenMarketSymbol,
  onOpenWatchlistManager,
  onToggleAlertAcknowledged,
  strategyActivityLatestAuditSupplemented,
  strategyActivityAuditEvents,
  activityLatestAuditEvent,
  onOpenAuditSection,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  strategyActivityLatestActiveOrderSupplemented,
  strategyActivityActiveOrders,
  activityLatestActiveOrder,
  activityLatestOrder,
  replacePaperOrderPending,
  cancelPaperOrderPending,
  replaceExchangeOrderPending,
  cancelExchangeOrderPending,
  onOpenTradesSection,
  onOpenOrderEditor,
  onCancelPaperOrder,
  onCancelExchangeOrder,
  strategyActivityLatestHistoricalOrderSupplemented,
  strategyActivityOrders,
  activityLatestHistoricalOrder,
  strategyActivityLatestTradeSupplemented,
  strategyActivityTrades,
  activityLatestTrade,
}: StrategyActivityOpsSectionProps) {
  return (
    <div>
      <StrategyActivityOpsAlertsSection
        strategyActivityLatestPendingAlertSupplemented={strategyActivityLatestPendingAlertSupplemented}
        strategyActivityLatestAlertSupplemented={strategyActivityLatestAlertSupplemented}
        strategyActivityAlerts={strategyActivityAlerts}
        activityLatestAlert={activityLatestAlert}
        activityLatestPendingAlert={activityLatestPendingAlert}
        alertMutationPending={alertMutationPending}
        serviceAvailable={serviceAvailable}
        onOpenAlertsSection={onOpenAlertsSection}
        onOpenMarketSymbol={onOpenMarketSymbol}
        onOpenWatchlistManager={onOpenWatchlistManager}
        onToggleAlertAcknowledged={onToggleAlertAcknowledged}
      />
      <StrategyActivityOpsAuditSection
        strategyId={strategyId}
        strategyActivityLatestAuditSupplemented={strategyActivityLatestAuditSupplemented}
        strategyActivityAuditEvents={strategyActivityAuditEvents}
        activityLatestAuditEvent={activityLatestAuditEvent}
        onOpenAuditSection={onOpenAuditSection}
        onOpenAiSchedulerJob={onOpenAiSchedulerJob}
        onOpenReviewInspector={onOpenReviewInspector}
        onOpenChangeRequest={onOpenChangeRequest}
        onOpenBacktestDetail={onOpenBacktestDetail}
        onOpenSourceReview={onOpenSourceReview}
        onOpenStrategyProposal={onOpenStrategyProposal}
      />
      <StrategyActivityOpsOrdersSection
        selectedMode={selectedMode}
        strategyActivityLatestActiveOrderSupplemented={strategyActivityLatestActiveOrderSupplemented}
        strategyActivityActiveOrders={strategyActivityActiveOrders}
        activityLatestActiveOrder={activityLatestActiveOrder}
        activityLatestOrder={activityLatestOrder}
        replacePaperOrderPending={replacePaperOrderPending}
        cancelPaperOrderPending={cancelPaperOrderPending}
        replaceExchangeOrderPending={replaceExchangeOrderPending}
        cancelExchangeOrderPending={cancelExchangeOrderPending}
        serviceAvailable={serviceAvailable}
        onOpenTradesSection={onOpenTradesSection}
        onOpenMarketSymbol={onOpenMarketSymbol}
        onOpenOrderEditor={onOpenOrderEditor}
        onCancelPaperOrder={onCancelPaperOrder}
        onCancelExchangeOrder={onCancelExchangeOrder}
        strategyActivityLatestHistoricalOrderSupplemented={strategyActivityLatestHistoricalOrderSupplemented}
        strategyActivityOrders={strategyActivityOrders}
        activityLatestHistoricalOrder={activityLatestHistoricalOrder}
      />
      <StrategyActivityOpsTradesSection
        strategyActivityLatestTradeSupplemented={strategyActivityLatestTradeSupplemented}
        strategyActivityTrades={strategyActivityTrades}
        activityLatestTrade={activityLatestTrade}
        onOpenTradesSection={onOpenTradesSection}
        onOpenMarketSymbol={onOpenMarketSymbol}
      />
    </div>
  )
}

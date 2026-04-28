import type { StrategyActivityTopOpsRecentActionsProps } from './strategyActivityTopOpsTypes'

export default function StrategyActivityTopOpsRecentActions({
  activityLatestAlert,
  activityLatestPendingAlert,
  activityLatestOrder,
  activityLatestHistoricalOrder,
  activityLatestActiveOrder,
  activityLatestTrade,
  activityLatestActiveOrderEditable,
  activityLatestActiveOrderCancellable,
  activityLatestOrderActionLabelPrefix,
  serviceAvailable,
  selectedMode,
  alertMutationPending,
  cancelPaperOrderPending,
  cancelExchangeOrderPending,
  onOpenAlertsSection,
  onOpenMarketSymbol,
  onOpenTradesSection,
  onOpenWatchlistManager,
  onToggleAlertAcknowledged,
  onOpenOrderEditor,
  onCancelPaperOrder,
  onCancelExchangeOrder,
}: StrategyActivityTopOpsRecentActionsProps) {
  if (!(activityLatestAlert || activityLatestOrder || activityLatestTrade)) {
    return null
  }

  const handleCancelLatestActiveOrder = () => {
    if (!activityLatestActiveOrder) {
      return
    }
    if (activityLatestActiveOrder.source === 'paper' && selectedMode === 'paper') {
      onCancelPaperOrder(activityLatestActiveOrder.order_id)
      return
    }
    if (activityLatestActiveOrder.source === 'bybit_private' && selectedMode !== 'paper') {
      onCancelExchangeOrder(activityLatestActiveOrder.order_id)
    }
  }

  return (
    <div className="inline-actions inline-actions--tight" data-strategy-activity-top-actions="recent">
      {activityLatestAlert && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_alert_open"
          onClick={() => onOpenAlertsSection(activityLatestAlert.symbol ?? null)}
        >
          最新提醒
        </button>
      )}
      {activityLatestAlert && !activityLatestAlert.acknowledged && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_alert_ack"
          disabled={alertMutationPending}
          onClick={() => onToggleAlertAcknowledged(activityLatestAlert.id, true)}
        >
          确认提醒
        </button>
      )}
      {activityLatestAlert?.source_type === 'rule' && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_alert_rule"
          onClick={onOpenWatchlistManager}
        >
          自选规则
        </button>
      )}
      {activityLatestAlert?.symbol && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_alert_market"
          onClick={() => onOpenMarketSymbol(activityLatestAlert.symbol)}
        >
          提醒行情
        </button>
      )}
      {activityLatestPendingAlert && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="pending_alert_open"
          onClick={() => onOpenAlertsSection(activityLatestPendingAlert.symbol ?? null)}
        >
          当前待处理提醒
        </button>
      )}
      {activityLatestPendingAlert && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="pending_alert_ack"
          disabled={alertMutationPending}
          onClick={() => onToggleAlertAcknowledged(activityLatestPendingAlert.id, true)}
        >
          当前确认提醒
        </button>
      )}
      {activityLatestPendingAlert?.symbol && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="pending_alert_market"
          onClick={() => onOpenMarketSymbol(activityLatestPendingAlert.symbol)}
        >
          待处理行情
        </button>
      )}
      {activityLatestOrder && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_order_open"
          onClick={() => onOpenTradesSection(activityLatestOrder.symbol)}
        >
          最新委托
        </button>
      )}
      {activityLatestOrder?.symbol && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_order_market"
          onClick={() => onOpenMarketSymbol(activityLatestOrder.symbol)}
        >
          委托行情
        </button>
      )}
      {activityLatestHistoricalOrder && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_historical_order_open"
          onClick={() => onOpenTradesSection(activityLatestHistoricalOrder.symbol)}
        >
          最新历史委托
        </button>
      )}
      {activityLatestHistoricalOrder?.symbol && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_historical_order_market"
          onClick={() => onOpenMarketSymbol(activityLatestHistoricalOrder.symbol)}
        >
          历史行情
        </button>
      )}
      {activityLatestActiveOrder && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_active_order_open"
          onClick={() => onOpenTradesSection(activityLatestActiveOrder.symbol)}
        >
          当前活跃委托
        </button>
      )}
      {activityLatestActiveOrder?.symbol && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_active_order_market"
          onClick={() => onOpenMarketSymbol(activityLatestActiveOrder.symbol)}
        >
          活跃行情
        </button>
      )}
      {activityLatestActiveOrder && activityLatestActiveOrderEditable && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_active_order_edit"
          onClick={() => onOpenOrderEditor(activityLatestActiveOrder)}
        >
          {activityLatestOrderActionLabelPrefix}改单
        </button>
      )}
      {activityLatestActiveOrder && activityLatestActiveOrderCancellable && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_active_order_cancel"
          disabled={!serviceAvailable || cancelPaperOrderPending || cancelExchangeOrderPending}
          onClick={handleCancelLatestActiveOrder}
        >
          {activityLatestOrderActionLabelPrefix}撤单
        </button>
      )}
      {activityLatestTrade && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_trade_open"
          onClick={() => onOpenTradesSection(activityLatestTrade.symbol)}
        >
          最新成交
        </button>
      )}
      {activityLatestTrade?.symbol && (
        <button
          type="button"
          className="micro-action"
          data-strategy-activity-top-action-key="latest_trade_market"
          onClick={() => onOpenMarketSymbol(activityLatestTrade.symbol)}
        >
          成交行情
        </button>
      )}
    </div>
  )
}

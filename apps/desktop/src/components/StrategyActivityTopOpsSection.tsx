import type { AlertRecord, Mode, OrderRecord, TradeRecord } from '../types'

export type StrategyActivityTopOpsSectionProps = {
  latestActivitySummaryText: string | null
  latestOpsSummaryText: string | null
  latestActiveOrderHintText: string | null
  pendingAlertHintText: string | null
  actionableProposalHintText: string | null
  actionableChangeRequestHintText: string | null
  retryableTrackingJobHintText: string | null
  latestHistoricalOrderHintText: string | null
  actionableBacktestHintText: string | null
  actionablePrimaryReviewHintText: string | null
  activityLatestAlert: AlertRecord | null
  activityLatestPendingAlert: AlertRecord | null
  activityLatestOrder: OrderRecord | null
  activityLatestHistoricalOrder: OrderRecord | null
  activityLatestActiveOrder: OrderRecord | null
  activityLatestTrade: TradeRecord | null
  activityLatestActiveOrderEditable: boolean
  activityLatestActiveOrderCancellable: boolean
  activityLatestOrderActionLabelPrefix: string
  activityLatestAuditJobId: string | null
  activityLatestAuditLinkedReviewId: string | null
  activityLatestAuditChangeRequestId: string | null
  activityLatestAuditBacktestId: string | null
  activityLatestAuditSourceBacktestId: string | null
  activityLatestAuditSourceReviewId: string | null
  activityLatestAuditSourceProposalId: string | null
  activityLatestAuditStrategyId: string | null
  serviceAvailable: boolean
  selectedMode: Mode
  alertMutationPending: boolean
  cancelPaperOrderPending: boolean
  cancelExchangeOrderPending: boolean
  onOpenAlertsSection: (symbol?: string | null) => void
  onOpenMarketSymbol: (symbol: string) => void
  onOpenTradesSection: (symbol?: string | null) => void
  onOpenWatchlistManager: () => void
  onToggleAlertAcknowledged: (alertId: string, nextAcknowledged: boolean) => void
  onOpenOrderEditor: (order: OrderRecord) => void
  onCancelPaperOrder: (orderId: string) => void
  onCancelExchangeOrder: (orderId: string) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
}

export default function StrategyActivityTopOpsSection({
  latestActivitySummaryText,
  latestOpsSummaryText,
  latestActiveOrderHintText,
  pendingAlertHintText,
  actionableProposalHintText,
  actionableChangeRequestHintText,
  retryableTrackingJobHintText,
  latestHistoricalOrderHintText,
  actionableBacktestHintText,
  actionablePrimaryReviewHintText,
  activityLatestAlert,
  activityLatestPendingAlert,
  activityLatestOrder,
  activityLatestHistoricalOrder,
  activityLatestActiveOrder,
  activityLatestTrade,
  activityLatestActiveOrderEditable,
  activityLatestActiveOrderCancellable,
  activityLatestOrderActionLabelPrefix,
  activityLatestAuditJobId,
  activityLatestAuditLinkedReviewId,
  activityLatestAuditChangeRequestId,
  activityLatestAuditBacktestId,
  activityLatestAuditSourceBacktestId,
  activityLatestAuditSourceReviewId,
  activityLatestAuditSourceProposalId,
  activityLatestAuditStrategyId,
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
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
}: StrategyActivityTopOpsSectionProps) {
  return (
    <>
      {latestActivitySummaryText && (
        <div className="panel-note" data-strategy-activity-note-key="latest_activity_summary">
          {latestActivitySummaryText}
        </div>
      )}
      {latestOpsSummaryText && (
        <p className="panel-note" data-strategy-activity-note-key="latest_ops_summary">
          {latestOpsSummaryText}
        </p>
      )}
      {latestActiveOrderHintText && (
        <p className="panel-note" data-strategy-activity-note-key="latest_active_order_hint">
          {latestActiveOrderHintText}
        </p>
      )}
      {pendingAlertHintText && (
        <p className="panel-note" data-strategy-activity-note-key="pending_alert_hint">
          {pendingAlertHintText}
        </p>
      )}
      {actionableProposalHintText && (
        <p className="panel-note" data-strategy-activity-note-key="actionable_proposal_hint">
          {actionableProposalHintText}
        </p>
      )}
      {actionableChangeRequestHintText && (
        <p className="panel-note" data-strategy-activity-note-key="actionable_change_request_hint">
          {actionableChangeRequestHintText}
        </p>
      )}
      {retryableTrackingJobHintText && (
        <p className="panel-note" data-strategy-activity-note-key="retryable_tracking_job_hint">
          {retryableTrackingJobHintText}
        </p>
      )}
      {latestHistoricalOrderHintText && (
        <p className="panel-note" data-strategy-activity-note-key="latest_historical_order_hint">
          {latestHistoricalOrderHintText}
        </p>
      )}
      {actionableBacktestHintText && (
        <p className="panel-note" data-strategy-activity-note-key="actionable_backtest_hint">
          {actionableBacktestHintText}
        </p>
      )}
      {actionablePrimaryReviewHintText && (
        <p className="panel-note" data-strategy-activity-note-key="actionable_primary_review_hint">
          {actionablePrimaryReviewHintText}
        </p>
      )}

      {(activityLatestAlert || activityLatestOrder || activityLatestTrade) && (
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
              onClick={() => {
                if (activityLatestActiveOrder.source === 'paper' && selectedMode === 'paper') {
                  onCancelPaperOrder(activityLatestActiveOrder.order_id)
                  return
                }
                if (activityLatestActiveOrder.source === 'bybit_private' && selectedMode !== 'paper') {
                  onCancelExchangeOrder(activityLatestActiveOrder.order_id)
                }
              }}
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
      )}

      {(activityLatestAuditJobId ||
        activityLatestAuditLinkedReviewId ||
        activityLatestAuditChangeRequestId ||
        activityLatestAuditBacktestId ||
        activityLatestAuditSourceBacktestId ||
        activityLatestAuditSourceReviewId ||
        activityLatestAuditSourceProposalId) && (
        <div className="inline-actions inline-actions--tight" data-strategy-activity-top-actions="audit">
          {activityLatestAuditJobId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_audit_job"
              onClick={() => onOpenAiSchedulerJob(activityLatestAuditJobId)}
            >
              最新审计任务
            </button>
          )}
          {activityLatestAuditLinkedReviewId && activityLatestAuditStrategyId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_audit_result"
              onClick={() => onOpenReviewInspector(activityLatestAuditLinkedReviewId, activityLatestAuditStrategyId)}
            >
              最新审计结果
            </button>
          )}
          {activityLatestAuditChangeRequestId && activityLatestAuditStrategyId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_audit_change_request"
              onClick={() => onOpenChangeRequest(activityLatestAuditChangeRequestId, activityLatestAuditStrategyId)}
            >
              最新审计变更
            </button>
          )}
          {activityLatestAuditBacktestId && activityLatestAuditStrategyId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_audit_backtest"
              onClick={() => onOpenBacktestDetail(activityLatestAuditBacktestId, activityLatestAuditStrategyId)}
            >
              最新审计回测
            </button>
          )}
          {activityLatestAuditSourceBacktestId &&
            activityLatestAuditStrategyId &&
            activityLatestAuditSourceBacktestId !== activityLatestAuditBacktestId && (
              <button
                type="button"
                className="micro-action"
                data-strategy-activity-top-action-key="latest_audit_source_backtest"
                onClick={() =>
                  onOpenBacktestDetail(activityLatestAuditSourceBacktestId, activityLatestAuditStrategyId)
                }
              >
                最新来源回测
              </button>
            )}
          {activityLatestAuditSourceReviewId &&
            activityLatestAuditStrategyId &&
            activityLatestAuditSourceReviewId !== activityLatestAuditLinkedReviewId && (
              <button
                type="button"
                className="micro-action"
                data-strategy-activity-top-action-key="latest_audit_source_review"
                onClick={() =>
                  onOpenSourceReview(activityLatestAuditSourceReviewId, activityLatestAuditStrategyId)
                }
              >
                最新来源复盘
              </button>
            )}
          {activityLatestAuditSourceProposalId && activityLatestAuditStrategyId && (
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_audit_source_proposal"
              onClick={() =>
                onOpenStrategyProposal(activityLatestAuditSourceProposalId, activityLatestAuditStrategyId)
              }
            >
              最新来源提案
            </button>
          )}
        </div>
      )}
    </>
  )
}

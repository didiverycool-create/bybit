import type { AlertRecord, ExecutionEvent, Mode, OrderRecord, TradeRecord } from '../types'
import {
  activityAlertToneClass,
  auditImpactMeta,
  formatDateTime,
  getAuditBacktestId,
  getAuditChangeRequestId,
  getAuditJobId,
  getAuditLinkedReviewId,
  getAuditSourceBacktestId,
  getAuditSourceProposalId,
  getAuditSourceReviewId,
  getAuditStrategyId,
  orderActivitySummary,
  orderSourceLabel,
  summarizeAuditEvent,
  tradeActivitySummary,
} from '../utils/app-helpers'

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
      <span className="section-label">提醒 / 审计</span>
      {strategyActivityLatestPendingAlertSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_pending_alert_supplemented_hint">
          顶部当前待处理提醒不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续近场确认或恢复。
        </p>
      )}
      {strategyActivityLatestAlertSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_alert_supplemented_hint">
          顶部最新提醒不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿同一提醒排障。
        </p>
      )}
      <div className="trade-list trade-list--dense" data-strategy-activity-action-group="alerts">
        {strategyActivityAlerts.map((alert) => (
          <div
            key={alert.id}
            className="trade-row trade-row--fade"
            data-strategy-activity-row-id={alert.id}
          >
            <div className="console-row__main">
              <strong className={activityAlertToneClass(alert)}>
                {alert.severity} · {alert.title}
              </strong>
              <p>{alert.description}</p>
            </div>
            <div className="trade-meta">
              {activityLatestAlert?.id === alert.id && (
                <span className="console-tag console-tag--warn">当前最新</span>
              )}
              {activityLatestPendingAlert?.id === alert.id && (
                <span className="console-tag console-tag--warn">当前待处理</span>
              )}
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenAlertsSection(alert.symbol ?? null)}
              >
                提醒页
              </button>
              {alert.symbol && (
                <button
                  type="button"
                  className="micro-action"
                  onClick={() => onOpenMarketSymbol(alert.symbol)}
                >
                  提醒行情
                </button>
              )}
              {alert.source_type === 'rule' && (
                <button type="button" className="micro-action" onClick={onOpenWatchlistManager}>
                  自选规则
                </button>
              )}
              <button
                type="button"
                className="micro-action"
                disabled={!serviceAvailable || alertMutationPending}
                onClick={() => onToggleAlertAcknowledged(alert.id, !alert.acknowledged)}
              >
                {alert.acknowledged ? '恢复提醒' : '确认提醒'}
              </button>
              <small>{formatDateTime(alert.triggered_at)}</small>
            </div>
          </div>
        ))}
        {!strategyActivityAlerts.length && (
          <div className="empty-state empty-state--inline">当前没有未完成的策略提醒。</div>
        )}
      </div>
      {strategyActivityLatestAuditSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_audit_supplemented_hint">
          顶部最新审计事件不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿同一审计链路排障。
        </p>
      )}
      <div className="trade-list trade-list--dense" data-strategy-activity-action-group="audit">
        {strategyActivityAuditEvents.map((event) => {
          const auditJobId = getAuditJobId(event.payload)
          const auditChangeRequestId = getAuditChangeRequestId(event.payload)
          const auditLinkedReviewId = getAuditLinkedReviewId(event.payload)
          const auditStrategyId = getAuditStrategyId(event.payload) ?? strategyId
          const auditBacktestId = getAuditBacktestId(event.payload)
          const auditSourceBacktestId = getAuditSourceBacktestId(event.payload)
          const auditSourceReviewId = getAuditSourceReviewId(event.payload)
          const auditSourceProposalId = getAuditSourceProposalId(event.payload)
          const impactMeta = auditImpactMeta(event)
          return (
            <div
              key={event.id}
              className="trade-row trade-row--fade"
              data-strategy-activity-row-id={event.id}
            >
              <div className="console-row__main">
                <strong>{event.event_type}</strong>
                <p>{summarizeAuditEvent(event)}</p>
                {impactMeta && <p>{impactMeta.detail}</p>}
              </div>
              <div className="trade-meta">
                {activityLatestAuditEvent?.id === event.id && (
                  <span className="console-tag console-tag--warn">当前最新</span>
                )}
                <span className="console-tag">{event.severity}</span>
                <button
                  type="button"
                  className="micro-action"
                  onClick={() => onOpenAuditSection(event.symbol ?? null)}
                >
                  审计页
                </button>
                {auditJobId && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenAiSchedulerJob(auditJobId)}
                  >
                    打开任务
                  </button>
                )}
                {auditLinkedReviewId && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenReviewInspector(auditLinkedReviewId, auditStrategyId)}
                  >
                    查看结果
                  </button>
                )}
                {auditChangeRequestId && auditStrategyId && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenChangeRequest(auditChangeRequestId, auditStrategyId)}
                  >
                    查看变更
                  </button>
                )}
                {auditBacktestId && auditStrategyId && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenBacktestDetail(auditBacktestId, auditStrategyId)}
                  >
                    打开回测
                  </button>
                )}
                {auditSourceBacktestId && auditStrategyId && auditSourceBacktestId !== auditBacktestId && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenBacktestDetail(auditSourceBacktestId, auditStrategyId)}
                  >
                    来源回测
                  </button>
                )}
                {auditSourceReviewId && auditStrategyId && auditSourceReviewId !== auditLinkedReviewId && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenSourceReview(auditSourceReviewId, auditStrategyId)}
                  >
                    来源复盘
                  </button>
                )}
                {auditSourceProposalId && auditStrategyId && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenStrategyProposal(auditSourceProposalId, auditStrategyId)}
                  >
                    来源提案
                  </button>
                )}
                <small>{formatDateTime(event.occurred_at)}</small>
              </div>
            </div>
          )
        })}
        {!strategyActivityAuditEvents.length && (
          <div className="empty-state empty-state--inline">当前没有可展示的策略审计事件。</div>
        )}
      </div>

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
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenTradesSection(order.symbol)}
              >
                委托页
              </button>
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenMarketSymbol(order.symbol)}
              >
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
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenTradesSection(order.symbol)}
              >
                委托页
              </button>
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenMarketSymbol(order.symbol)}
              >
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
      <div className="trade-list trade-list--dense" data-strategy-activity-action-group="trades">
        {strategyActivityLatestTradeSupplemented && (
          <p className="panel-note" data-strategy-activity-note-key="latest_trade_supplemented_hint">
            顶部最新成交不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿同一成交追踪。
          </p>
        )}
        {strategyActivityTrades.map((trade) => (
          <div
            key={trade.id}
            className="trade-row trade-row--fade"
            data-strategy-activity-row-id={trade.id}
          >
            <div className="console-row__main">
              <strong>{tradeActivitySummary(trade)}</strong>
              <p>{trade.pnl}</p>
            </div>
            <div className="trade-meta">
              {activityLatestTrade?.id === trade.id && (
                <span className="console-tag console-tag--warn">当前最新</span>
              )}
              <span className="console-tag">{trade.mode.toUpperCase()}</span>
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenTradesSection(trade.symbol)}
              >
                成交页
              </button>
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenMarketSymbol(trade.symbol)}
              >
                成交行情
              </button>
              <small>{formatDateTime(trade.created_at)}</small>
            </div>
          </div>
        ))}
        {!strategyActivityTrades.length && (
          <div className="empty-state empty-state--inline">当前没有策略相关成交记录。</div>
        )}
      </div>
    </div>
  )
}

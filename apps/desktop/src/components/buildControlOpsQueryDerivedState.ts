import type {
  AccountLiveSnapshot,
  AiLiveSnapshot,
  ChangeRequest,
  ExecutionEvent,
  OpsLiveSnapshot,
  OrderRecord,
  TradeRecord,
} from '../types'

type BuildControlOpsQueryDerivedStateArgs = {
  schedulerQueryData: AiLiveSnapshot | null | undefined
  aiLiveQueryData: AiLiveSnapshot | null | undefined
  opsLiveQueryData: OpsLiveSnapshot | null | undefined
  alertsQueryData: Array<unknown> | undefined
  accountLiveQueryData: AccountLiveSnapshot | null | undefined
  accountOverviewQueryData: AccountLiveSnapshot['overview'] | undefined
  accountPositionsQueryData: AccountLiveSnapshot['positions'] | undefined
  accountOrdersQueryData: OrderRecord[] | undefined
  accountOrderHistoryQueryData: OrderRecord[] | undefined
  tradesQueryData: TradeRecord[] | undefined
  auditQueryData: ExecutionEvent[] | undefined
  changeRequestsQueryData: ChangeRequest[] | undefined
  editingOrderId: string | null
  schedulerQueryFetched: boolean
  aiLiveQueryFetched: boolean
  opsLiveQueryFetched: boolean
  alertsQueryFetched: boolean
  auditQueryFetched: boolean
  newsQueryData: Array<unknown> | undefined
} 

export function buildControlOpsQueryDerivedState({
  schedulerQueryData,
  aiLiveQueryData,
  opsLiveQueryData,
  alertsQueryData,
  accountLiveQueryData,
  accountOverviewQueryData,
  accountPositionsQueryData,
  accountOrdersQueryData,
  accountOrderHistoryQueryData,
  tradesQueryData,
  auditQueryData,
  changeRequestsQueryData,
  editingOrderId,
  schedulerQueryFetched,
  aiLiveQueryFetched,
  opsLiveQueryFetched,
  alertsQueryFetched,
  auditQueryFetched,
  newsQueryData,
}: BuildControlOpsQueryDerivedStateArgs) {
  const scheduler = aiLiveQueryData ?? schedulerQueryData
  const opsLive = opsLiveQueryData ?? null
  const alerts = opsLive?.alerts ?? alertsQueryData ?? []
  const accountOverview = accountLiveQueryData?.overview ?? accountOverviewQueryData
  const accountPositions = accountLiveQueryData?.positions ?? accountPositionsQueryData ?? []
  const accountOrders = accountLiveQueryData?.orders ?? accountOrdersQueryData ?? []
  const accountOrderHistory =
    accountLiveQueryData?.order_history ?? accountOrderHistoryQueryData ?? []
  const editingOrder =
    editingOrderId != null
      ? accountOrders.find((order) => order.order_id === editingOrderId) ?? null
      : null
  const trades = opsLive?.trades ?? tradesQueryData ?? []
  const auditEvents = opsLive?.audit_events ?? auditQueryData ?? []
  const changeRequests =
    aiLiveQueryData?.change_requests ?? changeRequestsQueryData ?? scheduler?.change_requests ?? []

  return {
    scheduler,
    opsLive,
    alerts,
    accountOverview,
    accountPositions,
    accountOrders,
    accountOrderHistory,
    editingOrder,
    trades,
    auditEvents,
    changeRequests,
    news: newsQueryData ?? [],
    alertsNotificationBootstrapReady: opsLiveQueryFetched || alertsQueryFetched,
    jobsNotificationBootstrapReady: aiLiveQueryFetched || schedulerQueryFetched,
    opsNotificationBootstrapReady: opsLiveQueryFetched || auditQueryFetched,
  }
}

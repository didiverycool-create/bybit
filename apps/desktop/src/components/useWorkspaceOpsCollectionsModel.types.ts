import type { AlertRecord, ChangeRequest, ExecutionEvent, Mode, OrderRecord, TradeRecord } from '../types'

export type UseWorkspaceOpsCollectionsModelArgs = {
  alerts: AlertRecord[]
  trades: TradeRecord[]
  accountOrders: OrderRecord[]
  accountOrderHistory: OrderRecord[]
  auditEvents: ExecutionEvent[]
  changeRequests: ChangeRequest[]
  selectedSymbol: string
  alertSeverityFilter: 'all' | AlertRecord['severity']
  alertStatusFilter: 'all' | 'pending' | 'acknowledged'
  alertScopeFilter: 'all' | 'selected'
  tradeModeFilter: 'all' | Mode
  tradeOriginFilter: 'all' | TradeRecord['origin']
  tradeScopeFilter: 'all' | 'selected'
  auditSeverityFilter: 'all' | ExecutionEvent['severity']
  auditSourceFilter: 'all' | string
  auditScopeFilter: 'all' | 'selected'
  auditSearch: string
}

export type UseWorkspaceOpsCollectionsModelResult = {
  headlineAlert: AlertRecord | undefined
  pendingAlertsCount: number
  filteredAlerts: AlertRecord[]
  filteredTrades: TradeRecord[]
  filteredAccountOrders: OrderRecord[]
  filteredOrderHistory: OrderRecord[]
  auditSourceOptions: string[]
  filteredAuditEvents: ExecutionEvent[]
  overviewQueuedRequests: ChangeRequest[]
}

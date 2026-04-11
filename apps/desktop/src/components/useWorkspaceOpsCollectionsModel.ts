import type { AlertRecord, ChangeRequest, ExecutionEvent, Mode, OrderRecord, TradeRecord } from '../types'

type UseWorkspaceOpsCollectionsModelArgs = {
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

export function useWorkspaceOpsCollectionsModel({
  alerts,
  trades,
  accountOrders,
  accountOrderHistory,
  auditEvents,
  changeRequests,
  selectedSymbol,
  alertSeverityFilter,
  alertStatusFilter,
  alertScopeFilter,
  tradeModeFilter,
  tradeOriginFilter,
  tradeScopeFilter,
  auditSeverityFilter,
  auditSourceFilter,
  auditScopeFilter,
  auditSearch,
}: UseWorkspaceOpsCollectionsModelArgs) {
  const headlineAlert = [...alerts]
    .filter((item) => !item.acknowledged)
    .sort((left, right) => {
      const severityRank = { P0: 0, P1: 1, P2: 2 }
      return severityRank[left.severity] - severityRank[right.severity]
    })[0]
  const rankedAlerts = [...alerts].sort((left, right) => {
    const severityRank = { P0: 0, P1: 1, P2: 2 }
    const acknowledgedRank = Number(left.acknowledged) - Number(right.acknowledged)
    if (acknowledgedRank !== 0) {
      return acknowledgedRank
    }
    return severityRank[left.severity] - severityRank[right.severity]
  })
  const pendingAlertsCount = rankedAlerts.filter((item) => !item.acknowledged).length
  const filteredAlerts = rankedAlerts.filter((item) => {
    if (alertSeverityFilter !== 'all' && item.severity !== alertSeverityFilter) {
      return false
    }
    if (alertStatusFilter === 'pending' && item.acknowledged) {
      return false
    }
    if (alertStatusFilter === 'acknowledged' && !item.acknowledged) {
      return false
    }
    if (alertScopeFilter === 'selected' && item.symbol !== selectedSymbol) {
      return false
    }
    return true
  })
  const filteredTrades = trades.filter((item) => {
    if (tradeModeFilter !== 'all' && item.mode !== tradeModeFilter) {
      return false
    }
    if (tradeOriginFilter !== 'all' && item.origin !== tradeOriginFilter) {
      return false
    }
    if (tradeScopeFilter === 'selected' && item.symbol !== selectedSymbol) {
      return false
    }
    return true
  })
  const filteredAccountOrders = accountOrders.filter((item) => {
    if ((tradeOriginFilter === 'manual' || tradeOriginFilter === 'strategy') && item.origin !== tradeOriginFilter) {
      return false
    }
    if (tradeScopeFilter === 'selected' && item.symbol !== selectedSymbol) {
      return false
    }
    return true
  })
  const filteredOrderHistory = accountOrderHistory.filter((item) => {
    if ((tradeOriginFilter === 'manual' || tradeOriginFilter === 'strategy') && item.origin !== tradeOriginFilter) {
      return false
    }
    if (tradeScopeFilter === 'selected' && item.symbol !== selectedSymbol) {
      return false
    }
    return true
  })
  const auditSourceOptions = Array.from(new Set(auditEvents.map((item) => item.source))).slice(0, 8)
  const filteredAuditEvents = auditEvents.filter((item) => {
    if (auditSeverityFilter !== 'all' && item.severity !== auditSeverityFilter) {
      return false
    }
    if (auditSourceFilter !== 'all' && item.source !== auditSourceFilter) {
      return false
    }
    if (auditScopeFilter === 'selected' && item.symbol !== selectedSymbol) {
      return false
    }
    if (!auditSearch.trim()) {
      return true
    }
    const needle = auditSearch.trim().toLowerCase()
    const payloadText = JSON.stringify(item.payload).toLowerCase()
    return (
      item.event_type.toLowerCase().includes(needle) ||
      item.source.toLowerCase().includes(needle) ||
      String(item.symbol ?? '').toLowerCase().includes(needle) ||
      payloadText.includes(needle)
    )
  })
  const overviewQueuedRequests = changeRequests.filter((item) => item.status !== 'applied').slice(0, 4)

  return {
    headlineAlert,
    pendingAlertsCount,
    filteredAlerts,
    filteredTrades,
    filteredAccountOrders,
    filteredOrderHistory,
    auditSourceOptions,
    filteredAuditEvents,
    overviewQueuedRequests,
  }
}

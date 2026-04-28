import type { AlertRecord, ChangeRequest, ExecutionEvent, Mode, OrderRecord, TradeRecord } from '../types'

const alertSeverityRank = { P0: 0, P1: 1, P2: 2 } as const

export function buildWorkspaceOpsHeadlineAlert(alerts: AlertRecord[]) {
  return [...alerts]
    .filter((item) => !item.acknowledged)
    .sort((left, right) => alertSeverityRank[left.severity] - alertSeverityRank[right.severity])[0]
}

export function buildWorkspaceOpsRankedAlerts(alerts: AlertRecord[]) {
  return [...alerts].sort((left, right) => {
    const acknowledgedRank = Number(left.acknowledged) - Number(right.acknowledged)
    if (acknowledgedRank !== 0) {
      return acknowledgedRank
    }
    return alertSeverityRank[left.severity] - alertSeverityRank[right.severity]
  })
}

export function buildWorkspaceOpsFilteredAlerts({
  rankedAlerts,
  selectedSymbol,
  alertSeverityFilter,
  alertStatusFilter,
  alertScopeFilter,
}: {
  rankedAlerts: AlertRecord[]
  selectedSymbol: string
  alertSeverityFilter: 'all' | AlertRecord['severity']
  alertStatusFilter: 'all' | 'pending' | 'acknowledged'
  alertScopeFilter: 'all' | 'selected'
}) {
  return rankedAlerts.filter((item) => {
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
}

export function buildWorkspaceOpsFilteredTrades({
  trades,
  selectedSymbol,
  tradeModeFilter,
  tradeOriginFilter,
  tradeScopeFilter,
}: {
  trades: TradeRecord[]
  selectedSymbol: string
  tradeModeFilter: 'all' | Mode
  tradeOriginFilter: 'all' | TradeRecord['origin']
  tradeScopeFilter: 'all' | 'selected'
}) {
  return trades.filter((item) => {
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
}

export function buildWorkspaceOpsFilteredAccountOrders({
  accountOrders,
  selectedSymbol,
  tradeOriginFilter,
  tradeScopeFilter,
}: {
  accountOrders: OrderRecord[]
  selectedSymbol: string
  tradeOriginFilter: 'all' | TradeRecord['origin']
  tradeScopeFilter: 'all' | 'selected'
}) {
  return accountOrders.filter((item) => {
    if ((tradeOriginFilter === 'manual' || tradeOriginFilter === 'strategy') && item.origin !== tradeOriginFilter) {
      return false
    }
    if (tradeScopeFilter === 'selected' && item.symbol !== selectedSymbol) {
      return false
    }
    return true
  })
}

export function buildWorkspaceOpsFilteredOrderHistory({
  accountOrderHistory,
  selectedSymbol,
  tradeOriginFilter,
  tradeScopeFilter,
}: {
  accountOrderHistory: OrderRecord[]
  selectedSymbol: string
  tradeOriginFilter: 'all' | TradeRecord['origin']
  tradeScopeFilter: 'all' | 'selected'
}) {
  return accountOrderHistory.filter((item) => {
    if ((tradeOriginFilter === 'manual' || tradeOriginFilter === 'strategy') && item.origin !== tradeOriginFilter) {
      return false
    }
    if (tradeScopeFilter === 'selected' && item.symbol !== selectedSymbol) {
      return false
    }
    return true
  })
}

export function buildWorkspaceOpsAuditSourceOptions(auditEvents: ExecutionEvent[]) {
  return Array.from(new Set(auditEvents.map((item) => item.source))).slice(0, 8)
}

export function buildWorkspaceOpsFilteredAuditEvents({
  auditEvents,
  selectedSymbol,
  auditSeverityFilter,
  auditSourceFilter,
  auditScopeFilter,
  auditSearch,
}: {
  auditEvents: ExecutionEvent[]
  selectedSymbol: string
  auditSeverityFilter: 'all' | ExecutionEvent['severity']
  auditSourceFilter: 'all' | string
  auditScopeFilter: 'all' | 'selected'
  auditSearch: string
}) {
  return auditEvents.filter((item) => {
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
}

export function buildWorkspaceOpsOverviewQueuedRequests(changeRequests: ChangeRequest[]) {
  return changeRequests.filter((item) => item.status !== 'applied').slice(0, 4)
}

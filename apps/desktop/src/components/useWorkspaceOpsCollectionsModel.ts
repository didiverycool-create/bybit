import {
  buildWorkspaceOpsAuditSourceOptions,
  buildWorkspaceOpsFilteredAccountOrders,
  buildWorkspaceOpsFilteredAlerts,
  buildWorkspaceOpsFilteredAuditEvents,
  buildWorkspaceOpsFilteredOrderHistory,
  buildWorkspaceOpsFilteredTrades,
  buildWorkspaceOpsHeadlineAlert,
  buildWorkspaceOpsOverviewQueuedRequests,
  buildWorkspaceOpsRankedAlerts,
} from './workspaceOpsCollectionsHelpers'
import type { UseWorkspaceOpsCollectionsModelArgs, UseWorkspaceOpsCollectionsModelResult } from './useWorkspaceOpsCollectionsModel.types'

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
}: UseWorkspaceOpsCollectionsModelArgs): UseWorkspaceOpsCollectionsModelResult {
  const headlineAlert = buildWorkspaceOpsHeadlineAlert(alerts)
  const rankedAlerts = buildWorkspaceOpsRankedAlerts(alerts)
  const pendingAlertsCount = rankedAlerts.filter((item) => !item.acknowledged).length
  const filteredAlerts = buildWorkspaceOpsFilteredAlerts({
    rankedAlerts,
    selectedSymbol,
    alertSeverityFilter,
    alertStatusFilter,
    alertScopeFilter,
  })
  const filteredTrades = buildWorkspaceOpsFilteredTrades({
    trades,
    selectedSymbol,
    tradeModeFilter,
    tradeOriginFilter,
    tradeScopeFilter,
  })
  const filteredAccountOrders = buildWorkspaceOpsFilteredAccountOrders({
    accountOrders,
    selectedSymbol,
    tradeOriginFilter,
    tradeScopeFilter,
  })
  const filteredOrderHistory = buildWorkspaceOpsFilteredOrderHistory({
    accountOrderHistory,
    selectedSymbol,
    tradeOriginFilter,
    tradeScopeFilter,
  })
  const auditSourceOptions = buildWorkspaceOpsAuditSourceOptions(auditEvents)
  const filteredAuditEvents = buildWorkspaceOpsFilteredAuditEvents({
    auditEvents,
    selectedSymbol,
    auditSeverityFilter,
    auditSourceFilter,
    auditScopeFilter,
    auditSearch,
  })
  const overviewQueuedRequests = buildWorkspaceOpsOverviewQueuedRequests(changeRequests)

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

import type { useAppWorkspaceBootstrapState } from './useAppWorkspaceBootstrapState'
import type { useControlDataQueryModel } from './useControlDataQueryModel'
import type { useWorkspaceOpsCollectionsModel } from './useWorkspaceOpsCollectionsModel'

type BuildWorkspaceOpsCollectionsModelArgs = Parameters<typeof useWorkspaceOpsCollectionsModel>[0]
type AppWorkspaceBootstrapState = ReturnType<typeof useAppWorkspaceBootstrapState>
type ControlDataQueryModel = ReturnType<typeof useControlDataQueryModel>

export type BuildWorkspaceOpsCollectionsModelArgsInput =
  AppWorkspaceBootstrapState &
  ControlDataQueryModel

export function buildWorkspaceOpsCollectionsModelArgs({
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
}: BuildWorkspaceOpsCollectionsModelArgsInput): BuildWorkspaceOpsCollectionsModelArgs {
  return {
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
  }
}

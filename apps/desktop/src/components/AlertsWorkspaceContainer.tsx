import type { ComponentProps } from 'react'

import AlertsWorkspaceSection from './AlertsWorkspaceSection'

type AlertsWorkspaceSectionProps = ComponentProps<typeof AlertsWorkspaceSection>

type AlertsWorkspaceContainerProps = {
  summaryState: {
    pendingAlertsCount: AlertsWorkspaceSectionProps['pendingAlertsCount']
    p0AlertsCount: AlertsWorkspaceSectionProps['p0AlertsCount']
    notificationChannelsLabel: AlertsWorkspaceSectionProps['notificationChannelsLabel']
  }
  filterState: {
    alertSeverityFilter: AlertsWorkspaceSectionProps['alertSeverityFilter']
    alertStatusFilter: AlertsWorkspaceSectionProps['alertStatusFilter']
    alertScopeFilter: AlertsWorkspaceSectionProps['alertScopeFilter']
    selectedSymbol: AlertsWorkspaceSectionProps['selectedSymbol']
  }
  alertsState: {
    filteredAlerts: AlertsWorkspaceSectionProps['filteredAlerts']
    alertMutationPending: AlertsWorkspaceSectionProps['alertMutationPending']
  }
  actions: Pick<
    AlertsWorkspaceSectionProps,
    | 'onAlertSeverityFilterChange'
    | 'onAlertStatusFilterChange'
    | 'onToggleAlertScopeFilter'
    | 'onOpenAlertMarket'
    | 'onOpenWatchlistManager'
    | 'onToggleAlertAcknowledged'
  >
}

export default function AlertsWorkspaceContainer({
  summaryState,
  filterState,
  alertsState,
  actions,
}: AlertsWorkspaceContainerProps) {
  return (
    <AlertsWorkspaceSection
      pendingAlertsCount={summaryState.pendingAlertsCount}
      p0AlertsCount={summaryState.p0AlertsCount}
      alertSeverityFilter={filterState.alertSeverityFilter}
      onAlertSeverityFilterChange={actions.onAlertSeverityFilterChange}
      alertStatusFilter={filterState.alertStatusFilter}
      onAlertStatusFilterChange={actions.onAlertStatusFilterChange}
      alertScopeFilter={filterState.alertScopeFilter}
      selectedSymbol={filterState.selectedSymbol}
      onToggleAlertScopeFilter={actions.onToggleAlertScopeFilter}
      notificationChannelsLabel={summaryState.notificationChannelsLabel}
      filteredAlerts={alertsState.filteredAlerts}
      alertMutationPending={alertsState.alertMutationPending}
      onOpenAlertMarket={actions.onOpenAlertMarket}
      onOpenWatchlistManager={actions.onOpenWatchlistManager}
      onToggleAlertAcknowledged={actions.onToggleAlertAcknowledged}
    />
  )
}

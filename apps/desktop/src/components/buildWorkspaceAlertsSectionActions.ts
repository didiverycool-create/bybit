import type { BuildWorkspaceSectionActionsResult } from './buildWorkspaceSectionActions'
import type { BuildWorkspaceSectionOpsConsumerArgs } from './buildWorkspaceSectionActionConsumerGroups'

type BuildWorkspaceAlertsSectionActionsArgs = Pick<
  BuildWorkspaceSectionOpsConsumerArgs,
  'navigationActions' | 'workspaceControlActions' | 'setters'
>

export type BuildWorkspaceAlertsSectionActionsResult = Pick<
  BuildWorkspaceSectionActionsResult,
  'alertsWorkspaceActions'
>

export function buildWorkspaceAlertsSectionActions({
  navigationActions,
  workspaceControlActions,
  setters,
}: BuildWorkspaceAlertsSectionActionsArgs): BuildWorkspaceAlertsSectionActionsResult {
  return {
    alertsWorkspaceActions: {
      onAlertSeverityFilterChange: setters.setAlertSeverityFilter,
      onAlertStatusFilterChange: setters.setAlertStatusFilter,
      onToggleAlertScopeFilter: () =>
        setters.setAlertScopeFilter((current) => (current === 'selected' ? 'all' : 'selected')),
      onOpenAlertMarket: navigationActions.openMarketSymbol,
      onOpenWatchlistManager: () => setters.setWatchlistManagerOpen(true),
      onToggleAlertAcknowledged: (alertId, nextAcknowledged) => {
        void workspaceControlActions.toggleAlertAcknowledged(alertId, nextAcknowledged)
      },
    },
  }
}

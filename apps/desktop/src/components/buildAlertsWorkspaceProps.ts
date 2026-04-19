import type { ComponentProps } from 'react'

import type AlertsWorkspaceContainer from './AlertsWorkspaceContainer'

type AlertsWorkspaceContainerProps = ComponentProps<typeof AlertsWorkspaceContainer>

export type BuildAlertsWorkspacePropsArgs = AlertsWorkspaceContainerProps

export function buildAlertsWorkspaceProps({
  summaryState,
  filterState,
  alertsState,
  actions,
}: BuildAlertsWorkspacePropsArgs): AlertsWorkspaceContainerProps {
  return {
    summaryState,
    filterState,
    alertsState,
    actions,
  }
}

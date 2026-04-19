import type { ComponentProps } from 'react'

import type AuditWorkspaceContainer from './AuditWorkspaceContainer'

type AuditWorkspaceContainerProps = ComponentProps<typeof AuditWorkspaceContainer>

export type BuildAuditWorkspacePropsArgs = AuditWorkspaceContainerProps

export function buildAuditWorkspaceProps({
  summaryState,
  filterState,
  eventState,
  actions,
}: BuildAuditWorkspacePropsArgs): AuditWorkspaceContainerProps {
  return {
    summaryState,
    filterState,
    eventState,
    actions,
  }
}

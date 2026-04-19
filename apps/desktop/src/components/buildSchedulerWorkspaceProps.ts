import type { ComponentProps } from 'react'

import type SchedulerWorkspaceContainer from './SchedulerWorkspaceContainer'

type SchedulerWorkspaceContainerProps = ComponentProps<typeof SchedulerWorkspaceContainer>

export type BuildSchedulerWorkspacePropsArgs = SchedulerWorkspaceContainerProps

export function buildSchedulerWorkspaceProps({
  viewState,
  serviceState,
  actions,
}: BuildSchedulerWorkspacePropsArgs): SchedulerWorkspaceContainerProps {
  return {
    viewState,
    serviceState,
    actions,
  }
}

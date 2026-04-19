import type { ComponentProps } from 'react'

import type OverviewWorkspaceContainer from './OverviewWorkspaceContainer'

type OverviewWorkspaceContainerProps = ComponentProps<typeof OverviewWorkspaceContainer>

export type BuildOverviewWorkspacePropsArgs = OverviewWorkspaceContainerProps

export function buildOverviewWorkspaceProps({
  layoutState,
  marketState,
  activityState,
  actions,
}: BuildOverviewWorkspacePropsArgs): OverviewWorkspaceContainerProps {
  return {
    layoutState,
    marketState,
    activityState,
    actions,
  }
}

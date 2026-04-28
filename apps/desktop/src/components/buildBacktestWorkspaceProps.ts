import type { ComponentProps } from 'react'

import type BacktestWorkspaceContainer from './BacktestWorkspaceContainer'

type BacktestWorkspaceContainerProps = ComponentProps<typeof BacktestWorkspaceContainer>

export type BuildBacktestWorkspacePropsArgs = BacktestWorkspaceContainerProps

export function buildBacktestWorkspaceProps({
  selectionState,
  draftState,
  workspaceState,
  serviceState,
  actions,
}: BuildBacktestWorkspacePropsArgs): BacktestWorkspaceContainerProps {
  return {
    selectionState,
    draftState,
    workspaceState,
    serviceState,
    actions,
  }
}

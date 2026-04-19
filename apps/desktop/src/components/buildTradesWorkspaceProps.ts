import type { ComponentProps } from 'react'

import type TradesWorkspaceContainer from './TradesWorkspaceContainer'

type TradesWorkspaceContainerProps = ComponentProps<typeof TradesWorkspaceContainer>

export type BuildTradesWorkspacePropsArgs = TradesWorkspaceContainerProps

export function buildTradesWorkspaceProps({
  summaryState,
  filterState,
  positionsState,
  ordersState,
  actions,
}: BuildTradesWorkspacePropsArgs): TradesWorkspaceContainerProps {
  return {
    summaryState,
    filterState,
    positionsState,
    ordersState,
    actions,
  }
}

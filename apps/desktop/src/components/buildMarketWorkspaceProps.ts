import type { ComponentProps } from 'react'

import type MarketWorkspaceContainer from './MarketWorkspaceContainer'

type MarketWorkspaceContainerProps = ComponentProps<typeof MarketWorkspaceContainer>

export type BuildMarketWorkspacePropsArgs = MarketWorkspaceContainerProps

export function buildMarketWorkspaceProps({
  watchlistState,
  marketState,
  actions,
}: BuildMarketWorkspacePropsArgs): MarketWorkspaceContainerProps {
  return {
    watchlistState,
    marketState,
    actions,
  }
}

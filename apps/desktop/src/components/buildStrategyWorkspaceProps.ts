import type { ComponentProps } from 'react'

import type StrategyWorkspaceContainer from './StrategyWorkspaceContainer'

type StrategyWorkspaceContainerProps = ComponentProps<typeof StrategyWorkspaceContainer>

export type BuildStrategyWorkspacePropsArgs = StrategyWorkspaceContainerProps

export function buildStrategyWorkspaceProps({
  activeSectionKey,
  strategies,
  selectedStrategy,
  onSelectStrategyId,
  currentPanelState,
  executionContextState,
  actions,
}: BuildStrategyWorkspacePropsArgs): StrategyWorkspaceContainerProps {
  return {
    activeSectionKey,
    strategies,
    selectedStrategy,
    onSelectStrategyId,
    currentPanelState,
    executionContextState,
    actions,
  }
}

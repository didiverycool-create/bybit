import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppWorkspaceModelsArgsInput } from './buildAppWorkspaceModelsArgs'

export type BuildStrategyWorkspaceSurfaceArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildStrategyWorkspaceSurfaceArgs({
  source,
}: BuildStrategyWorkspaceSurfaceArgsInput): BuildAppWorkspaceModelsArgsInput['strategyWorkspace'] {
  const {
    activeSection,
    setSelectedStrategyId,
    strategies,
    selectedStrategy,
    strategyWorkspaceCurrentPanelState,
    strategyWorkspaceExecutionContextState,
  } = source

  return {
    activeSectionKey: activeSection,
    strategies,
    selectedStrategy,
    onSelectStrategyId: setSelectedStrategyId,
    currentPanelState: strategyWorkspaceCurrentPanelState,
    executionContextState: strategyWorkspaceExecutionContextState,
  }
}

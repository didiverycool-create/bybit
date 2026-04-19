import type { BuildAppCompositionModelArgs, BuildAppCompositionModelArgsInput } from './buildAppCompositionModelArgTypes'
import { buildAppCompositionStrategyWorkspaceCurrentPanelStateArgs } from './buildAppCompositionStrategyWorkspaceCurrentPanelStateArgs'
import { buildAppCompositionStrategyWorkspaceExecutionContextStateArgs } from './buildAppCompositionStrategyWorkspaceExecutionContextStateArgs'
import { buildAppCompositionStrategyWorkspaceDerivedStateInputGroups } from './buildAppCompositionStrategyWorkspaceDerivedStateInputGroups'

export function buildAppCompositionStrategyWorkspaceDerivedStateArgs({
  ...input
}: BuildAppCompositionModelArgsInput): BuildAppCompositionModelArgs['strategyWorkspaceDerivedStateArgs'] {
  const { parameterDraftStateInput, pendingStateInput } =
    buildAppCompositionStrategyWorkspaceDerivedStateInputGroups(input)

  return {
    parameterDraftState: {
      ...parameterDraftStateInput,
    },
    currentPanelState: buildAppCompositionStrategyWorkspaceCurrentPanelStateArgs(
      input,
      pendingStateInput,
    ),
    executionContextState: buildAppCompositionStrategyWorkspaceExecutionContextStateArgs(
      input,
      pendingStateInput,
    ),
  }
}

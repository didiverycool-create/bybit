import type { BuildAppCompositionModelArgsInput } from './buildAppCompositionModelArgTypes'

export type BuildAppCompositionStrategyWorkspaceDerivedStateInputGroups = {
  parameterDraftStateInput: Pick<
    BuildAppCompositionModelArgsInput,
    'selectedStrategy' | 'riskBudgetDraft' | 'parameterDrafts'
  >
  pendingStateInput: Pick<
    BuildAppCompositionModelArgsInput,
    'strategyWorkflowActions' | 'workspaceControlActions'
  >
}

export function buildAppCompositionStrategyWorkspaceDerivedStateInputGroups({
  selectedStrategy,
  riskBudgetDraft,
  parameterDrafts,
  strategyWorkflowActions,
  workspaceControlActions,
}: BuildAppCompositionModelArgsInput): BuildAppCompositionStrategyWorkspaceDerivedStateInputGroups {
  return {
    parameterDraftStateInput: {
      selectedStrategy,
      riskBudgetDraft,
      parameterDrafts,
    },
    pendingStateInput: {
      strategyWorkflowActions,
      workspaceControlActions,
    },
  }
}

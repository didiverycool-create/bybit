import type {
  AppInteractionNavigationArgs,
  BuildAppInteractionModelsArgsInput,
} from './buildAppInteractionModelsArgsShared'

export type BuildAppInteractionNavigationSelectionArgs = Pick<
  AppInteractionNavigationArgs,
  | 'strategies'
  | 'selectedStrategy'
  | 'selectedStrategyId'
  | 'strategyEditorDraftStrategyId'
  | 'parameterDrafts'
  | 'setParameterDrafts'
  | 'setRiskBudgetDraft'
  | 'setStrategyEditorDraftStrategyId'
  | 'setSelectedStrategyId'
  | 'setSelectedSymbol'
  | 'setStrategyEditorOpen'
>

export function buildAppInteractionNavigationSelectionArgs({
  strategies,
  selectedStrategy,
  selectedStrategyId,
  strategyEditorDraftStrategyId,
  parameterDrafts,
  setParameterDrafts,
  setRiskBudgetDraft,
  setStrategyEditorDraftStrategyId,
  setSelectedStrategyId,
  setSelectedSymbol,
  setStrategyEditorOpen,
}: BuildAppInteractionModelsArgsInput): BuildAppInteractionNavigationSelectionArgs {
  return {
    strategies,
    selectedStrategy,
    selectedStrategyId,
    strategyEditorDraftStrategyId,
    parameterDrafts,
    setParameterDrafts,
    setRiskBudgetDraft,
    setStrategyEditorDraftStrategyId,
    setSelectedStrategyId,
    setSelectedSymbol,
    setStrategyEditorOpen,
  }
}

import { buildStrategyWorkspaceDerivedState } from './buildStrategyWorkspaceDerivedState'
import { useReviewInspectorModel } from './useReviewInspectorModel'
import { useStrategyWorkspaceActions } from './useStrategyWorkspaceActions'
import { useWorkspaceStatusModel } from './useWorkspaceStatusModel'

type ReviewInspectorArgs = Parameters<typeof useReviewInspectorModel>[0]
type StrategyWorkspaceDerivedStateArgs = Parameters<typeof buildStrategyWorkspaceDerivedState>[0]
type StrategyWorkspaceActionsArgs = Parameters<typeof useStrategyWorkspaceActions>[0]
type WorkspaceStatusArgs = Parameters<typeof useWorkspaceStatusModel>[0]

export type UseAppCompositionModelArgs = {
  reviewInspectorArgs: ReviewInspectorArgs
  strategyWorkspaceDerivedStateArgs: StrategyWorkspaceDerivedStateArgs
  strategyWorkspaceActionsArgs: Omit<
    StrategyWorkspaceActionsArgs,
    'parameterDraftPatch' | 'hasParameterDraftChanges'
  >
  workspaceStatusArgs: Omit<WorkspaceStatusArgs, 'latestSchedulerCommandActions'>
}

export function useAppCompositionModel({
  reviewInspectorArgs,
  strategyWorkspaceDerivedStateArgs,
  strategyWorkspaceActionsArgs,
  workspaceStatusArgs,
}: UseAppCompositionModelArgs) {
  const reviewInspectorModel = useReviewInspectorModel(reviewInspectorArgs)
  const {
    parameterDraftPatch,
    parameterDraftChangeCount: parameterDraftPatchCount,
    hasParameterDraftChanges,
    riskBudgetChanged,
    currentPanelState: strategyWorkspaceCurrentPanelState,
    executionContextState: strategyWorkspaceExecutionContextState,
  } = buildStrategyWorkspaceDerivedState(strategyWorkspaceDerivedStateArgs)
  const strategyWorkspaceActions = useStrategyWorkspaceActions({
    ...strategyWorkspaceActionsArgs,
    parameterDraftPatch,
    hasParameterDraftChanges,
  })
  const workspaceStatusModel = useWorkspaceStatusModel({
    ...workspaceStatusArgs,
    latestSchedulerCommandActions: strategyWorkspaceActions.renderLatestSchedulerCommandActions(),
  })
  const {
    statusInspectorHasNotice,
    inlineToast,
    statusInspectorButtonTitle,
    latestSchedulerCommandBanner,
  } = workspaceStatusModel

  return {
    reviewInspectorModel,
    parameterDraftPatchCount,
    hasParameterDraftChanges,
    riskBudgetChanged,
    strategyWorkspaceCurrentPanelState,
    strategyWorkspaceExecutionContextState,
    strategyWorkspaceActions,
    workspaceStatusModel,
    statusInspectorHasNotice,
    inlineToast,
    statusInspectorButtonTitle,
    latestSchedulerCommandBanner,
  }
}

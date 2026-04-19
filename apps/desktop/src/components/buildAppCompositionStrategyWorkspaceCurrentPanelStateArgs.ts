import type {
  BuildAppCompositionModelArgs,
  BuildAppCompositionModelArgsInput,
} from './buildAppCompositionModelArgTypes'
import type { BuildAppCompositionStrategyWorkspaceDerivedStateInputGroups } from './buildAppCompositionStrategyWorkspaceDerivedStateInputGroups'

export function buildAppCompositionStrategyWorkspaceCurrentPanelStateArgs(
  input: BuildAppCompositionModelArgsInput,
  pendingStateInput: BuildAppCompositionStrategyWorkspaceDerivedStateInputGroups['pendingStateInput'],
): BuildAppCompositionModelArgs['strategyWorkspaceDerivedStateArgs']['currentPanelState'] {
  const {
    latestStrategyBacktest,
    latestStrategyBacktestDecisionMeta,
    latestStrategyBacktestWindowMeta,
    latestStrategyBacktestSampleMeta,
    selectedStrategyRuntime,
    selectedStrategyRuntimePreview,
    selectedMode,
    serviceAvailable,
    selectedStrategyNeedsRuntimeRecovery,
    runtimeWorkerRestoreHint,
    openStrategyProposals,
    selectedStrategyReview,
    selectedStrategyReviewDecisionMeta,
    selectedStrategyReviewLineageMeta,
  } = input

  return {
    latestStrategyBacktest,
    latestStrategyBacktestDecisionMeta,
    latestStrategyBacktestWindowMeta,
    latestStrategyBacktestSampleMeta,
    selectedStrategyRuntime,
    selectedStrategyRuntimePreview,
    selectedMode,
    serviceAvailable,
    selectedStrategyNeedsRuntimeRecovery,
    runtimeWorkerRestoreHint,
    selectedStrategyReview,
    selectedStrategyReviewDecisionMeta,
    selectedStrategyReviewLineageMeta,
    executeStrategySignalPending:
      pendingStateInput.strategyWorkflowActions.executeStrategySignalMutationPending,
    strategyTrackingPending:
      pendingStateInput.strategyWorkflowActions.strategyTrackingMutationPending,
    restartRuntimeWorkerPending:
      pendingStateInput.workspaceControlActions.restartRuntimeWorkerPending,
    backtestMutationPending: pendingStateInput.strategyWorkflowActions.backtestMutationPending,
    changeRequestMutationPending:
      pendingStateInput.strategyWorkflowActions.changeRequestMutationPending,
    openStrategyProposalsCount: openStrategyProposals.length,
  }
}

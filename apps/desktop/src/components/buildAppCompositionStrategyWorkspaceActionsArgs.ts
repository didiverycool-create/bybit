import type { BuildAppCompositionModelArgs, BuildAppCompositionModelArgsInput } from './buildAppCompositionModelArgTypes'

export function buildAppCompositionStrategyWorkspaceActionsArgs({
  latestSchedulerCommand,
  selectedStrategy,
  selectedStrategyRuntime,
  riskBudgetDraft,
  resetStrategyTrackingDraft,
  setSelectedSymbol,
  setActiveSection,
  setStrategyEditorOpen,
  setStrategyActivityPanelOpen,
  setStrategyTrackingPanelOpen,
  showFeedback,
  strategyWorkflowActions,
  workspaceNavigation,
}: BuildAppCompositionModelArgsInput): BuildAppCompositionModelArgs['strategyWorkspaceActionsArgs'] {
  return {
    latestSchedulerCommand,
    selectedStrategy,
    selectedStrategyRuntime,
    riskBudgetDraft,
    resetStrategyTrackingDraft,
    setSelectedSymbol,
    setActiveSection,
    setStrategyEditorOpen,
    setStrategyActivityPanelOpen,
    setStrategyTrackingPanelOpen,
    showFeedback,
    submitStrategyRequest: strategyWorkflowActions.submitStrategyRequest,
    openAiSchedulerJob: workspaceNavigation.openAiSchedulerJob,
    openReviewInspector: workspaceNavigation.openReviewInspector,
    openBacktestDetail: workspaceNavigation.openBacktestDetail,
    openChangeRequest: workspaceNavigation.openChangeRequest,
    openSourceReview: workspaceNavigation.openSourceReview,
    openStrategyProposal: workspaceNavigation.openStrategyProposal,
    openStrategyActivity: workspaceNavigation.openStrategyActivity,
  }
}

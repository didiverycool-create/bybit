import type { UseStrategyWorkflowActionsArgs } from './strategyWorkflowActionShared'
import { useStrategyWorkflowBacktestActions } from './useStrategyWorkflowBacktestActions'
import { useStrategyWorkflowExecutionActions } from './useStrategyWorkflowExecutionActions'
import { useStrategyWorkflowTrackingActions } from './useStrategyWorkflowTrackingActions'

export type { UseStrategyWorkflowActionsArgs } from './strategyWorkflowActionShared'

export function useStrategyWorkflowActions({
  refreshControlData,
  selectedMode,
  selectedStrategy,
  selectedStrategyRuntimePreview,
  selectedStrategyRuntime,
  watchlist,
  strategies,
  backtests,
  reviewCatalog,
  schedulerState,
  backtestRangeDraft,
  backtestTimeframeDraft,
  strategyTrackingKind,
  strategyTrackingSummary,
  strategyTrackingDetail,
  strategyTrackingRequestKey,
  findProposalById,
  setSelectedStrategyId,
  setBacktestRangeDraft,
  setBacktestTimeframeDraft,
  setSelectedBacktestId,
  setSelectedProposalId,
  setStrategyTrackingPanelOpen,
  setStrategyActivityPanelOpen,
  resetStrategyTrackingDraft,
  showFeedback,
  openAiSchedulerJob,
  openBacktestDetail,
  openChangeRequest,
}: UseStrategyWorkflowActionsArgs) {
  const strategyWorkflowTrackingActions = useStrategyWorkflowTrackingActions({
    refreshControlData,
    selectedMode,
    selectedStrategy,
    strategyTrackingKind,
    strategyTrackingSummary,
    strategyTrackingDetail,
    strategyTrackingRequestKey,
    setStrategyTrackingPanelOpen,
    setStrategyActivityPanelOpen,
    resetStrategyTrackingDraft,
    showFeedback,
  })

  const strategyWorkflowBacktestActions = useStrategyWorkflowBacktestActions({
    refreshControlData,
    selectedStrategy,
    strategies,
    backtests,
    reviewCatalog,
    backtestRangeDraft,
    backtestTimeframeDraft,
    setSelectedStrategyId,
    setBacktestRangeDraft,
    setBacktestTimeframeDraft,
    setSelectedBacktestId,
    showFeedback,
  })

  const strategyWorkflowExecutionActions = useStrategyWorkflowExecutionActions({
    refreshControlData,
    selectedMode,
    selectedStrategy,
    selectedStrategyRuntimePreview,
    selectedStrategyRuntime,
    watchlist,
    schedulerState,
    findProposalById,
    setSelectedProposalId,
    showFeedback,
    openAiSchedulerJob,
    openBacktestDetail,
    openChangeRequest,
  })

  return {
    ...strategyWorkflowTrackingActions,
    ...strategyWorkflowBacktestActions,
    ...strategyWorkflowExecutionActions,
  }
}

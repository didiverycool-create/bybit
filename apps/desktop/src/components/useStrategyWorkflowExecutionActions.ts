import { buildStrategyWorkflowExecuteSignalAction } from './buildStrategyWorkflowExecuteSignalAction'
import { buildStrategyWorkflowProposalAction } from './buildStrategyWorkflowProposalAction'
import { buildStrategyWorkflowRetryAgentJobAction } from './buildStrategyWorkflowRetryAgentJobAction'
import { buildStrategyWorkflowSubmitReviewJobAction } from './buildStrategyWorkflowSubmitReviewJobAction'
import type { UseStrategyWorkflowExecutionActionsArgs } from './useStrategyWorkflowExecutionActions.types'
import { useStrategyWorkflowExecutionMutations } from './useStrategyWorkflowExecutionMutations'

export function useStrategyWorkflowExecutionActions({
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
}: UseStrategyWorkflowExecutionActionsArgs) {
  const {
    executeStrategySignalMutation,
    agentJobMutation,
    retryAgentJobMutation,
    proposalMutation,
  } = useStrategyWorkflowExecutionMutations({
    refreshControlData,
  })

  const executeSelectedStrategySignal = buildStrategyWorkflowExecuteSignalAction({
    selectedMode,
    selectedStrategy,
    selectedStrategyRuntimePreview,
    selectedStrategyRuntime,
    showFeedback,
    executeStrategySignalMutation,
  })
  const submitReviewJob = buildStrategyWorkflowSubmitReviewJobAction({
    selectedMode,
    watchlist,
    showFeedback,
    agentJobMutation,
  })
  const retryAgentJob = buildStrategyWorkflowRetryAgentJobAction({
    showFeedback,
    openAiSchedulerJob,
    retryAgentJobMutation,
  })
  const handleProposalAction = buildStrategyWorkflowProposalAction({
    schedulerState,
    findProposalById,
    setSelectedProposalId,
    showFeedback,
    openBacktestDetail,
    openChangeRequest,
    proposalMutation,
  })

  return {
    executeStrategySignalMutationPending: executeStrategySignalMutation.isPending,
    agentJobMutationPending: agentJobMutation.isPending,
    retryAgentJobMutationPending: retryAgentJobMutation.isPending,
    proposalMutationPending: proposalMutation.isPending,
    executeSelectedStrategySignal,
    submitReviewJob,
    retryAgentJob,
    handleProposalAction,
  }
}

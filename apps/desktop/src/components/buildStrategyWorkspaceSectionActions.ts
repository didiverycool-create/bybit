import type {
  BuildWorkspaceSectionActionsResult,
} from './buildWorkspaceSectionActions'
import type { BuildWorkspaceSectionStrategyConsumerArgs } from './buildWorkspaceSectionActionConsumerGroups'

export type BuildStrategyWorkspaceSectionActionsResult = Pick<
  BuildWorkspaceSectionActionsResult,
  'strategyWorkspaceActions'
>

export function buildStrategyWorkspaceSectionActions({
  selectedStrategy,
  navigationActions,
  strategyWorkspaceActionState,
  strategyWorkflowActions,
  workspaceControlActions,
  setters,
}: BuildWorkspaceSectionStrategyConsumerArgs): BuildStrategyWorkspaceSectionActionsResult {
  return {
    strategyWorkspaceActions: {
      onOpenStrategyEditor: navigationActions.openStrategyEditor,
      onExecuteSelectedStrategySignal: () => {
        void strategyWorkflowActions.executeSelectedStrategySignal()
      },
      onOpenStrategyActivityPanel: () => setters.setStrategyActivityPanelOpen(true),
      onOpenStrategyTrackingPanel: strategyWorkspaceActionState.openStrategyTrackingPanel,
      onRestartStrategyRuntimeWorker: () => {
        void workspaceControlActions.restartStrategyRuntimeWorker()
      },
      onSubmitBacktest: () => {
        void strategyWorkflowActions.submitBacktest()
      },
      onToggleStrategyStatus: () => {
        void strategyWorkflowActions.submitStrategyRequest(
          'strategy.pause_resume',
          `${selectedStrategy?.name ?? '当前策略'} 切换策略状态`,
          {
            strategy_id: selectedStrategy?.id,
            next_status: selectedStrategy?.status === 'running' ? 'paused' : 'running',
          },
          'high',
        )
      },
      onOpenReplayReview: navigationActions.openReplayReview,
      onOpenChangeRequest: navigationActions.openChangeRequest,
      onOpenBacktestDetail: navigationActions.openBacktestDetail,
      onOpenSourceReview: navigationActions.openSourceReview,
      onOpenStrategyProposal: navigationActions.openStrategyProposal,
      onRerunBacktestFromReview: (review) => {
        void strategyWorkflowActions.rerunBacktestFromReview(review)
      },
      onOpenAiSchedulerJob: navigationActions.openAiSchedulerJob,
      onOpenReviewInspector: navigationActions.openReviewInspector,
      onRetryAgentJob: (jobId, options) => {
        void strategyWorkflowActions.retryAgentJob(jobId, options)
      },
      onHandleProposalAction: (proposalId, action) => {
        void strategyWorkflowActions.handleProposalAction(proposalId, action)
      },
      onRerunBacktestFromRecommendation: (backtest) => {
        void strategyWorkflowActions.rerunBacktestFromRecommendation(backtest)
      },
      onRerunBacktestFromChangeRequest: (request) => {
        void strategyWorkflowActions.rerunBacktestFromChangeRequest(request)
      },
    },
  }
}

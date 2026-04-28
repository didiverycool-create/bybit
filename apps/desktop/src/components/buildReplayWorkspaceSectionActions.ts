import type {
  BuildWorkspaceSectionActionsResult,
} from './buildWorkspaceSectionActions'
import type { BuildWorkspaceSectionStrategyConsumerArgs } from './buildWorkspaceSectionActionConsumerGroups'

export type BuildReplayWorkspaceSectionActionsResult = Pick<
  BuildWorkspaceSectionActionsResult,
  'replayWorkspaceActions'
>

export function buildReplayWorkspaceSectionActions({
  navigationActions,
  strategyWorkflowActions,
  setters,
}: BuildWorkspaceSectionStrategyConsumerArgs): BuildReplayWorkspaceSectionActionsResult {
  return {
    replayWorkspaceActions: {
      onSetReplayTrackingScope: setters.setReplayTrackingScope,
      onSubmitReviewJob: () => {
        void strategyWorkflowActions.submitReviewJob()
      },
      onOpenChangeRequest: navigationActions.openChangeRequest,
      onOpenBacktestDetail: navigationActions.openBacktestDetail,
      onOpenSourceReview: navigationActions.openSourceReview,
      onOpenStrategyProposal: navigationActions.openStrategyProposal,
      onOpenAiSchedulerJob: navigationActions.openAiSchedulerJob,
      onOpenStrategyActivity: navigationActions.openStrategyActivity,
      onRerunBacktestFromReview: (review) => {
        void strategyWorkflowActions.rerunBacktestFromReview(review)
      },
      onOpenReviewInspector: navigationActions.openReviewInspector,
      onOpenReplayReview: navigationActions.openReplayReview,
      onRetryAgentJob: (jobId, focusJob = false) => {
        void strategyWorkflowActions.retryAgentJob(jobId, focusJob ? { focusJob: true } : undefined)
      },
      onHandleProposalAction: (proposalId, action) => {
        void strategyWorkflowActions.handleProposalAction(proposalId, action)
      },
    },
  }
}

import type { BuildWorkspaceSectionActionsResult } from './buildWorkspaceSectionActions'
import type { BuildWorkspaceSectionOpsConsumerArgs } from './buildWorkspaceSectionActionConsumerGroups'

type BuildWorkspaceSchedulerSectionActionsArgs = Pick<
  BuildWorkspaceSectionOpsConsumerArgs,
  'navigationActions' | 'strategyWorkflowActions' | 'workspaceControlActions' | 'setters'
>

export type BuildWorkspaceSchedulerSectionActionsResult = Pick<
  BuildWorkspaceSectionActionsResult,
  'schedulerWorkspaceActions'
>

export function buildWorkspaceSchedulerSectionActions({
  navigationActions,
  strategyWorkflowActions,
  workspaceControlActions,
  setters,
}: BuildWorkspaceSchedulerSectionActionsArgs): BuildWorkspaceSchedulerSectionActionsResult {
  return {
    schedulerWorkspaceActions: {
      onRunSchedulerCommand: (command, reason, jobId) => {
        void workspaceControlActions.runSchedulerCommand(command, reason, jobId)
      },
      onOpenSchedulerControls: () => setters.setSchedulerControlsOpen(true),
      onOpenGrafanaPreview: () => setters.setGrafanaPreviewOpen(true),
      onSubmitReviewJob: () => {
        void strategyWorkflowActions.submitReviewJob()
      },
      onOpenReviewInspector: navigationActions.openReviewInspector,
      onOpenChangeRequest: navigationActions.openChangeRequest,
      onOpenBacktestDetail: navigationActions.openBacktestDetail,
      onOpenSourceReview: navigationActions.openSourceReview,
      onOpenStrategyProposal: navigationActions.openStrategyProposal,
      onOpenStrategyActivity: navigationActions.openStrategyActivity,
      onRetryAgentJob: (jobId) => {
        void strategyWorkflowActions.retryAgentJob(jobId)
      },
      onOpenAiSchedulerJob: navigationActions.openAiSchedulerJob,
    },
  }
}

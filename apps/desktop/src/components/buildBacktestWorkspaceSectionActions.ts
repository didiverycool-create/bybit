import { startTransition } from 'react'

import type {
  BuildWorkspaceSectionActionsResult,
} from './buildWorkspaceSectionActions'
import type { BuildWorkspaceSectionStrategyConsumerArgs } from './buildWorkspaceSectionActionConsumerGroups'

export type BuildBacktestWorkspaceSectionActionsResult = Pick<
  BuildWorkspaceSectionActionsResult,
  'backtestWorkspaceActions'
>

export function buildBacktestWorkspaceSectionActions({
  navigationActions,
  strategyWorkflowActions,
  setters,
}: BuildWorkspaceSectionStrategyConsumerArgs): BuildBacktestWorkspaceSectionActionsResult {
  return {
    backtestWorkspaceActions: {
      onSelectBacktestFilter: setters.setBacktestFilter,
      onSelectBacktestTimeframeDraft: setters.setBacktestTimeframeDraft,
      onSelectBacktestRangeDraft: setters.setBacktestRangeDraft,
      onSelectStrategyId: setters.setSelectedStrategyId,
      onSubmitBacktest: () => {
        void strategyWorkflowActions.submitBacktest()
      },
      onOpenStrategySection: () => {
        startTransition(() => navigationActions.openSection('strategy'))
      },
      onSelectBacktestId: setters.setSelectedBacktestId,
      onOpenChangeRequest: navigationActions.openChangeRequest,
      onOpenBacktestDetail: navigationActions.openBacktestDetail,
      onOpenSourceReview: navigationActions.openSourceReview,
      onOpenStrategyProposal: navigationActions.openStrategyProposal,
      onOpenAiSchedulerJob: navigationActions.openAiSchedulerJob,
      onOpenReplayReview: navigationActions.openReplayReview,
      onOpenReviewInspector: navigationActions.openReviewInspector,
      onRetryAgentJob: (jobId) => {
        void strategyWorkflowActions.retryAgentJob(jobId)
      },
      onHandleProposalAction: (proposalId, action) => {
        void strategyWorkflowActions.handleProposalAction(proposalId, action)
      },
      onRerunBacktestFromRecommendation: (backtest) => {
        void strategyWorkflowActions.rerunBacktestFromRecommendation(backtest)
      },
      onRerunBacktestFromReview: (review) => {
        void strategyWorkflowActions.rerunBacktestFromReview(review)
      },
    },
  }
}

import {
  resolveWorkspaceBacktestNavigationState,
  resolveWorkspaceChangeRequestNavigationState,
  resolveWorkspaceProposalNavigationState,
  resolveWorkspaceReviewNavigationState,
  resolveWorkspaceSchedulerJobNavigationState,
} from './resolveWorkspaceDetailNavigationState'
import {
  openWorkspaceAiSchedulerJobTransition,
  openWorkspaceBacktestDetailTransition,
  openWorkspaceChangeRequestTransition,
  openWorkspaceReviewInspectorTransition,
  openWorkspaceStrategyProposalTransition,
} from './buildWorkspaceDetailNavigationTransitions'
import {
  type BuildWorkspaceDetailNavigationActionsArgs,
} from './workspaceDetailNavigationShared'

export function buildWorkspaceDetailNavigationActions({
  ...args
}: BuildWorkspaceDetailNavigationActionsArgs) {
  const openBacktestDetail = (backtestId?: string | null, strategyId?: string | null) => {
    if (!backtestId) {
      return
    }
    openWorkspaceBacktestDetailTransition(
      args,
      backtestId,
      resolveWorkspaceBacktestNavigationState(args, backtestId, strategyId),
    )
  }

  const openSourceReview = (reviewId?: string | null, strategyId?: string | null) => {
    if (!reviewId) {
      return
    }
    args.openReplayReview(reviewId, strategyId, strategyId ? 'selected' : 'all')
    args.closeReviewInspector()
  }

  const openStrategyProposal = (proposalId?: string | null, strategyId?: string | null) => {
    if (!proposalId) {
      return
    }
    openWorkspaceStrategyProposalTransition(
      args,
      proposalId,
      resolveWorkspaceProposalNavigationState(args, proposalId, strategyId),
    )
  }

  const openChangeRequest = (changeRequestId?: string | null, strategyId?: string | null) => {
    if (!changeRequestId) {
      return
    }
    openWorkspaceChangeRequestTransition(
      args,
      changeRequestId,
      resolveWorkspaceChangeRequestNavigationState(args, changeRequestId, strategyId),
    )
  }

  const openReviewInspector = (reviewId?: string | null, strategyId?: string | null) => {
    if (!reviewId) {
      return
    }
    openWorkspaceReviewInspectorTransition(
      args,
      reviewId,
      resolveWorkspaceReviewNavigationState(args, reviewId, strategyId),
    )
  }

  const openAiSchedulerJob = (jobId?: string | null) => {
    if (!jobId) {
      return
    }
    openWorkspaceAiSchedulerJobTransition(
      args,
      jobId,
      resolveWorkspaceSchedulerJobNavigationState(args, jobId),
    )
  }

  return {
    openBacktestDetail,
    openSourceReview,
    openStrategyProposal,
    openChangeRequest,
    openReviewInspector,
    openAiSchedulerJob,
  }
}

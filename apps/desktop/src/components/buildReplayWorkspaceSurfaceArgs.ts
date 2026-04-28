import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppWorkspaceModelsArgsInput } from './buildAppWorkspaceModelsArgs'

export type BuildReplayWorkspaceSurfaceArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildReplayWorkspaceSurfaceArgs({
  source,
}: BuildReplayWorkspaceSurfaceArgsInput): BuildAppWorkspaceModelsArgsInput['replayWorkspace'] {
  const {
    selectedStrategy,
    replayFocusReview,
    replayFocusReviewDecisionMeta,
    replayFocusReviewLineageMeta,
    latestTrackingReview,
    replayTrackingScope,
    selectedProposalId,
    selectedChangeRequestId,
    selectedBacktestId,
    replayFocusedReviewId,
    aiSchedulerFocusedJobId,
    filteredReplayTrackingReviews,
    filteredReplayTrackingJobs,
    strategyNameMap,
    replayProposalFeed,
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
    snapshot,
    serviceAvailable,
    strategyWorkflowActions,
    reviewInspectorReviewId,
  } = source

  return {
    focusState: {
      selectedStrategy,
      replayFocusReview,
      replayFocusReviewDecisionMeta,
      replayFocusReviewLineageMeta,
      hasLatestTrackingReview: Boolean(latestTrackingReview),
      replayTrackingScope,
      selectedProposalId,
      selectedChangeRequestId,
      selectedBacktestId,
      focusedReviewId: reviewInspectorReviewId ?? replayFocusedReviewId,
      aiSchedulerFocusedJobId,
    },
    replayState: {
      filteredReplayTrackingReviews,
      filteredReplayTrackingJobs,
      strategyNameMap,
      replayProposalFeed,
      proposalBacktestMap,
      proposalReviewMap,
      proposalChangeRequestMap,
      proposalAgentJobMap,
      schedulerState: snapshot?.scheduler,
    },
    serviceState: {
      serviceAvailable,
      agentJobMutationPending: strategyWorkflowActions.agentJobMutationPending,
      backtestMutationPending: strategyWorkflowActions.backtestMutationPending,
      retryAgentJobMutationPending: strategyWorkflowActions.retryAgentJobMutationPending,
      proposalMutationPending: strategyWorkflowActions.proposalMutationPending,
    },
  }
}

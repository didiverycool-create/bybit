import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppWorkspaceModelsArgsInput } from './buildAppWorkspaceModelsArgs'

export type BuildBacktestWorkspaceSurfaceArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildBacktestWorkspaceSurfaceArgs({
  source,
}: BuildBacktestWorkspaceSurfaceArgsInput): BuildAppWorkspaceModelsArgsInput['backtestWorkspace'] {
  const {
    selectedStrategy,
    selectedProposalId,
    backtestFilter,
    selectedBacktest,
    backtestsForWorkspace,
    backtestRangeDraft,
    backtestTimeframeDraft,
    backtestRangePresets,
    backtestTimeframePresets,
    latestWorkspaceBacktest,
    latestWorkspaceBacktestDecisionMeta,
    latestWorkspaceBacktestWindowMeta,
    latestWorkspaceBacktestSampleMeta,
    openStrategyProposals,
    selectedBacktestSampleMeta,
    selectedBacktestWindowMeta,
    selectedBacktestDecisionMeta,
    selectedBacktestLineageMeta,
    selectedBacktestReview,
    selectedBacktestReviewJob,
    selectedBacktestReviewJobMeta,
    selectedBacktestProposals,
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
    snapshot,
  } = source

  return {
    selectionState: {
      selectedStrategy,
      strategies: source.strategies,
      backtestFilter,
      selectedProposalId,
    },
    serviceState: {
      serviceAvailable: source.serviceAvailable,
      backtestMutationPending: source.strategyWorkflowActions.backtestMutationPending,
      proposalMutationPending: source.strategyWorkflowActions.proposalMutationPending,
      retryAgentJobMutationPending: source.strategyWorkflowActions.retryAgentJobMutationPending,
    },
    derivedStateArgs: {
      selectedStrategy,
      selectedBacktest,
      backtestsForWorkspace,
      backtestRangeDraft,
      backtestTimeframeDraft,
      backtestRangePresets,
      backtestTimeframePresets,
      latestWorkspaceBacktest,
      latestWorkspaceBacktestDecisionMeta,
      latestWorkspaceBacktestWindowMeta,
      latestWorkspaceBacktestSampleMeta,
      openStrategyProposalsCount: openStrategyProposals.length,
      selectedBacktestSampleMeta,
      selectedBacktestWindowMeta,
      selectedBacktestDecisionMeta,
      selectedBacktestLineageMeta,
      selectedBacktestReview,
      selectedBacktestReviewJob,
      selectedBacktestReviewJobMeta,
      selectedBacktestProposals,
      proposalBacktestMap,
      proposalReviewMap,
      proposalChangeRequestMap,
      proposalAgentJobMap,
      schedulerState: snapshot?.scheduler ?? null,
    },
  }
}

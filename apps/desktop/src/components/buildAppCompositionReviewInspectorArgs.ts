import type { BuildAppCompositionModelArgs, BuildAppCompositionModelArgsInput } from './buildAppCompositionModelArgTypes'

export function buildAppCompositionReviewInspectorArgs({
  reviewCatalog,
  strategyActivityReviewRecords,
  reviewInspectorReviewId,
  reviewInspectorStrategyId,
  strategyNameMap,
  proposalBacktestMap,
  proposalReviewMap,
  proposalChangeRequestMap,
  proposalAgentJobMap,
  proposalFocusLabels,
  activityLatestActionableProposal,
  snapshot,
}: BuildAppCompositionModelArgsInput): BuildAppCompositionModelArgs['reviewInspectorArgs'] {
  return {
    reviewCatalog,
    strategyActivityReviewRecords,
    reviewInspectorReviewId,
    reviewInspectorStrategyId,
    strategyNameMap,
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
    proposalFocusLabels,
    latestActionableProposalId: activityLatestActionableProposal?.id ?? null,
    schedulerState: snapshot?.scheduler ?? null,
  }
}

import type { AppInteractionStrategyWorkflowArgs } from './buildAppInteractionModelsArgsShared'
import type { StrategyProposal } from '../types'

type ReplayProposalFeedItem = { proposal: StrategyProposal }

export function findAppShellProposalById(
  strategyProposals: ReadonlyArray<StrategyProposal>,
  replayProposalFeed: ReadonlyArray<ReplayProposalFeedItem>,
  proposalId: string,
): ReturnType<AppInteractionStrategyWorkflowArgs['findProposalById']> {
  return (
    strategyProposals.find((item) => item.id === proposalId) ??
    replayProposalFeed.find((item) => item.proposal.id === proposalId)?.proposal ??
    null
  )
}

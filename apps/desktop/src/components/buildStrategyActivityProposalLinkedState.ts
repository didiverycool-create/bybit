import type {
  StrategyActivityDecisionContext,
  StrategyActivityProposalLinkedState,
  UseStrategyActivityDecisionModelArgs,
} from './strategyActivityDecisionShared'

type ProposalLinkedStateResolverArgs = Pick<
  UseStrategyActivityDecisionModelArgs,
  'proposalBacktestMap' | 'proposalReviewMap' | 'proposalChangeRequestMap' | 'proposalAgentJobMap'
> &
  Pick<
    StrategyActivityDecisionContext,
    | 'latestProposalSource'
    | 'latestActionableProposalSource'
    | 'latestProposalChangeRequestSource'
    | 'latestActionableProposalChangeRequestSource'
    | 'latestProposalBacktestRecordSource'
    | 'latestActionableProposalBacktestRecordSource'
    | 'latestProposalReviewRecordSource'
    | 'latestActionableProposalReviewRecordSource'
    | 'latestProposalJobRecordSource'
    | 'latestActionableProposalJobRecordSource'
  >

export function createStrategyActivityProposalLinkedStateResolver({
  proposalBacktestMap,
  proposalReviewMap,
  proposalChangeRequestMap,
  proposalAgentJobMap,
  latestProposalSource,
  latestActionableProposalSource,
  latestProposalChangeRequestSource,
  latestActionableProposalChangeRequestSource,
  latestProposalBacktestRecordSource,
  latestActionableProposalBacktestRecordSource,
  latestProposalReviewRecordSource,
  latestActionableProposalReviewRecordSource,
  latestProposalJobRecordSource,
  latestActionableProposalJobRecordSource,
}: ProposalLinkedStateResolverArgs) {
  return (
    proposal?: typeof latestProposalSource | typeof latestActionableProposalSource | null,
  ): StrategyActivityProposalLinkedState => {
    if (!proposal) {
      return {
        linkedBacktest: null,
        linkedReview: null,
        linkedChangeRequest: null,
        linkedJob: null,
      }
    }

    const latestActionableMatched = latestActionableProposalSource?.id === proposal.id
    const latestMatched = latestProposalSource?.id === proposal.id
    const linkedChangeRequest =
      (latestActionableMatched ? latestActionableProposalChangeRequestSource : null) ??
      (latestMatched ? latestProposalChangeRequestSource : null) ??
      proposalChangeRequestMap.get(proposal.id) ??
      null
    const linkedBacktest =
      (latestActionableMatched ? latestActionableProposalBacktestRecordSource : null) ??
      (latestMatched ? latestProposalBacktestRecordSource : null) ??
      proposalBacktestMap.get(proposal.id) ??
      null
    const linkedReview =
      (latestActionableMatched ? latestActionableProposalReviewRecordSource : null) ??
      (latestMatched ? latestProposalReviewRecordSource : null) ??
      proposalReviewMap.get(proposal.id) ??
      null
    const linkedJob =
      (latestActionableMatched ? latestActionableProposalJobRecordSource : null) ??
      (latestMatched ? latestProposalJobRecordSource : null) ??
      proposalAgentJobMap.get(proposal.id) ??
      null

    return {
      linkedBacktest,
      linkedReview,
      linkedChangeRequest,
      linkedJob,
    }
  }
}

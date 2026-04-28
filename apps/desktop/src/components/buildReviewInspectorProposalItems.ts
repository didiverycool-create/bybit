import {
  getChangeRequestStrategyId,
  proposalAcceptBlockedReason,
  proposalManualFollowupMeta,
  proposalOutcomeDetails,
} from '../utils/app-helpers'
import type { UseReviewInspectorModelArgs, ReviewInspectorState } from './useReviewInspectorModel.types'

type BuildReviewInspectorProposalItemsArgs = Pick<
  UseReviewInspectorModelArgs,
  | 'proposalBacktestMap'
  | 'proposalReviewMap'
  | 'proposalChangeRequestMap'
  | 'proposalAgentJobMap'
  | 'proposalFocusLabels'
  | 'latestActionableProposalId'
  | 'schedulerState'
> & {
  review: ReviewInspectorState['review']
}

export function buildReviewInspectorProposalItems({
  review,
  proposalBacktestMap,
  proposalReviewMap,
  proposalChangeRequestMap,
  proposalAgentJobMap,
  proposalFocusLabels,
  latestActionableProposalId,
  schedulerState,
}: BuildReviewInspectorProposalItemsArgs): ReviewInspectorState['proposalItems'] {
  if (!review) {
    return []
  }

  return review.proposals.map((proposal) => {
    const linkedBacktest = proposalBacktestMap.get(proposal.id) ?? null
    const linkedReview = proposalReviewMap.get(proposal.id) ?? null
    const linkedChangeRequest = proposalChangeRequestMap.get(proposal.id) ?? null
    const linkedJob = proposalAgentJobMap.get(proposal.id) ?? null

    return {
      proposal,
      linkedBacktest,
      linkedReview,
      linkedChangeRequest,
      linkedJob,
      proposalStrategyId: getChangeRequestStrategyId(linkedChangeRequest, proposal.strategy_id),
      manualFollowupMeta: proposalManualFollowupMeta(proposal, linkedChangeRequest),
      outcomeDetails: proposalOutcomeDetails(
        proposal,
        linkedChangeRequest,
        linkedBacktest,
        linkedReview,
        linkedJob,
      ),
      focusLabels: proposalFocusLabels(
        proposal,
        linkedChangeRequest,
        linkedBacktest,
        linkedReview,
        linkedJob,
      ),
      blockedReason: proposalAcceptBlockedReason(proposal.proposal_type, schedulerState),
      isLatestActionable: latestActionableProposalId === proposal.id,
    }
  })
}

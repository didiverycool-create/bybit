import { prependUniqueActivityItem } from '../utils/app-helpers'
import type { StrategyProposal } from '../types'
import type {
  StrategyActivityDecisionContext,
  UseStrategyActivityDecisionModelArgs,
} from './strategyActivityDecisionShared'

type ProposalDecisionSelectionArgs = Pick<
  UseStrategyActivityDecisionModelArgs,
  | 'selectedProposalId'
  | 'selectedChangeRequestId'
  | 'selectedBacktestId'
  | 'reviewInspectorReviewId'
  | 'replayFocusedReviewId'
  | 'aiSchedulerFocusedJobId'
  | 'strategyProposals'
  | 'proposalBacktestMap'
  | 'proposalReviewMap'
  | 'proposalChangeRequestMap'
  | 'proposalAgentJobMap'
>

type ProposalDecisionSelectionContext = Pick<
  StrategyActivityDecisionContext,
  | 'activityStrategyId'
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
  | 'recentProposals'
>

function findLinkedProposal(
  strategyProposals: StrategyProposal[],
  matchesProposal: (proposal: StrategyProposal) => boolean,
) {
  return strategyProposals.find(matchesProposal) ?? null
}

export function buildStrategyActivityProposalSelection(
  {
    selectedProposalId,
    selectedChangeRequestId,
    selectedBacktestId,
    reviewInspectorReviewId,
    replayFocusedReviewId,
    aiSchedulerFocusedJobId,
    strategyProposals,
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
  }: ProposalDecisionSelectionArgs,
  {
    activityStrategyId,
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
    recentProposals,
  }: ProposalDecisionSelectionContext,
) {
  const selectedStrategyProposal = (() => {
    if (selectedProposalId != null) {
      return strategyProposals.find((proposal) => proposal.id === selectedProposalId) ?? null
    }
    if (selectedChangeRequestId != null) {
      return findLinkedProposal(
        strategyProposals,
        (proposal) =>
          (latestActionableProposalSource?.id === proposal.id &&
            (latestActionableProposalChangeRequestSource?.id ?? null) === selectedChangeRequestId) ||
          (latestProposalSource?.id === proposal.id &&
            (latestProposalChangeRequestSource?.id ?? null) === selectedChangeRequestId) ||
          (proposalChangeRequestMap.get(proposal.id) ?? null)?.id === selectedChangeRequestId,
      )
    }
    if (selectedBacktestId != null) {
      return findLinkedProposal(
        strategyProposals,
        (proposal) =>
          (latestActionableProposalSource?.id === proposal.id &&
            (latestActionableProposalBacktestRecordSource?.id ?? null) === selectedBacktestId) ||
          (latestProposalSource?.id === proposal.id &&
            (latestProposalBacktestRecordSource?.id ?? null) === selectedBacktestId) ||
          (proposalBacktestMap.get(proposal.id) ?? null)?.id === selectedBacktestId,
      )
    }

    const focusedReviewId = reviewInspectorReviewId ?? replayFocusedReviewId
    if (focusedReviewId != null) {
      return findLinkedProposal(
        strategyProposals,
        (proposal) =>
          (latestActionableProposalSource?.id === proposal.id &&
            (latestActionableProposalReviewRecordSource?.id ?? null) === focusedReviewId) ||
          (latestProposalSource?.id === proposal.id &&
            (latestProposalReviewRecordSource?.id ?? null) === focusedReviewId) ||
          (proposalReviewMap.get(proposal.id) ?? null)?.id === focusedReviewId,
      )
    }

    if (aiSchedulerFocusedJobId != null) {
      return findLinkedProposal(
        strategyProposals,
        (proposal) =>
          (latestActionableProposalSource?.id === proposal.id &&
            (latestActionableProposalJobRecordSource?.id ?? null) === aiSchedulerFocusedJobId) ||
          (latestProposalSource?.id === proposal.id &&
            (latestProposalJobRecordSource?.id ?? null) === aiSchedulerFocusedJobId) ||
          (proposalAgentJobMap.get(proposal.id) ?? null)?.id === aiSchedulerFocusedJobId,
      )
    }

    return null
  })()

  let strategyActivityProposals = recentProposals
  if (latestProposalSource && activityStrategyId && latestProposalSource.strategy_id === activityStrategyId) {
    strategyActivityProposals = prependUniqueActivityItem(
      strategyActivityProposals,
      latestProposalSource,
      (proposal) => proposal.id,
      8,
    )
  }
  if (
    latestActionableProposalSource &&
    activityStrategyId &&
    latestActionableProposalSource.strategy_id === activityStrategyId
  ) {
    strategyActivityProposals = prependUniqueActivityItem(
      strategyActivityProposals,
      latestActionableProposalSource,
      (proposal) => proposal.id,
      8,
    )
  }
  if (
    selectedStrategyProposal &&
    activityStrategyId &&
    selectedStrategyProposal.strategy_id === activityStrategyId
  ) {
    strategyActivityProposals = prependUniqueActivityItem(
      strategyActivityProposals,
      selectedStrategyProposal,
      (proposal) => proposal.id,
      8,
    )
  }

  const activityLatestProposal = strategyActivityProposals[0] ?? latestProposalSource
  const activityLatestActionableProposal =
    strategyActivityProposals.find((proposal) => proposal.status === 'pending' || proposal.status === 'testing') ??
    latestActionableProposalSource ??
    null

  return {
    selectedStrategyProposal,
    strategyActivityProposals,
    activityLatestProposal,
    activityLatestActionableProposal,
  }
}

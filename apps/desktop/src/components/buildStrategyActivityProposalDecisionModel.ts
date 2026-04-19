import {
  proposalAcceptBlockedReason,
  proposalManualFollowupMeta,
  strategyActivityLatestProposalSummary,
} from '../utils/app-helpers'
import type {
  StrategyActivityDecisionContext,
  StrategyActivityProposalLinkedState,
  UseStrategyActivityDecisionModelArgs,
} from './strategyActivityDecisionShared'
import { createStrategyActivityProposalLinkedStateResolver } from './buildStrategyActivityProposalLinkedState'
import { buildStrategyActivityProposalSelection } from './buildStrategyActivityProposalSelection'

type ProposalDecisionArgs = Pick<
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
  | 'schedulerState'
>

export function buildStrategyActivityProposalDecisionModel(
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
    schedulerState,
  }: ProposalDecisionArgs,
  context: StrategyActivityDecisionContext,
) {
  const {
    selectedStrategyProposal,
    strategyActivityProposals,
    activityLatestProposal,
    activityLatestActionableProposal,
  } = buildStrategyActivityProposalSelection(
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
    },
    context,
  )

  const getStrategyActivityProposalLinkedState: (
    proposal?: typeof activityLatestProposal | null,
  ) => StrategyActivityProposalLinkedState = createStrategyActivityProposalLinkedStateResolver({
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
    latestProposalSource: context.latestProposalSource,
    latestActionableProposalSource: context.latestActionableProposalSource,
    latestProposalChangeRequestSource: context.latestProposalChangeRequestSource,
    latestActionableProposalChangeRequestSource: context.latestActionableProposalChangeRequestSource,
    latestProposalBacktestRecordSource: context.latestProposalBacktestRecordSource,
    latestActionableProposalBacktestRecordSource: context.latestActionableProposalBacktestRecordSource,
    latestProposalReviewRecordSource: context.latestProposalReviewRecordSource,
    latestActionableProposalReviewRecordSource: context.latestActionableProposalReviewRecordSource,
    latestProposalJobRecordSource: context.latestProposalJobRecordSource,
    latestActionableProposalJobRecordSource: context.latestActionableProposalJobRecordSource,
  })

  const activityLatestProposalLinkedState = getStrategyActivityProposalLinkedState(activityLatestProposal)
  const activityLatestProposalLinkedBacktest = activityLatestProposalLinkedState.linkedBacktest
  const activityLatestProposalLinkedReview = activityLatestProposalLinkedState.linkedReview
  const activityLatestProposalLinkedChangeRequest = activityLatestProposalLinkedState.linkedChangeRequest
  const activityLatestProposalLinkedJob = activityLatestProposalLinkedState.linkedJob
  const activityLatestProposalSummary = strategyActivityLatestProposalSummary(
    activityLatestProposal,
    activityLatestProposalLinkedChangeRequest,
    activityLatestProposalLinkedBacktest,
    activityLatestProposalLinkedReview,
    activityLatestProposalLinkedJob,
  )

  const activityLatestActionableProposalLinkedState = getStrategyActivityProposalLinkedState(
    activityLatestActionableProposal,
  )
  const activityLatestActionableProposalLinkedBacktest =
    activityLatestActionableProposalLinkedState.linkedBacktest
  const activityLatestActionableProposalLinkedReview =
    activityLatestActionableProposalLinkedState.linkedReview
  const activityLatestActionableProposalLinkedChangeRequest =
    activityLatestActionableProposalLinkedState.linkedChangeRequest
  const activityLatestActionableProposalLinkedJob = activityLatestActionableProposalLinkedState.linkedJob
  const activityLatestActionableProposalSummary = strategyActivityLatestProposalSummary(
    activityLatestActionableProposal,
    activityLatestActionableProposalLinkedChangeRequest,
    activityLatestActionableProposalLinkedBacktest,
    activityLatestActionableProposalLinkedReview,
    activityLatestActionableProposalLinkedJob,
  )
  const activityLatestActionableProposalManualFollowupMeta = activityLatestActionableProposal
    ? proposalManualFollowupMeta(
        activityLatestActionableProposal,
        activityLatestActionableProposalLinkedChangeRequest,
      )
    : null
  const activityLatestActionableProposalBlockedReason = activityLatestActionableProposal
    ? proposalAcceptBlockedReason(activityLatestActionableProposal.proposal_type, schedulerState)
    : null
  const activityLatestActionableProposalDiffersFromLatest = Boolean(
    activityLatestActionableProposal && activityLatestActionableProposal.id !== activityLatestProposal?.id,
  )

  return {
    selectedStrategyProposal,
    strategyActivityProposals,
    activityLatestProposal,
    activityLatestActionableProposal,
    activityLatestProposalLinkedBacktest,
    activityLatestProposalLinkedReview,
    activityLatestProposalLinkedChangeRequest,
    activityLatestProposalLinkedJob,
    getStrategyActivityProposalLinkedState,
    activityLatestProposalSummary,
    activityLatestActionableProposalSummary,
    activityLatestActionableProposalManualFollowupMeta,
    activityLatestActionableProposalBlockedReason,
    activityLatestActionableProposalDiffersFromLatest,
  }
}

import {
  getChangeRequestLinkedBacktestRecommendation,
  getChangeRequestSourceBacktestId,
  getChangeRequestSourceProposalId,
  getChangeRequestSourceReviewId,
  getChangeRequestStrategyId,
  strategyActivityLatestChangeRequestSummary,
} from '../utils/app-helpers'
import type { ChangeRequest } from '../types'
import type {
  StrategyActivityChangeRequestLinkedState,
  StrategyActivityProgressLookupContext,
  UseStrategyActivityProgressModelArgs,
} from './strategyActivityProgressShared'
import {
  findLatestActionableChangeRequest,
} from './buildStrategyActivityChangeRequestProgressModelActionable'
import {
  buildStrategyActivityChangeRequestList,
} from './buildStrategyActivityChangeRequestProgressModelList'
import {
  resolveStrategyActivityChangeRequestLinkedState,
  type StrategyActivityChangeRequestLinkedStateLookup,
} from './buildStrategyActivityChangeRequestProgressModelLinkedState'

type ChangeRequestProgressArgs = Pick<
  UseStrategyActivityProgressModelArgs,
  'selectedStrategy' | 'selectedStrategyChangeRequest'
>

export function buildStrategyActivityChangeRequestProgressModelState(
  { selectedStrategy, selectedStrategyChangeRequest }: ChangeRequestProgressArgs,
  context: StrategyActivityProgressLookupContext,
) {
  const {
    activityStrategyId,
    changeRequestSources,
    strategyActivityCollections,
    backtestById,
    reviewById,
    schedulerJobById,
    proposalById,
  } = context
  const {
    latestChangeRequest: latestChangeRequestSource,
    latestActionableChangeRequest: latestActionableChangeRequestSource,
    latestChangeRequestBacktestRecord: latestChangeRequestBacktestRecordSource,
    latestChangeRequestReviewRecord: latestChangeRequestReviewRecordSource,
    latestChangeRequestJobRecord: latestChangeRequestJobRecordSource,
    latestChangeRequestSourceBacktestRecord: latestChangeRequestSourceBacktestRecordSource,
    latestChangeRequestSourceReviewRecord: latestChangeRequestSourceReviewRecordSource,
    latestChangeRequestSourceProposalRecord: latestChangeRequestSourceProposalRecordSource,
    latestActionableChangeRequestBacktestRecord: latestActionableChangeRequestBacktestRecordSource,
    latestActionableChangeRequestReviewRecord: latestActionableChangeRequestReviewRecordSource,
    latestActionableChangeRequestJobRecord: latestActionableChangeRequestJobRecordSource,
    latestActionableChangeRequestSourceBacktestRecord:
      latestActionableChangeRequestSourceBacktestRecordSource,
    latestActionableChangeRequestSourceReviewRecord:
      latestActionableChangeRequestSourceReviewRecordSource,
    latestActionableChangeRequestSourceProposalRecord:
      latestActionableChangeRequestSourceProposalRecordSource,
  } = changeRequestSources

  const strategyActivityChangeRequests = buildStrategyActivityChangeRequestList({
    activityStrategyId,
    strategyActivityCollections,
    latestChangeRequest: latestChangeRequestSource,
    latestActionableChangeRequest: latestActionableChangeRequestSource,
    selectedStrategyChangeRequest,
    selectedStrategyId: selectedStrategy?.id ?? activityStrategyId,
  })
  const activityLatestChangeRequest = strategyActivityChangeRequests[0] ?? latestChangeRequestSource
  const activityLatestChangeRequestSummary = strategyActivityLatestChangeRequestSummary(activityLatestChangeRequest)
  const activityLatestChangeRequestStrategyId = activityLatestChangeRequest
    ? getChangeRequestStrategyId(activityLatestChangeRequest, activityStrategyId)
    : null

  const latestChangeRequestLinkedStateLookup: StrategyActivityChangeRequestLinkedStateLookup = {
    latestChangeRequest: latestChangeRequestSource,
    latestActionableChangeRequest: latestActionableChangeRequestSource,
    latestChangeRequestBacktestRecord: latestChangeRequestBacktestRecordSource,
    latestChangeRequestReviewRecord: latestChangeRequestReviewRecordSource,
    latestChangeRequestJobRecord: latestChangeRequestJobRecordSource,
    latestChangeRequestSourceBacktestRecord: latestChangeRequestSourceBacktestRecordSource,
    latestChangeRequestSourceReviewRecord: latestChangeRequestSourceReviewRecordSource,
    latestChangeRequestSourceProposalRecord: latestChangeRequestSourceProposalRecordSource,
    latestActionableChangeRequestBacktestRecord: latestActionableChangeRequestBacktestRecordSource,
    latestActionableChangeRequestReviewRecord: latestActionableChangeRequestReviewRecordSource,
    latestActionableChangeRequestJobRecord: latestActionableChangeRequestJobRecordSource,
    latestActionableChangeRequestSourceBacktestRecord: latestActionableChangeRequestSourceBacktestRecordSource,
    latestActionableChangeRequestSourceReviewRecord: latestActionableChangeRequestSourceReviewRecordSource,
    latestActionableChangeRequestSourceProposalRecord: latestActionableChangeRequestSourceProposalRecordSource,
    backtestById,
    reviewById,
    schedulerJobById,
    proposalById,
  }
  const getStrategyActivityChangeRequestLinkedState = (
    request?: ChangeRequest | null,
  ): StrategyActivityChangeRequestLinkedState =>
    resolveStrategyActivityChangeRequestLinkedState(request, latestChangeRequestLinkedStateLookup)

  const activityLatestChangeRequestLinkedState = getStrategyActivityChangeRequestLinkedState(
    activityLatestChangeRequest,
  )
  const activityLatestChangeRequestLinkedBacktest = activityLatestChangeRequestLinkedState.linkedBacktest
  const activityLatestChangeRequestLinkedBacktestId = activityLatestChangeRequestLinkedBacktest?.id ?? null
  const activityLatestChangeRequestLinkedReview = activityLatestChangeRequestLinkedState.linkedReview
  const activityLatestChangeRequestLinkedReviewId = activityLatestChangeRequestLinkedReview?.id ?? null
  const activityLatestChangeRequestLinkedJob = activityLatestChangeRequestLinkedState.linkedJob
  const activityLatestChangeRequestSourceBacktest = activityLatestChangeRequestLinkedState.sourceBacktest
  const activityLatestChangeRequestSourceBacktestId =
    activityLatestChangeRequestSourceBacktest?.id ??
    (activityLatestChangeRequest ? getChangeRequestSourceBacktestId(activityLatestChangeRequest) : null)
  const activityLatestChangeRequestSourceReview = activityLatestChangeRequestLinkedState.sourceReview
  const activityLatestChangeRequestSourceReviewId =
    activityLatestChangeRequestSourceReview?.id ??
    (activityLatestChangeRequest ? getChangeRequestSourceReviewId(activityLatestChangeRequest) : null)
  const activityLatestChangeRequestSourceProposal = activityLatestChangeRequestLinkedState.sourceProposal
  const activityLatestChangeRequestSourceProposalId =
    activityLatestChangeRequestSourceProposal?.id ??
    (activityLatestChangeRequest ? getChangeRequestSourceProposalId(activityLatestChangeRequest) : null)
  const activityLatestChangeRequestSourceBacktestStrategyId =
    activityLatestChangeRequestSourceBacktest?.strategy_id ?? activityLatestChangeRequestStrategyId
  const activityLatestChangeRequestSourceReviewStrategyId =
    activityLatestChangeRequestSourceReview?.strategy_id ?? activityLatestChangeRequestStrategyId
  const activityLatestChangeRequestSourceProposalStrategyId =
    activityLatestChangeRequestSourceProposal?.strategy_id ?? activityLatestChangeRequestStrategyId

  const activityLatestActionableChangeRequest = findLatestActionableChangeRequest({
    strategyActivityChangeRequests,
    latestActionableChangeRequest: latestActionableChangeRequestSource,
    backtestById,
  })
  const activityLatestActionableChangeRequestSummary = strategyActivityLatestChangeRequestSummary(
    activityLatestActionableChangeRequest,
  )
  const activityLatestActionableChangeRequestLinkedState = getStrategyActivityChangeRequestLinkedState(
    activityLatestActionableChangeRequest,
  )
  const activityLatestActionableChangeRequestRerunRecommendation = activityLatestActionableChangeRequest
    ? getChangeRequestLinkedBacktestRecommendation(
        activityLatestActionableChangeRequest,
        activityLatestActionableChangeRequestLinkedState.linkedBacktest,
      )
    : null
  const activityLatestActionableChangeRequestDiffersFromLatest = Boolean(
    activityLatestActionableChangeRequest &&
      activityLatestActionableChangeRequest.id !== activityLatestChangeRequest?.id,
  )

  return {
    strategyActivityChangeRequests,
    activityLatestChangeRequest,
    activityLatestChangeRequestSummary,
    activityLatestChangeRequestStrategyId,
    getStrategyActivityChangeRequestLinkedState,
    activityLatestChangeRequestLinkedBacktest,
    activityLatestChangeRequestLinkedBacktestId,
    activityLatestChangeRequestLinkedReview,
    activityLatestChangeRequestLinkedReviewId,
    activityLatestChangeRequestLinkedJob,
    activityLatestChangeRequestSourceBacktest,
    activityLatestChangeRequestSourceBacktestId,
    activityLatestChangeRequestSourceReview,
    activityLatestChangeRequestSourceReviewId,
    activityLatestChangeRequestSourceProposal,
    activityLatestChangeRequestSourceProposalId,
    activityLatestChangeRequestSourceBacktestStrategyId,
    activityLatestChangeRequestSourceReviewStrategyId,
    activityLatestChangeRequestSourceProposalStrategyId,
    activityLatestActionableChangeRequest,
    activityLatestActionableChangeRequestSummary,
    activityLatestActionableChangeRequestLinkedState,
    activityLatestActionableChangeRequestRerunRecommendation,
    activityLatestActionableChangeRequestDiffersFromLatest,
  }
}

export type StrategyActivityChangeRequestProgressModelState = ReturnType<
  typeof buildStrategyActivityChangeRequestProgressModelState
>

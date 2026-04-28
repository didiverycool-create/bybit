import {
  getChangeRequestLinkedBacktestId,
  getChangeRequestSourceBacktestId,
  getChangeRequestSourceProposalId,
  getChangeRequestSourceReviewId,
} from '../utils/app-helpers'
import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyProposal,
} from '../types'
import type { StrategyActivityChangeRequestLinkedState } from './strategyActivityProgressShared'

export type StrategyActivityChangeRequestLinkedStateLookup = {
  latestChangeRequest: ChangeRequest | null
  latestActionableChangeRequest: ChangeRequest | null
  latestChangeRequestBacktestRecord: BacktestRun | null
  latestChangeRequestReviewRecord: ReviewDocument | null
  latestChangeRequestJobRecord: AgentJob | null
  latestChangeRequestSourceBacktestRecord: BacktestRun | null
  latestChangeRequestSourceReviewRecord: ReviewDocument | null
  latestChangeRequestSourceProposalRecord: StrategyProposal | null
  latestActionableChangeRequestBacktestRecord: BacktestRun | null
  latestActionableChangeRequestReviewRecord: ReviewDocument | null
  latestActionableChangeRequestJobRecord: AgentJob | null
  latestActionableChangeRequestSourceBacktestRecord: BacktestRun | null
  latestActionableChangeRequestSourceReviewRecord: ReviewDocument | null
  latestActionableChangeRequestSourceProposalRecord: StrategyProposal | null
  backtestById: Map<string, BacktestRun>
  reviewById: Map<string, ReviewDocument>
  schedulerJobById: Map<string, AgentJob>
  proposalById: Map<string, StrategyProposal>
}

export function resolveStrategyActivityChangeRequestLinkedState(
  request: ChangeRequest | null | undefined,
  lookup: StrategyActivityChangeRequestLinkedStateLookup,
): StrategyActivityChangeRequestLinkedState {
  if (!request) {
    return {
      linkedBacktest: null,
      linkedReview: null,
      linkedJob: null,
      sourceBacktest: null,
      sourceReview: null,
      sourceProposal: null,
    }
  }
  const latestMatched = lookup.latestChangeRequest?.id === request.id
  const latestActionableMatched = lookup.latestActionableChangeRequest?.id === request.id
  const linkedBacktestId = getChangeRequestLinkedBacktestId(request)
  const linkedReviewId =
    typeof request.linked_review_id === 'string' && request.linked_review_id.trim()
      ? request.linked_review_id.trim()
      : null
  const linkedBacktest =
    (latestActionableMatched ? lookup.latestActionableChangeRequestBacktestRecord : null) ??
    (latestMatched ? lookup.latestChangeRequestBacktestRecord : null) ??
    (linkedBacktestId ? lookup.backtestById.get(linkedBacktestId) ?? null : null)
  const linkedReview =
    (latestActionableMatched ? lookup.latestActionableChangeRequestReviewRecord : null) ??
    (latestMatched ? lookup.latestChangeRequestReviewRecord : null) ??
    (linkedReviewId ? lookup.reviewById.get(linkedReviewId) ?? null : null)
  const linkedJob =
    (latestActionableMatched ? lookup.latestActionableChangeRequestJobRecord : null) ??
    (latestMatched ? lookup.latestChangeRequestJobRecord : null) ??
    (request.follow_up_job_id ? lookup.schedulerJobById.get(request.follow_up_job_id) ?? null : null)
  const sourceBacktestId = getChangeRequestSourceBacktestId(request)
  const sourceReviewId = getChangeRequestSourceReviewId(request)
  const sourceProposalId = getChangeRequestSourceProposalId(request)
  const sourceBacktest =
    (latestActionableMatched ? lookup.latestActionableChangeRequestSourceBacktestRecord : null) ??
    (latestMatched ? lookup.latestChangeRequestSourceBacktestRecord : null) ??
    (sourceBacktestId ? lookup.backtestById.get(sourceBacktestId) ?? null : null)
  const sourceReview =
    (latestActionableMatched ? lookup.latestActionableChangeRequestSourceReviewRecord : null) ??
    (latestMatched ? lookup.latestChangeRequestSourceReviewRecord : null) ??
    (sourceReviewId ? lookup.reviewById.get(sourceReviewId) ?? null : null)
  const sourceProposal =
    (latestActionableMatched ? lookup.latestActionableChangeRequestSourceProposalRecord : null) ??
    (latestMatched ? lookup.latestChangeRequestSourceProposalRecord : null) ??
    (sourceProposalId ? lookup.proposalById.get(sourceProposalId) ?? null : null)
  return {
    linkedBacktest,
    linkedReview,
    linkedJob,
    sourceBacktest,
    sourceReview,
    sourceProposal,
  }
}

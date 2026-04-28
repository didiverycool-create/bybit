import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyProposal,
  StrategySummary,
} from '../types'
import { getAgentJobBacktestId, getReviewFocusStrategyId, isStrategyTrackingReview } from '../utils/app-helpers'
import type { StrategyActivitySnapshotViewModel } from './strategyActivitySelectors'

export type UseStrategyActivityProgressModelArgs = {
  strategyActivitySnapshotModel: StrategyActivitySnapshotViewModel
  selectedStrategy: StrategySummary | null
  selectedStrategyChangeRequest: ChangeRequest | null
  selectedStrategyProposal: StrategyProposal | null
  selectedBacktest: BacktestRun | null
  focusedPrimaryReviewId: string | null
  focusedTrackingReviewId: string | null
  aiSchedulerFocusedJobId: string | null
  reviewCatalog: ReviewDocument[]
  backtests: BacktestRun[]
  backtestReviewJobs: AgentJob[]
  strategyActivityReviewRecords: ReviewDocument[]
  strategyActivityJobRecords: AgentJob[]
  schedulerJobs: AgentJob[]
  proposalCatalog: StrategyProposal[]
  strategyProposals: StrategyProposal[]
}

export type StrategyActivityChangeRequestLinkedState = {
  linkedBacktest: BacktestRun | null
  linkedReview: ReviewDocument | null
  linkedJob: AgentJob | null
  sourceBacktest: BacktestRun | null
  sourceReview: ReviewDocument | null
  sourceProposal: StrategyProposal | null
}

export function createStrategyActivityProgressLookupContext({
  strategyActivitySnapshotModel,
  selectedStrategy,
  reviewCatalog,
  backtests,
  backtestReviewJobs,
  strategyActivityReviewRecords,
  strategyActivityJobRecords,
  schedulerJobs,
  proposalCatalog,
  strategyProposals,
}: UseStrategyActivityProgressModelArgs) {
  const activityStrategyId = strategyActivitySnapshotModel.strategyId ?? selectedStrategy?.id ?? null
  const {
    proposalSources,
    changeRequestSources,
    backtestSources,
    reviewSources,
    trackingSources,
    collections: strategyActivityCollections,
  } = strategyActivitySnapshotModel
  const backtestById = new Map(backtests.map((item) => [item.id, item] satisfies [string, BacktestRun]))
  const reviewById = new Map(reviewCatalog.map((item) => [item.id, item] satisfies [string, ReviewDocument]))
  const activityReviewById = new Map(
    strategyActivityReviewRecords.map((item) => [item.id, item] satisfies [string, ReviewDocument]),
  )
  const schedulerJobById = new Map(schedulerJobs.map((item) => [item.id, item] satisfies [string, AgentJob]))
  const activityJobById = new Map(
    strategyActivityJobRecords.map((item) => [item.id, item] satisfies [string, AgentJob]),
  )
  const proposalById = new Map(
    [...proposalCatalog, ...strategyProposals].map(
      (item) => [item.id, item] satisfies [string, StrategyProposal],
    ),
  )
  const recentProposalIds = new Set(strategyActivityCollections.recentProposals.map((proposal) => proposal.id))
  const recentChangeRequestIds = new Set(
    strategyActivityCollections.recentChangeRequests.map((request) => request.id),
  )
  const recentBacktestIds = new Set(strategyActivityCollections.recentBacktests.map((backtest) => backtest.id))
  const recentPrimaryReviewIds = new Set(
    strategyActivityCollections.recentReviews
      .filter((review) => !isStrategyTrackingReview(review.period))
      .map((review) => review.id),
  )
  const recentTrackingReviewIds = new Set(
    strategyActivityCollections.recentReviews
      .filter((review) => isStrategyTrackingReview(review.period))
      .map((review) => review.id),
  )
  const recentAgentJobIds = new Set(strategyActivityCollections.recentAgentJobs.map((job) => job.id))
  const latestBacktestReviewById = new Map<string, ReviewDocument>()
  for (const review of reviewCatalog) {
    if (!review.backtest_id) {
      continue
    }
    if (getReviewFocusStrategyId(review, activityStrategyId) !== activityStrategyId) {
      continue
    }
    const existing = latestBacktestReviewById.get(review.backtest_id)
    if (
      !existing ||
      new Date(review.created_at).getTime() > new Date(existing.created_at).getTime()
    ) {
      latestBacktestReviewById.set(review.backtest_id, review)
    }
  }
  const backtestReviewJobByBacktestId = new Map<string, AgentJob>()
  for (const job of backtestReviewJobs) {
    const backtestId = getAgentJobBacktestId(job)
    if (!backtestId || backtestReviewJobByBacktestId.has(backtestId)) {
      continue
    }
    backtestReviewJobByBacktestId.set(backtestId, job)
  }

  const resolveReviewRecord = (review?: ReviewDocument | null) =>
    review ? activityReviewById.get(review.id) ?? reviewById.get(review.id) ?? null : null
  const resolveJobRecord = (job?: AgentJob | null) =>
    job ? activityJobById.get(job.id) ?? schedulerJobById.get(job.id) ?? null : null
  const findLatestBacktestReview = (backtestId: string) => latestBacktestReviewById.get(backtestId) ?? null

  return {
    activityStrategyId,
    proposalSources,
    changeRequestSources,
    backtestSources,
    reviewSources,
    trackingSources,
    strategyActivityCollections,
    backtestById,
    reviewById,
    schedulerJobById,
    proposalById,
    recentProposalIds,
    recentChangeRequestIds,
    recentBacktestIds,
    recentPrimaryReviewIds,
    recentTrackingReviewIds,
    recentAgentJobIds,
    backtestReviewJobByBacktestId,
    resolveReviewRecord,
    resolveJobRecord,
    findLatestBacktestReview,
  }
}

export type StrategyActivityProgressLookupContext = ReturnType<
  typeof createStrategyActivityProgressLookupContext
>

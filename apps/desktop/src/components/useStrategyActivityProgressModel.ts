import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyActivityBacktestSummary,
  StrategyActivitySnapshot,
  StrategyProposal,
  StrategySummary,
} from '../types'
import {
  backtestDecisionReadinessMeta,
  backtestLineageMeta,
  backtestReviewJobMeta,
  backtestWindowMeta,
  getAgentJobBacktestId,
  getAgentJobChangeRequestId,
  getAgentJobLinkedReviewId,
  getAgentJobSourceBacktestId,
  getAgentJobSourceChangeRequestId,
  getAgentJobSourceProposalId,
  getAgentJobSourceReviewId,
  getAgentJobStrategyId,
  getChangeRequestLinkedBacktestId,
  getChangeRequestLinkedBacktestRecommendation,
  getChangeRequestSourceBacktestId,
  getChangeRequestSourceProposalId,
  getChangeRequestSourceReviewId,
  getChangeRequestStrategyId,
  getReviewFocusStrategyId,
  isStrategyTrackingReview,
  prependUniqueActivityItem,
  strategyActivityLatestChangeRequestSummary,
  strategyAgentJobSummary,
} from '../utils/app-helpers'

type UseStrategyActivityProgressModelArgs = {
  selectedStrategyActivity?: StrategyActivitySnapshot | null
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

export function useStrategyActivityProgressModel({
  selectedStrategyActivity,
  selectedStrategy,
  selectedStrategyChangeRequest,
  selectedStrategyProposal,
  selectedBacktest,
  focusedPrimaryReviewId,
  focusedTrackingReviewId,
  aiSchedulerFocusedJobId,
  reviewCatalog,
  backtests,
  backtestReviewJobs,
  strategyActivityReviewRecords,
  strategyActivityJobRecords,
  schedulerJobs,
  proposalCatalog,
  strategyProposals,
}: UseStrategyActivityProgressModelArgs) {
  const activityStrategyId = selectedStrategyActivity?.strategy_id ?? selectedStrategy?.id ?? null
  const backtestById = new Map(backtests.map((item) => [item.id, item]))
  const reviewById = new Map(reviewCatalog.map((item) => [item.id, item]))
  const activityReviewById = new Map(strategyActivityReviewRecords.map((item) => [item.id, item]))
  const schedulerJobById = new Map(schedulerJobs.map((item) => [item.id, item]))
  const activityJobById = new Map(strategyActivityJobRecords.map((item) => [item.id, item]))
  const proposalById = new Map(
    [...proposalCatalog, ...strategyProposals].map((item) => [item.id, item] satisfies [string, StrategyProposal]),
  )

  const resolveReviewRecord = (review?: ReviewDocument | null) =>
    review ? activityReviewById.get(review.id) ?? reviewById.get(review.id) ?? null : null
  const resolveJobRecord = (job?: AgentJob | null) =>
    job ? activityJobById.get(job.id) ?? schedulerJobById.get(job.id) ?? null : null
  const findLatestBacktestReview = (backtestId: string) =>
    reviewCatalog
      .filter(
        (review) =>
          review.backtest_id === backtestId &&
          getReviewFocusStrategyId(review, activityStrategyId) === activityStrategyId,
      )
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0] ?? null

  const strategyActivityChangeRequests = (() => {
    let activityRequests = selectedStrategyActivity?.recent_change_requests ?? []
    const latestRequest = selectedStrategyActivity?.latest_change_request ?? null
    const latestActionableRequest = selectedStrategyActivity?.latest_actionable_change_request ?? null
    if (
      latestRequest &&
      activityStrategyId &&
      getChangeRequestStrategyId(latestRequest, activityStrategyId) === activityStrategyId
    ) {
      activityRequests = prependUniqueActivityItem(activityRequests, latestRequest, (request) => request.id, 8)
    }
    if (
      latestActionableRequest &&
      activityStrategyId &&
      getChangeRequestStrategyId(latestActionableRequest, activityStrategyId) === activityStrategyId
    ) {
      activityRequests = prependUniqueActivityItem(activityRequests, latestActionableRequest, (request) => request.id, 8)
    }
    if (!selectedStrategyChangeRequest) {
      return activityRequests
    }
    const selectedRequestStrategyId = getChangeRequestStrategyId(
      selectedStrategyChangeRequest,
      selectedStrategy?.id ?? null,
    )
    if (!activityStrategyId || !selectedRequestStrategyId || activityStrategyId !== selectedRequestStrategyId) {
      return activityRequests
    }
    return prependUniqueActivityItem(activityRequests, selectedStrategyChangeRequest, (request) => request.id, 8)
  })()

  const activityLatestChangeRequest =
    strategyActivityChangeRequests[0] ?? selectedStrategyActivity?.latest_change_request ?? null
  const activityLatestChangeRequestSummary = strategyActivityLatestChangeRequestSummary(activityLatestChangeRequest)
  const activityLatestChangeRequestStrategyId = activityLatestChangeRequest
    ? getChangeRequestStrategyId(activityLatestChangeRequest, selectedStrategyActivity?.strategy_id ?? null)
    : null

  const getStrategyActivityChangeRequestLinkedState = (request?: ChangeRequest | null) => {
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
    const latestMatched = selectedStrategyActivity?.latest_change_request?.id === request.id
    const latestActionableMatched = selectedStrategyActivity?.latest_actionable_change_request?.id === request.id
    const linkedBacktestId = getChangeRequestLinkedBacktestId(request)
    const linkedReviewId =
      typeof request.linked_review_id === 'string' && request.linked_review_id.trim()
        ? request.linked_review_id.trim()
        : null
    const linkedBacktest =
      (latestActionableMatched
        ? selectedStrategyActivity?.latest_actionable_change_request_backtest_record ?? null
        : null) ??
      (latestMatched ? selectedStrategyActivity?.latest_change_request_backtest_record ?? null : null) ??
      (linkedBacktestId ? backtestById.get(linkedBacktestId) ?? null : null)
    const linkedReview =
      (latestActionableMatched
        ? selectedStrategyActivity?.latest_actionable_change_request_review_record ?? null
        : null) ??
      (latestMatched ? selectedStrategyActivity?.latest_change_request_review_record ?? null : null) ??
      (linkedReviewId ? reviewById.get(linkedReviewId) ?? null : null)
    const linkedJob =
      (latestActionableMatched ? selectedStrategyActivity?.latest_actionable_change_request_job_record ?? null : null) ??
      (latestMatched ? selectedStrategyActivity?.latest_change_request_job_record ?? null : null) ??
      (request.follow_up_job_id ? schedulerJobById.get(request.follow_up_job_id) ?? null : null)
    const sourceBacktestId = getChangeRequestSourceBacktestId(request)
    const sourceReviewId = getChangeRequestSourceReviewId(request)
    const sourceProposalId = getChangeRequestSourceProposalId(request)
    const sourceBacktest =
      (latestActionableMatched
        ? selectedStrategyActivity?.latest_actionable_change_request_source_backtest_record ?? null
        : null) ??
      (latestMatched ? selectedStrategyActivity?.latest_change_request_source_backtest_record ?? null : null) ??
      (sourceBacktestId ? backtestById.get(sourceBacktestId) ?? null : null)
    const sourceReview =
      (latestActionableMatched
        ? selectedStrategyActivity?.latest_actionable_change_request_source_review_record ?? null
        : null) ??
      (latestMatched ? selectedStrategyActivity?.latest_change_request_source_review_record ?? null : null) ??
      (sourceReviewId ? reviewById.get(sourceReviewId) ?? null : null)
    const sourceProposal =
      (latestActionableMatched
        ? selectedStrategyActivity?.latest_actionable_change_request_source_proposal_record ?? null
        : null) ??
      (latestMatched ? selectedStrategyActivity?.latest_change_request_source_proposal_record ?? null : null) ??
      (sourceProposalId ? proposalById.get(sourceProposalId) ?? null : null)
    return {
      linkedBacktest,
      linkedReview,
      linkedJob,
      sourceBacktest,
      sourceReview,
      sourceProposal,
    }
  }

  const activityLatestChangeRequestLinkedState = getStrategyActivityChangeRequestLinkedState(activityLatestChangeRequest)
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

  const activityLatestActionableChangeRequest =
    strategyActivityChangeRequests.find((request) => {
      if (
        request.follow_up_job_id &&
        (request.follow_up_job_status === 'failed' || request.follow_up_job_status === 'cancelled')
      ) {
        return true
      }
      const requestLinkedBacktest = backtestById.get(getChangeRequestLinkedBacktestId(request) ?? '') ?? null
      const rerunRecommendation = getChangeRequestLinkedBacktestRecommendation(request, requestLinkedBacktest)
      return Boolean(rerunRecommendation?.recommendedRange && rerunRecommendation?.recommendedTimeframe)
    }) ??
    selectedStrategyActivity?.latest_actionable_change_request ??
    null

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

  const strategyActivityBacktests = (() => {
    let activityBacktests = selectedStrategyActivity?.recent_backtests ?? []
    const latestBacktest = selectedStrategyActivity?.latest_backtest ?? null
    const latestActionableBacktest = selectedStrategyActivity?.latest_actionable_backtest ?? null
    if (latestBacktest && selectedStrategyActivity) {
      activityBacktests = prependUniqueActivityItem(activityBacktests, latestBacktest, (backtest) => backtest.id, 8)
    }
    if (latestActionableBacktest && selectedStrategyActivity) {
      activityBacktests = prependUniqueActivityItem(
        activityBacktests,
        latestActionableBacktest,
        (backtest) => backtest.id,
        8,
      )
    }
    if (!selectedBacktest || !selectedStrategyActivity) {
      return activityBacktests
    }
    if (selectedBacktest.strategy_id !== selectedStrategyActivity.strategy_id) {
      return activityBacktests
    }
    if (activityBacktests.some((backtest) => backtest.id === selectedBacktest.id)) {
      return activityBacktests
    }
    const focusedBacktest: StrategyActivityBacktestSummary = {
      id: selectedBacktest.id,
      status: selectedBacktest.status,
      timeframe: selectedBacktest.timeframe,
      data_range: selectedBacktest.data_range,
      sample_quality: selectedBacktest.sample_quality,
      history_source: selectedBacktest.history_source ?? 'exchange_history',
      decision_readiness: selectedBacktest.decision_readiness ?? 'ready',
      source_change_request_id: selectedBacktest.source_change_request_id ?? null,
      source_backtest_id: selectedBacktest.source_backtest_id ?? null,
      source_review_id: selectedBacktest.source_review_id ?? null,
      source_proposal_id: selectedBacktest.source_proposal_id ?? null,
      trigger_reason: selectedBacktest.trigger_reason ?? null,
      created_at: selectedBacktest.started_at,
      finished_at: selectedBacktest.finished_at ?? null,
    }
    return prependUniqueActivityItem(activityBacktests, focusedBacktest, (backtest) => backtest.id, 8)
  })()

  const activityLatestBacktest = strategyActivityBacktests[0] ?? selectedStrategyActivity?.latest_backtest ?? null
  const activityLatestBacktestRecord =
    selectedStrategyActivity?.latest_backtest_record ??
    (activityLatestBacktest ? backtestById.get(activityLatestBacktest.id) ?? null : null)
  const activityLatestBacktestDecisionMeta = activityLatestBacktestRecord
    ? backtestDecisionReadinessMeta(activityLatestBacktestRecord)
    : activityLatestBacktest
      ? backtestDecisionReadinessMeta({
          decision_readiness: activityLatestBacktest.decision_readiness ?? null,
        })
      : null
  const activityLatestBacktestWindowMeta = activityLatestBacktestRecord
    ? backtestWindowMeta(activityLatestBacktestRecord)
    : null
  const activityLatestBacktestLineageMeta = activityLatestBacktestRecord
    ? backtestLineageMeta(activityLatestBacktestRecord)
    : backtestLineageMeta(activityLatestBacktest)
  const activityLatestBacktestReview =
    (activityLatestBacktest ? findLatestBacktestReview(activityLatestBacktest.id) : null) ??
    selectedStrategyActivity?.latest_backtest_review ??
    null
  const activityLatestBacktestReviewRecord =
    selectedStrategyActivity?.latest_backtest_review_record ?? resolveReviewRecord(activityLatestBacktestReview)
  const activityLatestBacktestJob =
    (activityLatestBacktest
      ? backtestReviewJobs.find((job) => getAgentJobBacktestId(job) === activityLatestBacktest.id) ?? null
      : null) ??
    selectedStrategyActivity?.latest_backtest_job ??
    null
  const activityLatestBacktestJobRecord =
    selectedStrategyActivity?.latest_backtest_job_record ?? resolveJobRecord(activityLatestBacktestJob)
  const activityLatestBacktestJobMeta = backtestReviewJobMeta(
    activityLatestBacktestJobRecord ?? activityLatestBacktestJob,
    Boolean(activityLatestBacktestReviewRecord ?? activityLatestBacktestReview),
  )
  const activityLatestBacktestStrategyId =
    activityLatestBacktestRecord?.strategy_id ?? selectedStrategyActivity?.strategy_id ?? null
  const activityLatestBacktestSourceChangeRequestId =
    activityLatestBacktestRecord?.source_change_request_id ?? activityLatestBacktest?.source_change_request_id ?? null
  const activityLatestBacktestSourceBacktestId =
    activityLatestBacktestRecord?.source_backtest_id ?? activityLatestBacktest?.source_backtest_id ?? null
  const activityLatestBacktestSourceReviewId =
    activityLatestBacktestRecord?.source_review_id ?? activityLatestBacktest?.source_review_id ?? null
  const activityLatestBacktestSourceProposalId =
    activityLatestBacktestRecord?.source_proposal_id ?? activityLatestBacktest?.source_proposal_id ?? null

  const activityLatestActionableBacktest =
    strategyActivityBacktests.find((backtest) => {
      const linkedBacktest = backtestById.get(backtest.id) ?? null
      const decisionMeta = linkedBacktest ? backtestDecisionReadinessMeta(linkedBacktest) : null
      const linkedReview = findLatestBacktestReview(backtest.id)
      const linkedJob = backtestReviewJobs.find((job) => getAgentJobBacktestId(job) === backtest.id) ?? null
      const linkedJobMeta = backtestReviewJobMeta(linkedJob, Boolean(linkedReview))
      return Boolean(
        (decisionMeta?.recommendedRange && decisionMeta?.recommendedTimeframe) || linkedJobMeta?.canRetry,
      )
    }) ??
    selectedStrategyActivity?.latest_actionable_backtest ??
    null
  const activityLatestActionableBacktestRecord =
    selectedStrategyActivity?.latest_actionable_backtest_record ??
    (activityLatestActionableBacktest ? backtestById.get(activityLatestActionableBacktest.id) ?? null : null)
  const activityLatestActionableBacktestDecisionMeta = activityLatestActionableBacktestRecord
    ? backtestDecisionReadinessMeta(activityLatestActionableBacktestRecord)
    : null
  const activityLatestActionableBacktestReview =
    selectedStrategyActivity?.latest_actionable_backtest_review ??
    (activityLatestActionableBacktest ? findLatestBacktestReview(activityLatestActionableBacktest.id) : null) ??
    null
  const activityLatestActionableBacktestReviewRecord =
    selectedStrategyActivity?.latest_actionable_backtest_review_record ??
    resolveReviewRecord(activityLatestActionableBacktestReview)
  const activityLatestActionableBacktestJob =
    selectedStrategyActivity?.latest_actionable_backtest_job ??
    (activityLatestActionableBacktest
      ? backtestReviewJobs.find((job) => getAgentJobBacktestId(job) === activityLatestActionableBacktest.id) ?? null
      : null) ??
    null
  const activityLatestActionableBacktestJobRecord =
    selectedStrategyActivity?.latest_actionable_backtest_job_record ??
    resolveJobRecord(activityLatestActionableBacktestJob)
  const activityLatestActionableBacktestJobMeta = backtestReviewJobMeta(
    activityLatestActionableBacktestJobRecord ?? activityLatestActionableBacktestJob,
    Boolean(activityLatestActionableBacktestReviewRecord ?? activityLatestActionableBacktestReview),
  )
  const activityLatestActionableBacktestSummary = activityLatestActionableBacktest
    ? `${activityLatestActionableBacktest.id} · ${activityLatestActionableBacktest.timeframe} · ${activityLatestActionableBacktest.data_range} · ${activityLatestActionableBacktest.status}`
    : null
  const activityLatestActionableBacktestDiffersFromLatest = Boolean(
    activityLatestActionableBacktest && activityLatestActionableBacktest.id !== activityLatestBacktest?.id,
  )

  const activityLatestPrimaryReview = selectedStrategyActivity?.latest_primary_review ?? null
  const activityLatestPrimaryReviewRecord =
    selectedStrategyActivity?.latest_primary_review_record ?? resolveReviewRecord(activityLatestPrimaryReview)
  const activityLatestPrimaryReviewStrategyId = getReviewFocusStrategyId(
    activityLatestPrimaryReviewRecord,
    selectedStrategyActivity?.strategy_id ?? null,
  )
  const activityLatestActionablePrimaryReview = selectedStrategyActivity?.latest_actionable_primary_review ?? null
  const activityLatestActionablePrimaryReviewRecord =
    selectedStrategyActivity?.latest_actionable_primary_review_record ??
    resolveReviewRecord(activityLatestActionablePrimaryReview)
  const activityLatestActionablePrimaryReviewStrategyId = getReviewFocusStrategyId(
    activityLatestActionablePrimaryReviewRecord,
    selectedStrategyActivity?.strategy_id ?? null,
  )
  const activityLatestActionablePrimaryReviewDecisionMeta =
    (activityLatestActionablePrimaryReviewRecord ?? activityLatestActionablePrimaryReview)?.period === 'backtest'
      ? backtestDecisionReadinessMeta(
          activityLatestActionablePrimaryReviewRecord ?? activityLatestActionablePrimaryReview,
        )
      : null
  const activityLatestActionablePrimaryReviewSummary = activityLatestActionablePrimaryReview
    ? `${activityLatestActionablePrimaryReview.title} · ${activityLatestActionablePrimaryReview.summary}`
    : null
  const activityLatestActionablePrimaryReviewDiffersFromLatest = Boolean(
    activityLatestActionablePrimaryReview && activityLatestActionablePrimaryReview.id !== activityLatestPrimaryReview?.id,
  )

  const activityLatestTrackingReview = selectedStrategyActivity?.latest_tracking_review ?? null
  const activityLatestTrackingReviewRecord =
    selectedStrategyActivity?.latest_tracking_review_record ?? resolveReviewRecord(activityLatestTrackingReview)
  const activityLatestTrackingReviewStrategyId = getReviewFocusStrategyId(
    activityLatestTrackingReviewRecord,
    selectedStrategyActivity?.strategy_id ?? null,
  )
  const activityLatestTrackingJob = selectedStrategyActivity?.latest_tracking_job ?? null
  const activityLatestTrackingJobRecord =
    selectedStrategyActivity?.latest_tracking_job_record ?? resolveJobRecord(activityLatestTrackingJob)
  const activityLatestTrackingJobStrategyId =
    (activityLatestTrackingJobRecord
      ? getAgentJobStrategyId(activityLatestTrackingJobRecord)
      : activityLatestTrackingJob
        ? getAgentJobStrategyId(activityLatestTrackingJob)
        : null) ??
    selectedStrategyActivity?.strategy_id ??
    null
  const activityLatestTrackingJobLinkedReviewId = activityLatestTrackingJobRecord
    ? getAgentJobLinkedReviewId(activityLatestTrackingJobRecord)
    : activityLatestTrackingJob
      ? getAgentJobLinkedReviewId(activityLatestTrackingJob)
      : null
  const activityLatestTrackingJobChangeRequestId = activityLatestTrackingJobRecord
    ? getAgentJobChangeRequestId(activityLatestTrackingJobRecord)
    : activityLatestTrackingJob
      ? getAgentJobChangeRequestId(activityLatestTrackingJob)
      : null
  const activityLatestTrackingJobBacktestId = activityLatestTrackingJobRecord
    ? getAgentJobBacktestId(activityLatestTrackingJobRecord)
    : activityLatestTrackingJob
      ? getAgentJobBacktestId(activityLatestTrackingJob)
      : null
  const activityLatestTrackingJobSourceChangeRequestId = activityLatestTrackingJobRecord
    ? getAgentJobSourceChangeRequestId(activityLatestTrackingJobRecord)
    : activityLatestTrackingJob
      ? getAgentJobSourceChangeRequestId(activityLatestTrackingJob)
      : null
  const activityLatestTrackingJobSourceBacktestId = activityLatestTrackingJobRecord
    ? getAgentJobSourceBacktestId(activityLatestTrackingJobRecord)
    : activityLatestTrackingJob
      ? getAgentJobSourceBacktestId(activityLatestTrackingJob)
      : null
  const activityLatestTrackingJobSourceReviewId = activityLatestTrackingJobRecord
    ? getAgentJobSourceReviewId(activityLatestTrackingJobRecord)
    : activityLatestTrackingJob
      ? getAgentJobSourceReviewId(activityLatestTrackingJob)
      : null
  const activityLatestTrackingJobSourceProposalId = activityLatestTrackingJobRecord
    ? getAgentJobSourceProposalId(activityLatestTrackingJobRecord)
    : activityLatestTrackingJob
      ? getAgentJobSourceProposalId(activityLatestTrackingJob)
      : null
  const activityLatestRetryableTrackingJob = selectedStrategyActivity?.latest_retryable_tracking_job ?? null
  const activityLatestRetryableTrackingJobRecord =
    selectedStrategyActivity?.latest_retryable_tracking_job_record ??
    resolveJobRecord(activityLatestRetryableTrackingJob)
  const activityLatestRetryableTrackingJobSummary = activityLatestRetryableTrackingJob
    ? strategyAgentJobSummary(activityLatestRetryableTrackingJobRecord ?? activityLatestRetryableTrackingJob)
    : null
  const activityLatestRetryableTrackingJobDiffersFromLatest = Boolean(
    activityLatestRetryableTrackingJob && activityLatestRetryableTrackingJob.id !== activityLatestTrackingJob?.id,
  )

  const strategyActivityLatestProposalSupplemented = Boolean(
    selectedStrategyActivity?.latest_proposal &&
      !(selectedStrategyActivity?.recent_proposals ?? []).some(
        (proposal) => proposal.id === selectedStrategyActivity.latest_proposal?.id,
      ) &&
      selectedStrategyActivity.latest_proposal.id !== selectedStrategyProposal?.id,
  )
  const strategyActivityLatestActionableProposalSupplemented = Boolean(
    selectedStrategyActivity?.latest_actionable_proposal &&
      !(selectedStrategyActivity?.recent_proposals ?? []).some(
        (proposal) => proposal.id === selectedStrategyActivity.latest_actionable_proposal?.id,
      ) &&
      selectedStrategyActivity.latest_actionable_proposal.id !== selectedStrategyProposal?.id,
  )
  const strategyActivityLatestChangeRequestSupplemented = Boolean(
    selectedStrategyActivity?.latest_change_request &&
      !(selectedStrategyActivity?.recent_change_requests ?? []).some(
        (request) => request.id === selectedStrategyActivity.latest_change_request?.id,
      ) &&
      selectedStrategyActivity.latest_change_request.id !== selectedStrategyChangeRequest?.id,
  )
  const strategyActivityLatestActionableChangeRequestSupplemented = Boolean(
    selectedStrategyActivity?.latest_actionable_change_request &&
      !(selectedStrategyActivity?.recent_change_requests ?? []).some(
        (request) => request.id === selectedStrategyActivity.latest_actionable_change_request?.id,
      ) &&
      selectedStrategyActivity.latest_actionable_change_request.id !== selectedStrategyChangeRequest?.id,
  )
  const strategyActivityLatestBacktestSupplemented = Boolean(
    selectedStrategyActivity?.latest_backtest &&
      !(selectedStrategyActivity?.recent_backtests ?? []).some(
        (backtest) => backtest.id === selectedStrategyActivity.latest_backtest?.id,
      ) &&
      selectedStrategyActivity.latest_backtest.id !== selectedBacktest?.id,
  )
  const strategyActivityLatestActionableBacktestSupplemented = Boolean(
    selectedStrategyActivity?.latest_actionable_backtest &&
      !(selectedStrategyActivity?.recent_backtests ?? []).some(
        (backtest) => backtest.id === selectedStrategyActivity.latest_actionable_backtest?.id,
      ) &&
      selectedStrategyActivity.latest_actionable_backtest.id !== selectedBacktest?.id,
  )
  const strategyActivityLatestActionableBacktestReviewSupplemented = Boolean(
    selectedStrategyActivity?.latest_actionable_backtest_review &&
      !(selectedStrategyActivity?.recent_reviews ?? [])
        .filter((review) => !isStrategyTrackingReview(review.period))
        .some((review) => review.id === selectedStrategyActivity.latest_actionable_backtest_review?.id) &&
      selectedStrategyActivity.latest_actionable_backtest_review.id !== focusedPrimaryReviewId,
  )
  const strategyActivityLatestTrackingReviewSupplemented = Boolean(
    selectedStrategyActivity?.latest_tracking_review &&
      !(selectedStrategyActivity?.recent_reviews ?? [])
        .filter((review) => isStrategyTrackingReview(review.period))
        .some((review) => review.id === selectedStrategyActivity.latest_tracking_review?.id) &&
      selectedStrategyActivity.latest_tracking_review.id !== focusedTrackingReviewId,
  )
  const strategyActivityLatestPrimaryReviewSupplemented = Boolean(
    selectedStrategyActivity?.latest_primary_review &&
      !(selectedStrategyActivity?.recent_reviews ?? [])
        .filter((review) => !isStrategyTrackingReview(review.period))
        .some((review) => review.id === selectedStrategyActivity.latest_primary_review?.id) &&
      selectedStrategyActivity.latest_primary_review.id !== focusedPrimaryReviewId,
  )
  const strategyActivityLatestActionablePrimaryReviewSupplemented = Boolean(
    selectedStrategyActivity?.latest_actionable_primary_review &&
      !(selectedStrategyActivity?.recent_reviews ?? [])
        .filter((review) => !isStrategyTrackingReview(review.period))
        .some((review) => review.id === selectedStrategyActivity.latest_actionable_primary_review?.id) &&
      selectedStrategyActivity.latest_actionable_primary_review.id !== focusedPrimaryReviewId,
  )
  const strategyActivityLatestTrackingJobSupplemented = Boolean(
    selectedStrategyActivity?.latest_tracking_job &&
      !(selectedStrategyActivity?.recent_agent_jobs ?? []).some(
        (job) => job.id === selectedStrategyActivity.latest_tracking_job?.id,
      ) &&
      selectedStrategyActivity.latest_tracking_job.id !== aiSchedulerFocusedJobId,
  )
  const strategyActivityLatestRetryableTrackingJobSupplemented = Boolean(
    selectedStrategyActivity?.latest_retryable_tracking_job &&
      !(selectedStrategyActivity?.recent_agent_jobs ?? []).some(
        (job) => job.id === selectedStrategyActivity.latest_retryable_tracking_job?.id,
      ) &&
      selectedStrategyActivity.latest_retryable_tracking_job.id !== aiSchedulerFocusedJobId,
  )
  const strategyActivityLatestActionableBacktestJobSupplemented = Boolean(
    selectedStrategyActivity?.latest_actionable_backtest_job &&
      !(selectedStrategyActivity?.recent_agent_jobs ?? []).some(
        (job) => job.id === selectedStrategyActivity.latest_actionable_backtest_job?.id,
      ) &&
      selectedStrategyActivity.latest_actionable_backtest_job.id !== aiSchedulerFocusedJobId,
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
    strategyActivityBacktests,
    activityLatestBacktest,
    activityLatestBacktestRecord,
    activityLatestBacktestDecisionMeta,
    activityLatestBacktestWindowMeta,
    activityLatestBacktestLineageMeta,
    activityLatestBacktestReview,
    activityLatestBacktestReviewRecord,
    activityLatestBacktestJob,
    activityLatestBacktestJobRecord,
    activityLatestBacktestJobMeta,
    activityLatestBacktestStrategyId,
    activityLatestBacktestSourceChangeRequestId,
    activityLatestBacktestSourceBacktestId,
    activityLatestBacktestSourceReviewId,
    activityLatestBacktestSourceProposalId,
    activityLatestActionableBacktest,
    activityLatestActionableBacktestRecord,
    activityLatestActionableBacktestDecisionMeta,
    activityLatestActionableBacktestReview,
    activityLatestActionableBacktestReviewRecord,
    activityLatestActionableBacktestJob,
    activityLatestActionableBacktestJobRecord,
    activityLatestActionableBacktestJobMeta,
    activityLatestActionableBacktestSummary,
    activityLatestActionableBacktestDiffersFromLatest,
    activityLatestPrimaryReview,
    activityLatestPrimaryReviewRecord,
    activityLatestPrimaryReviewStrategyId,
    activityLatestActionablePrimaryReview,
    activityLatestActionablePrimaryReviewRecord,
    activityLatestActionablePrimaryReviewStrategyId,
    activityLatestActionablePrimaryReviewDecisionMeta,
    activityLatestActionablePrimaryReviewSummary,
    activityLatestActionablePrimaryReviewDiffersFromLatest,
    activityLatestTrackingReview,
    activityLatestTrackingReviewRecord,
    activityLatestTrackingReviewStrategyId,
    activityLatestTrackingJob,
    activityLatestTrackingJobRecord,
    activityLatestTrackingJobStrategyId,
    activityLatestTrackingJobLinkedReviewId,
    activityLatestTrackingJobChangeRequestId,
    activityLatestTrackingJobBacktestId,
    activityLatestTrackingJobSourceChangeRequestId,
    activityLatestTrackingJobSourceBacktestId,
    activityLatestTrackingJobSourceReviewId,
    activityLatestTrackingJobSourceProposalId,
    activityLatestRetryableTrackingJob,
    activityLatestRetryableTrackingJobRecord,
    activityLatestRetryableTrackingJobSummary,
    activityLatestRetryableTrackingJobDiffersFromLatest,
    strategyActivityLatestProposalSupplemented,
    strategyActivityLatestActionableProposalSupplemented,
    strategyActivityLatestChangeRequestSupplemented,
    strategyActivityLatestActionableChangeRequestSupplemented,
    strategyActivityLatestBacktestSupplemented,
    strategyActivityLatestActionableBacktestSupplemented,
    strategyActivityLatestActionableBacktestReviewSupplemented,
    strategyActivityLatestTrackingReviewSupplemented,
    strategyActivityLatestPrimaryReviewSupplemented,
    strategyActivityLatestActionablePrimaryReviewSupplemented,
    strategyActivityLatestTrackingJobSupplemented,
    strategyActivityLatestRetryableTrackingJobSupplemented,
    strategyActivityLatestActionableBacktestJobSupplemented,
  }
}

import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  SchedulerState,
  StrategyActivitySnapshot,
  StrategyProposal,
  StrategySummary,
} from '../types'
import {
  getAgentJobStrategyId,
  getReviewFocusStrategyId,
  isStrategyTrackingReview,
  prependUniqueActivityItem,
  proposalAcceptBlockedReason,
  proposalManualFollowupMeta,
  strategyActivityLatestProposalSummary,
} from '../utils/app-helpers'

type UseStrategyActivityDecisionModelArgs = {
  selectedStrategyActivity?: StrategyActivitySnapshot | null
  selectedStrategy: StrategySummary | null
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  selectedBacktestId: string | null
  reviewInspectorReviewId: string | null
  replayFocusedReviewId: string | null
  aiSchedulerFocusedJobId: string | null
  schedulerJobs: AgentJob[]
  reviewCatalog: ReviewDocument[]
  strategyProposals: StrategyProposal[]
  proposalBacktestMap: Map<string, BacktestRun>
  proposalReviewMap: Map<string, ReviewDocument>
  proposalChangeRequestMap: Map<string, ChangeRequest>
  proposalAgentJobMap: Map<string, AgentJob>
  schedulerState?: SchedulerState | null
}

export function useStrategyActivityDecisionModel({
  selectedStrategyActivity,
  selectedStrategy,
  selectedProposalId,
  selectedChangeRequestId,
  selectedBacktestId,
  reviewInspectorReviewId,
  replayFocusedReviewId,
  aiSchedulerFocusedJobId,
  schedulerJobs,
  reviewCatalog,
  strategyProposals,
  proposalBacktestMap,
  proposalReviewMap,
  proposalChangeRequestMap,
  proposalAgentJobMap,
  schedulerState,
}: UseStrategyActivityDecisionModelArgs) {
  const focusedReplayReview =
    replayFocusedReviewId != null
      ? reviewCatalog.find((review) => review.id === replayFocusedReviewId) ?? null
      : null
  const focusedTrackingReviewId =
    focusedReplayReview && isStrategyTrackingReview(focusedReplayReview.period) ? focusedReplayReview.id : null
  const focusedPrimaryReviewId =
    focusedReplayReview && !isStrategyTrackingReview(focusedReplayReview.period) ? focusedReplayReview.id : null

  const strategyActivityTrackingReviews = (() => {
    let activityReviews = (selectedStrategyActivity?.recent_reviews ?? []).filter((review) =>
      isStrategyTrackingReview(review.period),
    )
    const latestTrackingReview = selectedStrategyActivity?.latest_tracking_review ?? null
    if (
      latestTrackingReview &&
      selectedStrategyActivity &&
      isStrategyTrackingReview(latestTrackingReview.period) &&
      getReviewFocusStrategyId(latestTrackingReview, selectedStrategyActivity.strategy_id) ===
        selectedStrategyActivity.strategy_id
    ) {
      activityReviews = prependUniqueActivityItem(activityReviews, latestTrackingReview, (review) => review.id, 8)
    }
    if (!focusedReplayReview || !selectedStrategyActivity || !isStrategyTrackingReview(focusedReplayReview.period)) {
      return activityReviews
    }
    const focusedStrategyId = getReviewFocusStrategyId(focusedReplayReview, selectedStrategy?.id ?? null)
    if (!focusedStrategyId || focusedStrategyId !== selectedStrategyActivity.strategy_id) {
      return activityReviews
    }
    return prependUniqueActivityItem(activityReviews, focusedReplayReview, (review) => review.id, 8)
  })()

  const strategyActivityPrimaryReviews = (() => {
    let activityReviews = (selectedStrategyActivity?.recent_reviews ?? []).filter(
      (review) => !isStrategyTrackingReview(review.period),
    )
    const latestPrimaryReview = selectedStrategyActivity?.latest_primary_review ?? null
    const latestActionableBacktestReview = selectedStrategyActivity?.latest_actionable_backtest_review ?? null
    const latestActionablePrimaryReview = selectedStrategyActivity?.latest_actionable_primary_review ?? null
    if (
      latestPrimaryReview &&
      selectedStrategyActivity &&
      !isStrategyTrackingReview(latestPrimaryReview.period) &&
      getReviewFocusStrategyId(latestPrimaryReview, selectedStrategyActivity.strategy_id) ===
        selectedStrategyActivity.strategy_id
    ) {
      activityReviews = prependUniqueActivityItem(activityReviews, latestPrimaryReview, (review) => review.id, 8)
    }
    if (
      latestActionableBacktestReview &&
      selectedStrategyActivity &&
      !isStrategyTrackingReview(latestActionableBacktestReview.period) &&
      getReviewFocusStrategyId(latestActionableBacktestReview, selectedStrategyActivity.strategy_id) ===
        selectedStrategyActivity.strategy_id
    ) {
      activityReviews = prependUniqueActivityItem(
        activityReviews,
        latestActionableBacktestReview,
        (review) => review.id,
        8,
      )
    }
    if (
      latestActionablePrimaryReview &&
      selectedStrategyActivity &&
      !isStrategyTrackingReview(latestActionablePrimaryReview.period) &&
      getReviewFocusStrategyId(latestActionablePrimaryReview, selectedStrategyActivity.strategy_id) ===
        selectedStrategyActivity.strategy_id
    ) {
      activityReviews = prependUniqueActivityItem(
        activityReviews,
        latestActionablePrimaryReview,
        (review) => review.id,
        8,
      )
    }
    if (!focusedReplayReview || !selectedStrategyActivity || isStrategyTrackingReview(focusedReplayReview.period)) {
      return activityReviews
    }
    const focusedStrategyId = getReviewFocusStrategyId(focusedReplayReview, selectedStrategy?.id ?? null)
    if (!focusedStrategyId || focusedStrategyId !== selectedStrategyActivity.strategy_id) {
      return activityReviews
    }
    return prependUniqueActivityItem(activityReviews, focusedReplayReview, (review) => review.id, 8)
  })()

  const strategyActivityAgentJobs = (() => {
    let activityJobs = selectedStrategyActivity?.recent_agent_jobs ?? []
    const latestTrackingJob = selectedStrategyActivity?.latest_tracking_job ?? null
    const latestActionableBacktestJob = selectedStrategyActivity?.latest_actionable_backtest_job ?? null
    const latestRetryableTrackingJob = selectedStrategyActivity?.latest_retryable_tracking_job ?? null
    if (
      latestTrackingJob &&
      selectedStrategyActivity &&
      getAgentJobStrategyId(latestTrackingJob) === selectedStrategyActivity.strategy_id
    ) {
      activityJobs = prependUniqueActivityItem(activityJobs, latestTrackingJob, (job) => job.id, 12)
    }
    if (
      latestActionableBacktestJob &&
      selectedStrategyActivity &&
      getAgentJobStrategyId(latestActionableBacktestJob) === selectedStrategyActivity.strategy_id
    ) {
      activityJobs = prependUniqueActivityItem(activityJobs, latestActionableBacktestJob, (job) => job.id, 12)
    }
    if (
      latestRetryableTrackingJob &&
      selectedStrategyActivity &&
      getAgentJobStrategyId(latestRetryableTrackingJob) === selectedStrategyActivity.strategy_id
    ) {
      activityJobs = prependUniqueActivityItem(activityJobs, latestRetryableTrackingJob, (job) => job.id, 12)
    }
    if (!aiSchedulerFocusedJobId || !selectedStrategyActivity || !schedulerJobs.length) {
      return activityJobs
    }
    const focusedJob = schedulerJobs.find((job) => job.id === aiSchedulerFocusedJobId) ?? null
    if (!focusedJob) {
      return activityJobs
    }
    const focusedStrategyId = getAgentJobStrategyId(focusedJob)
    if (!focusedStrategyId || focusedStrategyId !== selectedStrategyActivity.strategy_id) {
      return activityJobs
    }
    return prependUniqueActivityItem(activityJobs, focusedJob, (job) => job.id, 12)
  })()

  const strategyActivityReviewRecords = (() => {
    const activityRecords = [
      selectedStrategyActivity?.latest_backtest_review_record ?? null,
      selectedStrategyActivity?.latest_actionable_backtest_review_record ?? null,
      selectedStrategyActivity?.latest_primary_review_record ?? null,
      selectedStrategyActivity?.latest_actionable_primary_review_record ?? null,
      selectedStrategyActivity?.latest_tracking_review_record ?? null,
    ].filter((review): review is ReviewDocument => Boolean(review))
    if (!focusedReplayReview || !selectedStrategyActivity) {
      return activityRecords
    }
    const focusedStrategyId = getReviewFocusStrategyId(focusedReplayReview, selectedStrategy?.id ?? null)
    if (!focusedStrategyId || focusedStrategyId !== selectedStrategyActivity.strategy_id) {
      return activityRecords
    }
    return prependUniqueActivityItem(activityRecords, focusedReplayReview, (review) => review.id, 12)
  })()

  const strategyActivityJobRecords = (() => {
    const activityRecords = [
      selectedStrategyActivity?.latest_backtest_job_record ?? null,
      selectedStrategyActivity?.latest_actionable_backtest_job_record ?? null,
      selectedStrategyActivity?.latest_tracking_job_record ?? null,
      selectedStrategyActivity?.latest_retryable_tracking_job_record ?? null,
    ].filter((job): job is AgentJob => Boolean(job))
    if (!aiSchedulerFocusedJobId || !selectedStrategyActivity || !schedulerJobs.length) {
      return activityRecords
    }
    const focusedJob = schedulerJobs.find((job) => job.id === aiSchedulerFocusedJobId) ?? null
    if (!focusedJob || getAgentJobStrategyId(focusedJob) !== selectedStrategyActivity.strategy_id) {
      return activityRecords
    }
    return prependUniqueActivityItem(activityRecords, focusedJob, (job) => job.id, 12)
  })()

  const selectedStrategyProposal = (() => {
    if (selectedProposalId != null) {
      return strategyProposals.find((proposal) => proposal.id === selectedProposalId) ?? null
    }
    if (selectedChangeRequestId != null) {
      return (
        strategyProposals.find(
          (proposal) =>
            (selectedStrategyActivity?.latest_actionable_proposal?.id === proposal.id &&
              (selectedStrategyActivity?.latest_actionable_proposal_change_request?.id ?? null) ===
                selectedChangeRequestId) ||
            (selectedStrategyActivity?.latest_proposal?.id === proposal.id &&
              (selectedStrategyActivity?.latest_proposal_change_request?.id ?? null) === selectedChangeRequestId) ||
            (proposalChangeRequestMap.get(proposal.id) ?? null)?.id === selectedChangeRequestId,
        ) ?? null
      )
    }
    if (selectedBacktestId != null) {
      return (
        strategyProposals.find(
          (proposal) =>
            (selectedStrategyActivity?.latest_actionable_proposal?.id === proposal.id &&
              (selectedStrategyActivity?.latest_actionable_proposal_backtest_record?.id ?? null) ===
                selectedBacktestId) ||
            (selectedStrategyActivity?.latest_proposal?.id === proposal.id &&
              (selectedStrategyActivity?.latest_proposal_backtest_record?.id ?? null) === selectedBacktestId) ||
            (proposalBacktestMap.get(proposal.id) ?? null)?.id === selectedBacktestId,
        ) ?? null
      )
    }
    const focusedReviewId = reviewInspectorReviewId ?? replayFocusedReviewId
    if (focusedReviewId != null) {
      return (
        strategyProposals.find(
          (proposal) =>
            (selectedStrategyActivity?.latest_actionable_proposal?.id === proposal.id &&
              (selectedStrategyActivity?.latest_actionable_proposal_review_record?.id ?? null) ===
                focusedReviewId) ||
            (selectedStrategyActivity?.latest_proposal?.id === proposal.id &&
              (selectedStrategyActivity?.latest_proposal_review_record?.id ?? null) === focusedReviewId) ||
            (proposalReviewMap.get(proposal.id) ?? null)?.id === focusedReviewId,
        ) ?? null
      )
    }
    if (aiSchedulerFocusedJobId != null) {
      return (
        strategyProposals.find(
          (proposal) =>
            (selectedStrategyActivity?.latest_actionable_proposal?.id === proposal.id &&
              (selectedStrategyActivity?.latest_actionable_proposal_job_record?.id ?? null) ===
                aiSchedulerFocusedJobId) ||
            (selectedStrategyActivity?.latest_proposal?.id === proposal.id &&
              (selectedStrategyActivity?.latest_proposal_job_record?.id ?? null) === aiSchedulerFocusedJobId) ||
            (proposalAgentJobMap.get(proposal.id) ?? null)?.id === aiSchedulerFocusedJobId,
        ) ?? null
      )
    }
    return null
  })()

  const strategyActivityProposals = (() => {
    let activityProposals = selectedStrategyActivity?.recent_proposals ?? []
    const latestProposal = selectedStrategyActivity?.latest_proposal ?? null
    const latestActionableProposal = selectedStrategyActivity?.latest_actionable_proposal ?? null
    if (
      latestProposal &&
      selectedStrategyActivity &&
      latestProposal.strategy_id === selectedStrategyActivity.strategy_id
    ) {
      activityProposals = prependUniqueActivityItem(activityProposals, latestProposal, (proposal) => proposal.id, 8)
    }
    if (
      latestActionableProposal &&
      selectedStrategyActivity &&
      latestActionableProposal.strategy_id === selectedStrategyActivity.strategy_id
    ) {
      activityProposals = prependUniqueActivityItem(
        activityProposals,
        latestActionableProposal,
        (proposal) => proposal.id,
        8,
      )
    }
    if (!selectedStrategyProposal || !selectedStrategyActivity) {
      return activityProposals
    }
    if (selectedStrategyProposal.strategy_id !== selectedStrategyActivity.strategy_id) {
      return activityProposals
    }
    return prependUniqueActivityItem(activityProposals, selectedStrategyProposal, (proposal) => proposal.id, 8)
  })()

  const activityLatestProposal = strategyActivityProposals[0] ?? selectedStrategyActivity?.latest_proposal ?? null
  const activityLatestActionableProposal =
    strategyActivityProposals.find((proposal) => proposal.status === 'pending' || proposal.status === 'testing') ??
    selectedStrategyActivity?.latest_actionable_proposal ??
    null

  const getStrategyActivityProposalLinkedState = (proposal?: StrategyProposal | null) => {
    if (!proposal) {
      return {
        linkedBacktest: null,
        linkedReview: null,
        linkedChangeRequest: null,
        linkedJob: null,
      }
    }
    const latestActionableMatched = selectedStrategyActivity?.latest_actionable_proposal?.id === proposal.id
    const latestMatched = selectedStrategyActivity?.latest_proposal?.id === proposal.id
    const linkedChangeRequest =
      (latestActionableMatched ? selectedStrategyActivity?.latest_actionable_proposal_change_request ?? null : null) ??
      (latestMatched ? selectedStrategyActivity?.latest_proposal_change_request ?? null : null) ??
      proposalChangeRequestMap.get(proposal.id) ??
      null
    const linkedBacktest =
      (latestActionableMatched ? selectedStrategyActivity?.latest_actionable_proposal_backtest_record ?? null : null) ??
      (latestMatched ? selectedStrategyActivity?.latest_proposal_backtest_record ?? null : null) ??
      proposalBacktestMap.get(proposal.id) ??
      null
    const linkedReview =
      (latestActionableMatched ? selectedStrategyActivity?.latest_actionable_proposal_review_record ?? null : null) ??
      (latestMatched ? selectedStrategyActivity?.latest_proposal_review_record ?? null : null) ??
      proposalReviewMap.get(proposal.id) ??
      null
    const linkedJob =
      (latestActionableMatched ? selectedStrategyActivity?.latest_actionable_proposal_job_record ?? null : null) ??
      (latestMatched ? selectedStrategyActivity?.latest_proposal_job_record ?? null : null) ??
      proposalAgentJobMap.get(proposal.id) ??
      null
    return {
      linkedBacktest,
      linkedReview,
      linkedChangeRequest,
      linkedJob,
    }
  }

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
  const activityLatestActionableProposalLinkedReview = activityLatestActionableProposalLinkedState.linkedReview
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
    focusedReplayReview,
    focusedTrackingReviewId,
    focusedPrimaryReviewId,
    strategyActivityTrackingReviews,
    strategyActivityPrimaryReviews,
    strategyActivityAgentJobs,
    strategyActivityReviewRecords,
    strategyActivityJobRecords,
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

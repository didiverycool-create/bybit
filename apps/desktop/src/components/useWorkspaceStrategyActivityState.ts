import { useState } from 'react'

import type { WorkspaceBootstrap } from '../utils/workspace-helpers'

type UseWorkspaceStrategyActivityStateArgs = {
  workspaceBootstrap: WorkspaceBootstrap
  createTrackingRequestKey: () => string
}

export function useWorkspaceStrategyActivityState({
  workspaceBootstrap,
  createTrackingRequestKey,
}: UseWorkspaceStrategyActivityStateArgs) {
  const [reviewInspectorReviewId, setReviewInspectorReviewId] = useState<string | null>(
    workspaceBootstrap.selected_review_inspector_id,
  )
  const [reviewInspectorStrategyId, setReviewInspectorStrategyId] = useState<string | null>(
    workspaceBootstrap.selected_review_inspector_strategy_id,
  )
  const [aiSchedulerFocusedJobId, setAiSchedulerFocusedJobId] = useState<string | null>(
    workspaceBootstrap.selected_scheduler_job_id,
  )
  const [strategyTrackingKind, setStrategyTrackingKind] = useState<'issue' | 'change'>(
    workspaceBootstrap.selected_strategy_tracking_kind ?? 'issue',
  )
  const [strategyTrackingSummary, setStrategyTrackingSummary] = useState(
    workspaceBootstrap.selected_strategy_tracking_summary,
  )
  const [strategyTrackingDetail, setStrategyTrackingDetail] = useState(
    workspaceBootstrap.selected_strategy_tracking_detail,
  )
  const [strategyTrackingRequestKey, setStrategyTrackingRequestKey] = useState(
    createTrackingRequestKey,
  )
  const [replayFocusedReviewId, setReplayFocusedReviewId] = useState<string | null>(
    workspaceBootstrap.selected_review_id,
  )
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    workspaceBootstrap.selected_proposal_id,
  )
  const [selectedChangeRequestId, setSelectedChangeRequestId] = useState<string | null>(
    workspaceBootstrap.selected_change_request_id,
  )
  const [backtestFilter, setBacktestFilter] = useState<'selected' | 'all'>(
    workspaceBootstrap.backtest_filter,
  )
  const [replayTrackingScope, setReplayTrackingScope] = useState<'all' | 'selected'>(
    workspaceBootstrap.replay_tracking_scope,
  )
  const [selectedBacktestId, setSelectedBacktestId] = useState<string | null>(
    workspaceBootstrap.selected_backtest_id,
  )

  return {
    reviewInspectorReviewId,
    setReviewInspectorReviewId,
    reviewInspectorStrategyId,
    setReviewInspectorStrategyId,
    aiSchedulerFocusedJobId,
    setAiSchedulerFocusedJobId,
    strategyTrackingKind,
    setStrategyTrackingKind,
    strategyTrackingSummary,
    setStrategyTrackingSummary,
    strategyTrackingDetail,
    setStrategyTrackingDetail,
    strategyTrackingRequestKey,
    setStrategyTrackingRequestKey,
    replayFocusedReviewId,
    setReplayFocusedReviewId,
    selectedProposalId,
    setSelectedProposalId,
    selectedChangeRequestId,
    setSelectedChangeRequestId,
    backtestFilter,
    setBacktestFilter,
    replayTrackingScope,
    setReplayTrackingScope,
    selectedBacktestId,
    setSelectedBacktestId,
  }
}

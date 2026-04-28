import { useWorkspaceDraftSelectionCleanupBacktest } from './useWorkspaceDraftSelectionCleanupBacktest'
import { useWorkspaceDraftSelectionCleanupReview } from './useWorkspaceDraftSelectionCleanupReview'
import { useWorkspaceDraftSelectionCleanupRuntime } from './useWorkspaceDraftSelectionCleanupRuntime'
import type { UseWorkspaceDraftSelectionCleanupArgs } from './useWorkspaceDraftSelectionCleanup.types'

export function useWorkspaceDraftSelectionCleanup({
  backtestsForWorkspace,
  selectedBacktestId,
  setSelectedBacktestId,
  selectedProposalId,
  reviewsLoaded,
  proposalCatalog,
  setSelectedProposalId,
  reviewInspectorOpen,
  reviewInspectorReviewId,
  reviewInspectorStrategyId,
  reviewCatalog,
  setReviewInspectorOpen,
  setReviewInspectorReviewId,
  setReviewInspectorStrategyId,
  replayFocusedReviewId,
  setReplayFocusedReviewId,
  aiSchedulerFocusedJobId,
  schedulerLoaded,
  schedulerJobs,
  setAiSchedulerFocusedJobId,
  selectedChangeRequestId,
  changeRequestsLoaded,
  changeRequests,
  setSelectedChangeRequestId,
  editingOrderId,
  editingOrder,
  setEditingOrderId,
  setManualTradePanelOpen,
}: UseWorkspaceDraftSelectionCleanupArgs) {
  useWorkspaceDraftSelectionCleanupBacktest({
    backtestsForWorkspace,
    selectedBacktestId,
    setSelectedBacktestId,
  })

  useWorkspaceDraftSelectionCleanupReview({
    selectedProposalId,
    reviewsLoaded,
    proposalCatalog,
    setSelectedProposalId,
    reviewInspectorOpen,
    reviewInspectorReviewId,
    reviewInspectorStrategyId,
    reviewCatalog,
    setReviewInspectorOpen,
    setReviewInspectorReviewId,
    setReviewInspectorStrategyId,
    replayFocusedReviewId,
    setReplayFocusedReviewId,
  })

  useWorkspaceDraftSelectionCleanupRuntime({
    aiSchedulerFocusedJobId,
    schedulerLoaded,
    schedulerJobs,
    setAiSchedulerFocusedJobId,
    selectedChangeRequestId,
    changeRequestsLoaded,
    changeRequests,
    setSelectedChangeRequestId,
    editingOrderId,
    editingOrder,
    setEditingOrderId,
    setManualTradePanelOpen,
  })
}

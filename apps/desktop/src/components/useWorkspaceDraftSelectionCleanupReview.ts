import { useEffect } from 'react'

import type { UseWorkspaceDraftSelectionCleanupArgs } from './useWorkspaceDraftSelectionCleanup.types'

type UseWorkspaceDraftSelectionCleanupReviewArgs = Pick<
  UseWorkspaceDraftSelectionCleanupArgs,
  | 'selectedProposalId'
  | 'reviewsLoaded'
  | 'proposalCatalog'
  | 'setSelectedProposalId'
  | 'reviewInspectorOpen'
  | 'reviewInspectorReviewId'
  | 'reviewInspectorStrategyId'
  | 'reviewCatalog'
  | 'setReviewInspectorOpen'
  | 'setReviewInspectorReviewId'
  | 'setReviewInspectorStrategyId'
  | 'replayFocusedReviewId'
  | 'setReplayFocusedReviewId'
>

export function useWorkspaceDraftSelectionCleanupReview({
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
}: UseWorkspaceDraftSelectionCleanupReviewArgs) {
  useEffect(() => {
    if (!selectedProposalId || !reviewsLoaded) {
      return
    }
    if (proposalCatalog.some((proposal) => proposal.id === selectedProposalId)) {
      return
    }
    setSelectedProposalId(null)
  }, [proposalCatalog, reviewsLoaded, selectedProposalId, setSelectedProposalId])

  useEffect(() => {
    if (!reviewInspectorReviewId) {
      if (reviewInspectorOpen) {
        setReviewInspectorOpen(false)
      }
      if (reviewInspectorStrategyId) {
        setReviewInspectorStrategyId(null)
      }
      return
    }
    if (!reviewsLoaded) {
      return
    }
    if (reviewCatalog.some((review) => review.id === reviewInspectorReviewId)) {
      return
    }
    setReviewInspectorOpen(false)
    setReviewInspectorReviewId(null)
    setReviewInspectorStrategyId(null)
  }, [
    reviewCatalog,
    reviewInspectorOpen,
    reviewInspectorReviewId,
    reviewInspectorStrategyId,
    reviewsLoaded,
    setReviewInspectorOpen,
    setReviewInspectorReviewId,
    setReviewInspectorStrategyId,
  ])

  useEffect(() => {
    if (!replayFocusedReviewId || !reviewsLoaded) {
      return
    }
    if (reviewCatalog.some((review) => review.id === replayFocusedReviewId)) {
      return
    }
    setReplayFocusedReviewId(null)
  }, [replayFocusedReviewId, reviewCatalog, reviewsLoaded, setReplayFocusedReviewId])
}

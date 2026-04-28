import {
  useWorkspaceChangeRequestFocusSync,
  useWorkspaceInspectorFocusSync,
  useWorkspaceProposalFocusSync,
  useWorkspaceReviewFocusSync,
  useWorkspaceSchedulerFocusSync,
} from './useWorkspaceFocusSyncEffects'
import type { UseWorkspaceFocusSyncArgs } from './useWorkspaceFocusSync.types'

export function useWorkspaceFocusSyncModel({
  activeSection,
  selectedProposalId,
  selectedChangeRequestId,
  proposalCatalog,
  replayFocusedReviewId,
  reviewCatalog,
  reviewInspectorOpen,
  reviewInspectorReviewId,
  reviewInspectorStrategyId,
  aiSchedulerFocusedJobId,
  schedulerJobs,
  changeRequests,
  strategies,
  selectedStrategyCurrentId,
  selectedStrategyId,
  selectedSymbol,
  setSelectedStrategyId,
  setSelectedSymbol,
  setReviewInspectorStrategyId,
}: UseWorkspaceFocusSyncArgs) {
  useWorkspaceProposalFocusSync({
    activeSection,
    selectedChangeRequestId,
    selectedProposalId,
    proposalCatalog,
    strategies,
    selectedStrategyCurrentId,
    selectedStrategyId,
    selectedSymbol,
    setSelectedStrategyId,
    setSelectedSymbol,
  })

  useWorkspaceReviewFocusSync({
    activeSection,
    replayFocusedReviewId,
    reviewCatalog,
    strategies,
    selectedStrategyCurrentId,
    selectedStrategyId,
    selectedSymbol,
    setSelectedStrategyId,
    setSelectedSymbol,
  })

  useWorkspaceInspectorFocusSync({
    reviewCatalog,
    reviewInspectorOpen,
    reviewInspectorReviewId,
    reviewInspectorStrategyId,
    strategies,
    selectedStrategyCurrentId,
    selectedStrategyId,
    selectedSymbol,
    setReviewInspectorStrategyId,
    setSelectedStrategyId,
    setSelectedSymbol,
  })

  useWorkspaceSchedulerFocusSync({
    activeSection,
    aiSchedulerFocusedJobId,
    schedulerJobs,
    strategies,
    selectedStrategyCurrentId,
    selectedStrategyId,
    selectedSymbol,
    setSelectedStrategyId,
    setSelectedSymbol,
  })

  useWorkspaceChangeRequestFocusSync({
    activeSection,
    changeRequests,
    selectedChangeRequestId,
    selectedStrategyCurrentId,
    selectedStrategyId,
    setSelectedStrategyId,
    strategies,
  })
}

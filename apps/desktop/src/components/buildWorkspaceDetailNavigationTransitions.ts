import { startTransition } from 'react'

import type {
  BuildWorkspaceDetailNavigationActionsArgs,
  WorkspaceDetailNavigationState,
  WorkspaceSchedulerJobNavigationState,
} from './workspaceDetailNavigationShared'

export function openWorkspaceBacktestDetailTransition(
  {
    closeReviewInspector,
    setActiveSection,
    setBacktestFilter,
    setSelectedBacktestId,
    setSelectedStrategyId,
    setSelectedSymbol,
  }: BuildWorkspaceDetailNavigationActionsArgs,
  backtestId: string,
  { nextStrategyId, nextSymbol }: WorkspaceDetailNavigationState,
) {
  startTransition(() => {
    setActiveSection('backtest')
    if (nextStrategyId) {
      setSelectedStrategyId(nextStrategyId)
      setBacktestFilter('selected')
    } else {
      setBacktestFilter('all')
    }
    if (nextSymbol) {
      setSelectedSymbol(nextSymbol)
    }
    setSelectedBacktestId(backtestId)
  })
  closeReviewInspector()
}

export function openWorkspaceStrategyProposalTransition(
  {
    closeReviewInspector,
    setActiveSection,
    setSelectedChangeRequestId,
    setSelectedProposalId,
    setSelectedStrategyId,
    setSelectedSymbol,
  }: BuildWorkspaceDetailNavigationActionsArgs,
  proposalId: string,
  { nextStrategyId, nextSymbol }: WorkspaceDetailNavigationState,
) {
  startTransition(() => {
    setActiveSection('strategy')
    if (nextStrategyId) {
      setSelectedStrategyId(nextStrategyId)
    }
    if (nextSymbol) {
      setSelectedSymbol(nextSymbol)
    }
    setSelectedChangeRequestId(null)
    setSelectedProposalId(proposalId)
  })
  closeReviewInspector()
}

export function openWorkspaceChangeRequestTransition(
  {
    closeReviewInspector,
    setActiveSection,
    setSelectedChangeRequestId,
    setSelectedProposalId,
    setSelectedStrategyId,
    setSelectedSymbol,
  }: BuildWorkspaceDetailNavigationActionsArgs,
  changeRequestId: string,
  { nextStrategyId, nextSymbol }: WorkspaceDetailNavigationState,
) {
  startTransition(() => {
    setActiveSection('strategy')
    if (nextStrategyId) {
      setSelectedStrategyId(nextStrategyId)
    }
    if (nextSymbol) {
      setSelectedSymbol(nextSymbol)
    }
    setSelectedProposalId(null)
    setSelectedChangeRequestId(changeRequestId)
  })
  closeReviewInspector()
}

export function openWorkspaceReviewInspectorTransition(
  {
    setReviewInspectorOpen,
    setReviewInspectorReviewId,
    setReviewInspectorStrategyId,
    setSelectedStrategyId,
    setSelectedSymbol,
  }: BuildWorkspaceDetailNavigationActionsArgs,
  reviewId: string,
  { nextStrategyId, nextSymbol }: WorkspaceDetailNavigationState,
) {
  startTransition(() => {
    if (nextStrategyId) {
      setSelectedStrategyId(nextStrategyId)
    }
    if (nextSymbol) {
      setSelectedSymbol(nextSymbol)
    }
    setReviewInspectorReviewId(reviewId)
    setReviewInspectorStrategyId(nextStrategyId ?? null)
    setReviewInspectorOpen(true)
  })
}

export function openWorkspaceAiSchedulerJobTransition(
  {
    closeReviewInspector,
    setActiveSection,
    setAiSchedulerFocusedJobId,
    setSelectedStrategyId,
    setSelectedSymbol,
  }: BuildWorkspaceDetailNavigationActionsArgs,
  jobId: string,
  { jobStrategyId, jobSymbol }: WorkspaceSchedulerJobNavigationState,
) {
  startTransition(() => {
    setActiveSection('scheduler')
    if (jobStrategyId) {
      setSelectedStrategyId(jobStrategyId)
    }
    if (jobSymbol) {
      setSelectedSymbol(jobSymbol)
    }
    setAiSchedulerFocusedJobId(jobId)
  })
  closeReviewInspector()
}

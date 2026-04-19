import { getAgentJobStrategyId, getChangeRequestStrategyId, getReviewFocusStrategyId } from '../utils/app-helpers'

import {
  findWorkspaceReviewRecord,
  getStrategyPrimarySymbol,
} from './workspaceNavigationShared'
import type {
  BuildWorkspaceDetailNavigationActionsArgs,
  WorkspaceDetailNavigationState,
  WorkspaceSchedulerJobNavigationState,
} from './workspaceDetailNavigationShared'

export function resolveWorkspaceBacktestNavigationState(
  { backtests, strategies }: BuildWorkspaceDetailNavigationActionsArgs,
  backtestId: string,
  strategyId?: string | null,
): WorkspaceDetailNavigationState {
  const linkedBacktest = backtests.find((item) => item.id === backtestId) ?? null
  const nextStrategyId = strategyId ?? linkedBacktest?.strategy_id ?? null
  const nextSymbol =
    linkedBacktest?.symbol_scope.find((symbol) => typeof symbol === 'string' && symbol.trim()) ??
    getStrategyPrimarySymbol(strategies, nextStrategyId)

  return {
    nextStrategyId,
    nextSymbol,
  }
}

export function resolveWorkspaceProposalNavigationState(
  { proposalCatalog, strategies }: BuildWorkspaceDetailNavigationActionsArgs,
  proposalId: string,
  strategyId?: string | null,
): WorkspaceDetailNavigationState {
  const linkedProposal = proposalCatalog.find((proposal) => proposal.id === proposalId) ?? null
  const nextStrategyId = strategyId ?? linkedProposal?.strategy_id ?? null

  return {
    nextStrategyId,
    nextSymbol: getStrategyPrimarySymbol(strategies, nextStrategyId),
  }
}

export function resolveWorkspaceChangeRequestNavigationState(
  {
    changeRequests,
    selectedStrategy,
    selectedStrategyId,
    strategies,
  }: BuildWorkspaceDetailNavigationActionsArgs,
  changeRequestId: string,
  strategyId?: string | null,
): WorkspaceDetailNavigationState {
  const linkedChangeRequest = changeRequests.find((request) => request.id === changeRequestId) ?? null
  const nextStrategyId =
    strategyId ??
    getChangeRequestStrategyId(linkedChangeRequest ?? undefined, selectedStrategy?.id ?? selectedStrategyId)

  return {
    nextStrategyId,
    nextSymbol: getStrategyPrimarySymbol(strategies, nextStrategyId),
  }
}

export function resolveWorkspaceReviewNavigationState(
  {
    reviewCatalog,
    selectedStrategy,
    selectedStrategyId,
    strategies,
    strategyActivityReviewRecords,
  }: BuildWorkspaceDetailNavigationActionsArgs,
  reviewId: string,
  strategyId?: string | null,
): WorkspaceDetailNavigationState {
  const linkedReview = findWorkspaceReviewRecord(reviewCatalog, strategyActivityReviewRecords, reviewId)
  const nextStrategyId =
    strategyId ?? getReviewFocusStrategyId(linkedReview, selectedStrategy?.id ?? selectedStrategyId)

  return {
    nextStrategyId,
    nextSymbol: getStrategyPrimarySymbol(strategies, nextStrategyId),
  }
}

export function resolveWorkspaceSchedulerJobNavigationState(
  { schedulerJobs, strategies, strategyActivityJobRecords }: BuildWorkspaceDetailNavigationActionsArgs,
  jobId: string,
): WorkspaceSchedulerJobNavigationState {
  const selectedJob =
    schedulerJobs.find((job) => job.id === jobId) ??
    strategyActivityJobRecords.find((job) => job.id === jobId) ??
    null
  const jobStrategyId = selectedJob ? getAgentJobStrategyId(selectedJob) : null

  return {
    jobStrategyId,
    jobSymbol: getStrategyPrimarySymbol(strategies, jobStrategyId),
  }
}

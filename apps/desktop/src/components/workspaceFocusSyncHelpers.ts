import type { Dispatch, SetStateAction } from 'react'

import type { AgentJob, ChangeRequest, ReviewDocument, StrategyProposal, StrategySummary } from '../types'
import { getAgentJobStrategyId, getChangeRequestStrategyId, getReviewFocusStrategyId } from '../utils/app-helpers'
import { resolveWorkspaceFocusSelection } from './resolveWorkspaceFocusSelection'

type WorkspaceFocusBaseArgs = {
  strategies: StrategySummary[]
  selectedStrategyCurrentId: string | null
  selectedStrategyId: string | null
  selectedSymbol: string
}

type WorkspaceFocusSelectionSetters = {
  setSelectedStrategyId: Dispatch<SetStateAction<string | null>>
  setSelectedSymbol: Dispatch<SetStateAction<string>>
}

type WorkspaceFocusInspectorSetters = WorkspaceFocusSelectionSetters & {
  setReviewInspectorStrategyId: Dispatch<SetStateAction<string | null>>
}

export function syncWorkspaceFocusFromProposal({
  proposalCatalog,
  selectedProposalId,
  ...baseArgs
}: WorkspaceFocusBaseArgs & {
  proposalCatalog: StrategyProposal[]
  selectedProposalId: string | null
} & WorkspaceFocusSelectionSetters) {
  if (!selectedProposalId) {
    return
  }

  const selectedProposal = proposalCatalog.find((proposal) => proposal.id === selectedProposalId) ?? null
  if (!selectedProposal) {
    return
  }

  const selection = resolveWorkspaceFocusSelection({
    strategyId: selectedProposal.strategy_id,
    ...baseArgs,
  })
  if (!selection.strategy) {
    return
  }

  if (selection.nextSelectedStrategyId) {
    baseArgs.setSelectedStrategyId(selection.nextSelectedStrategyId)
  }
  if (selection.nextSelectedSymbol) {
    baseArgs.setSelectedSymbol(selection.nextSelectedSymbol)
  }
}

export function syncWorkspaceFocusFromReview({
  reviewCatalog,
  replayFocusedReviewId,
  ...baseArgs
}: WorkspaceFocusBaseArgs & {
  reviewCatalog: ReviewDocument[]
  replayFocusedReviewId: string | null
} & WorkspaceFocusSelectionSetters) {
  if (!replayFocusedReviewId) {
    return
  }

  const selectedReview = reviewCatalog.find((review) => review.id === replayFocusedReviewId) ?? null
  if (!selectedReview) {
    return
  }

  const selection = resolveWorkspaceFocusSelection({
    strategyId: getReviewFocusStrategyId(selectedReview),
    ...baseArgs,
  })
  if (!selection.strategy) {
    return
  }

  if (selection.nextSelectedStrategyId) {
    baseArgs.setSelectedStrategyId(selection.nextSelectedStrategyId)
  }
  if (selection.nextSelectedSymbol) {
    baseArgs.setSelectedSymbol(selection.nextSelectedSymbol)
  }
}

export function syncWorkspaceFocusFromScheduler({
  schedulerJobs,
  aiSchedulerFocusedJobId,
  ...baseArgs
}: WorkspaceFocusBaseArgs & {
  schedulerJobs: AgentJob[]
  aiSchedulerFocusedJobId: string | null
} & WorkspaceFocusSelectionSetters) {
  if (!aiSchedulerFocusedJobId) {
    return
  }

  const selectedJob = schedulerJobs.find((job) => job.id === aiSchedulerFocusedJobId) ?? null
  if (!selectedJob) {
    return
  }

  const selection = resolveWorkspaceFocusSelection({
    strategyId: getAgentJobStrategyId(selectedJob),
    ...baseArgs,
  })
  if (!selection.strategy) {
    return
  }

  if (selection.nextSelectedStrategyId) {
    baseArgs.setSelectedStrategyId(selection.nextSelectedStrategyId)
  }
  if (selection.nextSelectedSymbol) {
    baseArgs.setSelectedSymbol(selection.nextSelectedSymbol)
  }
}

export function syncWorkspaceFocusFromChangeRequest({
  changeRequests,
  selectedChangeRequestId,
  ...baseArgs
}: WorkspaceFocusBaseArgs & {
  changeRequests: ChangeRequest[]
  selectedChangeRequestId: string | null
} & Pick<WorkspaceFocusSelectionSetters, 'setSelectedStrategyId'>) {
  if (!selectedChangeRequestId) {
    return
  }

  const selectedRequest = changeRequests.find((request) => request.id === selectedChangeRequestId) ?? null
  if (!selectedRequest) {
    return
  }

  const selection = resolveWorkspaceFocusSelection({
    strategyId: getChangeRequestStrategyId(selectedRequest),
    ...baseArgs,
    syncSymbol: false,
  })
  if (!selection.nextSelectedStrategyId) {
    return
  }

  baseArgs.setSelectedStrategyId(selection.nextSelectedStrategyId)
}

export function syncWorkspaceInspectorFocus({
  reviewCatalog,
  reviewInspectorOpen,
  reviewInspectorReviewId,
  reviewInspectorStrategyId,
  setReviewInspectorStrategyId,
  ...baseArgs
}: WorkspaceFocusBaseArgs & {
  reviewCatalog: ReviewDocument[]
  reviewInspectorOpen: boolean
  reviewInspectorReviewId: string | null
  reviewInspectorStrategyId: string | null
} & WorkspaceFocusInspectorSetters) {
  if (!reviewInspectorOpen || !reviewInspectorReviewId) {
    return
  }

  const selectedReview = reviewCatalog.find((review) => review.id === reviewInspectorReviewId) ?? null
  const selection = resolveWorkspaceFocusSelection({
    strategyId:
      reviewInspectorStrategyId ??
      getReviewFocusStrategyId(selectedReview, baseArgs.selectedStrategyCurrentId ?? baseArgs.selectedStrategyId),
    ...baseArgs,
    currentReviewInspectorStrategyId: reviewInspectorStrategyId,
    syncReviewInspectorStrategyId: true,
  })
  if (!selection.strategy) {
    return
  }

  if (selection.nextReviewInspectorStrategyId) {
    setReviewInspectorStrategyId(selection.nextReviewInspectorStrategyId)
  }
  if (selection.nextSelectedStrategyId) {
    baseArgs.setSelectedStrategyId(selection.nextSelectedStrategyId)
  }
  if (selection.nextSelectedSymbol) {
    baseArgs.setSelectedSymbol(selection.nextSelectedSymbol)
  }
}

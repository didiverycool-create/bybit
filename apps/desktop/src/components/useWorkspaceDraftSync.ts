import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { BacktestRun, ChangeRequest, OrderRecord, ReviewDocument, StrategyParameter, StrategyProposal, StrategySummary } from '../types'
import { normalizeDraftValue } from '../utils/app-helpers'

type UseWorkspaceDraftSyncArgs = {
  selectedStrategy: StrategySummary | null
  selectedStrategyId: string | null
  selectedStrategyParameterSignature: string
  strategyEditorDraftStrategyId: string | null
  strategyEditorOpen: boolean
  setParameterDrafts: Dispatch<SetStateAction<Record<string, string>>>
  setRiskBudgetDraft: Dispatch<SetStateAction<string>>
  setStrategyEditorDraftStrategyId: Dispatch<SetStateAction<string | null>>
  watchlist: Array<{ symbol: string; alert_threshold_pct: number }>
  watchlistAlertSignature: string
  setWatchlistAlertDrafts: Dispatch<SetStateAction<Record<string, string>>>
  backtestsForWorkspace: BacktestRun[]
  selectedBacktestId: string | null
  setSelectedBacktestId: Dispatch<SetStateAction<string | null>>
  selectedProposalId: string | null
  reviewsLoaded: boolean
  proposalCatalog: StrategyProposal[]
  setSelectedProposalId: Dispatch<SetStateAction<string | null>>
  reviewInspectorOpen: boolean
  reviewInspectorReviewId: string | null
  reviewInspectorStrategyId: string | null
  reviewCatalog: ReviewDocument[]
  setReviewInspectorOpen: Dispatch<SetStateAction<boolean>>
  setReviewInspectorReviewId: Dispatch<SetStateAction<string | null>>
  setReviewInspectorStrategyId: Dispatch<SetStateAction<string | null>>
  replayFocusedReviewId: string | null
  setReplayFocusedReviewId: Dispatch<SetStateAction<string | null>>
  aiSchedulerFocusedJobId: string | null
  schedulerLoaded: boolean
  schedulerJobs: Array<{ id: string }>
  setAiSchedulerFocusedJobId: Dispatch<SetStateAction<string | null>>
  selectedChangeRequestId: string | null
  changeRequestsLoaded: boolean
  changeRequests: ChangeRequest[]
  setSelectedChangeRequestId: Dispatch<SetStateAction<string | null>>
  editingOrderId: string | null
  editingOrder: OrderRecord | null
  setEditingOrderId: Dispatch<SetStateAction<string | null>>
  setManualTradePanelOpen: Dispatch<SetStateAction<boolean>>
}

export function useWorkspaceDraftSync({
  selectedStrategy,
  selectedStrategyId,
  selectedStrategyParameterSignature,
  strategyEditorDraftStrategyId,
  strategyEditorOpen,
  setParameterDrafts,
  setRiskBudgetDraft,
  setStrategyEditorDraftStrategyId,
  watchlist,
  watchlistAlertSignature,
  setWatchlistAlertDrafts,
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
}: UseWorkspaceDraftSyncArgs) {
  useEffect(() => {
    const currentParameters = selectedStrategy?.parameters ?? ([] as StrategyParameter[])
    const currentRiskBudget = selectedStrategy?.risk_budget ?? ''

    if (!selectedStrategyId || currentParameters.length === 0) {
      setParameterDrafts({})
      setRiskBudgetDraft('')
      setStrategyEditorDraftStrategyId(null)
      return
    }
    if (strategyEditorDraftStrategyId === selectedStrategyId) {
      return
    }
    if (!strategyEditorOpen) {
      setParameterDrafts({})
      setRiskBudgetDraft('')
      setStrategyEditorDraftStrategyId(null)
      return
    }
    setParameterDrafts(
      Object.fromEntries(
        currentParameters.map((parameter) => [parameter.key, normalizeDraftValue(parameter.value)]),
      ),
    )
    setRiskBudgetDraft(currentRiskBudget)
    setStrategyEditorDraftStrategyId(selectedStrategyId)
  }, [
    selectedStrategy,
    selectedStrategyId,
    selectedStrategyParameterSignature,
    strategyEditorDraftStrategyId,
    strategyEditorOpen,
    setParameterDrafts,
    setRiskBudgetDraft,
    setStrategyEditorDraftStrategyId,
  ])

  useEffect(() => {
    setWatchlistAlertDrafts(
      Object.fromEntries(watchlist.map((item) => [item.symbol, item.alert_threshold_pct.toFixed(1)])),
    )
  }, [setWatchlistAlertDrafts, watchlist, watchlistAlertSignature])

  useEffect(() => {
    if (backtestsForWorkspace.length === 0) {
      setSelectedBacktestId(null)
      return
    }
    const exists = backtestsForWorkspace.some((item) => item.id === selectedBacktestId)
    if (!selectedBacktestId || !exists) {
      setSelectedBacktestId(backtestsForWorkspace[0].id)
    }
  }, [backtestsForWorkspace, selectedBacktestId, setSelectedBacktestId])

  useEffect(() => {
    if (!selectedProposalId) {
      return
    }
    if (!reviewsLoaded) {
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
    if (!replayFocusedReviewId) {
      return
    }
    if (!reviewsLoaded) {
      return
    }
    if (reviewCatalog.some((review) => review.id === replayFocusedReviewId)) {
      return
    }
    setReplayFocusedReviewId(null)
  }, [replayFocusedReviewId, reviewCatalog, reviewsLoaded, setReplayFocusedReviewId])

  useEffect(() => {
    if (!aiSchedulerFocusedJobId) {
      return
    }
    if (!schedulerLoaded) {
      return
    }
    if (schedulerJobs.some((job) => job.id === aiSchedulerFocusedJobId)) {
      return
    }
    setAiSchedulerFocusedJobId(null)
  }, [aiSchedulerFocusedJobId, schedulerJobs, schedulerLoaded, setAiSchedulerFocusedJobId])

  useEffect(() => {
    if (!selectedChangeRequestId) {
      return
    }
    if (!changeRequestsLoaded) {
      return
    }
    if (changeRequests.some((request) => request.id === selectedChangeRequestId)) {
      return
    }
    setSelectedChangeRequestId(null)
  }, [changeRequests, changeRequestsLoaded, selectedChangeRequestId, setSelectedChangeRequestId])

  useEffect(() => {
    if (editingOrderId && !editingOrder) {
      setEditingOrderId(null)
      setManualTradePanelOpen(false)
    }
  }, [editingOrder, editingOrderId, setEditingOrderId, setManualTradePanelOpen])
}

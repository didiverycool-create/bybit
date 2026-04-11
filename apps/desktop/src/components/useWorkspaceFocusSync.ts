import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { AgentJob, ChangeRequest, ReviewDocument, StrategyProposal, StrategySummary } from '../types'
import { getAgentJobStrategyId, getChangeRequestStrategyId, getReviewFocusStrategyId } from '../utils/app-helpers'

type UseWorkspaceFocusSyncArgs = {
  activeSection: string
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  proposalCatalog: StrategyProposal[]
  replayFocusedReviewId: string | null
  reviewCatalog: ReviewDocument[]
  reviewInspectorOpen: boolean
  reviewInspectorReviewId: string | null
  reviewInspectorStrategyId: string | null
  aiSchedulerFocusedJobId: string | null
  schedulerJobs: AgentJob[]
  changeRequests: ChangeRequest[]
  strategies: StrategySummary[]
  selectedStrategyCurrentId: string | null
  selectedStrategyId: string | null
  selectedSymbol: string
  setSelectedStrategyId: Dispatch<SetStateAction<string | null>>
  setSelectedSymbol: Dispatch<SetStateAction<string>>
  setReviewInspectorStrategyId: Dispatch<SetStateAction<string | null>>
}

export function useWorkspaceFocusSync({
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
  useEffect(() => {
    if (activeSection !== 'strategy') {
      return
    }
    if (selectedChangeRequestId || !selectedProposalId) {
      return
    }
    const selectedProposal = proposalCatalog.find((proposal) => proposal.id === selectedProposalId) ?? null
    if (!selectedProposal) {
      return
    }
    if (!strategies.some((strategy) => strategy.id === selectedProposal.strategy_id)) {
      return
    }
    if (selectedProposal.strategy_id !== selectedStrategyCurrentId && selectedProposal.strategy_id !== selectedStrategyId) {
      setSelectedStrategyId(selectedProposal.strategy_id)
    }
    const proposalSymbol = strategies.find((strategy) => strategy.id === selectedProposal.strategy_id)?.symbols[0] ?? null
    if (proposalSymbol && proposalSymbol !== selectedSymbol) {
      setSelectedSymbol(proposalSymbol)
    }
  }, [
    activeSection,
    proposalCatalog,
    selectedChangeRequestId,
    selectedProposalId,
    selectedStrategyCurrentId,
    selectedStrategyId,
    selectedSymbol,
    setSelectedStrategyId,
    setSelectedSymbol,
    strategies,
  ])

  useEffect(() => {
    if (activeSection !== 'replay' || !replayFocusedReviewId) {
      return
    }
    const selectedReview = reviewCatalog.find((review) => review.id === replayFocusedReviewId) ?? null
    if (!selectedReview) {
      return
    }
    const reviewStrategyId = getReviewFocusStrategyId(selectedReview)
    if (!reviewStrategyId || !strategies.some((strategy) => strategy.id === reviewStrategyId)) {
      return
    }
    if (reviewStrategyId !== selectedStrategyCurrentId && reviewStrategyId !== selectedStrategyId) {
      setSelectedStrategyId(reviewStrategyId)
    }
    const reviewSymbol = strategies.find((strategy) => strategy.id === reviewStrategyId)?.symbols[0] ?? null
    if (reviewSymbol && reviewSymbol !== selectedSymbol) {
      setSelectedSymbol(reviewSymbol)
    }
  }, [
    activeSection,
    replayFocusedReviewId,
    reviewCatalog,
    selectedStrategyCurrentId,
    selectedStrategyId,
    selectedSymbol,
    setSelectedStrategyId,
    setSelectedSymbol,
    strategies,
  ])

  useEffect(() => {
    if (!reviewInspectorOpen || !reviewInspectorReviewId) {
      return
    }
    const selectedReview = reviewCatalog.find((review) => review.id === reviewInspectorReviewId) ?? null
    const inspectorStrategyId =
      reviewInspectorStrategyId ?? getReviewFocusStrategyId(selectedReview, selectedStrategyCurrentId ?? selectedStrategyId)
    if (!inspectorStrategyId || !strategies.some((strategy) => strategy.id === inspectorStrategyId)) {
      return
    }
    if (!reviewInspectorStrategyId || reviewInspectorStrategyId !== inspectorStrategyId) {
      setReviewInspectorStrategyId(inspectorStrategyId)
    }
    if (inspectorStrategyId !== selectedStrategyCurrentId && inspectorStrategyId !== selectedStrategyId) {
      setSelectedStrategyId(inspectorStrategyId)
    }
    const inspectorSymbol = strategies.find((strategy) => strategy.id === inspectorStrategyId)?.symbols[0] ?? null
    if (inspectorSymbol && inspectorSymbol !== selectedSymbol) {
      setSelectedSymbol(inspectorSymbol)
    }
  }, [
    reviewCatalog,
    reviewInspectorOpen,
    reviewInspectorReviewId,
    reviewInspectorStrategyId,
    selectedStrategyCurrentId,
    selectedStrategyId,
    selectedSymbol,
    setReviewInspectorStrategyId,
    setSelectedStrategyId,
    setSelectedSymbol,
    strategies,
  ])

  useEffect(() => {
    if (activeSection !== 'scheduler' || !aiSchedulerFocusedJobId) {
      return
    }
    const selectedJob = schedulerJobs.find((job) => job.id === aiSchedulerFocusedJobId) ?? null
    if (!selectedJob) {
      return
    }
    const jobStrategyId = getAgentJobStrategyId(selectedJob)
    if (!jobStrategyId || !strategies.some((strategy) => strategy.id === jobStrategyId)) {
      return
    }
    if (jobStrategyId !== selectedStrategyCurrentId && jobStrategyId !== selectedStrategyId) {
      setSelectedStrategyId(jobStrategyId)
    }
    const jobSymbol = strategies.find((strategy) => strategy.id === jobStrategyId)?.symbols[0] ?? null
    if (jobSymbol && jobSymbol !== selectedSymbol) {
      setSelectedSymbol(jobSymbol)
    }
  }, [
    activeSection,
    aiSchedulerFocusedJobId,
    schedulerJobs,
    selectedStrategyCurrentId,
    selectedStrategyId,
    selectedSymbol,
    setSelectedStrategyId,
    setSelectedSymbol,
    strategies,
  ])

  useEffect(() => {
    if (activeSection !== 'strategy') {
      return
    }
    if (!selectedChangeRequestId) {
      return
    }
    const selectedRequest = changeRequests.find((request) => request.id === selectedChangeRequestId) ?? null
    if (!selectedRequest) {
      return
    }
    const requestStrategyId = getChangeRequestStrategyId(selectedRequest)
    if (!requestStrategyId || requestStrategyId === selectedStrategyCurrentId || requestStrategyId === selectedStrategyId) {
      return
    }
    if (!strategies.some((strategy) => strategy.id === requestStrategyId)) {
      return
    }
    setSelectedStrategyId(requestStrategyId)
  }, [
    activeSection,
    changeRequests,
    selectedChangeRequestId,
    selectedStrategyCurrentId,
    selectedStrategyId,
    setSelectedStrategyId,
    strategies,
  ])
}

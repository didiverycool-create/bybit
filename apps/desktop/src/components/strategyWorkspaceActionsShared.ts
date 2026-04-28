import type { Dispatch, ReactNode, SetStateAction } from 'react'

import type { StrategyRuntimeSnapshot, StrategySummary } from '../types'

export type ActionTone = 'success' | 'warning' | 'error'
export type StrategyTrackingKind = 'issue' | 'change'

export type SubmitStrategyRequest = (
  type: string,
  summary: string,
  payload: Record<string, unknown>,
  priority?: 'low' | 'normal' | 'high' | 'critical',
) => Promise<void>

export type LatestSchedulerCommandMeta = {
  jobId: string | null
  linkedReviewId: string | null
  strategyId: string | null
  backtestId: string | null
  sourceChangeRequestId: string | null
  sourceBacktestId: string | null
  sourceReviewId: string | null
  sourceProposalId: string | null
} | null

export type UseStrategyWorkspaceActionsArgs = {
  latestSchedulerCommand: LatestSchedulerCommandMeta
  selectedStrategy: StrategySummary | null | undefined
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null | undefined
  parameterDraftPatch: Record<string, unknown>
  hasParameterDraftChanges: boolean
  riskBudgetDraft: string
  resetStrategyTrackingDraft: (kind?: StrategyTrackingKind, nextSummary?: string, nextDetail?: string) => void
  setSelectedSymbol: Dispatch<SetStateAction<string>>
  setActiveSection: Dispatch<SetStateAction<string>>
  setStrategyEditorOpen: Dispatch<SetStateAction<boolean>>
  setStrategyActivityPanelOpen: Dispatch<SetStateAction<boolean>>
  setStrategyTrackingPanelOpen: Dispatch<SetStateAction<boolean>>
  showFeedback: (tone: ActionTone, title: string, detail: string) => void
  submitStrategyRequest: SubmitStrategyRequest
  openAiSchedulerJob: (jobId: string) => void
  openReviewInspector: (reviewId: string, strategyId?: string | null) => void
  openBacktestDetail: (backtestId: string, strategyId?: string | null) => void
  openChangeRequest: (changeRequestId: string, strategyId?: string | null) => void
  openSourceReview: (reviewId: string, strategyId?: string | null) => void
  openStrategyProposal: (proposalId: string, strategyId?: string | null) => void
  openStrategyActivity: (strategyId: string) => void
}

export type StrategyWorkspaceActionHandlers = {
  openStrategyTrackingPanel: (kind?: StrategyTrackingKind) => void
  submitSelectedStrategyParameterUpdate: () => void
  submitSelectedStrategyRiskUpdate: () => void
}

export type RenderLatestSchedulerCommandActions = (buttonClass?: string) => ReactNode

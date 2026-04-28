import type { BacktestRun, ExecutionPreview, Mode, ReviewDocument, StrategyRuntimeSnapshot } from '../types'
import type { BacktestDecisionMeta, BacktestSampleMeta, BacktestWindowMeta, ReviewLineageMeta } from './strategyCurrentPanelTypes'
import type { StrategyCurrentPanelActionsSectionProps } from './StrategyCurrentPanelActionsSection'
import type { StrategyCurrentPanelNotesSectionProps } from './StrategyCurrentPanelNotesSection'
import type { StrategyCurrentPanelSummarySectionProps } from './StrategyCurrentPanelSummarySection'

export type StrategyWorkspaceCurrentPanelSummaryState = Omit<
  StrategyCurrentPanelSummarySectionProps,
  'selectedStrategy'
>

export type StrategyWorkspaceCurrentPanelActionsState = Omit<
  StrategyCurrentPanelActionsSectionProps,
  | 'onOpenStrategyEditor'
  | 'onExecuteSelectedStrategySignal'
  | 'onOpenStrategyActivityPanel'
  | 'onOpenStrategyTrackingPanel'
  | 'onRestartStrategyRuntimeWorker'
  | 'onSubmitBacktest'
  | 'onToggleStrategyStatus'
>

export type StrategyWorkspaceCurrentPanelNotesState = Omit<
  StrategyCurrentPanelNotesSectionProps,
  | 'selectedStrategyId'
  | 'onOpenReplayReview'
  | 'onOpenChangeRequest'
  | 'onOpenBacktestDetail'
  | 'onOpenSourceReview'
  | 'onOpenStrategyProposal'
  | 'onRerunBacktestFromReview'
>

export type BuildStrategyWorkspaceCurrentPanelSummaryStateArgs = {
  latestStrategyBacktest: BacktestRun | null
  latestStrategyBacktestDecisionMeta: BacktestDecisionMeta
  latestStrategyBacktestWindowMeta: BacktestWindowMeta
  latestStrategyBacktestSampleMeta: BacktestSampleMeta
  openStrategyProposalsCount: number
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null
  selectedStrategyRuntimePreview: ExecutionPreview | null
  selectedMode: Mode
}

export type BuildStrategyWorkspaceCurrentPanelActionsStateArgs = {
  serviceAvailable: boolean
  executeStrategySignalPending: boolean
  strategyTrackingPending: boolean
  restartRuntimeWorkerPending: boolean
  backtestMutationPending: boolean
  changeRequestMutationPending: boolean
  selectedStrategyNeedsRuntimeRecovery: boolean
  runtimeWorkerRestoreHint: string
  selectedMode: Mode
  selectedStrategyRuntimePreview: ExecutionPreview | null
}

export type BuildStrategyWorkspaceCurrentPanelNotesStateArgs = {
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null
  selectedStrategyReview: ReviewDocument | null
  selectedStrategyReviewDecisionMeta: BacktestDecisionMeta
  selectedStrategyReviewLineageMeta: ReviewLineageMeta
  hasParameterDraftChanges: boolean
  parameterDraftChangeCount: number
  riskBudgetChanged: boolean
  serviceAvailable: boolean
  backtestMutationPending: boolean
}

export function buildStrategyWorkspaceCurrentPanelSummaryState({
  latestStrategyBacktest,
  latestStrategyBacktestDecisionMeta,
  latestStrategyBacktestWindowMeta,
  latestStrategyBacktestSampleMeta,
  openStrategyProposalsCount,
  selectedStrategyRuntime,
  selectedStrategyRuntimePreview,
  selectedMode,
}: BuildStrategyWorkspaceCurrentPanelSummaryStateArgs): StrategyWorkspaceCurrentPanelSummaryState {
  return {
    latestStrategyBacktestAnnualReturn: latestStrategyBacktest?.metrics.annual_return ?? null,
    latestStrategyBacktestDecisionMeta,
    latestStrategyBacktestWindowMeta,
    latestStrategyBacktestSampleMeta,
    openStrategyProposalsCount,
    selectedStrategyRuntime,
    selectedStrategyRuntimePreview,
    selectedMode,
  }
}

export function buildStrategyWorkspaceCurrentPanelActionsState({
  serviceAvailable,
  executeStrategySignalPending,
  strategyTrackingPending,
  restartRuntimeWorkerPending,
  backtestMutationPending,
  changeRequestMutationPending,
  selectedStrategyNeedsRuntimeRecovery,
  runtimeWorkerRestoreHint,
  selectedMode,
  selectedStrategyRuntimePreview,
}: BuildStrategyWorkspaceCurrentPanelActionsStateArgs): StrategyWorkspaceCurrentPanelActionsState {
  return {
    serviceAvailable,
    executeStrategySignalPending,
    strategyTrackingPending,
    restartRuntimeWorkerPending,
    backtestMutationPending,
    changeRequestMutationPending,
    selectedStrategyNeedsRuntimeRecovery,
    runtimeWorkerRestoreHint,
    selectedMode,
    selectedStrategyRuntimePreviewAllowed: selectedStrategyRuntimePreview?.allowed,
  }
}

export function buildStrategyWorkspaceCurrentPanelNotesState({
  selectedStrategyRuntime,
  selectedStrategyReview,
  selectedStrategyReviewDecisionMeta,
  selectedStrategyReviewLineageMeta,
  hasParameterDraftChanges,
  parameterDraftChangeCount,
  riskBudgetChanged,
  serviceAvailable,
  backtestMutationPending,
}: BuildStrategyWorkspaceCurrentPanelNotesStateArgs): StrategyWorkspaceCurrentPanelNotesState {
  return {
    selectedStrategyRuntime,
    selectedStrategyReview,
    selectedStrategyReviewDecisionMeta,
    selectedStrategyReviewLineageMeta,
    hasParameterDraftChanges,
    parameterDraftChangeCount,
    riskBudgetChanged,
    serviceAvailable,
    backtestMutationPending,
  }
}

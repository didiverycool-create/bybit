import type { BacktestRun, ExecutionPreview, Mode, ReviewDocument, StrategyRuntimeSnapshot } from '../types'
import type { BacktestDecisionMeta, BacktestSampleMeta, BacktestWindowMeta, ReviewLineageMeta } from './strategyCurrentPanelTypes'
import {
  buildStrategyWorkspaceCurrentPanelActionsState,
  buildStrategyWorkspaceCurrentPanelNotesState,
  buildStrategyWorkspaceCurrentPanelSummaryState,
  type StrategyWorkspaceCurrentPanelActionsState,
  type StrategyWorkspaceCurrentPanelNotesState,
  type StrategyWorkspaceCurrentPanelSummaryState,
} from './buildStrategyWorkspaceCurrentPanelSectionState'

export type StrategyWorkspaceCurrentPanelState = {
  summaryState: StrategyWorkspaceCurrentPanelSummaryState
  actionsState: StrategyWorkspaceCurrentPanelActionsState
  notesState: StrategyWorkspaceCurrentPanelNotesState
}

export type BuildStrategyWorkspaceCurrentPanelStateArgs = {
  latestStrategyBacktest: BacktestRun | null
  latestStrategyBacktestDecisionMeta: BacktestDecisionMeta
  latestStrategyBacktestWindowMeta: BacktestWindowMeta
  latestStrategyBacktestSampleMeta: BacktestSampleMeta
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null
  selectedStrategyRuntimePreview: ExecutionPreview | null
  selectedMode: Mode
  serviceAvailable: boolean
  executeStrategySignalPending: boolean
  strategyTrackingPending: boolean
  restartRuntimeWorkerPending: boolean
  backtestMutationPending: boolean
  changeRequestMutationPending: boolean
  selectedStrategyNeedsRuntimeRecovery: boolean
  runtimeWorkerRestoreHint: string
  openStrategyProposalsCount: number
  hasParameterDraftChanges: boolean
  parameterDraftChangeCount: number
  riskBudgetChanged: boolean
  selectedStrategyReview: ReviewDocument | null
  selectedStrategyReviewDecisionMeta: BacktestDecisionMeta
  selectedStrategyReviewLineageMeta: ReviewLineageMeta
}

export function buildStrategyWorkspaceCurrentPanelState({
  latestStrategyBacktest,
  latestStrategyBacktestDecisionMeta,
  latestStrategyBacktestWindowMeta,
  latestStrategyBacktestSampleMeta,
  selectedStrategyRuntime,
  selectedStrategyRuntimePreview,
  selectedMode,
  serviceAvailable,
  executeStrategySignalPending,
  strategyTrackingPending,
  restartRuntimeWorkerPending,
  backtestMutationPending,
  changeRequestMutationPending,
  selectedStrategyNeedsRuntimeRecovery,
  runtimeWorkerRestoreHint,
  openStrategyProposalsCount,
  hasParameterDraftChanges,
  parameterDraftChangeCount,
  riskBudgetChanged,
  selectedStrategyReview,
  selectedStrategyReviewDecisionMeta,
  selectedStrategyReviewLineageMeta,
}: BuildStrategyWorkspaceCurrentPanelStateArgs): StrategyWorkspaceCurrentPanelState {
  return {
    summaryState: buildStrategyWorkspaceCurrentPanelSummaryState({
      latestStrategyBacktest,
      latestStrategyBacktestDecisionMeta,
      latestStrategyBacktestWindowMeta,
      latestStrategyBacktestSampleMeta,
      openStrategyProposalsCount,
      selectedStrategyRuntime,
      selectedStrategyRuntimePreview,
      selectedMode,
    }),
    actionsState: buildStrategyWorkspaceCurrentPanelActionsState({
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
    }),
    notesState: buildStrategyWorkspaceCurrentPanelNotesState({
      selectedStrategyRuntime,
      selectedStrategyReview,
      selectedStrategyReviewDecisionMeta,
      selectedStrategyReviewLineageMeta,
      hasParameterDraftChanges,
      parameterDraftChangeCount,
      riskBudgetChanged,
      serviceAvailable,
      backtestMutationPending,
    }),
  }
}

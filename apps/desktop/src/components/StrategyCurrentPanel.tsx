import StrategyExecutionContextSection, {
  type StrategyExecutionContextSectionProps,
} from './StrategyExecutionContextSection'
import StrategyCurrentPanelActionsSection, {
  type StrategyCurrentPanelActionsSectionProps,
} from './StrategyCurrentPanelActionsSection'
import StrategyCurrentPanelNotesSection, {
  type StrategyCurrentPanelNotesSectionProps,
} from './StrategyCurrentPanelNotesSection'
import StrategyCurrentPanelSummarySection, {
  type StrategyCurrentPanelSummarySectionProps,
} from './StrategyCurrentPanelSummarySection'
import type { ReviewDocument, StrategySummary } from '../types'

export type StrategyCurrentPanelSummaryState = Omit<
  StrategyCurrentPanelSummarySectionProps,
  'selectedStrategy'
>

export type StrategyCurrentPanelActionsState = Omit<
  StrategyCurrentPanelActionsSectionProps,
  | 'onOpenStrategyEditor'
  | 'onExecuteSelectedStrategySignal'
  | 'onOpenStrategyActivityPanel'
  | 'onOpenStrategyTrackingPanel'
  | 'onRestartStrategyRuntimeWorker'
  | 'onSubmitBacktest'
  | 'onToggleStrategyStatus'
>

export type StrategyCurrentPanelNotesState = Omit<
  StrategyCurrentPanelNotesSectionProps,
  | 'selectedStrategyId'
  | 'onOpenReplayReview'
  | 'onOpenChangeRequest'
  | 'onOpenBacktestDetail'
  | 'onOpenSourceReview'
  | 'onOpenStrategyProposal'
  | 'onRerunBacktestFromReview'
>

export type StrategyCurrentPanelProps = {
  selectedStrategy: StrategySummary
  summaryState: StrategyCurrentPanelSummaryState
  actionsState: StrategyCurrentPanelActionsState
  notesState: StrategyCurrentPanelNotesState
  executionContextProps: StrategyExecutionContextSectionProps
  onOpenStrategyEditor: (strategyId?: string | null) => void
  onExecuteSelectedStrategySignal: () => void
  onOpenStrategyActivityPanel: () => void
  onOpenStrategyTrackingPanel: (kind?: 'issue' | 'change') => void
  onRestartStrategyRuntimeWorker: () => void | Promise<void>
  onSubmitBacktest: () => void | Promise<void>
  onToggleStrategyStatus: () => void | Promise<void>
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onRerunBacktestFromReview: (review: ReviewDocument) => void | Promise<void>
}

export default function StrategyCurrentPanel({
  selectedStrategy,
  summaryState,
  actionsState,
  notesState,
  executionContextProps,
  onOpenStrategyEditor,
  onExecuteSelectedStrategySignal,
  onOpenStrategyActivityPanel,
  onOpenStrategyTrackingPanel,
  onRestartStrategyRuntimeWorker,
  onSubmitBacktest,
  onToggleStrategyStatus,
  onOpenReplayReview,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onRerunBacktestFromReview,
}: StrategyCurrentPanelProps) {
  return (
    <>
      <StrategyCurrentPanelSummarySection selectedStrategy={selectedStrategy} {...summaryState} />
      <StrategyCurrentPanelActionsSection
        {...actionsState}
        onOpenStrategyEditor={() => onOpenStrategyEditor(selectedStrategy.id)}
        onExecuteSelectedStrategySignal={onExecuteSelectedStrategySignal}
        onOpenStrategyActivityPanel={onOpenStrategyActivityPanel}
        onOpenStrategyTrackingPanel={onOpenStrategyTrackingPanel}
        onRestartStrategyRuntimeWorker={onRestartStrategyRuntimeWorker}
        onSubmitBacktest={onSubmitBacktest}
        onToggleStrategyStatus={onToggleStrategyStatus}
      />
      <StrategyCurrentPanelNotesSection
        selectedStrategyId={selectedStrategy.id}
        {...notesState}
        onOpenReplayReview={onOpenReplayReview}
        onOpenChangeRequest={onOpenChangeRequest}
        onOpenBacktestDetail={onOpenBacktestDetail}
        onOpenSourceReview={onOpenSourceReview}
        onOpenStrategyProposal={onOpenStrategyProposal}
        onRerunBacktestFromReview={onRerunBacktestFromReview}
      />
      <StrategyExecutionContextSection {...executionContextProps} />
    </>
  )
}

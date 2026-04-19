import type { StrategySummary } from '../types'
import type { StrategyWorkspaceCurrentPanelState } from './buildStrategyWorkspaceCurrentPanelState'
import type { StrategyCurrentPanelProps } from './StrategyCurrentPanel'
import type { StrategyExecutionContextSectionProps } from './StrategyExecutionContextSection'
import StrategyWorkspaceSection from './StrategyWorkspaceSection'

type StrategyWorkspaceExecutionContextState = Omit<
  StrategyExecutionContextSectionProps,
  | 'onOpenChangeRequest'
  | 'onOpenBacktestDetail'
  | 'onOpenSourceReview'
  | 'onOpenStrategyProposal'
  | 'onOpenAiSchedulerJob'
  | 'onOpenReviewInspector'
  | 'onRetryAgentJob'
  | 'onHandleProposalAction'
  | 'onRerunBacktestFromRecommendation'
  | 'onRerunBacktestFromChangeRequest'
>

type StrategyWorkspaceActions = Pick<
  StrategyCurrentPanelProps,
  | 'onOpenStrategyEditor'
  | 'onExecuteSelectedStrategySignal'
  | 'onOpenStrategyActivityPanel'
  | 'onOpenStrategyTrackingPanel'
  | 'onRestartStrategyRuntimeWorker'
  | 'onSubmitBacktest'
  | 'onToggleStrategyStatus'
  | 'onOpenReplayReview'
  | 'onOpenChangeRequest'
  | 'onOpenBacktestDetail'
  | 'onOpenSourceReview'
  | 'onOpenStrategyProposal'
  | 'onRerunBacktestFromReview'
> &
  Pick<
    StrategyExecutionContextSectionProps,
    | 'onOpenAiSchedulerJob'
    | 'onOpenReviewInspector'
    | 'onRetryAgentJob'
    | 'onHandleProposalAction'
    | 'onRerunBacktestFromRecommendation'
    | 'onRerunBacktestFromChangeRequest'
  >

type StrategyWorkspaceContainerProps = {
  activeSectionKey: string
  strategies: StrategySummary[]
  selectedStrategy: StrategySummary | null
  onSelectStrategyId: (strategyId: string) => void
  currentPanelState: StrategyWorkspaceCurrentPanelState
  executionContextState: StrategyWorkspaceExecutionContextState | null
  actions: StrategyWorkspaceActions
}

export default function StrategyWorkspaceContainer({
  activeSectionKey,
  strategies,
  selectedStrategy,
  onSelectStrategyId,
  currentPanelState,
  executionContextState,
  actions,
}: StrategyWorkspaceContainerProps) {
  const currentPanelProps = selectedStrategy && executionContextState
    ? {
        selectedStrategy,
        summaryState: currentPanelState.summaryState,
        actionsState: currentPanelState.actionsState,
        notesState: currentPanelState.notesState,
        executionContextProps: {
          ...executionContextState,
          onOpenChangeRequest: actions.onOpenChangeRequest,
          onOpenBacktestDetail: actions.onOpenBacktestDetail,
          onOpenSourceReview: actions.onOpenSourceReview,
          onOpenStrategyProposal: actions.onOpenStrategyProposal,
          onOpenAiSchedulerJob: actions.onOpenAiSchedulerJob,
          onOpenReviewInspector: actions.onOpenReviewInspector,
          onRetryAgentJob: actions.onRetryAgentJob,
          onHandleProposalAction: actions.onHandleProposalAction,
          onRerunBacktestFromRecommendation: actions.onRerunBacktestFromRecommendation,
          onRerunBacktestFromChangeRequest: actions.onRerunBacktestFromChangeRequest,
        },
        onOpenStrategyEditor: actions.onOpenStrategyEditor,
        onExecuteSelectedStrategySignal: actions.onExecuteSelectedStrategySignal,
        onOpenStrategyActivityPanel: actions.onOpenStrategyActivityPanel,
        onOpenStrategyTrackingPanel: actions.onOpenStrategyTrackingPanel,
        onRestartStrategyRuntimeWorker: actions.onRestartStrategyRuntimeWorker,
        onSubmitBacktest: actions.onSubmitBacktest,
        onToggleStrategyStatus: actions.onToggleStrategyStatus,
        onOpenReplayReview: actions.onOpenReplayReview,
        onOpenChangeRequest: actions.onOpenChangeRequest,
        onOpenBacktestDetail: actions.onOpenBacktestDetail,
        onOpenSourceReview: actions.onOpenSourceReview,
        onOpenStrategyProposal: actions.onOpenStrategyProposal,
        onRerunBacktestFromReview: actions.onRerunBacktestFromReview,
      }
    : null

  return (
    <StrategyWorkspaceSection
      activeSectionKey={activeSectionKey}
      strategies={strategies}
      selectedStrategy={selectedStrategy}
      onSelectStrategyId={onSelectStrategyId}
      currentPanelProps={currentPanelProps}
    />
  )
}

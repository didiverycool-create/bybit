import type { Dispatch, ReactNode, SetStateAction } from 'react'

import type { StrategyRuntimeSnapshot, StrategySummary } from '../types'

type ActionTone = 'success' | 'warning' | 'error'
type StrategyTrackingKind = 'issue' | 'change'

type SubmitStrategyRequest = (
  type: string,
  summary: string,
  payload: Record<string, unknown>,
  priority?: 'low' | 'normal' | 'high' | 'critical',
) => Promise<void>

type LatestSchedulerCommandMeta = {
  jobId: string | null
  linkedReviewId: string | null
  strategyId: string | null
  backtestId: string | null
  sourceChangeRequestId: string | null
  sourceBacktestId: string | null
  sourceReviewId: string | null
  sourceProposalId: string | null
} | null

type UseStrategyWorkspaceActionsArgs = {
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

export function useStrategyWorkspaceActions({
  latestSchedulerCommand,
  selectedStrategy,
  selectedStrategyRuntime,
  parameterDraftPatch,
  hasParameterDraftChanges,
  riskBudgetDraft,
  resetStrategyTrackingDraft,
  setSelectedSymbol,
  setActiveSection,
  setStrategyEditorOpen,
  setStrategyActivityPanelOpen,
  setStrategyTrackingPanelOpen,
  showFeedback,
  submitStrategyRequest,
  openAiSchedulerJob,
  openReviewInspector,
  openBacktestDetail,
  openChangeRequest,
  openSourceReview,
  openStrategyProposal,
  openStrategyActivity,
}: UseStrategyWorkspaceActionsArgs) {
  const openStrategyTrackingPanel = (kind: StrategyTrackingKind = 'issue') => {
    const defaultSummary =
      kind === 'issue'
        ? `${selectedStrategy?.name ?? '当前策略'} 需要继续跟踪当前执行问题`
        : `${selectedStrategy?.name ?? '当前策略'} 最近有一项变更需要继续跟踪`
    const defaultDetail =
      kind === 'issue'
        ? selectedStrategyRuntime?.guard_detail ||
          selectedStrategyRuntime?.last_execution_detail ||
          selectedStrategyRuntime?.note ||
          ''
        : selectedStrategyRuntime?.note || ''
    resetStrategyTrackingDraft(kind, defaultSummary, defaultDetail)
    if (selectedStrategy?.symbols[0]) {
      setSelectedSymbol(selectedStrategy.symbols[0])
    }
    setActiveSection('strategy')
    setStrategyEditorOpen(false)
    setStrategyActivityPanelOpen(false)
    setStrategyTrackingPanelOpen(true)
  }

  const submitSelectedStrategyParameterUpdate = () => {
    if (!selectedStrategy) {
      return
    }
    if (!hasParameterDraftChanges) {
      showFeedback('warning', '没有可提交的参数变更', '你还没有修改当前策略参数。')
      return
    }
    void submitStrategyRequest(
      'strategy.parameter.update',
      `更新 ${selectedStrategy.name} 参数`,
      {
        strategy_id: selectedStrategy.id,
        parameter_patch: parameterDraftPatch,
      },
    )
  }

  const submitSelectedStrategyRiskUpdate = () => {
    if (!selectedStrategy) {
      return
    }
    void submitStrategyRequest(
      'strategy.risk_update',
      `${selectedStrategy.name} 更新风控边界`,
      { strategy_id: selectedStrategy.id, risk_budget: riskBudgetDraft },
      'high',
    )
  }

  const renderLatestSchedulerCommandActions = (buttonClass = 'ghost-button ghost-button--inline'): ReactNode => {
    if (!latestSchedulerCommand) {
      return null
    }
    return (
      <div className="inline-actions inline-actions--tight">
        {latestSchedulerCommand.jobId && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => openAiSchedulerJob(latestSchedulerCommand.jobId!)}
          >
            打开任务
          </button>
        )}
        {latestSchedulerCommand.linkedReviewId && latestSchedulerCommand.strategyId && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => openReviewInspector(latestSchedulerCommand.linkedReviewId!, latestSchedulerCommand.strategyId)}
          >
            查看结果
          </button>
        )}
        {latestSchedulerCommand.backtestId && latestSchedulerCommand.strategyId && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => openBacktestDetail(latestSchedulerCommand.backtestId!, latestSchedulerCommand.strategyId)}
          >
            打开回测
          </button>
        )}
        {latestSchedulerCommand.sourceChangeRequestId && latestSchedulerCommand.strategyId && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => openChangeRequest(latestSchedulerCommand.sourceChangeRequestId!, latestSchedulerCommand.strategyId)}
          >
            来源变更
          </button>
        )}
        {latestSchedulerCommand.sourceBacktestId &&
          latestSchedulerCommand.strategyId &&
          latestSchedulerCommand.sourceBacktestId !== latestSchedulerCommand.backtestId && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => openBacktestDetail(latestSchedulerCommand.sourceBacktestId!, latestSchedulerCommand.strategyId)}
            >
              来源回测
            </button>
          )}
        {latestSchedulerCommand.sourceReviewId &&
          latestSchedulerCommand.strategyId &&
          latestSchedulerCommand.sourceReviewId !== latestSchedulerCommand.linkedReviewId && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => openSourceReview(latestSchedulerCommand.sourceReviewId!, latestSchedulerCommand.strategyId)}
            >
              来源复盘
            </button>
          )}
        {latestSchedulerCommand.sourceProposalId && latestSchedulerCommand.strategyId && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => openStrategyProposal(latestSchedulerCommand.sourceProposalId!, latestSchedulerCommand.strategyId)}
          >
            来源提案
          </button>
        )}
        {latestSchedulerCommand.strategyId && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => openStrategyActivity(latestSchedulerCommand.strategyId!)}
          >
            打开策略
          </button>
        )}
      </div>
    )
  }

  return {
    openStrategyTrackingPanel,
    submitSelectedStrategyParameterUpdate,
    submitSelectedStrategyRiskUpdate,
    renderLatestSchedulerCommandActions,
  }
}

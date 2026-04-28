import type {
  StrategyTrackingKind,
  StrategyWorkspaceActionHandlers,
  UseStrategyWorkspaceActionsArgs,
} from './strategyWorkspaceActionsShared'

export function buildStrategyWorkspaceActionHandlers({
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
}: UseStrategyWorkspaceActionsArgs): StrategyWorkspaceActionHandlers {
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

  return {
    openStrategyTrackingPanel,
    submitSelectedStrategyParameterUpdate,
    submitSelectedStrategyRiskUpdate,
  }
}

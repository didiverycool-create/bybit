import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'

export type WorkspaceSectionSurfaceSourceGroups = {
  workspaceSectionCoreSource: Pick<
    BuildAppPresentationModelsArgs,
    'selectedStrategy' | 'news'
  >
  workspaceSectionActionSource: {
    navigationActions: BuildAppPresentationModelsArgs['workspaceNavigation']
    strategyWorkspaceActions: Pick<
      BuildAppPresentationModelsArgs['strategyWorkspaceActions'],
      'openStrategyTrackingPanel'
    >
    strategyWorkflowActions: BuildAppPresentationModelsArgs['strategyWorkflowActions']
    workspaceControlActions: BuildAppPresentationModelsArgs['workspaceControlActions']
    tradingExecutionActions: BuildAppPresentationModelsArgs['tradingExecutionActions']
    marketSelectionActions: {
      onSelectMarketSymbol: BuildAppPresentationModelsArgs['handleSelectMarketSymbol']
      onSelectMarketTimeframe: BuildAppPresentationModelsArgs['handleSelectMarketTimeframe']
    }
    settingsPersistenceActions: {
      syncWorkspacePreferences: BuildAppPresentationModelsArgs['syncWorkspacePreferences']
      restoreDefaultWorkspace: BuildAppPresentationModelsArgs['restoreDefaultWorkspace']
      onOpenLocalPath: BuildAppPresentationModelsArgs['openLocalPath']
    }
  }
  workspaceSectionSetterSource: {
    setSelectedMode: BuildAppPresentationModelsArgs['setSelectedMode']
    setLayoutPreset: BuildAppPresentationModelsArgs['setLayoutPreset']
    setSelectedStrategyId: BuildAppPresentationModelsArgs['setSelectedStrategyId']
    setSelectedBacktestId: BuildAppPresentationModelsArgs['setSelectedBacktestId']
    setBacktestFilter: BuildAppPresentationModelsArgs['setBacktestFilter']
    setBacktestTimeframeDraft: BuildAppPresentationModelsArgs['setBacktestTimeframeDraft']
    setBacktestRangeDraft: BuildAppPresentationModelsArgs['setBacktestRangeDraft']
    setWatchlistManagerOpen: BuildAppPresentationModelsArgs['setWatchlistManagerOpen']
    setManualTradePanelOpen: BuildAppPresentationModelsArgs['setManualTradePanelOpen']
    setEditingOrderId: BuildAppPresentationModelsArgs['setEditingOrderId']
    setSchedulerControlsOpen: BuildAppPresentationModelsArgs['setSchedulerControlsOpen']
    setGrafanaPreviewOpen: BuildAppPresentationModelsArgs['setGrafanaPreviewOpen']
    setStrategyActivityPanelOpen: BuildAppPresentationModelsArgs['setStrategyActivityPanelOpen']
    setSettingsDraft: BuildAppPresentationModelsArgs['setSettingsDraft']
    setAlertSeverityFilter: BuildAppPresentationModelsArgs['setAlertSeverityFilter']
    setAlertStatusFilter: BuildAppPresentationModelsArgs['setAlertStatusFilter']
    setAlertScopeFilter: BuildAppPresentationModelsArgs['setAlertScopeFilter']
    setTradeModeFilter: BuildAppPresentationModelsArgs['setTradeModeFilter']
    setTradeOriginFilter: BuildAppPresentationModelsArgs['setTradeOriginFilter']
    setTradeScopeFilter: BuildAppPresentationModelsArgs['setTradeScopeFilter']
    setReplayTrackingScope: BuildAppPresentationModelsArgs['setReplayTrackingScope']
    setAccountInspectorOpen: BuildAppPresentationModelsArgs['setAccountInspectorOpen']
    setOrderHistoryPanelOpen: BuildAppPresentationModelsArgs['setOrderHistoryPanelOpen']
    setAuditSeverityFilter: BuildAppPresentationModelsArgs['setAuditSeverityFilter']
    setAuditSourceFilter: BuildAppPresentationModelsArgs['setAuditSourceFilter']
    setAuditScopeFilter: BuildAppPresentationModelsArgs['setAuditScopeFilter']
    setAuditSearch: BuildAppPresentationModelsArgs['setAuditSearch']
  }
}

export function buildWorkspaceSectionSurfaceSourceGroups({
  selectedStrategy,
  news,
  workspaceNavigation,
  strategyWorkspaceActions,
  strategyWorkflowActions,
  workspaceControlActions,
  tradingExecutionActions,
  handleSelectMarketSymbol,
  handleSelectMarketTimeframe,
  syncWorkspacePreferences,
  restoreDefaultWorkspace,
  openLocalPath,
  setSelectedMode,
  setLayoutPreset,
  setSelectedStrategyId,
  setSelectedBacktestId,
  setBacktestFilter,
  setBacktestTimeframeDraft,
  setBacktestRangeDraft,
  setWatchlistManagerOpen,
  setManualTradePanelOpen,
  setEditingOrderId,
  setSchedulerControlsOpen,
  setGrafanaPreviewOpen,
  setStrategyActivityPanelOpen,
  setSettingsDraft,
  setAlertSeverityFilter,
  setAlertStatusFilter,
  setAlertScopeFilter,
  setTradeModeFilter,
  setTradeOriginFilter,
  setTradeScopeFilter,
  setReplayTrackingScope,
  setAccountInspectorOpen,
  setOrderHistoryPanelOpen,
  setAuditSeverityFilter,
  setAuditSourceFilter,
  setAuditScopeFilter,
  setAuditSearch,
}: BuildAppPresentationModelsArgs): WorkspaceSectionSurfaceSourceGroups {
  return {
    workspaceSectionCoreSource: {
      selectedStrategy,
      news,
    },
    workspaceSectionActionSource: {
      navigationActions: workspaceNavigation,
      strategyWorkspaceActions: {
        openStrategyTrackingPanel: strategyWorkspaceActions.openStrategyTrackingPanel,
      },
      strategyWorkflowActions,
      workspaceControlActions,
      tradingExecutionActions,
      marketSelectionActions: {
        onSelectMarketSymbol: handleSelectMarketSymbol,
        onSelectMarketTimeframe: handleSelectMarketTimeframe,
      },
      settingsPersistenceActions: {
        syncWorkspacePreferences,
        restoreDefaultWorkspace,
        onOpenLocalPath: openLocalPath,
      },
    },
    workspaceSectionSetterSource: {
      setSelectedMode,
      setLayoutPreset,
      setSelectedStrategyId,
      setSelectedBacktestId,
      setBacktestFilter,
      setBacktestTimeframeDraft,
      setBacktestRangeDraft,
      setWatchlistManagerOpen,
      setManualTradePanelOpen,
      setEditingOrderId,
      setSchedulerControlsOpen,
      setGrafanaPreviewOpen,
      setStrategyActivityPanelOpen,
      setSettingsDraft,
      setAlertSeverityFilter,
      setAlertStatusFilter,
      setAlertScopeFilter,
      setTradeModeFilter,
      setTradeOriginFilter,
      setTradeScopeFilter,
      setReplayTrackingScope,
      setAccountInspectorOpen,
      setOrderHistoryPanelOpen,
      setAuditSeverityFilter,
      setAuditSourceFilter,
      setAuditScopeFilter,
      setAuditSearch,
    },
  }
}

import { type ComponentProps, type Dispatch, type SetStateAction } from 'react'

import type { LayoutPreset, Mode, StrategySummary } from '../types'
import type { BuildAlertsWorkspacePropsArgs } from './buildAlertsWorkspaceProps'
import type { BuildAuditWorkspacePropsArgs } from './buildAuditWorkspaceProps'
import type { BuildBacktestWorkspacePropsArgs } from './buildBacktestWorkspaceProps'
import type { BuildMarketWorkspacePropsArgs } from './buildMarketWorkspaceProps'
import type { BuildOverviewWorkspacePropsArgs } from './buildOverviewWorkspaceProps'
import type { BuildReplayWorkspacePropsArgs } from './buildReplayWorkspaceProps'
import type { BuildSchedulerWorkspacePropsArgs } from './buildSchedulerWorkspaceProps'
import type { BuildSettingsWorkspacePropsArgs } from './buildSettingsWorkspaceProps'
import type { BuildStrategyWorkspacePropsArgs } from './buildStrategyWorkspaceProps'
import type { BuildTradesWorkspacePropsArgs } from './buildTradesWorkspaceProps'
import { buildWorkspaceSectionActionConsumerGroups } from './buildWorkspaceSectionActionConsumerGroups'
import { buildWorkspaceOpsSectionActions } from './buildWorkspaceOpsSectionActions'
import { buildWorkspaceStrategySectionActions } from './buildWorkspaceStrategySectionActions'
import type NewsWorkspaceContainer from './NewsWorkspaceContainer'
import type { useStrategyWorkflowActions } from './useStrategyWorkflowActions'
import type { useStrategyWorkspaceActions } from './useStrategyWorkspaceActions'
import type { useTradingExecutionActions } from './useTradingExecutionActions'
import type { useWorkspaceControlActions } from './useWorkspaceControlActions'
import type { useWorkspaceNavigation } from './useWorkspaceNavigation'

type StrategyWorkspaceActions = BuildStrategyWorkspacePropsArgs['actions']
type BacktestWorkspaceActions = BuildBacktestWorkspacePropsArgs['actions']
type SchedulerWorkspaceActions = BuildSchedulerWorkspacePropsArgs['actions']
type OverviewWorkspaceActions = BuildOverviewWorkspacePropsArgs['actions']
type SettingsWorkspaceActions = BuildSettingsWorkspacePropsArgs['actions']
type MarketWorkspaceActions = BuildMarketWorkspacePropsArgs['actions']
type AlertsWorkspaceActions = BuildAlertsWorkspacePropsArgs['actions']
type TradesWorkspaceActions = BuildTradesWorkspacePropsArgs['actions']
type ReplayWorkspaceActions = BuildReplayWorkspacePropsArgs['actions']
type AuditWorkspaceActions = BuildAuditWorkspacePropsArgs['actions']
type NewsWorkspaceProps = ComponentProps<typeof NewsWorkspaceContainer>

type WorkspaceNavigationModel = ReturnType<typeof useWorkspaceNavigation>
type StrategyWorkflowActionsModel = ReturnType<typeof useStrategyWorkflowActions>
type StrategyWorkspaceActionsModel = ReturnType<typeof useStrategyWorkspaceActions>
type WorkspaceControlActionsModel = ReturnType<typeof useWorkspaceControlActions>
type TradingExecutionActionsModel = ReturnType<typeof useTradingExecutionActions>

export type BuildWorkspaceSectionActionsArgs = {
  selectedStrategy: StrategySummary | null
  news: NewsWorkspaceProps['news']
  navigationActions: Pick<
    WorkspaceNavigationModel,
    | 'openSection'
    | 'openStrategyEditor'
    | 'openStrategyActivity'
    | 'openStrategyReplay'
    | 'openReplayReview'
    | 'openBacktestDetail'
    | 'openSourceReview'
    | 'openStrategyProposal'
    | 'openChangeRequest'
    | 'openReviewInspector'
    | 'openAiSchedulerJob'
    | 'openMarketSymbol'
  >
  strategyWorkspaceActionState: Pick<StrategyWorkspaceActionsModel, 'openStrategyTrackingPanel'>
  strategyWorkflowActions: Pick<
    StrategyWorkflowActionsModel,
    | 'executeSelectedStrategySignal'
    | 'submitStrategyRequest'
    | 'submitBacktest'
    | 'rerunBacktestFromRecommendation'
    | 'rerunBacktestFromReview'
    | 'rerunBacktestFromChangeRequest'
    | 'submitReviewJob'
    | 'retryAgentJob'
    | 'handleProposalAction'
  >
  workspaceControlActions: Pick<
    WorkspaceControlActionsModel,
    | 'runSchedulerCommand'
    | 'restartStrategyRuntimeWorker'
    | 'toggleSettingsNotificationChannel'
    | 'restoreSettingsDraft'
    | 'saveSettings'
    | 'triggerDesktopNotificationTest'
    | 'toggleAlertAcknowledged'
  >
  tradingExecutionActions: Pick<
    TradingExecutionActionsModel,
    | 'openOrderEditor'
    | 'closePaperPosition'
    | 'closeExchangePosition'
    | 'closeAllPaperPositions'
    | 'closeAllExchangePositions'
    | 'cancelPaperOrder'
    | 'cancelExchangeOrder'
    | 'cancelAllExchangeOrders'
    | 'cancelAllPaperOrders'
  >
  marketSelectionActions: Pick<
    OverviewWorkspaceActions,
    'onSelectMarketSymbol' | 'onSelectMarketTimeframe'
  >
  settingsPersistenceActions: {
    syncWorkspacePreferences: () => unknown
    restoreDefaultWorkspace: SettingsWorkspaceActions['onRestoreDefaultWorkspace']
    onOpenLocalPath: SettingsWorkspaceActions['onOpenLocalPath']
  }
  setters: {
    setSelectedMode: Dispatch<SetStateAction<Mode>>
    setLayoutPreset: Dispatch<SetStateAction<LayoutPreset>>
    setSelectedStrategyId: BuildStrategyWorkspacePropsArgs['onSelectStrategyId']
    setSelectedBacktestId: Dispatch<SetStateAction<string | null>>
    setBacktestFilter: Dispatch<SetStateAction<'selected' | 'all'>>
    setBacktestTimeframeDraft: Dispatch<SetStateAction<string>>
    setBacktestRangeDraft: Dispatch<SetStateAction<string>>
    setWatchlistManagerOpen: Dispatch<SetStateAction<boolean>>
    setManualTradePanelOpen: Dispatch<SetStateAction<boolean>>
    setEditingOrderId: Dispatch<SetStateAction<string | null>>
    setSchedulerControlsOpen: Dispatch<SetStateAction<boolean>>
    setGrafanaPreviewOpen: Dispatch<SetStateAction<boolean>>
    setStrategyActivityPanelOpen: Dispatch<SetStateAction<boolean>>
    setSettingsDraft: SettingsWorkspaceActions['setSettingsDraft']
    setAlertSeverityFilter: AlertsWorkspaceActions['onAlertSeverityFilterChange']
    setAlertStatusFilter: AlertsWorkspaceActions['onAlertStatusFilterChange']
    setAlertScopeFilter: Dispatch<SetStateAction<'all' | 'selected'>>
    setTradeModeFilter: TradesWorkspaceActions['onTradeModeFilterChange']
    setTradeOriginFilter: TradesWorkspaceActions['onTradeOriginFilterChange']
    setTradeScopeFilter: Dispatch<SetStateAction<'all' | 'selected'>>
    setReplayTrackingScope: ReplayWorkspaceActions['onSetReplayTrackingScope']
    setAccountInspectorOpen: Dispatch<SetStateAction<boolean>>
    setOrderHistoryPanelOpen: Dispatch<SetStateAction<boolean>>
    setAuditSeverityFilter: AuditWorkspaceActions['onAuditSeverityFilterChange']
    setAuditSourceFilter: AuditWorkspaceActions['onAuditSourceFilterChange']
    setAuditScopeFilter: Dispatch<SetStateAction<'all' | 'selected'>>
    setAuditSearch: AuditWorkspaceActions['onAuditSearchChange']
  }
}

export type BuildWorkspaceSectionActionsResult = {
  strategyWorkspaceActions: StrategyWorkspaceActions
  backtestWorkspaceActions: BacktestWorkspaceActions
  schedulerWorkspaceActions: SchedulerWorkspaceActions
  overviewWorkspaceActions: OverviewWorkspaceActions
  settingsWorkspaceActions: SettingsWorkspaceActions
  marketWorkspaceActions: MarketWorkspaceActions
  alertsWorkspaceActions: AlertsWorkspaceActions
  tradesWorkspaceActions: TradesWorkspaceActions
  replayWorkspaceActions: ReplayWorkspaceActions
  auditWorkspaceActions: AuditWorkspaceActions
  newsWorkspaceProps: NewsWorkspaceProps
}

export function buildWorkspaceSectionActions({
  selectedStrategy,
  news,
  navigationActions,
  strategyWorkspaceActionState,
  strategyWorkflowActions,
  workspaceControlActions,
  tradingExecutionActions,
  marketSelectionActions,
  settingsPersistenceActions,
  setters,
}: BuildWorkspaceSectionActionsArgs): BuildWorkspaceSectionActionsResult {
  const { strategyConsumerArgs, opsConsumerArgs } =
    buildWorkspaceSectionActionConsumerGroups({
      selectedStrategy,
      news,
      navigationActions,
      strategyWorkspaceActionState,
      strategyWorkflowActions,
      workspaceControlActions,
      tradingExecutionActions,
      marketSelectionActions,
      settingsPersistenceActions,
      setters,
    })

  return {
    ...buildWorkspaceStrategySectionActions(strategyConsumerArgs),
    ...buildWorkspaceOpsSectionActions(opsConsumerArgs),
  }
}

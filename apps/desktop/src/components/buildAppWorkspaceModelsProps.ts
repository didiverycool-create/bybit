import { buildAlertsWorkspaceProps, type BuildAlertsWorkspacePropsArgs } from './buildAlertsWorkspaceProps'
import { buildAuditWorkspaceProps, type BuildAuditWorkspacePropsArgs } from './buildAuditWorkspaceProps'
import { buildBacktestWorkspaceProps, type BuildBacktestWorkspacePropsArgs } from './buildBacktestWorkspaceProps'
import { buildMarketWorkspaceProps, type BuildMarketWorkspacePropsArgs } from './buildMarketWorkspaceProps'
import { buildOverviewWorkspaceProps, type BuildOverviewWorkspacePropsArgs } from './buildOverviewWorkspaceProps'
import { buildReplayWorkspaceProps, type BuildReplayWorkspacePropsArgs } from './buildReplayWorkspaceProps'
import { buildSchedulerWorkspaceProps, type BuildSchedulerWorkspacePropsArgs } from './buildSchedulerWorkspaceProps'
import { buildSettingsWorkspaceProps, type BuildSettingsWorkspacePropsArgs } from './buildSettingsWorkspaceProps'
import { buildStrategyWorkspaceProps, type BuildStrategyWorkspacePropsArgs } from './buildStrategyWorkspaceProps'
import { buildTradesWorkspaceProps, type BuildTradesWorkspacePropsArgs } from './buildTradesWorkspaceProps'
import type { BuildBacktestWorkspaceDerivedStateResult } from './buildBacktestWorkspaceDerivedState'
import type { BuildAppWorkspaceModelsResult } from './buildAppWorkspaceModels'
import type { BuildWorkspaceSectionActionsResult } from './buildWorkspaceSectionActions'

type StrategyWorkspaceBaseArgs = Omit<BuildStrategyWorkspacePropsArgs, 'actions'>
type BacktestWorkspaceBaseArgs = Omit<
  BuildBacktestWorkspacePropsArgs,
  'actions' | 'draftState' | 'workspaceState'
>
type SchedulerWorkspaceBaseArgs = Omit<BuildSchedulerWorkspacePropsArgs, 'actions'>
type OverviewWorkspaceBaseArgs = Omit<BuildOverviewWorkspacePropsArgs, 'actions'>
type SettingsWorkspaceBaseArgs = Omit<BuildSettingsWorkspacePropsArgs, 'actions'>
type MarketWorkspaceBaseArgs = Omit<BuildMarketWorkspacePropsArgs, 'actions'>
type AlertsWorkspaceBaseArgs = Omit<BuildAlertsWorkspacePropsArgs, 'actions'>
type TradesWorkspaceBaseArgs = Omit<BuildTradesWorkspacePropsArgs, 'actions'>
type ReplayWorkspaceBaseArgs = Omit<BuildReplayWorkspacePropsArgs, 'actions'>
type AuditWorkspaceBaseArgs = Omit<BuildAuditWorkspacePropsArgs, 'actions'>

export type BuildAppWorkspaceModelsPropsArgs = {
  workspaceSectionActions: BuildWorkspaceSectionActionsResult
  strategyWorkspace: StrategyWorkspaceBaseArgs
  backtestWorkspace: BacktestWorkspaceBaseArgs &
    Pick<BuildBacktestWorkspaceDerivedStateResult, 'draftState' | 'workspaceState'>
  schedulerWorkspace: SchedulerWorkspaceBaseArgs
  overviewWorkspace: OverviewWorkspaceBaseArgs
  settingsWorkspace: SettingsWorkspaceBaseArgs
  marketWorkspace: MarketWorkspaceBaseArgs
  alertsWorkspace: AlertsWorkspaceBaseArgs
  tradesWorkspace: TradesWorkspaceBaseArgs
  replayWorkspace: ReplayWorkspaceBaseArgs
  auditWorkspace: AuditWorkspaceBaseArgs
}

export function buildAppWorkspaceModelsProps({
  workspaceSectionActions,
  strategyWorkspace,
  backtestWorkspace,
  schedulerWorkspace,
  overviewWorkspace,
  settingsWorkspace,
  marketWorkspace,
  alertsWorkspace,
  tradesWorkspace,
  replayWorkspace,
  auditWorkspace,
}: BuildAppWorkspaceModelsPropsArgs): BuildAppWorkspaceModelsResult {
  return {
    strategyWorkspaceProps: buildStrategyWorkspaceProps({
      ...strategyWorkspace,
      actions: workspaceSectionActions.strategyWorkspaceActions,
    }),
    backtestWorkspaceProps: buildBacktestWorkspaceProps({
      ...backtestWorkspace,
      actions: workspaceSectionActions.backtestWorkspaceActions,
    }),
    schedulerWorkspaceProps: buildSchedulerWorkspaceProps({
      ...schedulerWorkspace,
      actions: workspaceSectionActions.schedulerWorkspaceActions,
    }),
    overviewWorkspaceProps: buildOverviewWorkspaceProps({
      ...overviewWorkspace,
      actions: workspaceSectionActions.overviewWorkspaceActions,
    }),
    settingsWorkspaceProps: buildSettingsWorkspaceProps({
      ...settingsWorkspace,
      actions: workspaceSectionActions.settingsWorkspaceActions,
    }),
    marketWorkspaceProps: buildMarketWorkspaceProps({
      ...marketWorkspace,
      actions: workspaceSectionActions.marketWorkspaceActions,
    }),
    alertsWorkspaceProps: buildAlertsWorkspaceProps({
      ...alertsWorkspace,
      actions: workspaceSectionActions.alertsWorkspaceActions,
    }),
    tradesWorkspaceProps: buildTradesWorkspaceProps({
      ...tradesWorkspace,
      actions: workspaceSectionActions.tradesWorkspaceActions,
    }),
    replayWorkspaceProps: buildReplayWorkspaceProps({
      ...replayWorkspace,
      actions: workspaceSectionActions.replayWorkspaceActions,
    }),
    auditWorkspaceProps: buildAuditWorkspaceProps({
      ...auditWorkspace,
      actions: workspaceSectionActions.auditWorkspaceActions,
    }),
    newsWorkspaceProps: workspaceSectionActions.newsWorkspaceProps,
  }
}

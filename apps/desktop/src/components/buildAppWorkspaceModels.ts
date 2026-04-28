import {
  buildAlertsWorkspaceProps,
  type BuildAlertsWorkspacePropsArgs,
} from './buildAlertsWorkspaceProps'
import {
  buildAuditWorkspaceProps,
  type BuildAuditWorkspacePropsArgs,
} from './buildAuditWorkspaceProps'
import {
  buildBacktestWorkspaceDerivedState,
  type BuildBacktestWorkspaceDerivedStateArgs,
} from './buildBacktestWorkspaceDerivedState'
import {
  buildBacktestWorkspaceProps,
  type BuildBacktestWorkspacePropsArgs,
} from './buildBacktestWorkspaceProps'
import {
  buildMarketWorkspaceProps,
  type BuildMarketWorkspacePropsArgs,
} from './buildMarketWorkspaceProps'
import {
  buildOverviewWorkspaceProps,
  type BuildOverviewWorkspacePropsArgs,
} from './buildOverviewWorkspaceProps'
import {
  buildReplayWorkspaceProps,
  type BuildReplayWorkspacePropsArgs,
} from './buildReplayWorkspaceProps'
import {
  buildSchedulerWorkspaceProps,
  type BuildSchedulerWorkspacePropsArgs,
} from './buildSchedulerWorkspaceProps'
import {
  buildSettingsWorkspaceProps,
  type BuildSettingsWorkspacePropsArgs,
} from './buildSettingsWorkspaceProps'
import {
  buildStrategyWorkspaceProps,
  type BuildStrategyWorkspacePropsArgs,
} from './buildStrategyWorkspaceProps'
import {
  buildTradesWorkspaceProps,
  type BuildTradesWorkspacePropsArgs,
} from './buildTradesWorkspaceProps'
import {
  buildWorkspaceSectionActions,
  type BuildWorkspaceSectionActionsArgs,
} from './buildWorkspaceSectionActions'
import {
  buildAppWorkspaceModelsProps,
} from './buildAppWorkspaceModelsProps'

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

export type BuildAppWorkspaceModelsArgs = {
  workspaceSectionActionsArgs: BuildWorkspaceSectionActionsArgs
  strategyWorkspace: {
    baseArgs: StrategyWorkspaceBaseArgs
  }
  backtestWorkspace: {
    baseArgs: BacktestWorkspaceBaseArgs
    derivedStateArgs: BuildBacktestWorkspaceDerivedStateArgs
  }
  schedulerWorkspace: {
    baseArgs: SchedulerWorkspaceBaseArgs
  }
  overviewWorkspace: {
    baseArgs: OverviewWorkspaceBaseArgs
  }
  settingsWorkspace: {
    baseArgs: SettingsWorkspaceBaseArgs
  }
  marketWorkspace: {
    baseArgs: MarketWorkspaceBaseArgs
  }
  alertsWorkspace: {
    baseArgs: AlertsWorkspaceBaseArgs
  }
  tradesWorkspace: {
    baseArgs: TradesWorkspaceBaseArgs
  }
  replayWorkspace: {
    baseArgs: ReplayWorkspaceBaseArgs
  }
  auditWorkspace: {
    baseArgs: AuditWorkspaceBaseArgs
  }
}

export type BuildAppWorkspaceModelsResult = {
  strategyWorkspaceProps: ReturnType<typeof buildStrategyWorkspaceProps>
  backtestWorkspaceProps: ReturnType<typeof buildBacktestWorkspaceProps>
  schedulerWorkspaceProps: ReturnType<typeof buildSchedulerWorkspaceProps>
  overviewWorkspaceProps: ReturnType<typeof buildOverviewWorkspaceProps>
  settingsWorkspaceProps: ReturnType<typeof buildSettingsWorkspaceProps>
  marketWorkspaceProps: ReturnType<typeof buildMarketWorkspaceProps>
  alertsWorkspaceProps: ReturnType<typeof buildAlertsWorkspaceProps>
  tradesWorkspaceProps: ReturnType<typeof buildTradesWorkspaceProps>
  replayWorkspaceProps: ReturnType<typeof buildReplayWorkspaceProps>
  auditWorkspaceProps: ReturnType<typeof buildAuditWorkspaceProps>
  newsWorkspaceProps: ReturnType<typeof buildWorkspaceSectionActions>['newsWorkspaceProps']
}

export function buildAppWorkspaceModels({
  workspaceSectionActionsArgs,
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
}: BuildAppWorkspaceModelsArgs): BuildAppWorkspaceModelsResult {
  const workspaceSectionActions = buildWorkspaceSectionActions(workspaceSectionActionsArgs)
  const { draftState: backtestWorkspaceDraftState, workspaceState: backtestWorkspaceState } =
    buildBacktestWorkspaceDerivedState(backtestWorkspace.derivedStateArgs)
  return buildAppWorkspaceModelsProps({
    workspaceSectionActions,
    strategyWorkspace: strategyWorkspace.baseArgs,
    backtestWorkspace: {
      ...backtestWorkspace.baseArgs,
      draftState: backtestWorkspaceDraftState,
      workspaceState: backtestWorkspaceState,
    },
    schedulerWorkspace: schedulerWorkspace.baseArgs,
    overviewWorkspace: overviewWorkspace.baseArgs,
    settingsWorkspace: settingsWorkspace.baseArgs,
    marketWorkspace: marketWorkspace.baseArgs,
    alertsWorkspace: alertsWorkspace.baseArgs,
    tradesWorkspace: tradesWorkspace.baseArgs,
    replayWorkspace: replayWorkspace.baseArgs,
    auditWorkspace: auditWorkspace.baseArgs,
  })
}

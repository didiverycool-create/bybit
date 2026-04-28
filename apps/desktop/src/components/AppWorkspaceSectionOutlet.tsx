import { Suspense, lazy, type ComponentProps } from 'react'

import AppChromeShell from './AppChromeShell'
import OverviewWorkspaceContainer from './OverviewWorkspaceContainer'

const AlertsWorkspaceContainer = lazy(() => import('./AlertsWorkspaceContainer'))
const AuditWorkspaceContainer = lazy(() => import('./AuditWorkspaceContainer'))
const BacktestWorkspaceContainer = lazy(() => import('./BacktestWorkspaceContainer'))
const MarketWorkspaceContainer = lazy(() => import('./MarketWorkspaceContainer'))
const NewsWorkspaceContainer = lazy(() => import('./NewsWorkspaceContainer'))
const ReplayWorkspaceContainer = lazy(() => import('./ReplayWorkspaceContainer'))
const SchedulerWorkspaceContainer = lazy(() => import('./SchedulerWorkspaceContainer'))
const SettingsWorkspaceContainer = lazy(() => import('./SettingsWorkspaceContainer'))
const StrategyWorkspaceContainer = lazy(() => import('./StrategyWorkspaceContainer'))
const TradesWorkspaceContainer = lazy(() => import('./TradesWorkspaceContainer'))

type ChromeProps = ComponentProps<typeof AppChromeShell>

export type AppWorkspaceSectionOutletProps = Pick<ChromeProps, 'activeSection'> & {
  overviewWorkspaceProps: ComponentProps<typeof OverviewWorkspaceContainer>
  settingsWorkspaceProps: ComponentProps<typeof SettingsWorkspaceContainer>
  marketWorkspaceProps: ComponentProps<typeof MarketWorkspaceContainer>
  strategyWorkspaceProps: ComponentProps<typeof StrategyWorkspaceContainer>
  backtestWorkspaceProps: ComponentProps<typeof BacktestWorkspaceContainer>
  schedulerWorkspaceProps: ComponentProps<typeof SchedulerWorkspaceContainer>
  newsWorkspaceProps: ComponentProps<typeof NewsWorkspaceContainer>
  alertsWorkspaceProps: ComponentProps<typeof AlertsWorkspaceContainer>
  tradesWorkspaceProps: ComponentProps<typeof TradesWorkspaceContainer>
  replayWorkspaceProps: ComponentProps<typeof ReplayWorkspaceContainer>
  auditWorkspaceProps: ComponentProps<typeof AuditWorkspaceContainer>
}

const workspaceFallback = <div className="empty-state empty-state--inline">工作台加载中...</div>

export default function AppWorkspaceSectionOutlet({
  activeSection,
  overviewWorkspaceProps,
  settingsWorkspaceProps,
  marketWorkspaceProps,
  strategyWorkspaceProps,
  backtestWorkspaceProps,
  schedulerWorkspaceProps,
  newsWorkspaceProps,
  alertsWorkspaceProps,
  tradesWorkspaceProps,
  replayWorkspaceProps,
  auditWorkspaceProps,
}: AppWorkspaceSectionOutletProps) {
  return (
    <>
      {activeSection === 'overview' && (
        <OverviewWorkspaceContainer {...overviewWorkspaceProps} />
      )}

      {activeSection === 'settings' && (
        <Suspense fallback={workspaceFallback}>
          <SettingsWorkspaceContainer {...settingsWorkspaceProps} />
        </Suspense>
      )}

      {activeSection === 'market' && (
        <Suspense fallback={workspaceFallback}>
          <MarketWorkspaceContainer {...marketWorkspaceProps} />
        </Suspense>
      )}

      {activeSection === 'strategy' && (
        <Suspense fallback={workspaceFallback}>
          <StrategyWorkspaceContainer {...strategyWorkspaceProps} />
        </Suspense>
      )}

      {activeSection === 'backtest' && (
        <Suspense fallback={workspaceFallback}>
          <BacktestWorkspaceContainer {...backtestWorkspaceProps} />
        </Suspense>
      )}

      {activeSection === 'scheduler' && (
        <Suspense fallback={workspaceFallback}>
          <SchedulerWorkspaceContainer {...schedulerWorkspaceProps} />
        </Suspense>
      )}

      {activeSection === 'news' && (
        <Suspense fallback={workspaceFallback}>
          <NewsWorkspaceContainer {...newsWorkspaceProps} />
        </Suspense>
      )}

      {activeSection === 'alerts' && (
        <Suspense fallback={workspaceFallback}>
          <AlertsWorkspaceContainer {...alertsWorkspaceProps} />
        </Suspense>
      )}

      {activeSection === 'trades' && (
        <Suspense fallback={workspaceFallback}>
          <TradesWorkspaceContainer {...tradesWorkspaceProps} />
        </Suspense>
      )}

      {activeSection === 'replay' && (
        <Suspense fallback={workspaceFallback}>
          <ReplayWorkspaceContainer {...replayWorkspaceProps} />
        </Suspense>
      )}

      {activeSection === 'audit' && (
        <Suspense fallback={workspaceFallback}>
          <AuditWorkspaceContainer {...auditWorkspaceProps} />
        </Suspense>
      )}
    </>
  )
}

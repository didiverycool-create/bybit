import type { ComponentProps } from 'react'

import AppChromeShell from './AppChromeShell'
import AlertsWorkspaceContainer from './AlertsWorkspaceContainer'
import AuditWorkspaceContainer from './AuditWorkspaceContainer'
import BacktestWorkspaceContainer from './BacktestWorkspaceContainer'
import MarketWorkspaceContainer from './MarketWorkspaceContainer'
import NewsWorkspaceContainer from './NewsWorkspaceContainer'
import OverviewWorkspaceContainer from './OverviewWorkspaceContainer'
import ReplayWorkspaceContainer from './ReplayWorkspaceContainer'
import SchedulerWorkspaceContainer from './SchedulerWorkspaceContainer'
import SettingsWorkspaceContainer from './SettingsWorkspaceContainer'
import StrategyWorkspaceContainer from './StrategyWorkspaceContainer'
import TradesWorkspaceContainer from './TradesWorkspaceContainer'

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
        <SettingsWorkspaceContainer {...settingsWorkspaceProps} />
      )}

      {activeSection === 'market' && (
        <MarketWorkspaceContainer {...marketWorkspaceProps} />
      )}

      {activeSection === 'strategy' && (
        <StrategyWorkspaceContainer {...strategyWorkspaceProps} />
      )}

      {activeSection === 'backtest' && (
        <BacktestWorkspaceContainer {...backtestWorkspaceProps} />
      )}

      {activeSection === 'scheduler' && (
        <SchedulerWorkspaceContainer {...schedulerWorkspaceProps} />
      )}

      {activeSection === 'news' && (
        <NewsWorkspaceContainer {...newsWorkspaceProps} />
      )}

      {activeSection === 'alerts' && (
        <AlertsWorkspaceContainer {...alertsWorkspaceProps} />
      )}

      {activeSection === 'trades' && (
        <TradesWorkspaceContainer {...tradesWorkspaceProps} />
      )}

      {activeSection === 'replay' && (
        <ReplayWorkspaceContainer {...replayWorkspaceProps} />
      )}

      {activeSection === 'audit' && (
        <AuditWorkspaceContainer {...auditWorkspaceProps} />
      )}
    </>
  )
}

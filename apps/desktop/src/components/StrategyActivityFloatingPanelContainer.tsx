import type { ComponentProps } from 'react'

import type { StrategyActivitySnapshot, StrategySummary } from '../types'
import { formatDateTime, strategyActivityHeadline } from '../utils/app-helpers'
import StrategyActivityFloatingPanel from './StrategyActivityFloatingPanel'

type StrategyActivityFloatingPanelProps = ComponentProps<typeof StrategyActivityFloatingPanel>

type StrategyActivityFloatingPanelContainerProps = {
  panelOpen: boolean
  selectedStrategy: StrategySummary | null
  selectedStrategyActivity?: StrategyActivitySnapshot | null
  activeStrategyId: string | null
  queryState: {
    status: StrategyActivityFloatingPanelProps['queryStatus']
    fetchStatus: StrategyActivityFloatingPanelProps['queryFetchStatus']
    errorMessage: StrategyActivityFloatingPanelProps['queryErrorMessage']
    loading: StrategyActivityFloatingPanelProps['queryLoading']
  }
  serviceState: {
    serviceAvailable: boolean
    strategyTrackingPending: boolean
  }
  sectionProps: {
    topOpsProps?: StrategyActivityFloatingPanelProps['topOpsProps']
    topDecisionActionsProps?: StrategyActivityFloatingPanelProps['topDecisionActionsProps']
    decisionSectionsProps?: StrategyActivityFloatingPanelProps['decisionSectionsProps']
    reviewAndJobsProps?: StrategyActivityFloatingPanelProps['reviewAndJobsProps']
    opsSectionProps?: StrategyActivityFloatingPanelProps['opsSectionProps']
  }
  onTrack: StrategyActivityFloatingPanelProps['onTrack']
  onClose: StrategyActivityFloatingPanelProps['onClose']
}

export default function StrategyActivityFloatingPanelContainer({
  panelOpen,
  selectedStrategy,
  selectedStrategyActivity,
  activeStrategyId,
  queryState,
  serviceState,
  sectionProps,
  onTrack,
  onClose,
}: StrategyActivityFloatingPanelContainerProps) {
  if (!panelOpen || !selectedStrategy) {
    return null
  }

  const strategyHeadlineText = `${strategyActivityHeadline(selectedStrategyActivity)}${
    selectedStrategyActivity?.generated_at ? ` · 更新于 ${formatDateTime(selectedStrategyActivity.generated_at)}` : ''
  }`

  return (
    <StrategyActivityFloatingPanel
      strategyName={selectedStrategy.name}
      strategyHeadlineText={strategyHeadlineText}
      queryEnabled={Boolean(activeStrategyId) && panelOpen}
      queryStatus={queryState.status}
      queryFetchStatus={queryState.fetchStatus}
      queryStrategyId={activeStrategyId}
      queryErrorMessage={queryState.errorMessage}
      queryLoading={queryState.loading}
      activityAvailable={Boolean(selectedStrategyActivity)}
      trackingDisabled={!serviceState.serviceAvailable || serviceState.strategyTrackingPending}
      onTrack={onTrack}
      onClose={onClose}
      topOpsProps={selectedStrategyActivity ? sectionProps.topOpsProps : undefined}
      topDecisionActionsProps={selectedStrategyActivity ? sectionProps.topDecisionActionsProps : undefined}
      decisionSectionsProps={selectedStrategyActivity ? sectionProps.decisionSectionsProps : undefined}
      reviewAndJobsProps={selectedStrategyActivity ? sectionProps.reviewAndJobsProps : undefined}
      opsSectionProps={selectedStrategyActivity ? sectionProps.opsSectionProps : undefined}
    />
  )
}

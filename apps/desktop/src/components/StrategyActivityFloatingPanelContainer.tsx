import { Suspense, lazy, type ComponentProps } from 'react'

import type { StrategySummary } from '../types'
import { formatDateTime } from '../utils/app-helpers'
import type StrategyActivityFloatingPanelComponent from './StrategyActivityFloatingPanel'

const StrategyActivityFloatingPanel = lazy(() => import('./StrategyActivityFloatingPanel'))

type StrategyActivityFloatingPanelProps = ComponentProps<typeof StrategyActivityFloatingPanelComponent>

type StrategyActivityFloatingPanelContainerProps = {
  panelOpen: boolean
  selectedStrategy: StrategySummary | null
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
  activityMeta: {
    activityAvailable: boolean
    generatedAt: string | null
    headline: string
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
  activeStrategyId,
  queryState,
  serviceState,
  activityMeta,
  sectionProps,
  onTrack,
  onClose,
}: StrategyActivityFloatingPanelContainerProps) {
  if (!panelOpen || !selectedStrategy) {
    return null
  }

  const strategyHeadlineText = `${activityMeta.headline}${
    activityMeta.generatedAt ? ` · 更新于 ${formatDateTime(activityMeta.generatedAt)}` : ''
  }`

  return (
    <Suspense fallback={<div className="empty-state empty-state--inline">策略活动面板加载中...</div>}>
      <StrategyActivityFloatingPanel
        strategyName={selectedStrategy.name}
        strategyHeadlineText={strategyHeadlineText}
        queryEnabled={Boolean(activeStrategyId) && panelOpen}
        queryStatus={queryState.status}
        queryFetchStatus={queryState.fetchStatus}
        queryStrategyId={activeStrategyId}
        queryErrorMessage={queryState.errorMessage}
        queryLoading={queryState.loading}
        activityAvailable={activityMeta.activityAvailable}
        trackingDisabled={!serviceState.serviceAvailable || serviceState.strategyTrackingPending}
        onTrack={onTrack}
        onClose={onClose}
        topOpsProps={activityMeta.activityAvailable ? sectionProps.topOpsProps : undefined}
        topDecisionActionsProps={activityMeta.activityAvailable ? sectionProps.topDecisionActionsProps : undefined}
        decisionSectionsProps={activityMeta.activityAvailable ? sectionProps.decisionSectionsProps : undefined}
        reviewAndJobsProps={activityMeta.activityAvailable ? sectionProps.reviewAndJobsProps : undefined}
        opsSectionProps={activityMeta.activityAvailable ? sectionProps.opsSectionProps : undefined}
      />
    </Suspense>
  )
}

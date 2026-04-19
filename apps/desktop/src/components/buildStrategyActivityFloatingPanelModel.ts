import type { ComponentProps } from 'react'

import type { Mode, SchedulerState, StrategySummary } from '../types'
import type StrategyActivityFloatingPanelContainer from './StrategyActivityFloatingPanelContainer'
import type { StrategyActivityDecisionSelectors } from './buildStrategyActivityDecisionSectionProps'
import { buildStrategyActivityFloatingPanelSectionModel } from './buildStrategyActivityFloatingPanelSectionModel'
import type { useStrategyActivityDecisionModel } from './useStrategyActivityDecisionModel'
import type { useStrategyActivityOpsModel } from './useStrategyActivityOpsModel'
import type { useStrategyActivityProgressModel } from './useStrategyActivityProgressModel'
import type { StrategyActivitySnapshotViewModel } from './strategyActivitySelectors'

type StrategyActivityFloatingPanelProps = ComponentProps<typeof StrategyActivityFloatingPanelContainer>
type StrategyActivityDecisionModel = ReturnType<typeof useStrategyActivityDecisionModel>
type StrategyActivityProgressModel = ReturnType<typeof useStrategyActivityProgressModel>
type StrategyActivityOpsModel = ReturnType<typeof useStrategyActivityOpsModel>

export type BuildStrategyActivityFloatingPanelPropsArgs = {
  panelOpen: boolean
  selectedStrategy: StrategySummary | null
  strategyActivitySnapshotModel: StrategyActivitySnapshotViewModel
  activeStrategyId: string | null
  queryState: StrategyActivityFloatingPanelProps['queryState']
  activityMeta: StrategyActivityFloatingPanelProps['activityMeta']
  serviceState: {
    serviceAvailable: boolean
    strategyTrackingPending: boolean
    selectedMode: Mode
    alertMutationPending: boolean
    cancelPaperOrderPending: boolean
    cancelExchangeOrderPending: boolean
    replacePaperOrderPending: boolean
    replaceExchangeOrderPending: boolean
    proposalMutationPending: boolean
    backtestMutationPending: boolean
    retryAgentJobMutationPending: boolean
  }
  workspaceState: {
    selectedStrategyChangeRequest: StrategyActivityProgressModel['selectedStrategyChangeRequest']
    selectedBacktest: StrategyActivityProgressModel['selectedBacktest']
    backtests: StrategyActivityProgressModel['strategyActivityBacktests']
    reviewCatalog: unknown[]
    backtestReviewJobs: unknown[]
    selectedProposalId: string | null
    selectedChangeRequestId: string | null
    aiSchedulerFocusedJobId: string | null
    replayFocusReview: unknown | null
    schedulerState?: SchedulerState | null
  }
  decisionModel: StrategyActivityDecisionModel
  progressModel: StrategyActivityProgressModel
  opsModel: StrategyActivityOpsModel
  actions: {
    onTrack: StrategyActivityFloatingPanelProps['onTrack']
    onClose: StrategyActivityFloatingPanelProps['onClose']
    onOpenAlertsSection: () => void
    onOpenMarketSymbol: (symbol: string, latestPrice?: number | null) => void
    onOpenTradesSection: () => void
    onOpenWatchlistManager: () => void
    onToggleAlertAcknowledged: (alertId: string, nextAcknowledged: boolean) => void
    onOpenOrderEditor: (order: unknown) => void
    onCancelPaperOrder: (orderId: string) => void
    onCancelExchangeOrder: (orderId: string) => void
    onOpenAuditSection: () => void
    onOpenAiSchedulerJob: (jobId: string) => void
    onOpenReviewInspector: (reviewId: string, strategyId?: string | null) => void
    onOpenChangeRequest: (changeRequestId: string, strategyId?: string | null) => void
    onOpenBacktestDetail: (backtestId: string, strategyId?: string | null) => void
    onOpenSourceReview: (reviewId: string, strategyId?: string | null) => void
    onOpenStrategyProposal: (proposalId: string, strategyId?: string | null) => void
    onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
    onRetryAgentJob: (jobId: string, options?: { focusJob?: boolean }) => void
    onRerunBacktestFromChangeRequest: (request: unknown) => void
    onRerunBacktestFromRecommendation: (backtest: unknown) => void
    onRerunBacktestFromReview: (review: unknown) => void
    onOpenReplayReview: (reviewId: string, strategyId?: string | null) => void
    onOpenStrategyReplay: (strategyId: string) => void
  }
  focusLabels: Pick<
    StrategyActivityDecisionSelectors,
    'proposalFocusLabels' | 'backtestFocusLabels'
  >
}

export type StrategyActivityFloatingPanelModel = {
  activityMeta: StrategyActivityFloatingPanelProps['activityMeta']
  serviceState: StrategyActivityFloatingPanelProps['serviceState']
  onTrack: StrategyActivityFloatingPanelProps['onTrack']
  onClose: StrategyActivityFloatingPanelProps['onClose']
  sectionProps: StrategyActivityFloatingPanelProps['sectionProps']
}

export function buildStrategyActivityFloatingPanelModel({
  selectedStrategy,
  strategyActivitySnapshotModel,
  activityMeta,
  serviceState,
  workspaceState,
  decisionModel,
  progressModel,
  opsModel,
  actions,
  focusLabels,
}: BuildStrategyActivityFloatingPanelPropsArgs): StrategyActivityFloatingPanelModel {
  return {
    activityMeta,
    serviceState: {
      serviceAvailable: serviceState.serviceAvailable,
      strategyTrackingPending: serviceState.strategyTrackingPending,
    },
    onTrack: actions.onTrack,
    onClose: actions.onClose,
    sectionProps: activityMeta.activityAvailable
      ? buildStrategyActivityFloatingPanelSectionModel({
          selectedStrategy,
          strategyActivitySnapshotModel,
          serviceState,
          workspaceState,
          decisionModel,
          progressModel,
          opsModel,
          actions,
          focusLabels,
        })
      : {},
  }
}

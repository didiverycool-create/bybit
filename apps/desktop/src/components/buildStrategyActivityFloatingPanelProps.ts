import type { ComponentProps } from 'react'

import type { Mode, SchedulerState, StrategyActivitySnapshot, StrategySummary } from '../types'
import { proposalAcceptBlockedReason } from '../utils/app-helpers'
import {
  buildStrategyActivityFloatingPanelSectionProps,
  type StrategyActivityFloatingPanelActions,
  type StrategyActivityFloatingPanelCollectionState,
  type StrategyActivityFloatingPanelDerivedState,
  type StrategyActivityFloatingPanelServiceState,
} from './buildStrategyActivityFloatingPanelSectionProps'
import type StrategyActivityFloatingPanelContainer from './StrategyActivityFloatingPanelContainer'
import type { useStrategyActivityDecisionModel } from './useStrategyActivityDecisionModel'
import type { useStrategyActivityOpsModel } from './useStrategyActivityOpsModel'
import type { useStrategyActivityProgressModel } from './useStrategyActivityProgressModel'
import type { StrategyActivityDecisionSelectors } from './buildStrategyActivityDecisionSectionProps'

type StrategyActivityFloatingPanelProps = ComponentProps<typeof StrategyActivityFloatingPanelContainer>
type StrategyActivityDecisionModel = ReturnType<typeof useStrategyActivityDecisionModel>
type StrategyActivityProgressModel = ReturnType<typeof useStrategyActivityProgressModel>
type StrategyActivityOpsModel = ReturnType<typeof useStrategyActivityOpsModel>

type BuildStrategyActivityFloatingPanelPropsArgs = {
  panelOpen: boolean
  selectedStrategy: StrategySummary | null
  selectedStrategyActivity?: StrategyActivitySnapshot | null
  activeStrategyId: string | null
  queryState: StrategyActivityFloatingPanelProps['queryState']
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

export function buildStrategyActivityFloatingPanelProps({
  panelOpen,
  selectedStrategy,
  selectedStrategyActivity,
  activeStrategyId,
  queryState,
  serviceState,
  workspaceState,
  decisionModel,
  progressModel,
  opsModel,
  actions,
  focusLabels,
}: BuildStrategyActivityFloatingPanelPropsArgs): StrategyActivityFloatingPanelProps {
  const derivedState: StrategyActivityFloatingPanelDerivedState = {
    ...decisionModel,
    ...progressModel,
    ...opsModel,
  }
  const collectionState: StrategyActivityFloatingPanelCollectionState = {
    ...decisionModel,
    ...progressModel,
    ...opsModel,
    selectedStrategyChangeRequest: workspaceState.selectedStrategyChangeRequest,
    selectedBacktest: workspaceState.selectedBacktest,
    backtests: workspaceState.backtests,
    reviewCatalog: workspaceState.reviewCatalog,
    backtestReviewJobs: workspaceState.backtestReviewJobs,
    selectedProposalId: workspaceState.selectedProposalId,
    selectedChangeRequestId: workspaceState.selectedChangeRequestId,
    selectedStrategyId: selectedStrategy?.id ?? null,
    replayFocusReview: workspaceState.replayFocusReview,
    aiSchedulerFocusedJobId: workspaceState.aiSchedulerFocusedJobId,
  }
  const floatingPanelServiceState: StrategyActivityFloatingPanelServiceState = {
    serviceAvailable: serviceState.serviceAvailable,
    selectedMode: serviceState.selectedMode,
    alertMutationPending: serviceState.alertMutationPending,
    cancelPaperOrderPending: serviceState.cancelPaperOrderPending,
    cancelExchangeOrderPending: serviceState.cancelExchangeOrderPending,
    replacePaperOrderPending: serviceState.replacePaperOrderPending,
    replaceExchangeOrderPending: serviceState.replaceExchangeOrderPending,
    proposalMutationPending: serviceState.proposalMutationPending,
    backtestMutationPending: serviceState.backtestMutationPending,
    retryAgentJobMutationPending: serviceState.retryAgentJobMutationPending,
  }
  const floatingPanelActions: StrategyActivityFloatingPanelActions = {
    onOpenAlertsSection: actions.onOpenAlertsSection,
    onOpenMarketSymbol: actions.onOpenMarketSymbol,
    onOpenTradesSection: actions.onOpenTradesSection,
    onOpenWatchlistManager: actions.onOpenWatchlistManager,
    onToggleAlertAcknowledged: actions.onToggleAlertAcknowledged,
    onOpenOrderEditor: actions.onOpenOrderEditor,
    onCancelPaperOrder: actions.onCancelPaperOrder,
    onCancelExchangeOrder: actions.onCancelExchangeOrder,
    onOpenAuditSection: actions.onOpenAuditSection,
    onOpenAiSchedulerJob: actions.onOpenAiSchedulerJob,
    onOpenReviewInspector: actions.onOpenReviewInspector,
    onOpenChangeRequest: actions.onOpenChangeRequest,
    onOpenBacktestDetail: actions.onOpenBacktestDetail,
    onOpenSourceReview: actions.onOpenSourceReview,
    onOpenStrategyProposal: actions.onOpenStrategyProposal,
    onHandleProposalAction: (proposalId, action) => {
      actions.onHandleProposalAction(proposalId, action)
    },
    onRetryAgentJobWithFocus: (jobId) => {
      actions.onRetryAgentJob(jobId, { focusJob: true })
    },
    onRerunBacktestFromChangeRequest: (request) => {
      actions.onRerunBacktestFromChangeRequest(request)
    },
    onRerunBacktestFromRecommendation: (backtest) => {
      actions.onRerunBacktestFromRecommendation(backtest)
    },
    onRerunBacktestFromReview: (review) => {
      actions.onRerunBacktestFromReview(review)
    },
    onOpenReplayReview: actions.onOpenReplayReview,
    onOpenStrategyReplay: actions.onOpenStrategyReplay,
    onRetryAgentJob: (jobId) => {
      actions.onRetryAgentJob(jobId)
    },
  }
  const selectors: StrategyActivityDecisionSelectors = {
    getStrategyActivityProposalLinkedState: decisionModel.getStrategyActivityProposalLinkedState,
    getStrategyActivityChangeRequestLinkedState: progressModel.getStrategyActivityChangeRequestLinkedState,
    proposalFocusLabels: focusLabels.proposalFocusLabels,
    backtestFocusLabels: focusLabels.backtestFocusLabels,
    getProposalBlockedReason: (proposal) =>
      proposalAcceptBlockedReason(proposal.proposal_type, workspaceState.schedulerState),
  }

  return {
    panelOpen,
    selectedStrategy,
    selectedStrategyActivity,
    activeStrategyId,
    queryState,
    serviceState: {
      serviceAvailable: serviceState.serviceAvailable,
      strategyTrackingPending: serviceState.strategyTrackingPending,
    },
    onTrack: actions.onTrack,
    onClose: actions.onClose,
    sectionProps: selectedStrategyActivity
      ? buildStrategyActivityFloatingPanelSectionProps({
          activity: selectedStrategyActivity,
          derivedState,
          collectionState,
          serviceState: floatingPanelServiceState,
          actions: floatingPanelActions,
          selectors,
        })
      : {},
  }
}

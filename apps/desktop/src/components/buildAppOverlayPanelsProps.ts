import { startTransition } from 'react'
import type { ComponentProps, Dispatch, SetStateAction } from 'react'

import { CONTROL_API_BASE } from '../api'
import type { SchedulerState, SectionKey } from '../types'
import { schedulerLabel } from '../utils/app-helpers'
import AppOverlayPanelsContainer from './AppOverlayPanelsContainer'
import type { useReviewInspectorModel } from './useReviewInspectorModel'
import type { useStrategyWorkflowActions } from './useStrategyWorkflowActions'
import type { useStrategyWorkspaceActions } from './useStrategyWorkspaceActions'
import type { useTradingExecutionActions } from './useTradingExecutionActions'
import type { useWorkspaceControlActions } from './useWorkspaceControlActions'
import type { useWorkspaceStatusModel } from './useWorkspaceStatusModel'

type AppOverlayPanelsProps = ComponentProps<typeof AppOverlayPanelsContainer>
type WorkspaceStatusModel = ReturnType<typeof useWorkspaceStatusModel>
type TradingExecutionActionsModel = ReturnType<typeof useTradingExecutionActions>
type WorkspaceControlActionsModel = ReturnType<typeof useWorkspaceControlActions>
type StrategyWorkspaceActionsModel = ReturnType<typeof useStrategyWorkspaceActions>
type StrategyWorkflowActionsModel = ReturnType<typeof useStrategyWorkflowActions>
type ReviewInspectorModel = ReturnType<typeof useReviewInspectorModel>

type ManualOrderState = AppOverlayPanelsProps['manualTradeState']['manualOrder']
type ReviewInspectorState = ReviewInspectorModel

type BuildAppOverlayPanelsPropsArgs = {
  panelState: {
    statusInspectorOpen: boolean
    watchlistManagerOpen: boolean
    schedulerControlsOpen: boolean
    grafanaPreviewOpen: boolean
    manualTradePanelOpen: boolean
    orderHistoryPanelOpen: boolean
    accountInspectorOpen: boolean
    strategyEditorOpen: boolean
    strategyTrackingPanelOpen: boolean
    reviewInspectorOpen: boolean
  }
  panelSetters: {
    setStatusInspectorOpen: Dispatch<SetStateAction<boolean>>
    setWatchlistManagerOpen: Dispatch<SetStateAction<boolean>>
    setSchedulerControlsOpen: Dispatch<SetStateAction<boolean>>
    setGrafanaPreviewOpen: Dispatch<SetStateAction<boolean>>
    setManualTradePanelOpen: Dispatch<SetStateAction<boolean>>
    setOrderHistoryPanelOpen: Dispatch<SetStateAction<boolean>>
    setAccountInspectorOpen: Dispatch<SetStateAction<boolean>>
    setStrategyEditorOpen: Dispatch<SetStateAction<boolean>>
    setStrategyTrackingPanelOpen: Dispatch<SetStateAction<boolean>>
    setReviewInspectorOpen: Dispatch<SetStateAction<boolean>>
    setWatchlistDraftSymbol: Dispatch<SetStateAction<string>>
    setWatchlistDraftMarket: Dispatch<SetStateAction<'spot' | 'perp'>>
    setWatchlistAlertDrafts: Dispatch<SetStateAction<Record<string, string>>>
    setManualOrder: Dispatch<SetStateAction<ManualOrderState>>
    setTradeOriginFilter: Dispatch<SetStateAction<'all' | 'manual' | 'strategy' | 'exchange'>>
    setTradeScopeFilter: Dispatch<SetStateAction<'all' | 'selected'>>
    setParameterDrafts: Dispatch<SetStateAction<Record<string, string>>>
    setRiskBudgetDraft: Dispatch<SetStateAction<string>>
    setStrategyTrackingKind: Dispatch<SetStateAction<'issue' | 'change'>>
    setStrategyTrackingSummary: Dispatch<SetStateAction<string>>
    setStrategyTrackingDetail: Dispatch<SetStateAction<string>>
    setActiveSection: Dispatch<SetStateAction<SectionKey>>
    setReplayFocusedReviewId: Dispatch<SetStateAction<string | null>>
  }
  navigationActions: {
    onOpenSection: (section: SectionKey) => void
    onOpenStrategyActivity: (strategyId: string) => void
    onOpenStrategyReplay: (strategyId: string) => void
    onOpenReviewInspector: (reviewId: string, strategyId?: string | null) => void
    onOpenChangeRequest: (changeRequestId: string, strategyId?: string | null) => void
    onOpenBacktestDetail: (backtestId: string, strategyId?: string | null) => void
    onOpenSourceReview: (reviewId: string, strategyId?: string | null) => void
    onOpenStrategyProposal: (proposalId: string, strategyId?: string | null) => void
    onOpenAiSchedulerJob: (jobId: string) => void
  }
  workspaceStatusModel: WorkspaceStatusModel
  workspaceControlActions: WorkspaceControlActionsModel
  tradingExecutionActions: TradingExecutionActionsModel
  strategyWorkspaceActions: StrategyWorkspaceActionsModel
  strategyWorkflowActions: StrategyWorkflowActionsModel
  reviewInspectorModel: ReviewInspectorState
  dataState: {
    snapshotScheduler?: SchedulerState | null
    serviceAvailable: boolean
    settings: {
      bybit_web_entry?: string | null
    } | null | undefined
    grafanaStatus: {
      metrics_path?: string | null
      dashboard_url?: string | null
      configured?: boolean | null
      note?: string | null
    } | null | undefined
    metricsPreviewLines: string[]
    pendingAlertsCount: number
    selectedMode: AppOverlayPanelsProps['manualTradeState']['selectedMode']
    selectedSymbol: string
    editingOrder: AppOverlayPanelsProps['manualTradeState']['editingOrder']
    manualOrder: ManualOrderState
    manualTradePreviewLoading: boolean
    manualTradePreview: AppOverlayPanelsProps['manualTradeState']['preview']
    manualTradingBlockedReason: string | null
    watchlist: AppOverlayPanelsProps['watchlistManagerState']['watchlist']
    watchlistDraftSymbol: string
    watchlistDraftMarket: 'spot' | 'perp'
    watchlistAlertDrafts: Record<string, string>
    watchlistControlsDisabled: boolean
    accountOverview: AppOverlayPanelsProps['accountInspectorState']['accountOverview']
    bybitPrivateStatus: AppOverlayPanelsProps['accountInspectorState']['bybitPrivateStatus']
    bybitPublicStatus: AppOverlayPanelsProps['accountInspectorState']['bybitPublicStatus']
    tradeProbeResult: AppOverlayPanelsProps['accountInspectorState']['tradeProbeResult']
    tradeProbePending: AppOverlayPanelsProps['accountInspectorState']['tradeProbePending']
    parameterDrafts: Record<string, string>
    riskBudgetDraft: string
    hasParameterDraftChanges: boolean
    parameterDraftPatchCount: number
    riskBudgetChanged: boolean
    selectedStrategy: AppOverlayPanelsProps['strategyEditorState']['strategy']
    strategyTrackingKind: 'issue' | 'change'
    strategyTrackingSummary: string
    strategyTrackingDetail: string
    reviewInspectorReviewId: string | null
    reviewInspectorStrategyId: string | null
    tradeOriginFilter: AppOverlayPanelsProps['orderHistoryState']['tradeOriginFilter']
    tradeScopeFilter: AppOverlayPanelsProps['orderHistoryState']['tradeScopeFilter']
    filteredOrderHistory: AppOverlayPanelsProps['orderHistoryState']['filteredOrderHistory']
  }
  pendingState: {
    changeRequestMutationPending: boolean
    schedulerMutationPending: boolean
    watchlistAddPending: boolean
    watchlistRemovePending: boolean
    manualTradeMutationPending: boolean
    exchangeOrderMutationPending: boolean
    paperOrderMutationPending: boolean
    replacePaperOrderPending: boolean
    replaceExchangeOrderPending: boolean
    cancelPaperOrderPending: boolean
    cancelExchangeOrderPending: boolean
    strategyTrackingMutationPending: boolean
    backtestMutationPending: boolean
    retryAgentJobMutationPending: boolean
    proposalMutationPending: boolean
  }
}

export function buildAppOverlayPanelsProps({
  panelState,
  panelSetters,
  navigationActions,
  workspaceStatusModel,
  workspaceControlActions,
  tradingExecutionActions,
  strategyWorkspaceActions,
  strategyWorkflowActions,
  reviewInspectorModel,
  dataState,
  pendingState,
}: BuildAppOverlayPanelsPropsArgs): AppOverlayPanelsProps {
  const grafanaMetricsUrl = `${CONTROL_API_BASE}${dataState.grafanaStatus?.metrics_path ?? '/metrics'}`
  const grafanaPreviewNote =
    dataState.grafanaStatus?.note ?? 'Grafana 更适合系统监控，不建议直接替代主交易 K 线。'
  const manualTradeSubmitPending = Boolean(
    dataState.manualTradingBlockedReason ||
      pendingState.manualTradeMutationPending ||
      pendingState.exchangeOrderMutationPending,
  )
  const manualTradePaperPending = Boolean(
    dataState.manualTradingBlockedReason || pendingState.paperOrderMutationPending,
  )
  const manualTradeReplacePending = Boolean(
    dataState.manualTradingBlockedReason ||
      pendingState.replacePaperOrderPending ||
      pendingState.replaceExchangeOrderPending,
  )
  const manualTradeCancelPending = Boolean(
    !dataState.serviceAvailable ||
      pendingState.cancelPaperOrderPending ||
      pendingState.cancelExchangeOrderPending,
  )

  return {
    statusInspectorState: {
      open: panelState.statusInspectorOpen,
      statusCards: workspaceStatusModel.statusInspectorCards,
      latestCommand: workspaceStatusModel.latestSchedulerCommandBanner,
      messageCount: workspaceStatusModel.statusInspectorMessageCount,
      messages: workspaceStatusModel.statusInspectorMessages,
    },
    statusInspectorActions: {
      setOpen: panelSetters.setStatusInspectorOpen,
      onOpenSection: navigationActions.onOpenSection,
    },
    watchlistManagerState: {
      open: panelState.watchlistManagerOpen,
      draftSymbol: dataState.watchlistDraftSymbol,
      draftMarket: dataState.watchlistDraftMarket,
      submitPending: pendingState.watchlistAddPending,
      watchlist: dataState.watchlist,
      alertDrafts: dataState.watchlistAlertDrafts,
      controlsDisabled: dataState.watchlistControlsDisabled,
      removePending: pendingState.watchlistRemovePending,
    },
    watchlistManagerActions: {
      setOpen: panelSetters.setWatchlistManagerOpen,
      setDraftSymbol: panelSetters.setWatchlistDraftSymbol,
      setDraftMarket: panelSetters.setWatchlistDraftMarket,
      setAlertDrafts: panelSetters.setWatchlistAlertDrafts,
      onSubmit: workspaceControlActions.submitWatchlistItem,
      onUpdateAlertRule: workspaceControlActions.submitWatchlistAlertRule,
      onRemove: workspaceControlActions.removeWatchlistItem,
    },
    schedulerControlsState: {
      open: panelState.schedulerControlsOpen,
      currentJobId: dataState.snapshotScheduler?.current_job_id,
      publishGateLabel: workspaceStatusModel.schedulerControlsPublishGateLabel,
      schedulerStatusLabel: schedulerLabel(dataState.snapshotScheduler?.status ?? 'degraded'),
      serviceAvailable: dataState.serviceAvailable,
      pending: pendingState.schedulerMutationPending,
    },
    schedulerControlsActions: {
      setOpen: panelSetters.setSchedulerControlsOpen,
      setGrafanaPreviewOpen: panelSetters.setGrafanaPreviewOpen,
      onCancelAll: () => workspaceControlActions.runSchedulerCommand('cancel_all', '桌面端清空全部任务'),
      onFreezePublish: () =>
        workspaceControlActions.runSchedulerCommand('freeze_publish', '桌面端冻结自动发布'),
      onEnterManualOverride: () =>
        workspaceControlActions.runSchedulerCommand('enter_manual_override', '桌面端进入人工接管'),
    },
    grafanaPreviewState: {
      open: panelState.grafanaPreviewOpen,
      queueDepth: dataState.snapshotScheduler?.queue_depth ?? 0,
      schedulerStatusLabel: schedulerLabel(dataState.snapshotScheduler?.status ?? 'degraded'),
      pendingAlertsCount: dataState.pendingAlertsCount,
      metricsUrl: grafanaMetricsUrl,
      dashboardUrl: dataState.grafanaStatus?.dashboard_url,
      configured: Boolean(dataState.grafanaStatus?.configured),
      note: grafanaPreviewNote,
      metricsPreviewLines: dataState.metricsPreviewLines,
    },
    grafanaPreviewActions: {
      setOpen: panelSetters.setGrafanaPreviewOpen,
      onOpenMetrics: () => window.open(grafanaMetricsUrl, '_blank', 'noopener,noreferrer'),
      onOpenGrafana: () => {
        if (dataState.grafanaStatus?.dashboard_url) {
          window.open(dataState.grafanaStatus.dashboard_url, '_blank', 'noopener,noreferrer')
        }
      },
    },
    manualTradeState: {
      open: panelState.manualTradePanelOpen,
      selectedMode: dataState.selectedMode,
      selectedSymbol: dataState.selectedSymbol,
      editingOrder: dataState.editingOrder,
      manualOrder: dataState.manualOrder,
      previewLoading: dataState.manualTradePreviewLoading,
      preview: dataState.manualTradePreview,
      blockedReason: dataState.manualTradingBlockedReason,
      serviceAvailable: dataState.serviceAvailable,
      submitPending: manualTradeSubmitPending,
      paperPending: manualTradePaperPending,
      replacePending: manualTradeReplacePending,
      cancelPending: manualTradeCancelPending,
    },
    manualTradeActions: {
      onClose: tradingExecutionActions.closeManualTradePanel,
      setManualOrder: panelSetters.setManualOrder,
      onSubmitManual: tradingExecutionActions.submitManualOrder,
      onSubmitPaper: tradingExecutionActions.submitPaperOrder,
      onReplace:
        dataState.editingOrder?.source === 'paper'
          ? tradingExecutionActions.replacePaperOrder
          : tradingExecutionActions.replaceExchangeOrder,
      onCancelCurrent: () => {
        if (!dataState.editingOrder) {
          return
        }
        if (dataState.editingOrder.source === 'paper') {
          void tradingExecutionActions.cancelPaperOrder(dataState.editingOrder.order_id)
          return
        }
        void tradingExecutionActions.cancelExchangeOrder(dataState.editingOrder.order_id)
      },
    },
    orderHistoryState: {
      open: panelState.orderHistoryPanelOpen,
      tradeOriginFilter: dataState.tradeOriginFilter,
      tradeScopeFilter: dataState.tradeScopeFilter,
      selectedSymbol: dataState.selectedSymbol,
      accountSource: dataState.accountOverview?.source,
      bybitWebEntry: dataState.settings?.bybit_web_entry ?? 'https://www.bybit-global.com/',
      filteredOrderHistory: dataState.filteredOrderHistory,
    },
    orderHistoryActions: {
      setOpen: panelSetters.setOrderHistoryPanelOpen,
      setTradeOriginFilter: panelSetters.setTradeOriginFilter,
      setTradeScopeFilter: panelSetters.setTradeScopeFilter,
    },
    accountInspectorState: {
      open: panelState.accountInspectorOpen,
      accountOverview: dataState.accountOverview,
      bybitPrivateStatus: dataState.bybitPrivateStatus,
      bybitPublicStatus: dataState.bybitPublicStatus,
      bybitWebEntry: dataState.settings?.bybit_web_entry ?? 'https://www.bybit-global.com/',
      tradeProbeResult: dataState.tradeProbeResult,
      tradeProbePending: dataState.tradeProbePending,
    },
    accountInspectorActions: {
      setOpen: panelSetters.setAccountInspectorOpen,
      onProbeTradeRoute: () => {
        void tradingExecutionActions.probeBybitTradeRoute()
      },
    },
    strategyEditorState: {
      open: panelState.strategyEditorOpen,
      strategy: dataState.selectedStrategy,
      parameterDrafts: dataState.parameterDrafts,
      riskBudgetDraft: dataState.riskBudgetDraft,
      hasParameterDraftChanges: dataState.hasParameterDraftChanges,
      parameterDraftPatchCount: dataState.parameterDraftPatchCount,
      riskBudgetChanged: dataState.riskBudgetChanged,
      serviceAvailable: dataState.serviceAvailable,
      pending: pendingState.changeRequestMutationPending,
    },
    strategyEditorActions: {
      setOpen: panelSetters.setStrategyEditorOpen,
      setParameterDrafts: panelSetters.setParameterDrafts,
      setRiskBudgetDraft: panelSetters.setRiskBudgetDraft,
      onSubmitParameterUpdate: strategyWorkspaceActions.submitSelectedStrategyParameterUpdate,
      onSubmitRiskUpdate: strategyWorkspaceActions.submitSelectedStrategyRiskUpdate,
    },
    strategyTrackingState: {
      open: panelState.strategyTrackingPanelOpen,
      strategy: dataState.selectedStrategy,
      kind: dataState.strategyTrackingKind,
      summary: dataState.strategyTrackingSummary,
      detail: dataState.strategyTrackingDetail,
      serviceAvailable: dataState.serviceAvailable,
      pending: pendingState.strategyTrackingMutationPending,
    },
    strategyTrackingActions: {
      setOpen: panelSetters.setStrategyTrackingPanelOpen,
      setKind: panelSetters.setStrategyTrackingKind,
      setSummary: panelSetters.setStrategyTrackingSummary,
      setDetail: panelSetters.setStrategyTrackingDetail,
      onSubmit: () => {
        void strategyWorkflowActions.submitStrategyTrackingReview()
      },
    },
    reviewInspectorState: {
      open: panelState.reviewInspectorOpen,
      review: reviewInspectorModel.review,
      strategyId: reviewInspectorModel.strategyId,
      strategyLabel: reviewInspectorModel.strategyLabel,
      lineageMeta: reviewInspectorModel.lineageMeta,
      decisionMeta: reviewInspectorModel.decisionMeta,
      proposalItems: reviewInspectorModel.proposalItems,
      serviceAvailable: dataState.serviceAvailable,
      backtestPending: pendingState.backtestMutationPending,
      retryPending: pendingState.retryAgentJobMutationPending,
      proposalMutationPending: pendingState.proposalMutationPending,
    },
    reviewInspectorActions: {
      onClose: () => {
        panelSetters.setReviewInspectorOpen(false)
      },
      onOpenReplay: () => {
        if (!reviewInspectorModel.review) {
          return
        }
        if (dataState.reviewInspectorStrategyId) {
          navigationActions.onOpenStrategyReplay(dataState.reviewInspectorStrategyId)
          return
        }
        startTransition(() => {
          panelSetters.setActiveSection('replay')
          panelSetters.setReplayFocusedReviewId(reviewInspectorModel.review?.id ?? null)
        })
      },
      onOpenReviewInspector: navigationActions.onOpenReviewInspector,
      onOpenStrategy: navigationActions.onOpenStrategyActivity,
      onOpenChangeRequest: navigationActions.onOpenChangeRequest,
      onOpenBacktest: navigationActions.onOpenBacktestDetail,
      onOpenSourceReview: navigationActions.onOpenSourceReview,
      onOpenProposal: navigationActions.onOpenStrategyProposal,
      onOpenJob: navigationActions.onOpenAiSchedulerJob,
      onRerunBacktest: (review) => {
        void strategyWorkflowActions.rerunBacktestFromReview(review)
      },
      onRetryJob: (jobId) => {
        void strategyWorkflowActions.retryAgentJob(jobId, { focusJob: true })
      },
      onProposalAction: (proposalId, action) => {
        void strategyWorkflowActions.handleProposalAction(proposalId, action)
      },
    },
  }
}

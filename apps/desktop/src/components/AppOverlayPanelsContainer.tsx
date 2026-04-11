import type { ComponentProps, Dispatch, SetStateAction } from 'react'

import type { SectionKey } from '../types'
import AccountInspectorPanel from './AccountInspectorPanel'
import AppOverlayPanelsHost from './AppOverlayPanelsHost'
import GrafanaPreviewPanel from './GrafanaPreviewPanel'
import ManualTradePanel from './ManualTradePanel'
import OrderHistoryPanel from './OrderHistoryPanel'
import ReviewInspectorPanel from './ReviewInspectorPanel'
import SchedulerControlsPanel from './SchedulerControlsPanel'
import StatusInspectorPanel from './StatusInspectorPanel'
import StrategyEditorPanel from './StrategyEditorPanel'
import StrategyTrackingPanel from './StrategyTrackingPanel'
import WatchlistManagerPanel from './WatchlistManagerPanel'

type StatusInspectorState = Pick<
  ComponentProps<typeof StatusInspectorPanel>,
  'open' | 'statusCards' | 'latestCommand' | 'messageCount' | 'messages'
>

type WatchlistManagerState = Pick<
  ComponentProps<typeof WatchlistManagerPanel>,
  'open' | 'draftSymbol' | 'draftMarket' | 'submitPending' | 'watchlist' | 'alertDrafts' | 'controlsDisabled' | 'removePending'
>

type SchedulerControlsState = Pick<
  ComponentProps<typeof SchedulerControlsPanel>,
  'open' | 'currentJobId' | 'publishGateLabel' | 'schedulerStatusLabel' | 'serviceAvailable' | 'pending'
>

type GrafanaPreviewState = Pick<
  ComponentProps<typeof GrafanaPreviewPanel>,
  'open' | 'queueDepth' | 'schedulerStatusLabel' | 'pendingAlertsCount' | 'metricsUrl' | 'dashboardUrl' | 'configured' | 'note' | 'metricsPreviewLines'
>

type ManualTradeState = Pick<
  ComponentProps<typeof ManualTradePanel>,
  'open' | 'selectedMode' | 'selectedSymbol' | 'editingOrder' | 'manualOrder' | 'previewLoading' | 'preview' | 'blockedReason' | 'serviceAvailable' | 'submitPending' | 'paperPending' | 'replacePending' | 'cancelPending'
>

type OrderHistoryState = Pick<
  ComponentProps<typeof OrderHistoryPanel>,
  'open' | 'tradeOriginFilter' | 'tradeScopeFilter' | 'selectedSymbol' | 'accountSource' | 'bybitWebEntry' | 'filteredOrderHistory'
>

type AccountInspectorState = Pick<
  ComponentProps<typeof AccountInspectorPanel>,
  'open' | 'accountOverview' | 'bybitPrivateStatus' | 'bybitPublicStatus' | 'bybitWebEntry' | 'tradeProbeResult' | 'tradeProbePending'
>

type StrategyEditorState = Pick<
  ComponentProps<typeof StrategyEditorPanel>,
  'open' | 'strategy' | 'parameterDrafts' | 'riskBudgetDraft' | 'hasParameterDraftChanges' | 'parameterDraftPatchCount' | 'riskBudgetChanged' | 'serviceAvailable' | 'pending'
>

type StrategyTrackingState = Pick<
  ComponentProps<typeof StrategyTrackingPanel>,
  'open' | 'strategy' | 'kind' | 'summary' | 'detail' | 'serviceAvailable' | 'pending'
>

type ReviewInspectorState = Pick<
  ComponentProps<typeof ReviewInspectorPanel>,
  | 'open'
  | 'review'
  | 'strategyId'
  | 'strategyLabel'
  | 'lineageMeta'
  | 'decisionMeta'
  | 'proposalItems'
  | 'serviceAvailable'
  | 'backtestPending'
  | 'retryPending'
  | 'proposalMutationPending'
>

type AppOverlayPanelsContainerProps = {
  statusInspectorState: StatusInspectorState
  statusInspectorActions: {
    setOpen: Dispatch<SetStateAction<boolean>>
    onOpenSection: (section: SectionKey) => void
  }
  watchlistManagerState: WatchlistManagerState
  watchlistManagerActions: {
    setOpen: Dispatch<SetStateAction<boolean>>
    setDraftSymbol: Dispatch<SetStateAction<string>>
    setDraftMarket: Dispatch<SetStateAction<string>>
    setAlertDrafts: Dispatch<SetStateAction<WatchlistManagerState['alertDrafts']>>
    onSubmit: ComponentProps<typeof WatchlistManagerPanel>['onSubmit']
    onUpdateAlertRule: ComponentProps<typeof WatchlistManagerPanel>['onUpdateAlertRule']
    onRemove: ComponentProps<typeof WatchlistManagerPanel>['onRemove']
  }
  schedulerControlsState: SchedulerControlsState
  schedulerControlsActions: {
    setOpen: Dispatch<SetStateAction<boolean>>
    setGrafanaPreviewOpen: Dispatch<SetStateAction<boolean>>
    onCancelAll: ComponentProps<typeof SchedulerControlsPanel>['onCancelAll']
    onFreezePublish: ComponentProps<typeof SchedulerControlsPanel>['onFreezePublish']
    onEnterManualOverride: ComponentProps<typeof SchedulerControlsPanel>['onEnterManualOverride']
  }
  grafanaPreviewState: GrafanaPreviewState
  grafanaPreviewActions: {
    setOpen: Dispatch<SetStateAction<boolean>>
    onOpenMetrics: ComponentProps<typeof GrafanaPreviewPanel>['onOpenMetrics']
    onOpenGrafana: ComponentProps<typeof GrafanaPreviewPanel>['onOpenGrafana']
  }
  manualTradeState: ManualTradeState
  manualTradeActions: {
    onClose: ComponentProps<typeof ManualTradePanel>['onClose']
    setManualOrder: Dispatch<SetStateAction<ManualTradeState['manualOrder']>>
    onSubmitManual: ComponentProps<typeof ManualTradePanel>['onSubmitManual']
    onSubmitPaper: ComponentProps<typeof ManualTradePanel>['onSubmitPaper']
    onReplace: ComponentProps<typeof ManualTradePanel>['onReplace']
    onCancelCurrent: ComponentProps<typeof ManualTradePanel>['onCancelCurrent']
  }
  orderHistoryState: OrderHistoryState
  orderHistoryActions: {
    setOpen: Dispatch<SetStateAction<boolean>>
    setTradeOriginFilter: Dispatch<SetStateAction<OrderHistoryState['tradeOriginFilter']>>
    setTradeScopeFilter: Dispatch<SetStateAction<OrderHistoryState['tradeScopeFilter']>>
  }
  accountInspectorState: AccountInspectorState
  accountInspectorActions: {
    setOpen: Dispatch<SetStateAction<boolean>>
    onProbeTradeRoute: ComponentProps<typeof AccountInspectorPanel>['onProbeTradeRoute']
  }
  strategyEditorState: StrategyEditorState
  strategyEditorActions: {
    setOpen: Dispatch<SetStateAction<boolean>>
    setParameterDrafts: Dispatch<SetStateAction<StrategyEditorState['parameterDrafts']>>
    setRiskBudgetDraft: Dispatch<SetStateAction<string>>
    onSubmitParameterUpdate: ComponentProps<typeof StrategyEditorPanel>['onSubmitParameterUpdate']
    onSubmitRiskUpdate: ComponentProps<typeof StrategyEditorPanel>['onSubmitRiskUpdate']
  }
  strategyTrackingState: StrategyTrackingState
  strategyTrackingActions: {
    setOpen: Dispatch<SetStateAction<boolean>>
    setKind: Dispatch<SetStateAction<StrategyTrackingState['kind']>>
    setSummary: Dispatch<SetStateAction<string>>
    setDetail: Dispatch<SetStateAction<string>>
    onSubmit: ComponentProps<typeof StrategyTrackingPanel>['onSubmit']
  }
  reviewInspectorState: ReviewInspectorState
  reviewInspectorActions: Pick<
    ComponentProps<typeof ReviewInspectorPanel>,
    | 'onClose'
    | 'onOpenReplay'
    | 'onOpenReviewInspector'
    | 'onOpenStrategy'
    | 'onOpenChangeRequest'
    | 'onOpenBacktest'
    | 'onOpenSourceReview'
    | 'onOpenProposal'
    | 'onOpenJob'
    | 'onRerunBacktest'
    | 'onRetryJob'
    | 'onProposalAction'
  >
}

export default function AppOverlayPanelsContainer({
  statusInspectorState,
  statusInspectorActions,
  watchlistManagerState,
  watchlistManagerActions,
  schedulerControlsState,
  schedulerControlsActions,
  grafanaPreviewState,
  grafanaPreviewActions,
  manualTradeState,
  manualTradeActions,
  orderHistoryState,
  orderHistoryActions,
  accountInspectorState,
  accountInspectorActions,
  strategyEditorState,
  strategyEditorActions,
  strategyTrackingState,
  strategyTrackingActions,
  reviewInspectorState,
  reviewInspectorActions,
}: AppOverlayPanelsContainerProps) {
  return (
    <AppOverlayPanelsHost
      statusInspectorPanelProps={{
        ...statusInspectorState,
        onClose: () => statusInspectorActions.setOpen(false),
        onOpenAlerts: () => {
          statusInspectorActions.setOpen(false)
          statusInspectorActions.onOpenSection('alerts')
        },
        onOpenScheduler: () => {
          statusInspectorActions.setOpen(false)
          statusInspectorActions.onOpenSection('scheduler')
        },
        onOpenSettings: () => {
          statusInspectorActions.setOpen(false)
          statusInspectorActions.onOpenSection('settings')
        },
      }}
      watchlistManagerPanelProps={{
        ...watchlistManagerState,
        onClose: () => watchlistManagerActions.setOpen(false),
        onDraftSymbolChange: watchlistManagerActions.setDraftSymbol,
        onDraftMarketChange: watchlistManagerActions.setDraftMarket,
        onSubmit: watchlistManagerActions.onSubmit,
        onAlertDraftChange: (symbol, value) =>
          watchlistManagerActions.setAlertDrafts((current) => ({
            ...current,
            [symbol]: value,
          })),
        onUpdateAlertRule: watchlistManagerActions.onUpdateAlertRule,
        onToggleAlertRule: (item) =>
          watchlistManagerActions.onUpdateAlertRule(item, {
            alertEnabled: !item.alert_enabled,
          }),
        onRemove: watchlistManagerActions.onRemove,
      }}
      schedulerControlsPanelProps={{
        ...schedulerControlsState,
        onClose: () => schedulerControlsActions.setOpen(false),
        onCancelAll: schedulerControlsActions.onCancelAll,
        onFreezePublish: schedulerControlsActions.onFreezePublish,
        onEnterManualOverride: schedulerControlsActions.onEnterManualOverride,
        onOpenGrafana: () => {
          schedulerControlsActions.setOpen(false)
          schedulerControlsActions.setGrafanaPreviewOpen(true)
        },
      }}
      grafanaPreviewPanelProps={{
        ...grafanaPreviewState,
        onClose: () => grafanaPreviewActions.setOpen(false),
        onOpenMetrics: grafanaPreviewActions.onOpenMetrics,
        onOpenGrafana: grafanaPreviewActions.onOpenGrafana,
      }}
      manualTradePanelProps={{
        ...manualTradeState,
        onClose: manualTradeActions.onClose,
        onManualOrderChange: manualTradeActions.setManualOrder,
        onSubmitManual: manualTradeActions.onSubmitManual,
        onSubmitPaper: manualTradeActions.onSubmitPaper,
        onReplace: manualTradeActions.onReplace,
        onCancelCurrent: manualTradeActions.onCancelCurrent,
      }}
      orderHistoryPanelProps={{
        ...orderHistoryState,
        onClose: () => orderHistoryActions.setOpen(false),
        onTradeOriginFilterChange: orderHistoryActions.setTradeOriginFilter,
        onTradeScopeToggle: () =>
          orderHistoryActions.setTradeScopeFilter((current) => (current === 'selected' ? 'all' : 'selected')),
      }}
      accountInspectorPanelProps={{
        ...accountInspectorState,
        onClose: () => accountInspectorActions.setOpen(false),
        onProbeTradeRoute: accountInspectorActions.onProbeTradeRoute,
      }}
      strategyEditorPanelProps={{
        ...strategyEditorState,
        onParameterDraftChange: (key, value) =>
          strategyEditorActions.setParameterDrafts((current) => ({
            ...current,
            [key]: value,
          })),
        onRiskBudgetDraftChange: strategyEditorActions.setRiskBudgetDraft,
        onSubmitParameterUpdate: strategyEditorActions.onSubmitParameterUpdate,
        onSubmitRiskUpdate: strategyEditorActions.onSubmitRiskUpdate,
        onClose: () => strategyEditorActions.setOpen(false),
      }}
      strategyTrackingPanelProps={{
        ...strategyTrackingState,
        onKindChange: strategyTrackingActions.setKind,
        onSummaryChange: strategyTrackingActions.setSummary,
        onDetailChange: strategyTrackingActions.setDetail,
        onSubmit: strategyTrackingActions.onSubmit,
        onClose: () => strategyTrackingActions.setOpen(false),
      }}
      reviewInspectorPanelProps={{
        ...reviewInspectorState,
        onClose: reviewInspectorActions.onClose,
        onOpenReplay: reviewInspectorActions.onOpenReplay,
        onOpenReviewInspector: reviewInspectorActions.onOpenReviewInspector,
        onOpenStrategy: reviewInspectorActions.onOpenStrategy,
        onOpenChangeRequest: reviewInspectorActions.onOpenChangeRequest,
        onOpenBacktest: reviewInspectorActions.onOpenBacktest,
        onOpenSourceReview: reviewInspectorActions.onOpenSourceReview,
        onOpenProposal: reviewInspectorActions.onOpenProposal,
        onOpenJob: reviewInspectorActions.onOpenJob,
        onRerunBacktest: reviewInspectorActions.onRerunBacktest,
        onRetryJob: reviewInspectorActions.onRetryJob,
        onProposalAction: reviewInspectorActions.onProposalAction,
      }}
    />
  )
}

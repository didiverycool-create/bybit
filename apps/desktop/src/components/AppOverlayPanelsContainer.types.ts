import type { ComponentProps, Dispatch, SetStateAction } from 'react'

import type { SectionKey } from '../types'
import AccountInspectorPanel from './AccountInspectorPanel'
import GrafanaPreviewPanel from './GrafanaPreviewPanel'
import ManualTradePanel from './ManualTradePanel'
import OrderHistoryPanel from './OrderHistoryPanel'
import ReviewInspectorPanel from './ReviewInspectorPanel'
import SchedulerControlsPanel from './SchedulerControlsPanel'
import StatusInspectorPanel from './StatusInspectorPanel'
import StrategyEditorPanel from './StrategyEditorPanel'
import StrategyTrackingPanel from './StrategyTrackingPanel'
import WatchlistManagerPanel from './WatchlistManagerPanel'

export type StatusInspectorState = Pick<
  ComponentProps<typeof StatusInspectorPanel>,
  'open' | 'statusCards' | 'latestCommand' | 'messageCount' | 'messages'
>

export type StatusInspectorActions = {
  setOpen: Dispatch<SetStateAction<boolean>>
  onOpenSection: (section: SectionKey) => void
}

export type WatchlistManagerState = Pick<
  ComponentProps<typeof WatchlistManagerPanel>,
  'open' | 'draftSymbol' | 'draftMarket' | 'submitPending' | 'watchlist' | 'alertDrafts' | 'controlsDisabled' | 'removePending'
>

export type WatchlistManagerActions = {
  setOpen: Dispatch<SetStateAction<boolean>>
  setDraftSymbol: Dispatch<SetStateAction<string>>
  setDraftMarket: Dispatch<SetStateAction<string>>
  setAlertDrafts: Dispatch<SetStateAction<WatchlistManagerState['alertDrafts']>>
  onSubmit: ComponentProps<typeof WatchlistManagerPanel>['onSubmit']
  onUpdateAlertRule: ComponentProps<typeof WatchlistManagerPanel>['onUpdateAlertRule']
  onRemove: ComponentProps<typeof WatchlistManagerPanel>['onRemove']
}

export type SchedulerControlsState = Pick<
  ComponentProps<typeof SchedulerControlsPanel>,
  'open' | 'currentJobId' | 'publishGateLabel' | 'schedulerStatusLabel' | 'serviceAvailable' | 'pending'
>

export type SchedulerControlsActions = {
  setOpen: Dispatch<SetStateAction<boolean>>
  setGrafanaPreviewOpen: Dispatch<SetStateAction<boolean>>
  onCancelAll: ComponentProps<typeof SchedulerControlsPanel>['onCancelAll']
  onFreezePublish: ComponentProps<typeof SchedulerControlsPanel>['onFreezePublish']
  onEnterManualOverride: ComponentProps<typeof SchedulerControlsPanel>['onEnterManualOverride']
}

export type GrafanaPreviewState = Pick<
  ComponentProps<typeof GrafanaPreviewPanel>,
  'open' | 'queueDepth' | 'schedulerStatusLabel' | 'pendingAlertsCount' | 'metricsUrl' | 'dashboardUrl' | 'configured' | 'note' | 'metricsPreviewLines'
>

export type GrafanaPreviewActions = {
  setOpen: Dispatch<SetStateAction<boolean>>
  onOpenMetrics: ComponentProps<typeof GrafanaPreviewPanel>['onOpenMetrics']
  onOpenGrafana: ComponentProps<typeof GrafanaPreviewPanel>['onOpenGrafana']
}

export type ManualTradeState = Pick<
  ComponentProps<typeof ManualTradePanel>,
  'open' | 'selectedMode' | 'selectedSymbol' | 'editingOrder' | 'manualOrder' | 'previewLoading' | 'preview' | 'blockedReason' | 'serviceAvailable' | 'submitPending' | 'paperPending' | 'replacePending' | 'cancelPending'
>

export type ManualTradeActions = {
  onClose: ComponentProps<typeof ManualTradePanel>['onClose']
  setManualOrder: Dispatch<SetStateAction<ManualTradeState['manualOrder']>>
  onSubmitManual: ComponentProps<typeof ManualTradePanel>['onSubmitManual']
  onSubmitPaper: ComponentProps<typeof ManualTradePanel>['onSubmitPaper']
  onReplace: ComponentProps<typeof ManualTradePanel>['onReplace']
  onCancelCurrent: ComponentProps<typeof ManualTradePanel>['onCancelCurrent']
}

export type OrderHistoryState = Pick<
  ComponentProps<typeof OrderHistoryPanel>,
  'open' | 'tradeOriginFilter' | 'tradeScopeFilter' | 'selectedSymbol' | 'accountSource' | 'bybitWebEntry' | 'filteredOrderHistory'
>

export type OrderHistoryActions = {
  setOpen: Dispatch<SetStateAction<boolean>>
  setTradeOriginFilter: Dispatch<SetStateAction<OrderHistoryState['tradeOriginFilter']>>
  setTradeScopeFilter: Dispatch<SetStateAction<OrderHistoryState['tradeScopeFilter']>>
}

export type AccountInspectorState = Pick<
  ComponentProps<typeof AccountInspectorPanel>,
  'open' | 'accountOverview' | 'bybitPrivateStatus' | 'bybitPublicStatus' | 'bybitWebEntry' | 'tradeProbeResult' | 'tradeProbePending'
>

export type AccountInspectorActions = {
  setOpen: Dispatch<SetStateAction<boolean>>
  onProbeTradeRoute: ComponentProps<typeof AccountInspectorPanel>['onProbeTradeRoute']
}

export type StrategyEditorState = Pick<
  ComponentProps<typeof StrategyEditorPanel>,
  'open' | 'strategy' | 'parameterDrafts' | 'riskBudgetDraft' | 'hasParameterDraftChanges' | 'parameterDraftPatchCount' | 'riskBudgetChanged' | 'serviceAvailable' | 'pending'
>

export type StrategyEditorActions = {
  setOpen: Dispatch<SetStateAction<boolean>>
  setParameterDrafts: Dispatch<SetStateAction<StrategyEditorState['parameterDrafts']>>
  setRiskBudgetDraft: Dispatch<SetStateAction<string>>
  onSubmitParameterUpdate: ComponentProps<typeof StrategyEditorPanel>['onSubmitParameterUpdate']
  onSubmitRiskUpdate: ComponentProps<typeof StrategyEditorPanel>['onSubmitRiskUpdate']
}

export type StrategyTrackingState = Pick<
  ComponentProps<typeof StrategyTrackingPanel>,
  'open' | 'strategy' | 'kind' | 'summary' | 'detail' | 'serviceAvailable' | 'pending'
>

export type StrategyTrackingActions = {
  setOpen: Dispatch<SetStateAction<boolean>>
  setKind: Dispatch<SetStateAction<StrategyTrackingState['kind']>>
  setSummary: Dispatch<SetStateAction<string>>
  setDetail: Dispatch<SetStateAction<string>>
  onSubmit: ComponentProps<typeof StrategyTrackingPanel>['onSubmit']
}

export type ReviewInspectorState = Pick<
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

export type ReviewInspectorActions = Pick<
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

export type AppOverlayPanelsContainerProps = {
  statusInspectorState: StatusInspectorState
  statusInspectorActions: StatusInspectorActions
  watchlistManagerState: WatchlistManagerState
  watchlistManagerActions: WatchlistManagerActions
  schedulerControlsState: SchedulerControlsState
  schedulerControlsActions: SchedulerControlsActions
  grafanaPreviewState: GrafanaPreviewState
  grafanaPreviewActions: GrafanaPreviewActions
  manualTradeState: ManualTradeState
  manualTradeActions: ManualTradeActions
  orderHistoryState: OrderHistoryState
  orderHistoryActions: OrderHistoryActions
  accountInspectorState: AccountInspectorState
  accountInspectorActions: AccountInspectorActions
  strategyEditorState: StrategyEditorState
  strategyEditorActions: StrategyEditorActions
  strategyTrackingState: StrategyTrackingState
  strategyTrackingActions: StrategyTrackingActions
  reviewInspectorState: ReviewInspectorState
  reviewInspectorActions: ReviewInspectorActions
}

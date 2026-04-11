import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CONTROL_API_BASE } from './api'
import './App.css'
import AppChromeShell from './components/AppChromeShell'
import AppOverlayPanelsContainer from './components/AppOverlayPanelsContainer'
import AlertsWorkspaceContainer from './components/AlertsWorkspaceContainer'
import AuditWorkspaceContainer from './components/AuditWorkspaceContainer'
import BacktestWorkspaceContainer from './components/BacktestWorkspaceContainer'
import { buildAppOverlayPanelsProps } from './components/buildAppOverlayPanelsProps'
import { buildStrategyActivityFloatingPanelProps } from './components/buildStrategyActivityFloatingPanelProps'
import { useControlDataQueryModel } from './components/useControlDataQueryModel'
import { useControlRefreshActions } from './components/useControlRefreshActions'
import MarketWorkspaceContainer from './components/MarketWorkspaceContainer'
import NewsWorkspaceContainer from './components/NewsWorkspaceContainer'
import OverviewWorkspaceContainer from './components/OverviewWorkspaceContainer'
import ReplayWorkspaceContainer from './components/ReplayWorkspaceContainer'
import SchedulerWorkspaceContainer from './components/SchedulerWorkspaceContainer'
import SettingsWorkspaceContainer from './components/SettingsWorkspaceContainer'
import StrategyActivityFloatingPanelContainer from './components/StrategyActivityFloatingPanelContainer'
import { useMarketWorkspaceModel } from './components/useMarketWorkspaceModel'
import { useManualTradePreviewModel } from './components/useManualTradePreviewModel'
import { useStrategyActivityDecisionModel } from './components/useStrategyActivityDecisionModel'
import { useDesktopNotificationEffects } from './components/useDesktopNotificationEffects'
import { useLiveControlStreams } from './components/useLiveControlStreams'
import { useStrategyActivityOpsModel } from './components/useStrategyActivityOpsModel'
import { useStrategyActivityProgressModel } from './components/useStrategyActivityProgressModel'
import { useStrategyBacktestSelectionModel } from './components/useStrategyBacktestSelectionModel'
import { useStrategyWorkflowActions } from './components/useStrategyWorkflowActions'
import { useStrategyWorkspaceActions } from './components/useStrategyWorkspaceActions'
import { useTradingExecutionActions } from './components/useTradingExecutionActions'
import { useWorkspaceControlActions } from './components/useWorkspaceControlActions'
import { useReplayWorkspaceModel } from './components/useReplayWorkspaceModel'
import { useReviewInspectorModel } from './components/useReviewInspectorModel'
import { useStrategyReviewCatalogModel } from './components/useStrategyReviewCatalogModel'
import { useDesktopUiActions } from './components/useDesktopUiActions'
import { useRuntimeAndSettingsModel } from './components/useRuntimeAndSettingsModel'
import { useWorkspaceDraftModel } from './components/useWorkspaceDraftModel'
import { useWorkspaceDraftSync } from './components/useWorkspaceDraftSync'
import { useWorkspaceFocusSync } from './components/useWorkspaceFocusSync'
import { useWorkspaceOpsCollectionsModel } from './components/useWorkspaceOpsCollectionsModel'
import { useWorkspaceNavigation } from './components/useWorkspaceNavigation'
import { useWorkspacePersistence } from './components/useWorkspacePersistence'
import { useWorkspaceServerSync } from './components/useWorkspaceServerSync'
import { useWorkspaceStatusModel } from './components/useWorkspaceStatusModel'
import StrategyWorkspaceContainer from './components/StrategyWorkspaceContainer'
import TradesWorkspaceContainer from './components/TradesWorkspaceContainer'
import type {
  LayoutPreset,
  Mode,
  SectionKey,
} from './types'

import {
  buildSettingsDraft,
  withDraftPresetOption,
  normalizeDraftValue,
  formatTime,
  coerceParameterValue,
  schedulerLabel,
  backtestSampleQualityMeta,
  backtestDecisionReadinessMeta,
  backtestLineageMeta,
  backtestWindowMeta,
} from './utils/app-helpers'
import {
  buildWorkspaceSignature,
  defaultCardOrder,
  type MarketTimeframe,
  normalizeCardIds,
  normalizeCollapsedCardIds,
  normalizeVisibleCardIds,
  readWorkspaceBootstrap,
  type WorkspaceBootstrap,
} from './utils/workspace-helpers'
import type {
  SettingsDraft
} from './utils/app-helpers'

const backtestRangePresets = [
  { value: '最近 30 天', label: '近 30 天' },
  { value: '最近 90 天', label: '近 90 天' },
  { value: '最近 180 天', label: '近 180 天' },
] as const
const backtestTimeframePresets = [
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
] as const
const marketTimeframePresets = [
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
] as const
type ActionFeedback = {
  tone: 'success' | 'warning' | 'error'
  title: string
  detail: string
}

function App() {
  const queryClient = useQueryClient()
  const [workspaceBootstrap] = useState<WorkspaceBootstrap>(() => readWorkspaceBootstrap())
  const [activeSection, setActiveSection] = useState<SectionKey>(workspaceBootstrap.active_section)
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>(workspaceBootstrap.layout_preset)
  const [selectedMode, setSelectedMode] = useState<Mode>(workspaceBootstrap.selected_mode)
  const [selectedSymbol, setSelectedSymbol] = useState(workspaceBootstrap.selected_symbol)
  const [selectedMarketTimeframe, setSelectedMarketTimeframe] = useState<MarketTimeframe>(workspaceBootstrap.selected_market_timeframe)
  const [selectedStrategyId, setSelectedStrategyId] = useState(workspaceBootstrap.selected_strategy_id)
  const [cardOrder, setCardOrder] = useState(() => normalizeCardIds(workspaceBootstrap.overview_card_order))
  const [visibleOverviewCards, setVisibleOverviewCards] = useState(() =>
    normalizeVisibleCardIds(workspaceBootstrap.overview_visible_cards, workspaceBootstrap.overview_card_order),
  )
  const [collapsedOverviewCards, setCollapsedOverviewCards] = useState(() =>
    normalizeCollapsedCardIds(workspaceBootstrap.overview_collapsed_cards, workspaceBootstrap.overview_card_order),
  )
  const [workspaceSavedAt, setWorkspaceSavedAt] = useState<string | null>(workspaceBootstrap.updated_at)
  const [lastSyncedWorkspaceSignature, setLastSyncedWorkspaceSignature] = useState(() =>
    buildWorkspaceSignature(workspaceBootstrap),
  )
  const [workspaceConflict, setWorkspaceConflict] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null)
  const [statusInspectorOpen, setStatusInspectorOpen] = useState(false)
  const [accountInspectorOpen, setAccountInspectorOpen] = useState(false)
  const [watchlistManagerOpen, setWatchlistManagerOpen] = useState(false)
  const [schedulerControlsOpen, setSchedulerControlsOpen] = useState(false)
  const [grafanaPreviewOpen, setGrafanaPreviewOpen] = useState(false)
  const [manualTradePanelOpen, setManualTradePanelOpen] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [orderHistoryPanelOpen, setOrderHistoryPanelOpen] = useState(false)
  const [strategyEditorOpen, setStrategyEditorOpen] = useState(
    workspaceBootstrap.selected_strategy_detail_panel === 'editor',
  )
  const [strategyActivityPanelOpen, setStrategyActivityPanelOpen] = useState(
    workspaceBootstrap.selected_strategy_detail_panel === 'activity',
  )
  const [strategyTrackingPanelOpen, setStrategyTrackingPanelOpen] = useState(
    workspaceBootstrap.selected_strategy_detail_panel === 'tracking',
  )
  const [reviewInspectorOpen, setReviewInspectorOpen] = useState(
    Boolean(workspaceBootstrap.selected_review_inspector_id),
  )
  const [reviewInspectorReviewId, setReviewInspectorReviewId] = useState<string | null>(
    workspaceBootstrap.selected_review_inspector_id,
  )
  const [reviewInspectorStrategyId, setReviewInspectorStrategyId] = useState<string | null>(
    workspaceBootstrap.selected_review_inspector_strategy_id,
  )
  const [aiSchedulerFocusedJobId, setAiSchedulerFocusedJobId] = useState<string | null>(
    workspaceBootstrap.selected_scheduler_job_id,
  )
  const [strategyTrackingKind, setStrategyTrackingKind] = useState<'issue' | 'change'>(
    workspaceBootstrap.selected_strategy_tracking_kind ?? 'issue',
  )
  const [strategyTrackingSummary, setStrategyTrackingSummary] = useState(
    workspaceBootstrap.selected_strategy_tracking_summary,
  )
  const [strategyTrackingDetail, setStrategyTrackingDetail] = useState(
    workspaceBootstrap.selected_strategy_tracking_detail,
  )
  const [strategyTrackingRequestKey, setStrategyTrackingRequestKey] = useState(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  )
  const [replayFocusedReviewId, setReplayFocusedReviewId] = useState<string | null>(
    workspaceBootstrap.selected_review_id,
  )
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    workspaceBootstrap.selected_proposal_id,
  )
  const [selectedChangeRequestId, setSelectedChangeRequestId] = useState<string | null>(
    workspaceBootstrap.selected_change_request_id,
  )
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<'all' | 'P0' | 'P1' | 'P2'>(workspaceBootstrap.alert_severity_filter)
  const [alertStatusFilter, setAlertStatusFilter] = useState<'all' | 'pending' | 'acknowledged'>(workspaceBootstrap.alert_status_filter)
  const [alertScopeFilter, setAlertScopeFilter] = useState<'all' | 'selected'>(workspaceBootstrap.alert_scope_filter)
  const [tradeModeFilter, setTradeModeFilter] = useState<'all' | Mode>(workspaceBootstrap.trade_mode_filter)
  const [tradeOriginFilter, setTradeOriginFilter] = useState<'all' | 'manual' | 'strategy' | 'exchange'>(workspaceBootstrap.trade_origin_filter)
  const [tradeScopeFilter, setTradeScopeFilter] = useState<'all' | 'selected'>(workspaceBootstrap.trade_scope_filter)
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'critical'>(workspaceBootstrap.audit_severity_filter)
  const [auditSourceFilter, setAuditSourceFilter] = useState(workspaceBootstrap.audit_source_filter)
  const [auditScopeFilter, setAuditScopeFilter] = useState<'all' | 'selected'>(workspaceBootstrap.audit_scope_filter)
  const [auditSearch, setAuditSearch] = useState(workspaceBootstrap.audit_search)
  const [watchlistDraftSymbol, setWatchlistDraftSymbol] = useState('')
  const [watchlistDraftMarket, setWatchlistDraftMarket] = useState<'spot' | 'perp'>('perp')
  const [watchlistAlertDrafts, setWatchlistAlertDrafts] = useState<Record<string, string>>({})
  const [parameterDrafts, setParameterDrafts] = useState<Record<string, string>>(
    workspaceBootstrap.selected_strategy_editor_parameter_drafts,
  )
  const [riskBudgetDraft, setRiskBudgetDraft] = useState(workspaceBootstrap.selected_strategy_editor_risk_budget_draft)
  const [strategyEditorDraftStrategyId, setStrategyEditorDraftStrategyId] = useState<string | null>(
    workspaceBootstrap.selected_strategy_editor_strategy_id,
  )
  const [backtestFilter, setBacktestFilter] = useState<'selected' | 'all'>(workspaceBootstrap.backtest_filter)
  const [replayTrackingScope, setReplayTrackingScope] = useState<'all' | 'selected'>(workspaceBootstrap.replay_tracking_scope)
  const [selectedBacktestId, setSelectedBacktestId] = useState<string | null>(workspaceBootstrap.selected_backtest_id)
  const [backtestRangeDraft, setBacktestRangeDraft] = useState<string>(backtestRangePresets[1].value)
  const [backtestTimeframeDraft, setBacktestTimeframeDraft] = useState<string>('1h')
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(() => buildSettingsDraft())
  const [manualOrder, setManualOrder] = useState({
    side: 'buy' as 'buy' | 'sell',
    quantity: '1',
    price: '0',
    note: '',
  })
  const manualOrderSymbolRef = useRef<string | null>(null)
  const lastLoadedSettingsSignatureRef = useRef<string | null>(null)
  const desktopNotificationPermissionRequestedRef = useRef(false)
  const recentDesktopNotificationRef = useRef<Map<string, number>>(new Map())
  const seenAlertNotificationIdsRef = useRef<Set<string>>(new Set())
  const seenAgentJobStatusRef = useRef<Map<string, string>>(new Map())
  const seenOpsNotificationIdsRef = useRef<Set<string>>(new Set())
  const lastSchedulerStatusRef = useRef<string | null>(null)
  const notificationBootstrapRef = useRef({
    alerts: false,
    jobs: false,
    scheduler: false,
    ops: false,
  })
  const seedSelectedManualOrderPrice = useCallback((latestPrice: number) => {
    setManualOrder((current) => ({ ...current, price: latestPrice.toFixed(2) }))
  }, [])

  const {
    liveMarketEnabled,
    watchlist,
    watchlistErrorMessage,
    marketDetail,
    marketRenderableDetail,
    marketDiagnostics,
    marketDiagnosticsSummary,
    marketDiagnosticsTitle,
    marketDetailLoading,
    marketDetailErrorMessage,
    seedMarketLiveCaches,
    handleSelectMarketSymbol,
    handleSelectMarketTimeframe,
  } = useMarketWorkspaceModel({
    activeSection,
    selectedSymbol,
    setSelectedSymbol,
    selectedMarketTimeframe,
    setSelectedMarketTimeframe,
    marketTimeframeOptions: marketTimeframePresets,
    onSelectedPrice: seedSelectedManualOrderPrice,
  })
  const liveAiStreamEnabled = activeSection === 'scheduler'
  const liveOpsStreamEnabled =
    activeSection === 'alerts' || activeSection === 'trades' || activeSection === 'audit'
  const liveAccountStreamEnabled = activeSection === 'trades'

  const liveStrategyStreamEnabled = activeSection === 'strategy'
  const {
    runtimeWorkerStatusQuery,
    snapshot,
    strategiesQuery,
    strategies,
    selectedStrategy,
    selectedStrategyRuntime,
    activeStrategyId,
    strategyNameMap,
    strategyActivityQuery,
    strategyActivityQueryErrorMessage,
    backtests,
    scheduler,
    schedulerQuery,
    aiLiveQuery,
    opsLive,
    news,
    alerts,
    alertsNotificationBootstrapReady,
    jobsNotificationBootstrapReady,
    opsNotificationBootstrapReady,
    accountOverview,
    accountPositions,
    accountOrders,
    editingOrder,
    accountOrderHistory,
    trades,
    reviews,
    reviewsQuery,
    selectedStrategyReviewsQuery,
    selectedBacktestReviewsQuery,
    replayTrackingReviewsQuery,
    auditEvents,
    settings,
    settingsQuery,
    metricsPreviewLines,
    workspacePreferences,
    workspaceQuery,
    openClawStatus,
    bybitPrivateStatus,
    bybitPublicStatus,
    bybitPublicVisibleDiagnostics,
    changeRequests,
    changeRequestsQuery,
    serviceAvailable,
    selectedModeStrategyPreview,
    selectedStrategyActivity,
    grafanaStatus,
    latestSchedulerCommand,
    notificationQuietHoursActive,
  } = useControlDataQueryModel({
    activeSection,
    selectedMode,
    selectedStrategyId,
    selectedBacktestId,
    backtestFilter,
    replayTrackingScope,
    strategyActivityPanelOpen,
    grafanaPreviewOpen,
    editingOrderId,
  })

  const { showFeedback, dispatchDesktopNotification, openLocalPath } = useDesktopUiActions({
    setActionFeedback,
    settings,
    desktopNotificationPermissionRequestedRef,
    recentDesktopNotificationRef,
  })

  useEffect(() => {
    const missingAiCenter = !workspaceBootstrap.overview_card_order.includes('ai_center')
    const missingStrategyWatch = !workspaceBootstrap.overview_card_order.includes('strategy_watch')
    const missingAccountCenter = !workspaceBootstrap.overview_card_order.includes('account_center')
    const hiddenAiCenter = !visibleOverviewCards.includes('ai_center')
    if (!missingAiCenter && !missingStrategyWatch && !missingAccountCenter && !hiddenAiCenter) return

    const nextOrder = normalizeCardIds([...defaultCardOrder])
    const nextVisible = normalizeVisibleCardIds(
      [...visibleOverviewCards, 'ai_center', 'strategy_watch', 'account_center'],
      nextOrder,
    )

    if (JSON.stringify(nextOrder) !== JSON.stringify(cardOrder)) {
      setCardOrder(nextOrder)
    }
    if (JSON.stringify(nextVisible) !== JSON.stringify(visibleOverviewCards)) {
      setVisibleOverviewCards(nextVisible)
    }
  }, [cardOrder, visibleOverviewCards, workspaceBootstrap.overview_card_order])

  useEffect(() => {
    const firstStrategy = strategiesQuery.data?.[0]?.id
    const hasSelectedStrategy = strategiesQuery.data?.some((item) => item.id === selectedStrategyId)
    if (firstStrategy && (!selectedStrategyId || !hasSelectedStrategy)) {
      setSelectedStrategyId(firstStrategy)
    }
  }, [selectedStrategyId, strategiesQuery.data])

  useEffect(() => {
    const latestClose = marketDetail?.candles.at(-1)?.close
    const currentSymbol = marketDetail?.symbol
    if (latestClose && currentSymbol) {
      setManualOrder((current) => ({
        ...current,
        price:
          manualOrderSymbolRef.current !== currentSymbol || current.price === '0'
            ? latestClose.toFixed(2)
            : current.price,
      }))
      manualOrderSymbolRef.current = currentSymbol
    }
  }, [marketDetail?.symbol, marketDetail?.updated_at, marketDetail?.candles])

  useLiveControlStreams({
    liveMarketEnabled,
    selectedSymbol,
    selectedMarketTimeframe,
    queryClient,
    seedMarketLiveCaches,
    liveAiStreamEnabled,
    liveOpsStreamEnabled,
    liveAccountStreamEnabled,
    liveStrategyStreamEnabled,
  })

  const runtimeWorkerStatus = runtimeWorkerStatusQuery.data
  const {
    watchlistAlertSignature,
    selectedWatchItem,
    selectedStrategyRuntimePreview,
    settingsDraftDirty,
    snapshotExecutionHealth,
    desktopNotificationsEnabled,
    runtimeWorkerNeedsRecovery,
    runtimeWorkerRestoreHint,
    aiActivityFeed,
  } = useRuntimeAndSettingsModel({
    runtimeWorkerStatusData: runtimeWorkerStatus,
    watchlist,
    selectedSymbol,
    selectedStrategyRuntime,
    selectedModeStrategyPreview,
    settings,
    settingsDraft,
    setSettingsDraft,
    lastLoadedSettingsSignatureRef,
    snapshot,
    aiLiveData: aiLiveQuery.data,
    auditEvents,
  })
  const {
    backtestReviewJobs,
    latestStrategyBacktest,
    latestStrategyBacktestDecisionMeta,
    latestStrategyBacktestSampleMeta,
    latestStrategyBacktestWindowMeta,
    strategyProposals,
    selectedStrategyReviews,
    reviewCatalog,
    proposalCatalog,
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
  } = useStrategyReviewCatalogModel({
    selectedStrategy,
    backtests,
    reviews,
    selectedStrategyReviewsData: selectedStrategyReviewsQuery.data,
    selectedBacktestReviewsData: selectedBacktestReviewsQuery.data,
    replayTrackingReviewsData: replayTrackingReviewsQuery.data,
    changeRequests,
    schedulerJobs: scheduler?.jobs ?? [],
  })
  const strategyActivityDecisionModel = useStrategyActivityDecisionModel({
    selectedStrategyActivity,
    selectedStrategy,
    selectedProposalId,
    selectedChangeRequestId,
    selectedBacktestId,
    reviewInspectorReviewId,
    replayFocusedReviewId,
    aiSchedulerFocusedJobId,
    schedulerJobs: scheduler?.jobs ?? [],
    reviewCatalog,
    strategyProposals,
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
    schedulerState: snapshot?.scheduler ?? null,
  })
  const {
    focusedTrackingReviewId,
    focusedPrimaryReviewId,
    strategyActivityReviewRecords,
    strategyActivityJobRecords,
    selectedStrategyProposal,
    activityLatestActionableProposal,
  } = strategyActivityDecisionModel
  const {
    latestStrategyBacktestReview,
    latestStrategyBacktestReviewJob,
    latestStrategyBacktestReviewJobMeta,
    selectedStrategyPrimaryReviews,
    openStrategyProposals,
    gatedPublishProposalCount,
    allStrategyChangeRequests,
    selectedStrategyChangeRequest,
    strategyChangeRequests,
    selectedStrategyReview,
    selectedStrategyParameterSignature,
    backtestsForWorkspace,
    selectedBacktest,
    selectedBacktestReview,
    selectedBacktestReviewJob,
    selectedBacktestProposals,
    selectedBacktestDecisionMeta,
    selectedBacktestSampleMeta,
    selectedBacktestLineageMeta,
    selectedBacktestWindowMeta,
    selectedBacktestReviewJobMeta,
  } = useStrategyBacktestSelectionModel({
    latestStrategyBacktest,
    selectedStrategy,
    selectedChangeRequestId,
    selectedBacktestId,
    selectedStrategyReviews,
    selectedBacktestReviewsData: selectedBacktestReviewsQuery.data,
    reviewCatalog,
    backtests,
    backtestFilter,
    backtestReviewJobs,
    strategyProposals,
    changeRequests,
  })
  const strategyActivityProgressModel = useStrategyActivityProgressModel({
    selectedStrategyActivity,
    selectedStrategy,
    selectedStrategyChangeRequest,
    selectedStrategyProposal,
    selectedBacktest,
    focusedPrimaryReviewId,
    focusedTrackingReviewId,
    aiSchedulerFocusedJobId,
    reviewCatalog,
    backtests,
    backtestReviewJobs,
    strategyActivityReviewRecords,
    strategyActivityJobRecords,
    schedulerJobs: scheduler?.jobs ?? [],
    proposalCatalog,
    strategyProposals,
  })
  useEffect(() => {
    if (!strategyActivityQuery.isError) {
      return
    }
    console.error('[strategy-activity-query:error]', {
      strategyId: activeStrategyId,
      message: strategyActivityQueryErrorMessage || 'unknown error',
    })
  }, [activeStrategyId, strategyActivityQuery.isError, strategyActivityQueryErrorMessage])
  const strategyActivityOpsModel = useStrategyActivityOpsModel({
    selectedStrategyActivity,
    selectedMode,
  })
  const latestWorkspaceBacktest = backtestsForWorkspace[0]
  const latestWorkspaceBacktestDecisionMeta = backtestDecisionReadinessMeta(latestWorkspaceBacktest)
  const latestWorkspaceBacktestSampleMeta = backtestSampleQualityMeta(latestWorkspaceBacktest)
  const latestWorkspaceBacktestWindowMeta = backtestWindowMeta(latestWorkspaceBacktest)
  const latestStrategyBacktestLineageMeta = backtestLineageMeta(latestStrategyBacktest)
  const selectedStrategyReviewLineageMeta =
    selectedStrategyReview?.period === 'backtest' ? backtestLineageMeta(selectedStrategyReview) : null
  const selectedStrategyReviewDecisionMeta =
    selectedStrategyReview?.period === 'backtest' &&
    (
      selectedStrategyReview.decision_readiness ||
      selectedStrategyReview.decision_readiness_detail ||
      selectedStrategyReview.decision_readiness_action ||
      selectedStrategyReview.decision_recommended_data_range ||
      selectedStrategyReview.decision_recommended_timeframe
    )
      ? backtestDecisionReadinessMeta(selectedStrategyReview)
      : null
  const backtestRangeOptions = withDraftPresetOption(backtestRangePresets, backtestRangeDraft, '当前区间')
  const backtestTimeframeOptions = withDraftPresetOption(backtestTimeframePresets, backtestTimeframeDraft, '当前周期')
  const backtestParameterComparison = selectedBacktest
    ? Array.from(
        new Set([
          ...Object.keys(selectedBacktest.parameter_snapshot),
          ...(selectedStrategy?.parameters ?? []).map((parameter) => parameter.key),
        ]),
      ).map((key) => {
        const strategyParameter = selectedStrategy?.parameters.find((parameter) => parameter.key === key)
        const backtestValue = selectedBacktest.parameter_snapshot[key]
        const currentValue = strategyParameter?.value
        return {
          key,
          label: strategyParameter?.label ?? key,
          backtestValue: backtestValue == null ? '--' : String(backtestValue),
          currentValue: currentValue == null ? '--' : String(currentValue),
          changed:
            backtestValue != null &&
            currentValue != null &&
            String(backtestValue) !== String(currentValue),
        }
      })
    : []

  useDesktopNotificationEffects({
    desktopNotificationsEnabled,
    alertsNotificationBootstrapReady,
    jobsNotificationBootstrapReady,
    opsNotificationBootstrapReady,
    alerts,
    schedulerJobs: scheduler?.jobs ?? [],
    schedulerState: scheduler?.scheduler ?? null,
    auditEvents,
    notificationBootstrapRef,
    seenAlertNotificationIdsRef,
    seenAgentJobStatusRef,
    seenOpsNotificationIdsRef,
    lastSchedulerStatusRef,
    dispatchDesktopNotification,
  })

  useWorkspaceDraftSync({
    selectedStrategy,
    selectedStrategyId,
    selectedStrategyParameterSignature,
    strategyEditorDraftStrategyId,
    strategyEditorOpen,
    setParameterDrafts,
    setRiskBudgetDraft,
    setStrategyEditorDraftStrategyId,
    watchlist,
    watchlistAlertSignature,
    setWatchlistAlertDrafts,
    backtestsForWorkspace,
    selectedBacktestId,
    setSelectedBacktestId,
    selectedProposalId,
    reviewsLoaded: reviewsQuery.data !== undefined,
    proposalCatalog,
    setSelectedProposalId,
    reviewInspectorOpen,
    reviewInspectorReviewId,
    reviewInspectorStrategyId,
    reviewCatalog,
    setReviewInspectorOpen,
    setReviewInspectorReviewId,
    setReviewInspectorStrategyId,
    replayFocusedReviewId,
    setReplayFocusedReviewId,
    aiSchedulerFocusedJobId,
    schedulerLoaded: schedulerQuery.data !== undefined,
    schedulerJobs: scheduler?.jobs ?? [],
    setAiSchedulerFocusedJobId,
    selectedChangeRequestId,
    changeRequestsLoaded: changeRequestsQuery.data !== undefined,
    changeRequests,
    setSelectedChangeRequestId,
    editingOrderId,
    editingOrder,
    setEditingOrderId,
    setManualTradePanelOpen,
  })

  useWorkspaceFocusSync({
    activeSection,
    selectedProposalId,
    selectedChangeRequestId,
    proposalCatalog,
    replayFocusedReviewId,
    reviewCatalog,
    reviewInspectorOpen,
    reviewInspectorReviewId,
    reviewInspectorStrategyId,
    aiSchedulerFocusedJobId,
    schedulerJobs: scheduler?.jobs ?? [],
    changeRequests,
    strategies,
    selectedStrategyCurrentId: selectedStrategy?.id ?? null,
    selectedStrategyId,
    selectedSymbol,
    setSelectedStrategyId,
    setSelectedSymbol,
    setReviewInspectorStrategyId,
  })

  useEffect(() => {
    if (editingOrderId && !editingOrder) {
      setEditingOrderId(null)
      setManualTradePanelOpen(false)
    }
  }, [editingOrder, editingOrderId])

  const parameterDraftPatch = selectedStrategy
    ? Object.fromEntries(
        selectedStrategy.parameters.flatMap((parameter) => {
          const draftValue = parameterDrafts[parameter.key]
          const normalizedCurrent = normalizeDraftValue(parameter.value)
          if (draftValue == null || draftValue === normalizedCurrent) {
            return []
          }
          return [[parameter.key, coerceParameterValue(parameter.value, draftValue)]]
        }),
      )
    : {}
  const hasParameterDraftChanges = Object.keys(parameterDraftPatch).length > 0
  const riskBudgetChanged = Boolean(selectedStrategy && riskBudgetDraft.trim() && riskBudgetDraft !== selectedStrategy.risk_budget)

  const {
    manualOrderQuantity,
    manualOrderPrice,
    manualTradePreviewQuery,
    manualTradePreview,
    manualTradingBlockedReason,
    selectedStrategyNeedsRuntimeRecovery,
  } = useManualTradePreviewModel({
    marketDetail,
    selectedMode,
    manualOrder,
    manualTradePanelOpen,
    serviceAvailable,
    editingOrderId,
    bybitPrivateStatus,
    selectedStrategyRuntimePreview,
    selectedStrategyRuntime,
    runtimeWorkerNeedsRecovery,
  })
  const { refreshControlData, saveWorkspacePreferences, workspaceMutationPending } =
    useControlRefreshActions({
      queryClient,
      setWorkspaceSavedAt,
      setLastSyncedWorkspaceSignature,
    })

  const tradingExecutionActions = useTradingExecutionActions({
    refreshControlData,
    marketDetail,
    selectedMode,
    manualOrder,
    manualOrderQuantity,
    manualOrderPrice,
    manualTradingBlockedReason,
    editingOrderId,
    setSelectedSymbol,
    setManualOrder,
    setEditingOrderId,
    setManualTradePanelOpen,
    manualOrderSymbolRef,
    showFeedback,
  })
  const {
    tradeProbeResult,
    tradeProbePending,
    manualTradeMutationPending,
    exchangeOrderMutationPending,
    paperOrderMutationPending,
    replacePaperOrderPending,
    replaceExchangeOrderPending,
    cancelPaperOrderPending,
    cancelExchangeOrderPending,
    cancelAllPaperOrdersPending,
    cancelAllExchangeOrdersPending,
    closeAllPaperPositionsPending,
    closeAllExchangePositionsPending,
    closePaperPositionPending,
    closeExchangePositionPending,
    openOrderEditor,
    closePaperPosition,
    closeExchangePosition,
    closeAllPaperPositions,
    closeAllExchangePositions,
    cancelPaperOrder,
    cancelExchangeOrder,
    cancelAllExchangeOrders,
    cancelAllPaperOrders,
  } = tradingExecutionActions

  const {
    filteredReplayTrackingReviews,
    latestTrackingReview,
    filteredReplayTrackingJobs,
    replayFocusReview,
    replayFocusReviewLineageMeta,
    replayFocusReviewDecisionMeta,
    backtestFocusLabels,
    proposalFocusLabels,
    replayProposalFeed,
  } = useReplayWorkspaceModel({
    reviews,
    replayTrackingReviewsData: replayTrackingReviewsQuery.data,
    selectedStrategy,
    selectedStrategyPrimaryReviews,
    selectedStrategyReviews,
    schedulerJobs: scheduler?.jobs ?? [],
    replayTrackingScope,
    selectedProposalId,
    selectedChangeRequestId,
    selectedBacktestId,
    reviewInspectorReviewId,
    replayFocusedReviewId,
    aiSchedulerFocusedJobId,
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
  })

  const findProposalById = (proposalId: string) =>
    strategyProposals.find((item) => item.id === proposalId) ??
    replayProposalFeed.find((item) => item.proposal.id === proposalId)?.proposal ??
    null

  const { currentWorkspaceDraft } = useWorkspaceDraftModel({
    activeSection,
    layoutPreset,
    selectedMode,
    selectedSymbol,
    selectedMarketTimeframe,
    selectedStrategy,
    selectedStrategyId,
    selectedBacktestId,
    aiSchedulerFocusedJobId,
    strategyActivityPanelOpen,
    strategyTrackingPanelOpen,
    strategyEditorOpen,
    strategyTrackingKind,
    strategyTrackingSummary,
    strategyTrackingDetail,
    strategyEditorDraftStrategyId,
    parameterDrafts,
    riskBudgetDraft,
    reviewInspectorOpen,
    reviewInspectorReviewId,
    reviewInspectorStrategyId,
    replayFocusedReviewId,
    selectedProposalId,
    selectedChangeRequestId,
    backtestFilter,
    replayTrackingScope,
    alertSeverityFilter,
    alertStatusFilter,
    alertScopeFilter,
    tradeModeFilter,
    tradeOriginFilter,
    tradeScopeFilter,
    auditSeverityFilter,
    auditSourceFilter,
    auditScopeFilter,
    auditSearch,
    cardOrder,
    visibleOverviewCards,
    collapsedOverviewCards,
  })
  const showStrategyWatch = true
  const compactStrategyWatch = layoutPreset !== 'balanced'
  const { applyWorkspaceStateWithMarketPrefetch } = useWorkspaceServerSync({
    queryClient,
    currentWorkspaceDraft,
    workspaceQueryData: workspaceQuery.data,
    lastSyncedWorkspaceSignature,
    setWorkspaceConflict,
    setWorkspaceSavedAt,
    setLastSyncedWorkspaceSignature,
    setActiveSection,
    setLayoutPreset,
    setSelectedMode,
    setSelectedSymbol,
    setSelectedMarketTimeframe,
    setSelectedStrategyId,
    setSelectedBacktestId,
    setAiSchedulerFocusedJobId,
    setStrategyActivityPanelOpen,
    setStrategyTrackingPanelOpen,
    setStrategyEditorOpen,
    setStrategyTrackingKind,
    setStrategyTrackingSummary,
    setStrategyTrackingDetail,
    setParameterDrafts,
    setRiskBudgetDraft,
    setStrategyEditorDraftStrategyId,
    setReviewInspectorReviewId,
    setReviewInspectorOpen,
    setReviewInspectorStrategyId,
    setReplayFocusedReviewId,
    setSelectedProposalId,
    setSelectedChangeRequestId,
    setBacktestFilter,
    setReplayTrackingScope,
    setAlertSeverityFilter,
    setAlertStatusFilter,
    setAlertScopeFilter,
    setTradeModeFilter,
    setTradeOriginFilter,
    setTradeScopeFilter,
    setAuditSeverityFilter,
    setAuditSourceFilter,
    setAuditScopeFilter,
    setAuditSearch,
    setCardOrder,
    setVisibleOverviewCards,
    setCollapsedOverviewCards,
  })
  const {
    workspaceDirty,
    syncWorkspacePreferences,
    restoreDefaultWorkspace,
    applyServerWorkspace,
  } = useWorkspacePersistence({
    currentWorkspaceDraft,
    workspaceSavedAt,
    lastSyncedWorkspaceSignature,
    workspaceQueryData: workspaceQuery.data,
    serviceAvailable,
    saveWorkspacePreferences,
    setLastSyncedWorkspaceSignature,
    applyWorkspaceStateWithMarketPrefetch,
    setWorkspaceSavedAt,
    setWorkspaceConflict,
    showFeedback,
    watchlistFirstSymbol: watchlist[0]?.symbol,
    strategiesFirstId: strategies[0]?.id,
  })
  const {
    headlineAlert,
    pendingAlertsCount,
    filteredAlerts,
    filteredTrades,
    filteredAccountOrders,
    filteredOrderHistory,
    auditSourceOptions,
    filteredAuditEvents,
    overviewQueuedRequests,
  } = useWorkspaceOpsCollectionsModel({
    alerts,
    trades,
    accountOrders,
    accountOrderHistory,
    auditEvents,
    changeRequests,
    selectedSymbol,
    alertSeverityFilter,
    alertStatusFilter,
    alertScopeFilter,
    tradeModeFilter,
    tradeOriginFilter,
    tradeScopeFilter,
    auditSeverityFilter,
    auditSourceFilter,
    auditScopeFilter,
    auditSearch,
  })
  const overviewWatchlistItems = showStrategyWatch ? watchlist.slice(0, compactStrategyWatch ? 6 : 10) : []
  const overviewAiEvents = aiActivityFeed.slice(0, 6)
  const {
    openSection,
    openStrategyEditor,
    openStrategyActivity,
    openStrategyReplay,
    openReplayReview,
    openBacktestDetail,
    openSourceReview,
    openStrategyProposal,
    openChangeRequest,
    openReviewInspector,
    openAiSchedulerJob,
    openMarketSymbol,
    openAlertsSection,
    openTradesSection,
    openAuditSection,
  } = useWorkspaceNavigation({
    strategies,
    selectedStrategy,
    selectedStrategyId,
    strategyEditorDraftStrategyId,
    parameterDrafts,
    backtests,
    changeRequests,
    proposalCatalog,
    reviewCatalog,
    strategyActivityReviewRecords,
    schedulerJobs: scheduler?.jobs ?? [],
    strategyActivityJobRecords,
    setParameterDrafts,
    setRiskBudgetDraft,
    setStrategyEditorDraftStrategyId,
    setActiveSection,
    setSelectedStrategyId,
    setSelectedSymbol,
    setStrategyActivityPanelOpen,
    setStrategyTrackingPanelOpen,
    setStrategyEditorOpen,
    setReplayTrackingScope,
    setReplayFocusedReviewId,
    setBacktestFilter,
    setSelectedBacktestId,
    setReviewInspectorOpen,
    setReviewInspectorReviewId,
    setReviewInspectorStrategyId,
    setSelectedChangeRequestId,
    setSelectedProposalId,
    setAiSchedulerFocusedJobId,
    setAlertScopeFilter,
    setTradeScopeFilter,
    setAuditScopeFilter,
  })
  const reviewInspectorModel = useReviewInspectorModel({
    reviewCatalog,
    strategyActivityReviewRecords,
    reviewInspectorReviewId,
    reviewInspectorStrategyId,
    strategyNameMap,
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
    proposalFocusLabels,
    latestActionableProposalId: activityLatestActionableProposal?.id ?? null,
    schedulerState: snapshot?.scheduler ?? null,
  })
  const resetStrategyTrackingDraft = useCallback(
    (kind: 'issue' | 'change' = 'issue', nextSummary = '', nextDetail = '') => {
      setStrategyTrackingKind(kind)
      setStrategyTrackingSummary(nextSummary)
      setStrategyTrackingDetail(nextDetail)
      setStrategyTrackingRequestKey(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    },
    [],
  )
  const strategyWorkflowActions = useStrategyWorkflowActions({
    refreshControlData,
    selectedMode,
    selectedStrategy,
    selectedStrategyRuntimePreview,
    selectedStrategyRuntime,
    watchlist,
    strategies,
    backtests,
    reviewCatalog,
    schedulerState: snapshot?.scheduler,
    backtestRangeDraft,
    backtestTimeframeDraft,
    strategyTrackingKind,
    strategyTrackingSummary,
    strategyTrackingDetail,
    strategyTrackingRequestKey,
    findProposalById,
    setSelectedStrategyId,
    setBacktestRangeDraft,
    setBacktestTimeframeDraft,
    setSelectedBacktestId,
    setSelectedProposalId,
    setStrategyTrackingPanelOpen,
    setStrategyActivityPanelOpen,
    resetStrategyTrackingDraft,
    showFeedback,
    openAiSchedulerJob,
    openBacktestDetail,
    openChangeRequest,
  })
  const {
    changeRequestMutationPending,
    backtestMutationPending,
    executeStrategySignalMutationPending,
    agentJobMutationPending,
    strategyTrackingMutationPending,
    retryAgentJobMutationPending,
    proposalMutationPending,
    submitStrategyRequest,
    submitBacktest,
    rerunBacktestFromRecommendation,
    rerunBacktestFromReview,
    rerunBacktestFromChangeRequest,
    executeSelectedStrategySignal,
    submitReviewJob,
    retryAgentJob,
    handleProposalAction,
  } = strategyWorkflowActions
  const workspaceControlActions = useWorkspaceControlActions({
    refreshControlData,
    queryClient,
    settings,
    settingsDraft,
    settingsDraftDirty,
    setSettingsDraft,
    lastLoadedSettingsSignatureRef,
    desktopNotificationsEnabled,
    dispatchDesktopNotification,
    watchlistDraftSymbol,
    watchlistDraftMarket,
    watchlistAlertDrafts,
    setSelectedSymbol,
    setWatchlistDraftSymbol,
    setWatchlistManagerOpen,
    showFeedback,
    submitStrategyRequest,
  })
  const {
    schedulerMutationPending,
    restartRuntimeWorkerPending,
    alertMutationPending,
    watchlistAddPending,
    watchlistRemovePending,
    settingsMutationPending,
    runSchedulerCommand,
    restartStrategyRuntimeWorker,
    toggleSettingsNotificationChannel,
    restoreSettingsDraft,
    saveSettings,
    triggerDesktopNotificationTest,
    toggleAlertAcknowledged,
  } = workspaceControlActions
  const strategyWorkspaceActions = useStrategyWorkspaceActions({
    latestSchedulerCommand,
    selectedStrategy,
    selectedStrategyRuntime,
    parameterDraftPatch,
    hasParameterDraftChanges,
    riskBudgetDraft,
    resetStrategyTrackingDraft,
    setSelectedSymbol,
    setActiveSection,
    setStrategyEditorOpen,
    setStrategyActivityPanelOpen,
    setStrategyTrackingPanelOpen,
    showFeedback,
    submitStrategyRequest,
    openAiSchedulerJob,
    openReviewInspector,
    openBacktestDetail,
    openChangeRequest,
    openSourceReview,
    openStrategyProposal,
    openStrategyActivity,
  })
  const {
    openStrategyTrackingPanel,
    renderLatestSchedulerCommandActions,
  } = strategyWorkspaceActions
  const workspaceStatusModel = useWorkspaceStatusModel({
    actionFeedback,
    headlineAlert,
    latestSchedulerCommand,
    latestSchedulerCommandActions: renderLatestSchedulerCommandActions(),
    serviceAvailable,
    selectedMode,
    schedulerStatus: snapshot?.scheduler.status ?? 'degraded',
    schedulerQueueDepth: snapshot?.scheduler.queue_depth ?? 0,
    schedulerFreezePublish: Boolean(snapshot?.scheduler.freeze_publish),
    openClawReachable: Boolean(openClawStatus?.reachable),
    openClawGatewayUrl: openClawStatus?.gateway_url ?? settings?.openclaw_gateway_url ?? 'ws://127.0.0.1:18789',
    workspaceDirty,
    workspaceConflict,
    workspaceSavedAt,
    workspaceUpdatedAt: workspacePreferences?.updated_at,
    pendingAlertsCount,
    applyServerWorkspace,
    formatTime,
    schedulerLabel,
  })
  const {
    statusInspectorHasNotice,
    inlineToast,
    statusInspectorButtonTitle,
    latestSchedulerCommandBanner,
  } = workspaceStatusModel

  const selectedWatchAlertLabel = selectedWatchItem
    ? selectedWatchItem.alert_enabled
      ? `提醒 ${selectedWatchItem.alert_threshold_pct.toFixed(1)}%`
      : '提醒已关闭'
    : '提醒未配置'

  const marketHeader = marketDetail?.headline ?? '等待本地量化服务返回当前品种的跟踪摘要'
  const grafanaMetricsUrl = `${CONTROL_API_BASE}${grafanaStatus?.metrics_path ?? '/metrics'}`
  const strategyActivityFloatingPanelProps = buildStrategyActivityFloatingPanelProps({
    panelOpen: strategyActivityPanelOpen,
    selectedStrategy,
    selectedStrategyActivity,
    activeStrategyId,
    queryState: {
      status: strategyActivityQuery.status,
      fetchStatus: strategyActivityQuery.fetchStatus,
      errorMessage: strategyActivityQueryErrorMessage,
      loading: strategyActivityQuery.isFetching,
    },
    serviceState: {
      serviceAvailable,
      strategyTrackingPending: strategyTrackingMutationPending,
      selectedMode,
      alertMutationPending,
      cancelPaperOrderPending,
      cancelExchangeOrderPending,
      replacePaperOrderPending,
      replaceExchangeOrderPending,
      proposalMutationPending,
      backtestMutationPending,
      retryAgentJobMutationPending,
    },
    workspaceState: {
      selectedStrategyChangeRequest,
      selectedBacktest,
      backtests,
      reviewCatalog,
      backtestReviewJobs,
      selectedProposalId,
      selectedChangeRequestId,
      aiSchedulerFocusedJobId,
      replayFocusReview,
      schedulerState: snapshot?.scheduler,
    },
    decisionModel: strategyActivityDecisionModel,
    progressModel: strategyActivityProgressModel,
    opsModel: strategyActivityOpsModel,
    actions: {
      onTrack: () => openStrategyTrackingPanel('issue'),
      onClose: () => setStrategyActivityPanelOpen(false),
      onOpenAlertsSection: openAlertsSection,
      onOpenMarketSymbol: openMarketSymbol,
      onOpenTradesSection: openTradesSection,
      onOpenWatchlistManager: () => setWatchlistManagerOpen(true),
      onToggleAlertAcknowledged: (alertId, nextAcknowledged) => {
        void toggleAlertAcknowledged(alertId, nextAcknowledged)
      },
      onOpenOrderEditor: openOrderEditor,
      onCancelPaperOrder: (orderId) => {
        void cancelPaperOrder(orderId)
      },
      onCancelExchangeOrder: (orderId) => {
        void cancelExchangeOrder(orderId)
      },
      onOpenAuditSection: openAuditSection,
      onOpenAiSchedulerJob: openAiSchedulerJob,
      onOpenReviewInspector: openReviewInspector,
      onOpenChangeRequest: openChangeRequest,
      onOpenBacktestDetail: openBacktestDetail,
      onOpenSourceReview: openSourceReview,
      onOpenStrategyProposal: openStrategyProposal,
      onHandleProposalAction: (proposalId, action) => {
        void handleProposalAction(proposalId, action)
      },
      onRetryAgentJob: (jobId, options) => {
        void retryAgentJob(jobId, options)
      },
      onRerunBacktestFromChangeRequest: (request) => {
        void rerunBacktestFromChangeRequest(request)
      },
      onRerunBacktestFromRecommendation: (backtest) => {
        void rerunBacktestFromRecommendation(backtest)
      },
      onRerunBacktestFromReview: (review) => {
        void rerunBacktestFromReview(review)
      },
      onOpenReplayReview: openReplayReview,
      onOpenStrategyReplay: openStrategyReplay,
    },
    focusLabels: {
      proposalFocusLabels,
      backtestFocusLabels,
    },
  })
  const appOverlayPanelsProps = buildAppOverlayPanelsProps({
    panelState: {
      statusInspectorOpen,
      watchlistManagerOpen,
      schedulerControlsOpen,
      grafanaPreviewOpen,
      manualTradePanelOpen,
      orderHistoryPanelOpen,
      accountInspectorOpen,
      strategyEditorOpen,
      strategyTrackingPanelOpen,
      reviewInspectorOpen,
    },
    panelSetters: {
      setStatusInspectorOpen,
      setWatchlistManagerOpen,
      setSchedulerControlsOpen,
      setGrafanaPreviewOpen,
      setManualTradePanelOpen,
      setOrderHistoryPanelOpen,
      setAccountInspectorOpen,
      setStrategyEditorOpen,
      setStrategyTrackingPanelOpen,
      setReviewInspectorOpen,
      setWatchlistDraftSymbol,
      setWatchlistDraftMarket,
      setWatchlistAlertDrafts,
      setManualOrder,
      setTradeOriginFilter,
      setTradeScopeFilter,
      setParameterDrafts,
      setRiskBudgetDraft,
      setStrategyTrackingKind,
      setStrategyTrackingSummary,
      setStrategyTrackingDetail,
      setActiveSection,
      setReplayFocusedReviewId,
    },
    navigationActions: {
      onOpenSection: openSection,
      onOpenStrategyActivity: openStrategyActivity,
      onOpenStrategyReplay: openStrategyReplay,
      onOpenReviewInspector: openReviewInspector,
      onOpenChangeRequest: openChangeRequest,
      onOpenBacktestDetail: openBacktestDetail,
      onOpenSourceReview: openSourceReview,
      onOpenStrategyProposal: openStrategyProposal,
      onOpenAiSchedulerJob: openAiSchedulerJob,
    },
    workspaceStatusModel,
    workspaceControlActions,
    tradingExecutionActions,
    strategyWorkspaceActions,
    strategyWorkflowActions,
    reviewInspectorModel,
    dataState: {
      snapshotScheduler: snapshot?.scheduler,
      serviceAvailable,
      settings,
      grafanaStatus,
      metricsPreviewLines,
      pendingAlertsCount,
      selectedMode,
      selectedSymbol,
      editingOrder,
      manualOrder,
      manualTradePreviewLoading: manualTradePreviewQuery.isLoading,
      manualTradePreview,
      manualTradingBlockedReason,
      watchlist,
      watchlistDraftSymbol,
      watchlistDraftMarket,
      watchlistAlertDrafts,
      watchlistControlsDisabled: !serviceAvailable || changeRequestMutationPending,
      accountOverview,
      bybitPrivateStatus,
      bybitPublicStatus,
      tradeProbeResult,
      tradeProbePending,
      parameterDrafts,
      riskBudgetDraft,
      hasParameterDraftChanges,
      parameterDraftPatchCount: Object.keys(parameterDraftPatch).length,
      riskBudgetChanged,
      selectedStrategy,
      strategyTrackingKind,
      strategyTrackingSummary,
      strategyTrackingDetail,
      reviewInspectorReviewId,
      reviewInspectorStrategyId,
      tradeOriginFilter,
      tradeScopeFilter,
      filteredOrderHistory,
    },
    pendingState: {
      changeRequestMutationPending,
      schedulerMutationPending,
      watchlistAddPending,
      watchlistRemovePending,
      manualTradeMutationPending,
      exchangeOrderMutationPending,
      paperOrderMutationPending,
      replacePaperOrderPending,
      replaceExchangeOrderPending,
      cancelPaperOrderPending,
      cancelExchangeOrderPending,
      strategyTrackingMutationPending,
      backtestMutationPending,
      retryAgentJobMutationPending,
      proposalMutationPending,
    },
  })
  return (
    <AppChromeShell
      activeSection={activeSection}
      onOpenSection={openSection}
      statusInspectorHasNotice={statusInspectorHasNotice}
      statusInspectorButtonTitle={statusInspectorButtonTitle}
      onOpenStatusInspector={() => setStatusInspectorOpen(true)}
      inlineToast={inlineToast}
    >
      <AppOverlayPanelsContainer {...appOverlayPanelsProps} />

      <StrategyActivityFloatingPanelContainer {...strategyActivityFloatingPanelProps} />

      {activeSection === 'overview' && (
        <OverviewWorkspaceContainer
          layoutState={{
            layoutPreset,
            selectedSymbol,
            selectedStrategy,
            showStrategyWatch,
            overviewWatchlistItems,
            selectedMarketTimeframe,
            marketTimeframeOptions: marketTimeframePresets,
          }}
          marketState={{
            marketRenderableDetail,
            marketDiagnostics,
            marketDetailLoading,
            marketDetailErrorMessage,
            snapshotExecutionHealth,
            marketDiagnosticsTitle,
            marketDiagnosticsSummary,
          }}
          activityState={{
            schedulerJobs: scheduler?.jobs ?? [],
            overviewAiEvents,
            overviewQueuedRequests,
          }}
          actions={{
            onSelectMarketSymbol: handleSelectMarketSymbol,
            onSelectMarketTimeframe: handleSelectMarketTimeframe,
            onOpenReviewInspector: openReviewInspector,
            onOpenBacktestDetail: openBacktestDetail,
            onOpenSourceReview: openSourceReview,
            onOpenStrategyProposal: openStrategyProposal,
            onOpenStrategyActivity: openStrategyActivity,
            onOpenAiSchedulerJob: openAiSchedulerJob,
          }}
        />
      )}

      {activeSection === 'settings' && (
        <SettingsWorkspaceContainer
          workspaceState={{
            workspaceDirty,
            selectedMode,
            layoutPreset,
            serviceAvailable,
            schedulerMutationPending,
            currentSchedulerJobId: snapshot?.scheduler.current_job_id ?? null,
            schedulerFreezePublish: snapshot?.scheduler.freeze_publish,
            runtimeWorkerNeedsRecovery,
            runtimeWorkerRestartPending,
            runtimeWorkerRestoreHint,
            runtimeWorkerStatus,
            snapshotExecutionHealth,
            workspaceMutationPending,
            selectedStrategy,
          }}
          settingsState={{
            settingsMutationPending,
            settingsQueryLoading: settingsQuery.isLoading,
            settingsDraftDirty,
            settingsDraft,
            settings,
            notificationQuietHoursActive,
            bybitPrivateStatus,
            openClawStatus,
            bybitPublicStatus,
            bybitPublicVisibleDiagnostics,
            grafanaStatus,
            grafanaMetricsUrl,
          }}
          actions={{
            onSelectMode: setSelectedMode,
            onSelectLayoutPreset: setLayoutPreset,
            onRunSchedulerCommand: (command, reason, jobId) => {
              void runSchedulerCommand(command, reason, jobId)
            },
            onRestartRuntimeWorker: () => {
              void restartStrategyRuntimeWorker()
            },
            onTriggerDesktopNotificationTest: () => {
              void triggerDesktopNotificationTest()
            },
            onSyncWorkspacePreferences: () => {
              void syncWorkspacePreferences()
            },
            onRestoreDefaultWorkspace: restoreDefaultWorkspace,
            setSettingsDraft,
            onToggleSettingsNotificationChannel: toggleSettingsNotificationChannel,
            onOpenLocalPath: openLocalPath,
            onSaveSettings: () => {
              void saveSettings()
            },
            onRestoreSettingsDraft: restoreSettingsDraft,
          }}
        />
      )}

      {activeSection === 'market' && (
        <MarketWorkspaceContainer
          watchlistState={{
            watchlistErrorMessage,
            watchlist,
            selectedSymbol,
            selectedWatchAlertLabel,
          }}
          marketState={{
            marketDetail,
            marketRenderableDetail,
            marketDiagnostics,
            marketDiagnosticsSummary,
            marketDiagnosticsTitle,
            marketHeader,
            marketDetailLoading,
            marketDetailErrorMessage,
            selectedMarketTimeframe,
            marketTimeframeOptions: marketTimeframePresets,
            manualTradingBlockedReason,
          }}
          actions={{
            onSelectMarketSymbol: handleSelectMarketSymbol,
            onSelectMarketTimeframe: handleSelectMarketTimeframe,
            onOpenWatchlistManager: () => setWatchlistManagerOpen(true),
            onOpenManualTrade: () => {
              setEditingOrderId(null)
              setManualTradePanelOpen(true)
            },
          }}
        />
      )}

      {activeSection === 'strategy' && (
        <StrategyWorkspaceContainer
          activeSectionKey={activeSection}
          strategies={strategies}
          selectedStrategy={selectedStrategy}
          onSelectStrategyId={setSelectedStrategyId}
          currentPanelState={{
            latestStrategyBacktestAnnualReturn: latestStrategyBacktest?.metrics.annual_return ?? null,
            latestStrategyBacktestDecisionMeta,
            latestStrategyBacktestWindowMeta,
            latestStrategyBacktestSampleMeta,
            openStrategyProposalsCount: openStrategyProposals.length,
            selectedStrategyRuntime,
            selectedStrategyRuntimePreview,
            selectedMode,
            serviceAvailable,
            executeStrategySignalPending: executeStrategySignalMutationPending,
            strategyTrackingPending: strategyTrackingMutationPending,
            restartRuntimeWorkerPending,
            backtestMutationPending,
            changeRequestMutationPending,
            selectedStrategyNeedsRuntimeRecovery,
            runtimeWorkerRestoreHint,
            hasParameterDraftChanges,
            parameterDraftChangeCount: Object.keys(parameterDraftPatch).length,
            riskBudgetChanged,
            selectedStrategyReview,
            selectedStrategyReviewDecisionMeta,
            selectedStrategyReviewLineageMeta,
          }}
          executionContextState={
            selectedStrategy
              ? {
                  selectedStrategy,
                  latestStrategyBacktest,
                  latestStrategyBacktestDecisionMeta,
                  latestStrategyBacktestSampleMeta,
                  latestStrategyBacktestWindowMeta,
                  latestStrategyBacktestLineageMeta,
                  latestStrategyBacktestReview,
                  latestStrategyBacktestReviewJob,
                  latestStrategyBacktestReviewJobMeta,
                  selectedStrategyRuntime,
                  selectedStrategyChangeRequest,
                  allStrategyChangeRequests,
                  strategyChangeRequests,
                  strategyProposals,
                  backtests,
                  proposalBacktestMap,
                  proposalReviewMap,
                  proposalChangeRequestMap,
                  proposalAgentJobMap,
                  selectedProposalId,
                  selectedChangeRequestId,
                  selectedBacktestId,
                  reviewInspectorReviewId,
                  replayFocusedReviewId,
                  aiSchedulerFocusedJobId,
                  gatedPublishProposalCount,
                  schedulerState: snapshot?.scheduler,
                  serviceAvailable,
                  backtestMutationPending,
                  retryAgentJobMutationPending,
                  proposalMutationPending,
                }
              : null
          }
          actions={{
            onOpenStrategyEditor: openStrategyEditor,
            onExecuteSelectedStrategySignal: executeSelectedStrategySignal,
            onOpenStrategyActivityPanel: () => setStrategyActivityPanelOpen(true),
            onOpenStrategyTrackingPanel: openStrategyTrackingPanel,
            onRestartStrategyRuntimeWorker: restartStrategyRuntimeWorker,
            onSubmitBacktest: submitBacktest,
            onToggleStrategyStatus: () =>
              submitStrategyRequest(
                'strategy.pause_resume',
                `${selectedStrategy?.name ?? '当前策略'} 切换策略状态`,
                {
                  strategy_id: selectedStrategy?.id,
                  next_status: selectedStrategy?.status === 'running' ? 'paused' : 'running',
                },
                'high',
              ),
            onOpenReplayReview: openReplayReview,
            onOpenChangeRequest: openChangeRequest,
            onOpenBacktestDetail: openBacktestDetail,
            onOpenSourceReview: openSourceReview,
            onOpenStrategyProposal: openStrategyProposal,
            onRerunBacktestFromReview: rerunBacktestFromReview,
            onOpenAiSchedulerJob: openAiSchedulerJob,
            onOpenReviewInspector: openReviewInspector,
            onRetryAgentJob: retryAgentJob,
            onHandleProposalAction: handleProposalAction,
            onRerunBacktestFromRecommendation: rerunBacktestFromRecommendation,
            onRerunBacktestFromChangeRequest: rerunBacktestFromChangeRequest,
          }}
        />
      )}

      {activeSection === 'backtest' && (
        <BacktestWorkspaceContainer
          selectionState={{
            selectedStrategy,
            strategies,
            backtestFilter,
            selectedProposalId,
          }}
          draftState={{
            backtestTimeframeDraft,
            backtestTimeframeOptions,
            backtestRangeDraft,
            backtestRangeOptions,
          }}
          workspaceState={{
            backtestsForWorkspace,
            latestWorkspaceBacktest,
            latestWorkspaceBacktestDecisionMeta,
            latestWorkspaceBacktestWindowMeta,
            latestWorkspaceBacktestSampleMeta,
            openStrategyProposalsCount: openStrategyProposals.length,
            selectedBacktest,
            selectedBacktestSampleMeta,
            selectedBacktestWindowMeta,
            selectedBacktestDecisionMeta,
            selectedBacktestLineageMeta,
            selectedBacktestReview,
            selectedBacktestReviewJob,
            selectedBacktestReviewJobMeta,
            selectedBacktestProposals,
            proposalBacktestMap,
            proposalReviewMap,
            proposalChangeRequestMap,
            proposalAgentJobMap,
            schedulerState: snapshot?.scheduler,
            backtestParameterComparison,
          }}
          serviceState={{
            serviceAvailable,
            backtestMutationPending,
            proposalMutationPending,
            retryAgentJobMutationPending,
          }}
          actions={{
            onSelectBacktestFilter: setBacktestFilter,
            onSelectBacktestTimeframeDraft: setBacktestTimeframeDraft,
            onSelectBacktestRangeDraft: setBacktestRangeDraft,
            onSelectStrategyId: setSelectedStrategyId,
            onSubmitBacktest: submitBacktest,
            onOpenStrategySection: () => startTransition(() => openSection('strategy')),
            onSelectBacktestId: setSelectedBacktestId,
            onOpenChangeRequest: openChangeRequest,
            onOpenBacktestDetail: openBacktestDetail,
            onOpenSourceReview: openSourceReview,
            onOpenStrategyProposal: openStrategyProposal,
            onOpenAiSchedulerJob: openAiSchedulerJob,
            onOpenReplayReview: openReplayReview,
            onOpenReviewInspector: openReviewInspector,
            onRetryAgentJob: (jobId) => {
              void retryAgentJob(jobId)
            },
            onHandleProposalAction: handleProposalAction,
            onRerunBacktestFromRecommendation: (backtest) => {
              void rerunBacktestFromRecommendation(backtest)
            },
            onRerunBacktestFromReview: (review) => {
              void rerunBacktestFromReview(review)
            },
          }}
        />
      )}

      {activeSection === 'scheduler' && (
        <SchedulerWorkspaceContainer
          viewState={{
            activeSectionKey: activeSection,
            schedulerState: snapshot?.scheduler,
            schedulerJobs: scheduler?.jobs ?? [],
            aiActivityFeed,
            aiSchedulerFocusedJobId,
            openClawStatus,
            latestSchedulerCommandBanner,
          }}
          serviceState={{
            serviceAvailable,
            schedulerMutationPending,
            agentJobMutationPending,
            retryAgentJobPending: retryAgentJobMutationPending,
          }}
          actions={{
            onRunSchedulerCommand: (command, reason, jobId) => {
              void runSchedulerCommand(command, reason, jobId)
            },
            onOpenSchedulerControls: () => setSchedulerControlsOpen(true),
            onOpenGrafanaPreview: () => setGrafanaPreviewOpen(true),
            onSubmitReviewJob: () => {
              void submitReviewJob()
            },
            onOpenReviewInspector: openReviewInspector,
            onOpenChangeRequest: openChangeRequest,
            onOpenBacktestDetail: openBacktestDetail,
            onOpenSourceReview: openSourceReview,
            onOpenStrategyProposal: openStrategyProposal,
            onOpenStrategyActivity: openStrategyActivity,
            onRetryAgentJob: (jobId) => {
              void retryAgentJob(jobId)
            },
            onOpenAiSchedulerJob: openAiSchedulerJob,
          }}
        />
      )}

      {activeSection === 'news' && (
        <NewsWorkspaceContainer
          news={news}
          onOpenAlertsSection={() => startTransition(() => openSection('alerts'))}
        />
      )}

      {activeSection === 'alerts' && (
        <AlertsWorkspaceContainer
          summaryState={{
            pendingAlertsCount: opsLive?.summary.pending_alerts ?? pendingAlertsCount,
            p0AlertsCount: opsLive?.summary.p0_alerts ?? 0,
            notificationChannelsLabel: settings?.notification_channels.join(' / ') ?? '',
          }}
          filterState={{
            alertSeverityFilter,
            alertStatusFilter,
            alertScopeFilter,
            selectedSymbol,
          }}
          alertsState={{
            filteredAlerts,
            alertMutationPending,
          }}
          actions={{
            onAlertSeverityFilterChange: setAlertSeverityFilter,
            onAlertStatusFilterChange: setAlertStatusFilter,
            onToggleAlertScopeFilter: () =>
              setAlertScopeFilter((current) => (current === 'selected' ? 'all' : 'selected')),
            onOpenAlertMarket: (symbol) => {
              startTransition(() => setSelectedSymbol(symbol))
              startTransition(() => openSection('market'))
            },
            onOpenWatchlistManager: () => setWatchlistManagerOpen(true),
            onToggleAlertAcknowledged: (alertId, nextAcknowledged) => {
              void toggleAlertAcknowledged(alertId, nextAcknowledged)
            },
          }}
        />
      )}

      {activeSection === 'trades' && (
        <TradesWorkspaceContainer
          summaryState={{
            privateApiReady: Boolean(bybitPrivateStatus?.can_query_private),
            accountOverview,
            todayRealizedPnl: snapshot?.today_performance.realized_pnl ?? null,
            recentTradesCount: opsLive?.summary.recent_trades ?? trades.length,
            manualTradesCount: opsLive?.summary.manual_trades ?? 0,
          }}
          filterState={{
            selectedMode,
            tradeModeFilter,
            tradeOriginFilter,
            tradeScopeFilter,
            selectedSymbol,
          }}
          positionsState={{
            accountPositions,
            serviceAvailable,
            closeAllPaperPositionsPending,
            closeAllExchangePositionsPending,
            closePaperPositionPending,
            closeExchangePositionPending,
          }}
          ordersState={{
            filteredAccountOrders,
            cancelAllPaperOrdersPending,
            cancelAllExchangeOrdersPending,
            replacePaperOrderPending,
            replaceExchangeOrderPending,
            cancelPaperOrderPending,
            cancelExchangeOrderPending,
            filteredTrades,
          }}
          actions={{
            onOpenAccountInspector: () => setAccountInspectorOpen(true),
            onOpenOrderHistory: () => setOrderHistoryPanelOpen(true),
            onTradeModeFilterChange: setTradeModeFilter,
            onTradeOriginFilterChange: setTradeOriginFilter,
            onToggleTradeScopeFilter: () =>
              setTradeScopeFilter((current) => (current === 'selected' ? 'all' : 'selected')),
            onCloseAllPaperPositions: closeAllPaperPositions,
            onCloseAllExchangePositions: closeAllExchangePositions,
            onClosePaperPosition: closePaperPosition,
            onCloseExchangePosition: closeExchangePosition,
            onCancelAllPaperOrders: cancelAllPaperOrders,
            onCancelAllExchangeOrders: cancelAllExchangeOrders,
            onOpenOrderEditor: openOrderEditor,
            onCancelPaperOrder: cancelPaperOrder,
            onCancelExchangeOrder: cancelExchangeOrder,
          }}
        />
      )}

      {activeSection === 'replay' && (
        <ReplayWorkspaceContainer
          focusState={{
            selectedStrategy,
            replayFocusReview,
            replayFocusReviewDecisionMeta,
            replayFocusReviewLineageMeta,
            hasLatestTrackingReview: Boolean(latestTrackingReview),
            replayTrackingScope,
            selectedProposalId,
            selectedChangeRequestId,
            selectedBacktestId,
            focusedReviewId: reviewInspectorReviewId ?? replayFocusedReviewId,
            aiSchedulerFocusedJobId,
          }}
          replayState={{
            filteredReplayTrackingReviews,
            filteredReplayTrackingJobs,
            strategyNameMap,
            replayProposalFeed,
            proposalBacktestMap,
            proposalReviewMap,
            proposalChangeRequestMap,
            proposalAgentJobMap,
            schedulerState: snapshot?.scheduler,
          }}
          serviceState={{
            serviceAvailable,
            agentJobMutationPending,
            backtestMutationPending,
            retryAgentJobMutationPending,
            proposalMutationPending,
          }}
          actions={{
            onSetReplayTrackingScope: setReplayTrackingScope,
            onSubmitReviewJob: submitReviewJob,
            onOpenChangeRequest: openChangeRequest,
            onOpenBacktestDetail: openBacktestDetail,
            onOpenSourceReview: openSourceReview,
            onOpenStrategyProposal: openStrategyProposal,
            onOpenAiSchedulerJob: openAiSchedulerJob,
            onOpenStrategyActivity: openStrategyActivity,
            onRerunBacktestFromReview: (review) => {
              void rerunBacktestFromReview(review)
            },
            onOpenReviewInspector: openReviewInspector,
            onOpenReplayReview: openReplayReview,
            onRetryAgentJob: (jobId, focusJob = false) => {
              void retryAgentJob(jobId, focusJob ? { focusJob: true } : undefined)
            },
            onHandleProposalAction: handleProposalAction,
          }}
        />
      )}

      {activeSection === 'audit' && (
        <AuditWorkspaceContainer
          summaryState={{
            warningCount: opsLive?.summary.audit_warnings ?? 0,
            criticalCount: opsLive?.summary.audit_critical ?? 0,
          }}
          filterState={{
            auditSeverityFilter,
            auditSourceFilter,
            auditSourceOptions,
            auditScopeFilter,
            selectedSymbol,
            auditSearch,
          }}
          eventState={{
            filteredAuditEvents,
            configWebEntry: settings?.bybit_web_entry ?? 'https://www.bybit-global.com/',
            configApiBaseUrl: settings?.api_base_url ?? 'https://api.bybit.com',
            configGatewayUrl: openClawStatus?.gateway_url ?? settings?.openclaw_gateway_url ?? 'ws://127.0.0.1:18789',
          }}
          actions={{
            onAuditSeverityFilterChange: setAuditSeverityFilter,
            onAuditSourceFilterChange: setAuditSourceFilter,
            onToggleAuditScopeFilter: () =>
              setAuditScopeFilter((current) => (current === 'selected' ? 'all' : 'selected')),
            onAuditSearchChange: setAuditSearch,
            onOpenAiSchedulerJob: openAiSchedulerJob,
            onOpenReviewInspector: openReviewInspector,
            onOpenBacktestDetail: openBacktestDetail,
            onOpenSourceReview: openSourceReview,
            onOpenStrategyProposal: openStrategyProposal,
            onOpenStrategyActivity: openStrategyActivity,
          }}
        />
      )}
    </AppChromeShell>
  )
}

export default App

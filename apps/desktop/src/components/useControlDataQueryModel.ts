import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { api } from '../api'
import type { Mode, SectionKey } from '../types'
import {
  buildStrategyModeMismatchPreview,
  extractStrategyExecutionPreview,
  isNotificationQuietHoursActive,
  schedulerCommandEventMeta,
  schedulerCommandSnapshotMeta,
  strategyExecutionPreviewMatchesMode,
  strategySupportsExecutionPreviewMode,
} from '../utils/app-helpers'

type UseControlDataQueryModelArgs = {
  activeSection: SectionKey
  selectedMode: Mode
  selectedStrategyId: string | null
  selectedBacktestId: string | null
  backtestFilter: 'selected' | 'all'
  replayTrackingScope: 'all' | 'selected'
  strategyActivityPanelOpen: boolean
  grafanaPreviewOpen: boolean
  editingOrderId: string | null
}

export function useControlDataQueryModel({
  activeSection,
  selectedMode,
  selectedStrategyId,
  selectedBacktestId,
  backtestFilter,
  replayTrackingScope,
  strategyActivityPanelOpen,
  grafanaPreviewOpen,
  editingOrderId,
}: UseControlDataQueryModelArgs) {
  const liveAiEnabled = activeSection === 'overview' || activeSection === 'scheduler'
  const liveOpsEnabled =
    activeSection === 'overview' ||
    activeSection === 'alerts' ||
    activeSection === 'trades' ||
    activeSection === 'audit'
  const liveAccountEnabled = activeSection === 'overview' || activeSection === 'trades'

  const healthQuery = useQuery({
    queryKey: ['service-health'],
    queryFn: api.getServiceHealth,
    retry: false,
    refetchInterval: 15000,
  })
  const runtimeWorkerStatusQuery = useQuery({
    queryKey: ['runtime-worker-status'],
    queryFn: api.getRuntimeWorkerStatus,
    enabled: Boolean(healthQuery.data?.ok),
    refetchInterval: 5000,
    staleTime: 0,
  })
  const snapshotQuery = useQuery({
    queryKey: ['snapshot'],
    queryFn: api.getControlSnapshot,
    refetchInterval: 12000,
  })
  const strategiesQuery = useQuery({
    queryKey: ['strategies'],
    queryFn: api.getStrategies,
    refetchInterval: 20000,
  })
  const strategyRuntimeQuery = useQuery({
    queryKey: ['strategy-runtime'],
    queryFn: api.getStrategyRuntime,
    enabled: activeSection === 'strategy' || activeSection === 'overview',
    refetchInterval: 6000,
    staleTime: 0,
  })
  const liveStrategyEnabled = activeSection === 'strategy' || activeSection === 'overview'
  const strategies = useMemo(() => strategiesQuery.data ?? [], [strategiesQuery.data])
  const strategyRuntime = strategyRuntimeQuery.data ?? []
  const selectedStrategy =
    strategies.find((item) => item.id === selectedStrategyId) ?? strategies[0]
  const selectedStrategyRuntime = selectedStrategy
    ? strategyRuntime.find((item) => item.strategy_id === selectedStrategy.id) ?? null
    : null
  const selectedStrategyExecutionPreview = extractStrategyExecutionPreview(selectedStrategyRuntime)
  const selectedStrategyModeMismatchPreview = buildStrategyModeMismatchPreview(
    selectedStrategy,
    selectedStrategyRuntime,
    selectedMode,
  )
  const selectedStrategySupportsSelectedMode = strategySupportsExecutionPreviewMode(
    selectedStrategy,
    selectedMode,
  )
  const activeStrategyId = selectedStrategy?.id ?? selectedStrategyId ?? ''
  const runtimePreviewMatchesSelectedMode = strategyExecutionPreviewMatchesMode(
    selectedStrategyExecutionPreview,
    selectedMode,
  )
  const strategyNameMap = useMemo(
    () => new Map(strategies.map((item) => [item.id, item.name])),
    [strategies],
  )
  const strategyExecutionPreviewQuery = useQuery({
    queryKey: ['strategy-execution-preview', activeStrategyId, selectedMode],
    queryFn: () => api.getStrategyExecutionPreview(activeStrategyId, selectedMode),
    enabled:
      Boolean(activeStrategyId) &&
      liveStrategyEnabled &&
      selectedStrategySupportsSelectedMode &&
      !runtimePreviewMatchesSelectedMode &&
      !selectedStrategyModeMismatchPreview,
    refetchInterval: 6000,
    staleTime: 0,
  })
  const strategyActivityQuery = useQuery({
    queryKey: ['strategy-activity', activeStrategyId],
    queryFn: () => api.getStrategyActivity(activeStrategyId),
    enabled: Boolean(activeStrategyId) && strategyActivityPanelOpen,
    refetchInterval: strategyActivityPanelOpen ? 5000 : false,
    staleTime: 0,
  })
  const backtestsQuery = useQuery({
    queryKey: ['backtests'],
    queryFn: api.getBacktests,
    refetchInterval: 20000,
  })
  const schedulerQuery = useQuery({
    queryKey: ['scheduler'],
    queryFn: api.getScheduler,
    refetchInterval: 10000,
  })
  const aiLiveQuery = useQuery({
    queryKey: ['ai-live'],
    queryFn: api.getAiLiveSnapshot,
    enabled: liveAiEnabled,
    refetchInterval: 4000,
    staleTime: 0,
  })
  const opsLiveQuery = useQuery({
    queryKey: ['ops-live'],
    queryFn: api.getOpsLiveSnapshot,
    enabled: liveOpsEnabled,
    refetchInterval: 4000,
    staleTime: 0,
  })
  const newsQuery = useQuery({
    queryKey: ['news'],
    queryFn: api.getNews,
    refetchInterval: 20000,
  })
  const alertsQuery = useQuery({
    queryKey: ['alerts'],
    queryFn: api.getAlerts,
    refetchInterval: 15000,
  })
  const accountLiveQuery = useQuery({
    queryKey: ['account-live'],
    queryFn: api.getAccountLiveSnapshot,
    enabled: liveAccountEnabled,
    refetchInterval: 4000,
    staleTime: 0,
  })
  const accountOverviewQuery = useQuery({
    queryKey: ['account-overview'],
    queryFn: api.getAccountOverview,
    refetchInterval: 15000,
  })
  const accountPositionsQuery = useQuery({
    queryKey: ['account-positions'],
    queryFn: api.getAccountPositions,
    refetchInterval: 15000,
  })
  const accountOrdersQuery = useQuery({
    queryKey: ['account-orders'],
    queryFn: api.getAccountOrders,
    refetchInterval: 15000,
  })
  const accountOrderHistoryQuery = useQuery({
    queryKey: ['account-order-history'],
    queryFn: api.getAccountOrderHistory,
    refetchInterval: 15000,
  })
  const tradesQuery = useQuery({
    queryKey: ['trades'],
    queryFn: api.getTrades,
    refetchInterval: 15000,
  })
  const reviewsQuery = useQuery({
    queryKey: ['reviews'],
    queryFn: api.getReviews,
    refetchInterval: 30000,
  })
  const selectedBacktestQueryId =
    selectedBacktestId ??
    (
      (
        backtestFilter === 'selected' && activeStrategyId
          ? (backtestsQuery.data ?? []).find((item) => item.strategy_id === activeStrategyId)
          : (backtestsQuery.data ?? [])[0]
      )?.id ?? null
    )
  const selectedStrategyReviewsQuery = useQuery({
    queryKey: ['strategy-reviews', activeStrategyId],
    queryFn: () => api.getReviews({ strategyId: activeStrategyId }),
    enabled:
      Boolean(activeStrategyId) &&
      (activeSection === 'strategy' || activeSection === 'backtest' || activeSection === 'replay'),
    refetchInterval:
      activeSection === 'strategy' ||
      activeSection === 'backtest' ||
      activeSection === 'replay'
        ? 30000
        : false,
  })
  const selectedBacktestReviewsQuery = useQuery({
    queryKey: ['backtest-reviews', selectedBacktestQueryId],
    queryFn: () =>
      api.getReviews({ backtestId: selectedBacktestQueryId, periods: ['backtest'] }),
    enabled:
      Boolean(selectedBacktestQueryId) &&
      (activeSection === 'backtest' || activeSection === 'replay'),
    refetchInterval:
      activeSection === 'backtest' || activeSection === 'replay' ? 30000 : false,
  })
  const replayTrackingReviewsQuery = useQuery({
    queryKey: ['replay-tracking-reviews', replayTrackingScope, selectedStrategy?.id ?? 'none'],
    queryFn: () =>
      api.getReviews({
        strategyId: replayTrackingScope === 'selected' ? selectedStrategy?.id ?? null : null,
        periods: ['strategy_issue', 'strategy_change'],
      }),
    enabled:
      activeSection === 'replay' &&
      (replayTrackingScope === 'all' || Boolean(selectedStrategy?.id)),
    refetchInterval: activeSection === 'replay' ? 30000 : false,
  })
  const auditQuery = useQuery({
    queryKey: ['audit'],
    queryFn: api.getAuditEvents,
    refetchInterval: 10000,
  })
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: 60000,
  })
  const grafanaQuery = useQuery({
    queryKey: ['grafana'],
    queryFn: api.getGrafanaStatus,
    staleTime: 60000,
  })
  const metricsPreviewQuery = useQuery({
    queryKey: ['metrics-preview'],
    queryFn: api.getPrometheusMetrics,
    enabled: grafanaPreviewOpen,
    staleTime: 15000,
  })
  const workspaceQuery = useQuery({
    queryKey: ['workspace'],
    queryFn: api.getWorkspacePreferences,
    staleTime: 30000,
    retry: false,
  })
  const openClawQuery = useQuery({
    queryKey: ['openclaw'],
    queryFn: api.getOpenClawStatus,
    refetchInterval: 20000,
  })
  const bybitPrivateQuery = useQuery({
    queryKey: ['bybit-private'],
    queryFn: api.getBybitPrivateStatus,
    refetchInterval: 20000,
  })
  const bybitPublicQuery = useQuery({
    queryKey: ['bybit-public'],
    queryFn: api.getBybitPublicStatus,
    refetchInterval: 20000,
  })
  const changeRequestsQuery = useQuery({
    queryKey: ['change-requests'],
    queryFn: api.getChangeRequests,
    refetchInterval: 10000,
  })

  const serviceAvailable = Boolean(healthQuery.data?.ok)
  const snapshot = snapshotQuery.data
  const selectedModeStrategyPreview =
    strategyExecutionPreviewQuery.data ??
    selectedStrategyModeMismatchPreview ??
    selectedStrategyExecutionPreview
  const selectedStrategyActivity = strategyActivityQuery.data
  const strategyActivityQueryErrorMessage =
    strategyActivityQuery.error instanceof Error
      ? strategyActivityQuery.error.message
      : strategyActivityQuery.error
        ? String(strategyActivityQuery.error)
        : ''
  const backtests = useMemo(() => backtestsQuery.data ?? [], [backtestsQuery.data])
  const scheduler = aiLiveQuery.data ?? schedulerQuery.data
  const opsLive = opsLiveQuery.data
  const alerts = useMemo(
    () => opsLive?.alerts ?? alertsQuery.data ?? [],
    [opsLive?.alerts, alertsQuery.data],
  )
  const alertsNotificationBootstrapReady = opsLiveQuery.isFetched || alertsQuery.isFetched
  const jobsNotificationBootstrapReady = aiLiveQuery.isFetched || schedulerQuery.isFetched
  const opsNotificationBootstrapReady = opsLiveQuery.isFetched || auditQuery.isFetched
  const accountOverview = accountLiveQuery.data?.overview ?? accountOverviewQuery.data
  const accountPositions = accountLiveQuery.data?.positions ?? accountPositionsQuery.data ?? []
  const accountOrders = accountLiveQuery.data?.orders ?? accountOrdersQuery.data ?? []
  const editingOrder =
    editingOrderId != null
      ? accountOrders.find((order) => order.order_id === editingOrderId) ?? null
      : null
  const accountOrderHistory =
    accountLiveQuery.data?.order_history ?? accountOrderHistoryQuery.data ?? []
  const news = newsQuery.data ?? []
  const trades = opsLive?.trades ?? tradesQuery.data ?? []
  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data])
  const auditEvents = useMemo(
    () => opsLive?.audit_events ?? auditQuery.data ?? [],
    [auditQuery.data, opsLive?.audit_events],
  )
  const latestSchedulerCommand = useMemo(
    () =>
      schedulerCommandSnapshotMeta(
        scheduler?.latest_scheduler_command ??
          opsLive?.latest_scheduler_command ??
          snapshot?.latest_scheduler_command ??
          null,
      ) ??
      schedulerCommandEventMeta(
        auditEvents.find((event) => event.event_type === 'scheduler.command') ?? null,
      ),
    [
      auditEvents,
      opsLive?.latest_scheduler_command,
      scheduler?.latest_scheduler_command,
      snapshot?.latest_scheduler_command,
    ],
  )
  const changeRequests = useMemo(
    () => aiLiveQuery.data?.change_requests ?? changeRequestsQuery.data ?? scheduler?.change_requests ?? [],
    [aiLiveQuery.data?.change_requests, changeRequestsQuery.data, scheduler?.change_requests],
  )
  const settings = settingsQuery.data
  const notificationQuietHoursActive = isNotificationQuietHoursActive(settings)
  const grafanaStatus = grafanaQuery.data
  const metricsPreviewLines = (metricsPreviewQuery.data ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .slice(0, 10)
  const workspacePreferences = workspaceQuery.data
  const openClawStatus = openClawQuery.data
  const bybitPrivateStatus = bybitPrivateQuery.data
  const bybitPublicStatus = bybitPublicQuery.data
  const bybitPublicIssueDiagnostics = useMemo(
    () => (bybitPublicStatus?.watched_symbol_diagnostics ?? []).filter((item) => item.issue),
    [bybitPublicStatus?.watched_symbol_diagnostics],
  )
  const bybitPublicVisibleDiagnostics = useMemo(
    () =>
      (
        bybitPublicIssueDiagnostics.length
          ? bybitPublicIssueDiagnostics
          : (bybitPublicStatus?.watched_symbol_diagnostics ?? []).slice(0, 4)
      ).slice(0, 4),
    [bybitPublicIssueDiagnostics, bybitPublicStatus?.watched_symbol_diagnostics],
  )

  return {
    alerts,
    alertsNotificationBootstrapReady,
    accountLiveQuery,
    accountOrderHistory,
    accountOrderHistoryQuery,
    accountOrders,
    accountOrdersQuery,
    accountOverview,
    accountOverviewQuery,
    accountPositions,
    accountPositionsQuery,
    activeStrategyId,
    aiLiveQuery,
    auditEvents,
    auditQuery,
    backtests,
    backtestsQuery,
    bybitPrivateQuery,
    bybitPrivateStatus,
    bybitPublicIssueDiagnostics,
    bybitPublicQuery,
    bybitPublicStatus,
    bybitPublicVisibleDiagnostics,
    changeRequests,
    changeRequestsQuery,
    editingOrder,
    grafanaQuery,
    grafanaStatus,
    healthQuery,
    jobsNotificationBootstrapReady,
    latestSchedulerCommand,
    metricsPreviewLines,
    metricsPreviewQuery,
    news,
    newsQuery,
    notificationQuietHoursActive,
    openClawQuery,
    openClawStatus,
    opsLive,
    opsLiveQuery,
    opsNotificationBootstrapReady,
    reviews,
    reviewsQuery,
    replayTrackingReviewsQuery,
    runtimeWorkerStatusQuery,
    scheduler,
    schedulerQuery,
    selectedBacktestQueryId,
    selectedModeStrategyPreview,
    selectedStrategy,
    selectedStrategyActivity,
    selectedStrategyExecutionPreview,
    selectedStrategyModeMismatchPreview,
    selectedStrategyReviewsQuery,
    selectedStrategyRuntime,
    selectedStrategySupportsSelectedMode,
    serviceAvailable,
    settings,
    settingsQuery,
    snapshot,
    strategyActivityQuery,
    strategyActivityQueryErrorMessage,
    strategyExecutionPreviewQuery,
    strategyNameMap,
    strategyRuntime,
    strategyRuntimeQuery,
    strategies,
    strategiesQuery,
    trades,
    tradesQuery,
    workspacePreferences,
    workspaceQuery,
    selectedBacktestReviewsQuery,
  }
}

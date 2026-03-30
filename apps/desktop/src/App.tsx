import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  CandlestickChart,
  ClipboardList,
  FileSearch,
  History,
  Newspaper,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { api } from './api'
import './App.css'
import type {
  ChangeRequest,
  LayoutPreset,
  MarketDetail,
  Mode,
  SectionKey,
  StrategySummary,
  WorkspacePreferences,
} from './types'

type NavItem = {
  key: SectionKey
  label: string
  hint: string
  icon: typeof Activity
}

const navItems: NavItem[] = [
  { key: 'overview', label: '总览', hint: '控制中心', icon: Activity },
  { key: 'market', label: '行情', hint: '实时跟踪', icon: CandlestickChart },
  { key: 'strategy', label: '策略', hint: '参数与启停', icon: ClipboardList },
  { key: 'backtest', label: '回测', hint: '历史验证', icon: FileSearch },
  { key: 'scheduler', label: 'AI调度', hint: 'OpenClaw 编排', icon: Bot },
  { key: 'news', label: '新闻事件', hint: '情报与宏观', icon: Newspaper },
  { key: 'alerts', label: '提醒中心', hint: '风险告警', icon: Bell },
  { key: 'trades', label: '交易记录', hint: '委托与成交', icon: History },
  { key: 'replay', label: 'AI复盘', hint: '日报总结', icon: Sparkles },
  { key: 'audit', label: '系统日志/审计', hint: '执行追溯', icon: ShieldAlert },
]

const defaultCardOrder = ['assets', 'scheduler', 'strategy', 'risk', 'pnl', 'requests', 'backtest', 'news']
const defaultVisibleCards = [...defaultCardOrder]
const endpointPreview = [
  'GET /api/control/snapshot',
  'GET /api/market/watchlist',
  'GET /api/strategies',
  'POST /api/change-requests',
]
const WORKSPACE_STORAGE_KEY = 'bybit-control-workspace-v1'

type WorkspaceBootstrap = {
  active_section: SectionKey
  layout_preset: LayoutPreset
  selected_mode: Mode
  selected_symbol: string
  selected_strategy_id: string | null
  overview_card_order: string[]
  overview_visible_cards: string[]
  updated_at: string | null
  source: 'local' | 'default'
}

type ActionFeedback = {
  tone: 'success' | 'warning' | 'error'
  title: string
  detail: string
}

function normalizeCardIds(ids: string[]) {
  const validIds = ids.filter((id) => defaultCardOrder.includes(id))
  const next: string[] = []
  validIds.forEach((id) => {
    if (!next.includes(id)) {
      next.push(id)
    }
  })
  defaultCardOrder.forEach((id) => {
    if (!next.includes(id)) {
      next.push(id)
    }
  })
  return next
}

function normalizeVisibleCardIds(ids: string[], orderedCardIds: string[]) {
  const order = normalizeCardIds(orderedCardIds)
  const valid = ids.filter((id) => order.includes(id))
  const deduped: string[] = []
  valid.forEach((id) => {
    if (!deduped.includes(id)) {
      deduped.push(id)
    }
  })
  return deduped.length ? order.filter((id) => deduped.includes(id)) : defaultVisibleCards
}

function buildDefaultWorkspaceBootstrap(): WorkspaceBootstrap {
  return {
    active_section: 'overview',
    layout_preset: 'balanced',
    selected_mode: 'paper',
    selected_symbol: 'BTCUSDT',
    selected_strategy_id: null,
    overview_card_order: [...defaultCardOrder],
    overview_visible_cards: [...defaultVisibleCards],
    updated_at: null,
    source: 'default',
  }
}

function readWorkspaceBootstrap(): WorkspaceBootstrap {
  if (typeof window === 'undefined') {
    return buildDefaultWorkspaceBootstrap()
  }

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (!raw) {
      return buildDefaultWorkspaceBootstrap()
    }
    const parsed = JSON.parse(raw) as Partial<WorkspaceBootstrap>
    const baseline = buildDefaultWorkspaceBootstrap()
    const cardOrder = normalizeCardIds(parsed.overview_card_order ?? baseline.overview_card_order)
    return {
      active_section: parsed.active_section ?? baseline.active_section,
      layout_preset: parsed.layout_preset ?? baseline.layout_preset,
      selected_mode: parsed.selected_mode ?? baseline.selected_mode,
      selected_symbol: parsed.selected_symbol ?? baseline.selected_symbol,
      selected_strategy_id: parsed.selected_strategy_id ?? baseline.selected_strategy_id,
      overview_card_order: cardOrder,
      overview_visible_cards: normalizeVisibleCardIds(
        parsed.overview_visible_cards ?? baseline.overview_visible_cards,
        cardOrder,
      ),
      updated_at: parsed.updated_at ?? null,
      source: 'local',
    }
  } catch (error) {
    console.warn('读取本地工作台状态失败，已回退默认布局。', error)
    return buildDefaultWorkspaceBootstrap()
  }
}

function persistLocalWorkspace(workspace: Omit<WorkspaceBootstrap, 'source'>) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    WORKSPACE_STORAGE_KEY,
    JSON.stringify({
      ...workspace,
      overview_card_order: normalizeCardIds(workspace.overview_card_order),
      overview_visible_cards: normalizeVisibleCardIds(
        workspace.overview_visible_cards,
        workspace.overview_card_order,
      ),
    }),
  )
}

function buildWorkspaceSignature(workspace: {
  active_section: SectionKey
  layout_preset: LayoutPreset
  selected_mode: Mode
  selected_symbol: string
  selected_strategy_id?: string | null
  overview_card_order: string[]
  overview_visible_cards: string[]
}) {
  return JSON.stringify({
    active_section: workspace.active_section,
    layout_preset: workspace.layout_preset,
    selected_mode: workspace.selected_mode,
    selected_symbol: workspace.selected_symbol,
    selected_strategy_id: workspace.selected_strategy_id ?? '',
    overview_card_order: normalizeCardIds(workspace.overview_card_order),
    overview_visible_cards: normalizeVisibleCardIds(
      workspace.overview_visible_cards,
      workspace.overview_card_order,
    ),
  })
}

function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: value >= 1_000_000 ? 2 : 1,
  }).format(value)
}

function formatTime(value?: string | null) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return '未知错误，请检查本地控制服务日志。'
}

function priorityLabel(priority: ChangeRequest['priority']) {
  return (
    {
      low: 'P2',
      normal: 'P2',
      high: 'P1',
      critical: 'P0',
    }[priority] ?? 'P2'
  )
}

function schedulerLabel(status: string) {
  return (
    {
      running: '运行中',
      paused: '已暂停',
      manual_override: '人工接管',
      degraded: '降级运行',
    }[status] ?? status
  )
}

function strategyStatusLabel(status: StrategySummary['status']) {
  return (
    {
      running: '运行中',
      paused: '已暂停',
      paper_only: '仅模拟盘',
      shadow: '影子模式',
    }[status] ?? status
  )
}

function tradeProbeLabel(outcome?: string) {
  return (
    {
      validation_rejected: '已命中真实交易链路',
      permission_denied: '交易权限不足',
      request_rejected: '链路已响应',
      accepted_unexpectedly: '请求被真实接受',
      network_error: '链路探测失败',
      not_configured: '未配置',
    }[outcome ?? ''] ?? '待探测'
  )
}

function signalLabel(signal: 'neutral' | 'watch' | 'active') {
  return (
    {
      neutral: '中性观察',
      watch: '重点跟踪',
      active: '策略激活',
    }[signal] ?? signal
  )
}

function riskLevelLabel(level: 'low' | 'medium' | 'high') {
  return (
    {
      low: '低风险',
      medium: '中风险',
      high: '高风险',
    }[level] ?? level
  )
}

function buildCandleOption(detail: MarketDetail) {
  const categories = detail.candles.map((item) =>
    new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit' }).format(new Date(item.time)),
  )
  const candleSeries = detail.candles.map((item) => [item.open, item.close, item.low, item.high])
  const volumes = detail.candles.map((item) => item.volume)

  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: [
      { left: 18, right: 16, top: 18, height: '63%' },
      { left: 18, right: 16, top: '74%', height: '16%' },
    ],
    xAxis: [
      {
        type: 'category',
        data: categories,
        boundaryGap: true,
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.25)' } },
        axisLabel: { color: '#94a3b8', hideOverlap: true },
      },
      {
        type: 'category',
        data: categories,
        gridIndex: 1,
        boundaryGap: true,
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.2)' } },
        axisLabel: { show: false },
      },
    ],
    yAxis: [
      {
        scale: true,
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.09)' } },
        axisLine: { show: false },
        axisLabel: { color: '#94a3b8' },
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        splitLine: { show: false },
        axisLine: { show: false },
        axisLabel: { color: '#64748b' },
      },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(6, 11, 20, 0.96)',
      borderColor: 'rgba(34, 211, 238, 0.24)',
      textStyle: { color: '#e2e8f0' },
    },
    series: [
      {
        type: 'candlestick',
        data: candleSeries,
        itemStyle: {
          color: '#34d399',
          color0: '#fb7185',
          borderColor: '#34d399',
          borderColor0: '#fb7185',
        },
      },
      {
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
        itemStyle: {
          color: 'rgba(34, 211, 238, 0.58)',
        },
      },
    ],
  }
}

function App() {
  const queryClient = useQueryClient()
  const [workspaceBootstrap] = useState<WorkspaceBootstrap>(() => readWorkspaceBootstrap())
  const [activeSection, setActiveSection] = useState<SectionKey>(workspaceBootstrap.active_section)
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>(workspaceBootstrap.layout_preset)
  const [selectedMode, setSelectedMode] = useState<Mode>(workspaceBootstrap.selected_mode)
  const [selectedSymbol, setSelectedSymbol] = useState(workspaceBootstrap.selected_symbol)
  const [selectedStrategyId, setSelectedStrategyId] = useState(workspaceBootstrap.selected_strategy_id)
  const [cardOrder, setCardOrder] = useState(() => normalizeCardIds(workspaceBootstrap.overview_card_order))
  const [visibleOverviewCards, setVisibleOverviewCards] = useState(() =>
    normalizeVisibleCardIds(workspaceBootstrap.overview_visible_cards, workspaceBootstrap.overview_card_order),
  )
  const [workspaceSavedAt, setWorkspaceSavedAt] = useState<string | null>(workspaceBootstrap.updated_at)
  const [lastSyncedWorkspaceSignature, setLastSyncedWorkspaceSignature] = useState(() =>
    buildWorkspaceSignature(workspaceBootstrap),
  )
  const [workspaceConflict, setWorkspaceConflict] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null)
  const [manualOrder, setManualOrder] = useState({
    side: 'buy' as 'buy' | 'sell',
    quantity: '1',
    price: '0',
    note: '',
  })
  const manualOrderSymbolRef = useRef<string | null>(null)

  const deferredSymbol = useDeferredValue(selectedSymbol)

  const healthQuery = useQuery({
    queryKey: ['service-health'],
    queryFn: api.getServiceHealth,
    retry: false,
    refetchInterval: 15000,
  })
  const snapshotQuery = useQuery({
    queryKey: ['snapshot'],
    queryFn: api.getControlSnapshot,
    refetchInterval: 12000,
  })
  const watchlistQuery = useQuery({
    queryKey: ['watchlist'],
    queryFn: api.getWatchlist,
    refetchInterval: 12000,
  })
  const marketDetailQuery = useQuery({
    queryKey: ['market', deferredSymbol],
    queryFn: () => api.getMarketDetail(deferredSymbol),
    refetchInterval: 12000,
  })
  const strategiesQuery = useQuery({
    queryKey: ['strategies'],
    queryFn: api.getStrategies,
    refetchInterval: 20000,
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
  const changeRequestsQuery = useQuery({
    queryKey: ['change-requests'],
    queryFn: api.getChangeRequests,
    refetchInterval: 10000,
  })

  const applyWorkspaceState = (nextWorkspace: WorkspaceBootstrap | WorkspacePreferences) => {
    setActiveSection(nextWorkspace.active_section)
    setLayoutPreset(nextWorkspace.layout_preset)
    setSelectedMode(nextWorkspace.selected_mode)
    setSelectedSymbol(nextWorkspace.selected_symbol)
    setSelectedStrategyId(nextWorkspace.selected_strategy_id ?? null)
    setCardOrder(normalizeCardIds(nextWorkspace.overview_card_order))
    setVisibleOverviewCards(
      normalizeVisibleCardIds(nextWorkspace.overview_visible_cards, nextWorkspace.overview_card_order),
    )
    setWorkspaceSavedAt(nextWorkspace.updated_at)
    setLastSyncedWorkspaceSignature(buildWorkspaceSignature(nextWorkspace))
  }

  const showFeedback = (tone: ActionFeedback['tone'], title: string, detail: string) => {
    setActionFeedback({ tone, title, detail })
  }

  useEffect(() => {
    const firstSymbol = watchlistQuery.data?.[0]?.symbol
    const hasSelectedSymbol = watchlistQuery.data?.some((item) => item.symbol === selectedSymbol)
    if (firstSymbol && (!selectedSymbol || !hasSelectedSymbol)) {
      setSelectedSymbol(firstSymbol)
    }
  }, [selectedSymbol, watchlistQuery.data])

  useEffect(() => {
    const firstStrategy = strategiesQuery.data?.[0]?.id
    const hasSelectedStrategy = strategiesQuery.data?.some((item) => item.id === selectedStrategyId)
    if (firstStrategy && (!selectedStrategyId || !hasSelectedStrategy)) {
      setSelectedStrategyId(firstStrategy)
    }
  }, [selectedStrategyId, strategiesQuery.data])

  useEffect(() => {
    const latestClose = marketDetailQuery.data?.candles.at(-1)?.close
    const currentSymbol = marketDetailQuery.data?.symbol
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
  }, [marketDetailQuery.data?.symbol, marketDetailQuery.data?.updated_at, marketDetailQuery.data?.candles])

  useEffect(() => {
    if (!workspaceQuery.data) return
    const serverSignature = buildWorkspaceSignature(workspaceQuery.data)
    const currentSignature = buildWorkspaceSignature({
      active_section: activeSection,
      layout_preset: layoutPreset,
      selected_mode: selectedMode,
      selected_symbol: selectedSymbol,
      selected_strategy_id: selectedStrategyId,
      overview_card_order: cardOrder,
      overview_visible_cards: visibleOverviewCards,
    })

    if (serverSignature === lastSyncedWorkspaceSignature) {
      setWorkspaceConflict(false)
      return
    }

    if (currentSignature !== lastSyncedWorkspaceSignature) {
      setWorkspaceConflict(true)
      return
    }

    applyWorkspaceState(workspaceQuery.data)
    setWorkspaceConflict(false)
  }, [
    activeSection,
    cardOrder,
    lastSyncedWorkspaceSignature,
    layoutPreset,
    selectedMode,
    selectedStrategyId,
    selectedSymbol,
    visibleOverviewCards,
    workspaceQuery.data,
  ])

  const serviceAvailable = Boolean(healthQuery.data?.ok)
  const snapshot = snapshotQuery.data
  const watchlist = watchlistQuery.data ?? []
  const marketDetail = marketDetailQuery.data
  const selectedWatchItem = watchlist.find((item) => item.symbol === selectedSymbol)
  const strategies = strategiesQuery.data ?? []
  const selectedStrategy =
    strategies.find((item) => item.id === selectedStrategyId) ?? strategies[0]
  const backtests = backtestsQuery.data ?? []
  const scheduler = schedulerQuery.data
  const alerts = alertsQuery.data ?? []
  const accountOverview = accountOverviewQuery.data
  const accountPositions = accountPositionsQuery.data ?? []
  const accountOrders = accountOrdersQuery.data ?? []
  const news = newsQuery.data ?? []
  const trades = tradesQuery.data ?? []
  const reviews = reviewsQuery.data ?? []
  const auditEvents = auditQuery.data ?? []
  const changeRequests = changeRequestsQuery.data ?? scheduler?.change_requests ?? []
  const settings = settingsQuery.data
  const workspacePreferences = workspaceQuery.data
  const openClawStatus = openClawQuery.data
  const bybitPrivateStatus = bybitPrivateQuery.data
  const strongestInstrument = [...watchlist].sort((left, right) => right.change_24h - left.change_24h)[0]
  const weakestInstrument = [...watchlist].sort((left, right) => left.change_24h - right.change_24h)[0]
  const activeSignalCount = watchlist.filter((item) => item.signal === 'active').length
  const positiveWatchlistCount = watchlist.filter((item) => item.change_24h >= 0).length
  const watchlistTurnover = watchlist.reduce((total, item) => total + item.volume_24h, 0)
  const schedulerFocusJob = scheduler?.jobs[0]
  const manualOrderQuantity = Number(manualOrder.quantity)
  const manualOrderPrice = Number(manualOrder.price)
  const manualTradingBlockedReason =
    !serviceAvailable
      ? '本地控制服务当前未连接，无法提交手动交易。'
      : selectedMode !== 'paper'
        ? '当前版本只开放 Paper 模式的手动交易录入；Demo / Live 将在真实执行引擎接通后再开放。'
        : !marketDetail
          ? '当前品种行情尚未就绪，稍后再试。'
          : !Number.isFinite(manualOrderQuantity) || manualOrderQuantity <= 0
            ? '手动交易数量必须大于 0。'
            : !Number.isFinite(manualOrderPrice) || manualOrderPrice <= 0
              ? '手动交易价格必须大于 0。'
              : null

  const refreshControlData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['snapshot'] }),
      queryClient.invalidateQueries({ queryKey: ['account-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['account-positions'] }),
      queryClient.invalidateQueries({ queryKey: ['account-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['bybit-private'] }),
      queryClient.invalidateQueries({ queryKey: ['scheduler'] }),
      queryClient.invalidateQueries({ queryKey: ['change-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['backtests'] }),
      queryClient.invalidateQueries({ queryKey: ['strategies'] }),
      queryClient.invalidateQueries({ queryKey: ['trades'] }),
      queryClient.invalidateQueries({ queryKey: ['audit'] }),
      queryClient.invalidateQueries({ queryKey: ['workspace'] }),
    ])
  }

  const schedulerMutation = useMutation({
    mutationFn: api.sendSchedulerCommand,
    onSuccess: refreshControlData,
  })

  const changeRequestMutation = useMutation({
    mutationFn: api.createChangeRequest,
    onSuccess: refreshControlData,
  })

  const backtestMutation = useMutation({
    mutationFn: api.createBacktest,
    onSuccess: refreshControlData,
  })

  const agentJobMutation = useMutation({
    mutationFn: api.createAgentJob,
    onSuccess: refreshControlData,
  })

  const manualTradeMutation = useMutation({
    mutationFn: api.createManualTrade,
    onSuccess: refreshControlData,
  })

  const tradeProbeMutation = useMutation({
    mutationFn: api.probeBybitTradeRoute,
  })
  const tradeProbeResult = tradeProbeMutation.data

  const workspaceMutation = useMutation({
    mutationFn: api.updateWorkspacePreferences,
    onSuccess: async (workspace) => {
      setWorkspaceSavedAt(workspace.updated_at)
      setLastSyncedWorkspaceSignature(buildWorkspaceSignature(workspace))
      queryClient.setQueryData(['workspace'], workspace)
      await queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  const runSchedulerCommand = async (
    command: 'pause' | 'resume' | 'cancel_job' | 'cancel_all' | 'freeze_publish' | 'enter_manual_override',
    reason: string,
    jobId?: string,
  ) => {
    try {
      const result = await schedulerMutation.mutateAsync({
        command,
        job_id: jobId,
        requested_by: 'desktop_operator',
        reason,
      })
      const detail =
        command === 'freeze_publish'
          ? result.freeze_publish
            ? '自动发布已冻结，新的 AI 发布提案会停留在控制端。'
            : '自动发布冻结已解除。'
          : reason
      showFeedback('success', 'AI 调度命令已发送', detail)
    } catch (error) {
      showFeedback('error', 'AI 调度命令失败', resolveErrorMessage(error))
    }
  }

  const submitStrategyRequest = async (
    type: string,
    summary: string,
    payload: Record<string, unknown>,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal',
  ) => {
    try {
      await changeRequestMutation.mutateAsync({
        type,
        payload,
        requested_by: 'desktop_operator',
        target_mode: selectedMode,
        priority,
        summary,
      })
      showFeedback('success', 'ChangeRequest 已创建', `${summary} 已进入执行队列。`)
    } catch (error) {
      showFeedback('error', 'ChangeRequest 创建失败', resolveErrorMessage(error))
    }
  }

  const submitBacktest = async () => {
    if (!selectedStrategy) return
    try {
      await backtestMutation.mutateAsync({
        strategy_id: selectedStrategy.id,
        data_range: '2025-12-01 ~ 2026-03-29',
        timeframe: '1h',
      })
      showFeedback('success', '回测任务已完成', `${selectedStrategy.name} 的新回测结果已写回控制端。`)
    } catch (error) {
      showFeedback('error', '回测发起失败', resolveErrorMessage(error))
    }
  }

  const submitReviewJob = async () => {
    try {
      await agentJobMutation.mutateAsync({
        job_type: 'generate_daily_review',
        context: {
          focus_symbols: watchlist.slice(0, 3).map((item) => item.symbol),
          mode: selectedMode,
        },
        allowed_actions: ['review', 'summarize', 'backtest_request', 'change_request'],
        timeout: 180,
        idempotency_key: `review-${Date.now()}`,
        writeback_target: 'ai_review',
      })
      showFeedback('success', 'AI 复盘任务已排队', 'OpenClaw 会按当前关注品种生成新的复盘文档。')
    } catch (error) {
      showFeedback('error', 'AI 复盘任务创建失败', resolveErrorMessage(error))
    }
  }

  const submitManualOrder = async () => {
    if (!marketDetail) return
    if (manualTradingBlockedReason) {
      showFeedback('warning', '当前不能提交手动交易', manualTradingBlockedReason)
      return
    }

    try {
      await manualTradeMutation.mutateAsync({
        symbol: marketDetail.symbol,
        market: marketDetail.market,
        mode: selectedMode,
        side: manualOrder.side,
        quantity: manualOrderQuantity,
        price: manualOrderPrice,
        note: manualOrder.note,
      })
      showFeedback('success', '手动交易已写入量化控制链路', `${marketDetail.symbol} 的 Paper 手动交易已记录并写入审计日志。`)
      setManualOrder((current) => ({ ...current, note: '' }))
    } catch (error) {
      showFeedback('error', '手动交易提交失败', resolveErrorMessage(error))
    }
  }

  const probeBybitTradeRoute = async () => {
    try {
      const result = await tradeProbeMutation.mutateAsync()
      const tone =
        result.outcome === 'validation_rejected' || result.outcome === 'request_rejected'
          ? 'success'
          : result.outcome === 'permission_denied'
            ? 'warning'
            : result.outcome === 'accepted_unexpectedly'
              ? 'warning'
              : 'error'
      showFeedback(tone, '真实交易链路探测已完成', result.detail)
    } catch (error) {
      showFeedback('error', '真实交易链路探测失败', resolveErrorMessage(error))
    }
  }

  const overviewCards = [
    {
      id: 'assets',
      label: '资产概览',
      accent: 'cyan',
      title: snapshot?.account_metrics[0]?.label ?? '资产概览',
      value: snapshot?.account_metrics[0]?.value ?? '--',
      meta: snapshot?.account_metrics[0]?.delta ?? '等待数据同步',
      body: '现货与永续统一展示，重点关注权益、保证金率与浮盈浮亏。',
    },
    {
      id: 'scheduler',
      label: 'AI 调度',
      accent: 'amber',
      title: 'OpenClaw 编排状态',
      value: schedulerLabel(snapshot?.scheduler.status ?? 'degraded'),
      meta: `当前队列 ${snapshot?.scheduler.queue_depth ?? 0} 个 · 心跳 ${formatTime(snapshot?.scheduler.last_heartbeat_at)}`,
      body: '支持暂停、终止当前任务、进入人工接管、冻结自动发布。',
    },
    {
      id: 'strategy',
      label: '策略状态',
      accent: 'emerald',
      title: '活跃策略',
      value: `${strategies.filter((item) => item.status === 'running').length} / ${strategies.length}`,
      meta: `Paper ${strategies.filter((item) => item.mode === 'paper').length} · Demo ${strategies.filter((item) => item.mode === 'demo').length} · Live ${strategies.filter((item) => item.mode === 'live').length}`,
      body: '模板策略与 Python 策略共用同一套运行时与风控门禁。',
    },
    {
      id: 'risk',
      label: '风险状态',
      accent: 'rose',
      title: '风控边界',
      value: snapshot?.risk_metrics[0]?.value ?? '--',
      meta: snapshot?.risk_metrics[2]?.value ? `风控拦截 ${snapshot.risk_metrics[2].value}` : '等待同步',
      body: 'P0 告警优先于调度与复盘，确保交易执行不被越权。',
    },
    {
      id: 'pnl',
      label: '今日收益',
      accent: 'blue',
      title: '当日表现',
      value: snapshot?.today_performance.realized_pnl ?? '--',
      meta: `未实现 ${snapshot?.today_performance.unrealized_pnl ?? '--'} · 胜率 ${snapshot?.today_performance.win_rate ?? '--'}`,
      body: '回测、模拟、实盘三条路径共享同一收益统计口径。',
    },
    {
      id: 'requests',
      label: '待处理任务',
      accent: 'violet',
      title: 'ChangeRequest',
      value: `${changeRequests.filter((item) => item.status !== 'applied').length}`,
      meta: `${changeRequests.filter((item) => item.status === 'running').length} 运行 · ${changeRequests.filter((item) => item.status === 'queued').length} 排队`,
      body: '所有前端调整先写结构化请求，再由 OpenClaw 落实。',
    },
    {
      id: 'backtest',
      label: '回测摘要',
      accent: 'gold',
      title: backtests[0]?.strategy_name ?? '最新回测',
      value: backtests[0]?.metrics.annual_return ?? '--',
      meta: `胜率 ${backtests[0]?.metrics.win_rate ?? '--'} · 回撤 ${backtests[0]?.metrics.max_drawdown ?? '--'}`,
      body: '回测结果回链到参数快照、数据范围与版本记录。',
    },
    {
      id: 'news',
      label: '新闻脉冲',
      accent: 'teal',
      title: '相关事件',
      value: `${news.length} 条`,
      meta: `${alerts.filter((item) => item.related_news_id).length} 条提醒已关联新闻`,
      body: '仅展示与持仓、自选和风险最相关的情报与摘要。',
    },
  ]

  const orderedVisibleCards = normalizeVisibleCardIds(visibleOverviewCards, cardOrder)
  const visibleCards = layoutPreset === 'focus' ? orderedVisibleCards.slice(0, 4) : orderedVisibleCards
  const currentWorkspaceDraft = {
    active_section: activeSection,
    layout_preset: layoutPreset,
    selected_mode: selectedMode,
    selected_symbol: selectedSymbol,
    selected_strategy_id: (selectedStrategy?.id ?? selectedStrategyId) || null,
    overview_card_order: normalizeCardIds(cardOrder),
    overview_visible_cards: orderedVisibleCards,
  }
  const workspaceDirty = buildWorkspaceSignature(currentWorkspaceDraft) !== lastSyncedWorkspaceSignature
  const commandDeckCards = [
    {
      id: 'market-pulse',
      icon: TrendingUp,
      tone: 'cyan',
      eyebrow: '市场脉冲',
      title: strongestInstrument?.symbol ?? '等待行情',
      value: strongestInstrument ? formatPercent(strongestInstrument.change_24h) : '--',
      meta: weakestInstrument
        ? `最弱 ${weakestInstrument.symbol} ${formatPercent(weakestInstrument.change_24h)}`
        : '等待自选数据',
      detail: `上涨 ${positiveWatchlistCount}/${watchlist.length || 0} · 自选成交额 ${formatCompactNumber(watchlistTurnover)}`,
      actionLabel: '看行情',
      section: 'market' as SectionKey,
    },
    {
      id: 'strategy-focus',
      icon: ClipboardList,
      tone: 'emerald',
      eyebrow: '策略焦点',
      title: selectedStrategy?.name ?? '等待策略',
      value: selectedStrategy?.pnl_7d ?? '--',
      meta: selectedStrategy ? `${strategyStatusLabel(selectedStrategy.status)} · ${selectedStrategy.mode.toUpperCase()}` : '尚未选择策略',
      detail: selectedStrategy
        ? `版本 ${selectedStrategy.version} · 回撤 ${selectedStrategy.max_drawdown}`
        : '当前还没有可用策略摘要',
      actionLabel: '看策略',
      section: 'strategy' as SectionKey,
    },
    {
      id: 'scheduler-focus',
      icon: Bot,
      tone: 'amber',
      eyebrow: '调度控制',
      title: schedulerLabel(snapshot?.scheduler.status ?? 'degraded'),
      value: `${snapshot?.scheduler.queue_depth ?? 0} 个任务`,
      meta: schedulerFocusJob ? `当前 ${schedulerFocusJob.job_type}` : '当前没有正在排队的任务',
      detail: `OpenClaw ${openClawStatus?.reachable ? '可达' : '待接通'} · 冻结发布 ${snapshot?.scheduler.freeze_publish ? '开启' : '关闭'}`,
      actionLabel: '看调度',
      section: 'scheduler' as SectionKey,
    },
    {
      id: 'account-ready',
      icon: Wallet,
      tone: 'violet',
      eyebrow: '账户与链路',
      title: accountOverview?.total_equity ?? '--',
      value: tradeProbeLabel(tradeProbeResult?.outcome),
      meta: bybitPrivateStatus?.can_query_private ? 'Bybit 私有 API 已接通' : '私有 API 未配置',
      detail: tradeProbeResult
        ? tradeProbeResult.detail
        : '可在交易记录页探测真实交易链路，当前不会直接放开真实下单。',
      actionLabel: '看账户',
      section: 'trades' as SectionKey,
    },
  ]
  const marketPulseItems = watchlist
    .slice()
    .sort((left, right) => Math.abs(right.change_24h) - Math.abs(left.change_24h))
    .slice(0, 5)

  useEffect(() => {
    persistLocalWorkspace({
      active_section: activeSection,
      layout_preset: layoutPreset,
      selected_mode: selectedMode,
      selected_symbol: selectedSymbol,
      selected_strategy_id: (selectedStrategy?.id ?? selectedStrategyId) || null,
      overview_card_order: normalizeCardIds(cardOrder),
      overview_visible_cards: orderedVisibleCards,
      updated_at: workspaceSavedAt,
    })
  }, [
    activeSection,
    cardOrder,
    layoutPreset,
    orderedVisibleCards,
    selectedMode,
    selectedStrategy?.id,
    selectedStrategyId,
    selectedSymbol,
    workspaceSavedAt,
  ])

  const moveCard = (id: string, direction: 'up' | 'down') => {
    setCardOrder((current) => {
      const index = current.indexOf(id)
      if (index < 0) return current
      const nextIndex = direction === 'up' ? index - 1 : index + 1
      if (nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  const toggleOverviewCard = (id: string) => {
    setVisibleOverviewCards((current) => {
      const normalized = normalizeVisibleCardIds(current, cardOrder)
      if (normalized.includes(id)) {
        if (normalized.length === 1) {
          return normalized
        }
        return normalized.filter((item) => item !== id)
      }
      return normalizeVisibleCardIds([...normalized, id], cardOrder)
    })
  }

  const syncWorkspacePreferences = async (
    draft: typeof currentWorkspaceDraft = currentWorkspaceDraft,
  ) => {
    try {
      if (serviceAvailable) {
        const saved = await workspaceMutation.mutateAsync(draft)
        setWorkspaceSavedAt(saved.updated_at)
        setWorkspaceConflict(false)
        showFeedback('success', '工作台状态已同步', '控制端保存了最新布局、模式和关注品种。')
        return
      }

      const localSavedAt = new Date().toISOString()
      setWorkspaceSavedAt(localSavedAt)
      setLastSyncedWorkspaceSignature(buildWorkspaceSignature(draft))
      setWorkspaceConflict(false)
      showFeedback('warning', '已仅保存到本地缓存', '当前控制服务未连接，工作台状态尚未同步到本地控制端。')
    } catch (error) {
      showFeedback('error', '工作台同步失败', resolveErrorMessage(error))
    }
  }

  const restoreDefaultWorkspace = async () => {
    const defaults = buildDefaultWorkspaceBootstrap()
    const nextDraft = {
      active_section: defaults.active_section,
      layout_preset: defaults.layout_preset,
      selected_mode: defaults.selected_mode,
      selected_symbol: watchlist[0]?.symbol ?? defaults.selected_symbol,
      selected_strategy_id: strategies[0]?.id ?? defaults.selected_strategy_id,
      overview_card_order: [...defaultCardOrder],
      overview_visible_cards: [...defaultVisibleCards],
    }
    setActiveSection(nextDraft.active_section)
    setLayoutPreset(nextDraft.layout_preset)
    setSelectedMode(nextDraft.selected_mode)
    setSelectedSymbol(nextDraft.selected_symbol)
    setSelectedStrategyId(nextDraft.selected_strategy_id)
    setCardOrder(nextDraft.overview_card_order)
    setVisibleOverviewCards(nextDraft.overview_visible_cards)
    await syncWorkspacePreferences(nextDraft)
  }

  const applyServerWorkspace = async () => {
    if (!workspaceQuery.data) return
    applyWorkspaceState(workspaceQuery.data)
    setWorkspaceConflict(false)
    showFeedback('success', '已应用控制端状态', '当前界面已切换到服务端保存的工作台配置。')
  }

  const marketHeader = marketDetail?.headline ?? '等待本地量化服务返回当前品种的跟踪摘要'
  const marketStatsEntries = Object.entries(marketDetail?.stats ?? {}).filter(([key]) => key !== '数据源')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">BX</div>
          <div>
            <p>Bybit 量化交易控制端</p>
            <span>桌面版 v1 · 本地控制中枢</span>
          </div>
        </div>

        <div className="nav-block">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${activeSection === item.key ? 'active' : ''}`}
                onClick={() => {
                  startTransition(() => setActiveSection(item.key))
                }}
              >
                <span className="nav-item__label">
                  <Icon size={16} />
                  {item.label}
                </span>
                <small>{item.hint}</small>
              </button>
            )
          })}
        </div>

        <div className="sidebar-card sidebar-card--status">
          <div className="section-label">连接状态</div>
          <strong>{serviceAvailable ? '本地服务 · 已连接' : '本地服务 · 回退模式'}</strong>
          <p>量化核心与 OpenClaw 适配层通过本机服务通信。</p>
          <div className="chip-row">
            <span className={`chip ${serviceAvailable ? 'chip--success' : 'chip--warning'}`}>
              量化内核 {serviceAvailable ? '在线' : '未连通'}
            </span>
            <span className={`chip ${openClawStatus?.reachable ? 'chip--success' : 'chip--muted'}`}>
              OpenClaw {openClawStatus?.reachable ? '可达' : '待接通'}
            </span>
          </div>
        </div>

        <div className="sidebar-card">
          <div className="section-label">本地接口</div>
          <div className="api-list">
            {endpointPreview.map((endpoint) => (
              <code key={endpoint}>{endpoint}</code>
            ))}
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">量化交易控制端</p>
            <h1>中文桌面控制台</h1>
            <p className="subtitle">
              聚焦行情、策略、回测、AI 调度、新闻、提醒与审计；手动交易保持在量化层直连路径，OpenClaw 只负责编排与回写。
            </p>
          </div>

          <div className="topbar-actions">
            <div className="status-pill">
              <span
                className={`dot ${
                  snapshot?.scheduler.status === 'running'
                    ? 'green'
                    : snapshot?.scheduler.status === 'paused'
                      ? 'amber'
                      : 'rose'
                }`}
              />
              AI 调度 {schedulerLabel(snapshot?.scheduler.status ?? 'degraded')}
            </div>
            <div className="status-pill">模式 · {selectedMode.toUpperCase()}</div>
            <button
              type="button"
              className="ghost-button"
              disabled={!serviceAvailable || schedulerMutation.isPending}
              onClick={() => runSchedulerCommand('pause', '桌面端手动暂停调度')}
            >
              暂停调度
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!serviceAvailable || schedulerMutation.isPending}
              onClick={() => runSchedulerCommand('enter_manual_override', '桌面端强制进入人工接管')}
            >
              终止 AI 调度
            </button>
          </div>
        </header>

        {!serviceAvailable && (
          <section className="service-banner">
            <AlertTriangle size={18} />
            <div>
              <strong>本地控制服务当前未连通，页面已切换到 fallback 数据。</strong>
              <p>启动 `python3 services/control-api/main.py` 后，桌面端会自动切回真实数据与命令通道。</p>
            </div>
          </section>
        )}

        {actionFeedback && (
          <section className={`service-banner service-banner--${actionFeedback.tone}`}>
            <AlertTriangle size={18} />
            <div>
              <strong>{actionFeedback.title}</strong>
              <p>{actionFeedback.detail}</p>
            </div>
          </section>
        )}

        <section className="hero-panel">
          <div className="hero-copy">
            <div className="hero-tag">控制总览</div>
            <h2>先看盘，再控策略，再交给 OpenClaw 去执行</h2>
            <p>
              你在前端做的每一次调整，都会先进入结构化 ChangeRequest，再由本地 OpenClaw 编排层落实。
              真正的交易执行仍由量化内核直接完成。
            </p>

            <div className="hero-actions">
              <button
                type="button"
                className="primary-button"
                disabled={!serviceAvailable || schedulerMutation.isPending}
                onClick={() =>
                  runSchedulerCommand(
                    'freeze_publish',
                    snapshot?.scheduler.freeze_publish ? '解除自动发布冻结' : '冻结自动发布',
                  )
                }
              >
                {snapshot?.scheduler.freeze_publish ? '解除自动发布' : '冻结自动发布'}
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={!serviceAvailable || schedulerMutation.isPending}
                onClick={() =>
                  runSchedulerCommand(
                    'cancel_job',
                    '桌面端终止当前任务',
                    snapshot?.scheduler.current_job_id ?? undefined,
                  )
                }
              >
                终止当前任务
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={!serviceAvailable || schedulerMutation.isPending}
                onClick={() => runSchedulerCommand('resume', '桌面端恢复自动调度')}
              >
                恢复调度
              </button>
            </div>
          </div>

          <div className="hero-stack">
            <div className="mini-card">
              <span>自动交易状态</span>
              <strong>{snapshot?.scheduler.status === 'manual_override' ? '人工接管中' : '策略自动运行'}</strong>
              <p>OpenClaw 仅编排，不直接执行交易。</p>
            </div>
            <div className="mini-card">
              <span>当前量化模式</span>
              <strong>{selectedMode === 'paper' ? '模拟盘' : selectedMode === 'demo' ? 'Demo' : '实盘'}</strong>
              <p>Paper / Demo / Live 三路径隔离。</p>
            </div>
            <div className="mini-card">
              <span>本地服务</span>
              <strong>{serviceAvailable ? '真实 API 已接通' : 'Fallback 数据中'}</strong>
              <p>{openClawStatus?.gateway_url ?? settings?.openclaw_gateway_url ?? '等待 OpenClaw 配置'}</p>
            </div>
          </div>
        </section>

        <section className="toolbar">
          <div className="layout-switch">
            <span>布局</span>
            {(['balanced', 'focus', 'dense'] as LayoutPreset[]).map((layout) => (
              <button
                key={layout}
                type="button"
                className={layoutPreset === layout ? 'pill active' : 'pill'}
                onClick={() => setLayoutPreset(layout)}
              >
                {layout === 'balanced' ? '均衡' : layout === 'focus' ? '专注' : '紧凑'}
              </button>
            ))}
          </div>

          <div className="layout-switch">
            <span>切换模式</span>
            {(['paper', 'demo', 'live'] as Mode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={selectedMode === mode ? 'pill active' : 'pill'}
                onClick={() => setSelectedMode(mode)}
              >
                {mode === 'paper' ? '模拟盘' : mode === 'demo' ? 'Demo' : '实盘'}
              </button>
            ))}
          </div>

          <div className="workspace-actions">
            <span>工作台状态</span>
            <div className="chip-row">
              <span className={`chip ${workspaceDirty ? 'chip--warning' : 'chip--success'}`}>
                {workspaceDirty ? '有未同步改动' : '已同步'}
              </span>
              <span className="chip chip--muted">
                上次保存 {formatTime(workspaceSavedAt ?? workspacePreferences?.updated_at)}
              </span>
            </div>
            <div className="hero-actions hero-actions--compact">
              <button
                type="button"
                className="primary-button"
                disabled={workspaceMutation.isPending}
                onClick={() => syncWorkspacePreferences()}
              >
                同步到控制端
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={workspaceMutation.isPending}
                onClick={restoreDefaultWorkspace}
              >
                恢复默认布局
              </button>
            </div>
          </div>
        </section>

        {workspaceConflict && (
          <section className="service-banner service-banner--warning">
            <AlertTriangle size={18} />
            <div>
              <strong>检测到控制端保存的工作台状态与当前本地草稿不同。</strong>
              <p>当前先保留你的本地调整；你可以继续同步到控制端，或直接应用控制端版本。</p>
            </div>
            <div className="hero-actions hero-actions--compact">
              <button type="button" className="ghost-button" onClick={applyServerWorkspace}>
                应用控制端状态
              </button>
            </div>
          </section>
        )}

        <section className="command-deck">
          {commandDeckCards.map((card) => {
            const Icon = card.icon
            return (
              <button
                key={card.id}
                type="button"
                className={`command-deck__card tone-${card.tone}`}
                onClick={() => {
                  startTransition(() => setActiveSection(card.section))
                }}
              >
                <div className="command-deck__head">
                  <div>
                    <span className="section-label">{card.eyebrow}</span>
                    <strong>{card.title}</strong>
                  </div>
                  <span className="command-deck__icon">
                    <Icon size={18} />
                  </span>
                </div>
                <div className="command-deck__value">{card.value}</div>
                <p className="command-deck__meta">{card.meta}</p>
                <p className="command-deck__detail">{card.detail}</p>
                <span className="command-deck__action">{card.actionLabel}</span>
              </button>
            )
          })}
        </section>

        {activeSection === 'overview' && (
          <section className={`dashboard dashboard--${layoutPreset}`}>
            <div className="dashboard-grid">
              {visibleCards.map((cardId) => {
                const card = overviewCards.find((item) => item.id === cardId)
                if (!card) return null
                return (
                  <article key={card.id} className={`dashboard-card accent-${card.accent}`}>
                    <div className="card-head">
                      <div>
                        <span className="section-label">{card.label}</span>
                        <h3>{card.title}</h3>
                      </div>
                      <div className="card-controls">
                        <button type="button" onClick={() => moveCard(card.id, 'up')}>
                          上移
                        </button>
                        <button type="button" onClick={() => moveCard(card.id, 'down')}>
                          下移
                        </button>
                      </div>
                    </div>
                    <div className="card-value">{card.value}</div>
                    <p className="card-meta">{card.meta}</p>
                    <p className="card-body">{card.body}</p>
                  </article>
                )
              })}
            </div>

            <div className="two-column">
              <article className="panel">
                <div className="panel-head">
                  <div>
                    <span className="section-label">ChangeRequest</span>
                    <h3>前端调整的执行状态</h3>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={!serviceAvailable || changeRequestMutation.isPending}
                    onClick={() =>
                      submitStrategyRequest(
                        'strategy.parameter.update',
                        '提交 BTC 趋势策略风险参数调整',
                        {
                          strategy_id: selectedStrategy?.id,
                          risk_per_trade: 1.1,
                          requested_from: 'overview',
                        },
                        'high',
                      )
                    }
                  >
                    提交示例请求
                  </button>
                </div>
                <div className="request-list">
                  {changeRequests.slice(0, 6).map((request) => (
                    <div key={request.id} className="request-row">
                      <div>
                        <strong>{request.summary}</strong>
                        <p>{request.type}</p>
                        <small>
                          {request.requested_by} · {request.target_mode.toUpperCase()} · {formatTime(request.created_at)}
                        </small>
                      </div>
                      <div className="request-side">
                        <span className={`status-chip status-${request.status}`}>{request.status}</span>
                        <span className={`priority-chip ${priorityLabel(request.priority).toLowerCase()}`}>
                          {priorityLabel(request.priority)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel">
                <div className="panel-head">
                  <div>
                    <span className="section-label">控制指标</span>
                    <h3>负载、风险与发布门禁</h3>
                  </div>
                </div>
                <div className="bar-list">
                  <div className="bar-item">
                    <div className="bar-label">
                      <span>持仓集中度</span>
                      <strong>{snapshot?.risk_metrics[1]?.value ?? '3.4x'}</strong>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill tone-cyan" style={{ width: '64%' }} />
                    </div>
                  </div>
                  <div className="bar-item">
                    <div className="bar-label">
                      <span>风险预算消耗</span>
                      <strong>{snapshot?.risk_metrics[0]?.value ?? '-1.24%'}</strong>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill tone-amber" style={{ width: '42%' }} />
                    </div>
                  </div>
                  <div className="bar-item">
                    <div className="bar-label">
                      <span>AI 调度负载</span>
                      <strong>{snapshot?.scheduler.queue_depth ?? 0} 个任务</strong>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill tone-emerald" style={{ width: '58%' }} />
                    </div>
                  </div>
                </div>
                <div className="api-panel">
                  <span className="section-label">本地服务</span>
                  <code>{settings?.openclaw_gateway_url ?? 'ws://127.0.0.1:18789'}</code>
                  <p>
                    Bybit 网页入口固定为{' '}
                    <a href={settings?.bybit_web_entry} target="_blank" rel="noreferrer">
                      {settings?.bybit_web_entry ?? 'https://www.bybit-global.com/'}
                    </a>
                    ，API 和网页用途分离。
                  </p>
                </div>
              </article>
            </div>

            <div className="two-column">
              <article className="panel">
                <div className="panel-head">
                  <div>
                    <span className="section-label">工作台布局</span>
                    <h3>总览卡片显示与顺序控制</h3>
                  </div>
                  <span className="chip chip--muted">卡片顺序可在卡片右上角直接上移/下移</span>
                </div>
                <p className="panel-note">
                  这里控制总览页显示哪些卡片；当前工作台状态会先保存在本地，点击“同步到控制端”后会写入本地服务，方便后续 OpenClaw
                  和新线程继续接手。
                </p>
                <div className="visibility-grid">
                  {overviewCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      className={`toggle-card ${orderedVisibleCards.includes(card.id) ? 'active' : ''}`}
                      onClick={() => toggleOverviewCard(card.id)}
                    >
                      <strong>{card.label}</strong>
                      <span>{orderedVisibleCards.includes(card.id) ? '显示中' : '已隐藏'}</span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="panel">
                <div className="panel-head">
                  <div>
                    <span className="section-label">工作台同步</span>
                    <h3>当前默认控制状态</h3>
                  </div>
                </div>
                <div className="status-strip">
                  <div>
                    <span>默认页面</span>
                    <strong>{navItems.find((item) => item.key === activeSection)?.label ?? '总览'}</strong>
                  </div>
                  <div>
                    <span>默认模式</span>
                    <strong>{selectedMode === 'paper' ? '模拟盘' : selectedMode === 'demo' ? 'Demo' : '实盘'}</strong>
                  </div>
                  <div>
                    <span>关注品种</span>
                    <strong>{selectedSymbol}</strong>
                  </div>
                </div>
                <div className="status-strip">
                  <div>
                    <span>当前策略</span>
                    <strong>{selectedStrategy?.name ?? '等待选择'}</strong>
                  </div>
                  <div>
                    <span>布局方案</span>
                    <strong>{layoutPreset === 'balanced' ? '均衡' : layoutPreset === 'focus' ? '专注' : '紧凑'}</strong>
                  </div>
                  <div>
                    <span>保存位置</span>
                    <strong>{serviceAvailable ? '本地控制服务 + 本地缓存' : '仅本地缓存'}</strong>
                  </div>
                </div>
                <div className="api-panel api-panel--bottom">
                  <span className="section-label">同步说明</span>
                  <code>{serviceAvailable ? 'POST /api/workspace/preferences' : 'localStorage fallback'}</code>
                  <p>
                    当前工作台不仅记住布局，也会记住默认页面、模式、品种和策略选择，便于你重开控制端后继续工作。
                  </p>
                </div>
              </article>
            </div>
          </section>
        )}

        {activeSection === 'market' && (
          <section className="section-grid">
            <article className="panel panel--hero">
              <div className="panel-head">
                <div>
                  <span className="section-label">实时行情</span>
                  <h3>自选品种与 K 线跟踪</h3>
                </div>
                <div className="chip-row">
                  <span className={`chip ${marketDetail?.source === 'bybit_rest' ? 'chip--success' : 'chip--warning'}`}>
                    {marketDetail?.source === 'bybit_rest' ? 'Bybit 公共 REST' : 'Mock 回退'}
                  </span>
                  {watchlist.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      className={selectedSymbol === item.symbol ? 'pill active' : 'pill'}
                      onClick={() => {
                        startTransition(() => setSelectedSymbol(item.symbol))
                        setManualOrder((current) => ({ ...current, price: item.last_price.toFixed(2) }))
                      }}
                    >
                      {item.symbol}
                    </button>
                  ))}
                </div>
              </div>
              <p className="market-headline">{marketHeader}</p>
              <div className="market-hero-layout">
                <div className="chart-frame">
                  <div className="chart-stage chart-stage--live">
                    {marketDetail && (
                      <ReactECharts
                        option={buildCandleOption(marketDetail)}
                        style={{ height: '100%', width: '100%' }}
                        notMerge
                      />
                    )}
                  </div>
                  <div className="chart-metrics">
                    <div>
                      <span>最新价</span>
                      <strong>{marketDetail ? formatNumber(marketDetail.candles.at(-1)?.close ?? 0) : '--'}</strong>
                    </div>
                    <div>
                      <span>24H 涨跌</span>
                      <strong>{formatPercent(selectedWatchItem?.change_24h ?? 0)}</strong>
                    </div>
                    <div>
                      <span>成交量</span>
                      <strong>{formatCompactNumber(selectedWatchItem?.volume_24h ?? 0)}</strong>
                    </div>
                  </div>
                  <div className="market-status-grid">
                    <div>
                      <span>更新时间</span>
                      <strong>{formatTime(marketDetail?.updated_at)}</strong>
                    </div>
                    <div>
                      <span>市场类型</span>
                      <strong>{marketDetail?.market === 'perp' ? '永续合约' : '现货'}</strong>
                    </div>
                    {marketStatsEntries.slice(0, 4).map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <aside className="market-insights-rail">
                  <div className="market-insight-card">
                    <span className="section-label">脉冲摘要</span>
                    <strong>自选热度面板</strong>
                    <p>上涨 {positiveWatchlistCount} / {watchlist.length || 0}，激活策略 {activeSignalCount} 个。</p>
                  </div>
                  <div className="market-insight-card">
                    <span className="section-label">强弱对照</span>
                    <strong>{strongestInstrument?.symbol ?? '--'} / {weakestInstrument?.symbol ?? '--'}</strong>
                    <p>
                      最强 {strongestInstrument ? formatPercent(strongestInstrument.change_24h) : '--'} ·
                      最弱 {weakestInstrument ? formatPercent(weakestInstrument.change_24h) : '--'}
                    </p>
                  </div>
                  <div className="market-pulse-list">
                    {marketPulseItems.map((item) => (
                      <button
                        key={item.symbol}
                        type="button"
                        className={`market-pulse-row ${item.symbol === selectedSymbol ? 'active' : ''}`}
                        onClick={() => {
                          startTransition(() => setSelectedSymbol(item.symbol))
                          setManualOrder((current) => ({ ...current, price: item.last_price.toFixed(2) }))
                        }}
                      >
                        <div>
                          <strong>{item.symbol}</strong>
                          <p>{signalLabel(item.signal)} · {riskLevelLabel(item.risk_level)}</p>
                        </div>
                        <div className="market-pulse-meta">
                          <span className={item.change_24h >= 0 ? 'positive' : 'negative'}>
                            {formatPercent(item.change_24h)}
                          </span>
                          <small>{formatCompactNumber(item.volume_24h)}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                </aside>
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">盘口与手动交易</span>
                  <h3>辅助交易面板</h3>
                </div>
                <span className="chip chip--muted">交易仍直连量化内核</span>
              </div>
              <div className="watchlist-surface">
                {watchlist.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    className={`watchlist-surface__row ${item.symbol === selectedSymbol ? 'active' : ''}`}
                    onClick={() => {
                      startTransition(() => setSelectedSymbol(item.symbol))
                      setManualOrder((current) => ({ ...current, price: item.last_price.toFixed(2) }))
                    }}
                  >
                    <div className="watchlist-surface__main">
                      <strong>{item.symbol}</strong>
                      <p>{item.market === 'perp' ? '永续' : '现货'} · {signalLabel(item.signal)}</p>
                    </div>
                    <div className="watchlist-surface__stats">
                      <span className={item.change_24h >= 0 ? 'positive' : 'negative'}>
                        {formatPercent(item.change_24h)}
                      </span>
                      <small>{formatCompactNumber(item.volume_24h)}</small>
                    </div>
                  </button>
                ))}
              </div>
              <div className="orderbook-grid">
                <div className="orderbook-column">
                  <strong>买盘</strong>
                  {marketDetail?.bids.slice(0, 5).map((item) => (
                    <div key={`bid-${item.price}`} className="orderbook-row">
                      <span>{formatNumber(item.price)}</span>
                      <span>{formatNumber(item.size)}</span>
                      <span>{formatNumber(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="orderbook-column">
                  <strong>卖盘</strong>
                  {marketDetail?.asks.slice(0, 5).map((item) => (
                    <div key={`ask-${item.price}`} className="orderbook-row">
                      <span>{formatNumber(item.price)}</span>
                      <span>{formatNumber(item.size)}</span>
                      <span>{formatNumber(item.total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span>方向</span>
                  <select
                    value={manualOrder.side}
                    onChange={(event) => setManualOrder((current) => ({ ...current, side: event.target.value as 'buy' | 'sell' }))}
                  >
                    <option value="buy">买入</option>
                    <option value="sell">卖出</option>
                  </select>
                </label>
                <label className="field">
                  <span>数量</span>
                  <input
                    value={manualOrder.quantity}
                    onChange={(event) => setManualOrder((current) => ({ ...current, quantity: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>价格</span>
                  <input
                    value={manualOrder.price}
                    onChange={(event) => setManualOrder((current) => ({ ...current, price: event.target.value }))}
                  />
                </label>
                <label className="field field--wide">
                  <span>备注</span>
                  <input
                    value={manualOrder.note}
                    onChange={(event) => setManualOrder((current) => ({ ...current, note: event.target.value }))}
                    placeholder="例如：盘中人工接管后的手动对冲"
                  />
                </label>
              </div>
              <div className="hero-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={Boolean(manualTradingBlockedReason) || manualTradeMutation.isPending}
                  onClick={submitManualOrder}
                >
                  提交手动交易
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!serviceAvailable || changeRequestMutation.isPending}
                  onClick={() =>
                    submitStrategyRequest(
                      'alert.rule.update',
                      `为 ${selectedSymbol} 新增波动提醒`,
                      { symbol: selectedSymbol, threshold_pct: 2.5 },
                    )
                  }
                >
                  设为重点提醒
                </button>
              </div>
              <p className="panel-note">
                当前版本的手动交易只开放 Paper 路径，目的是保证控制端与审计链路先稳定；Demo / Live 会在真实执行引擎接通后再开放。
              </p>
              {manualTradingBlockedReason && (
                <div className="service-banner service-banner--warning service-banner--inline">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>手动交易暂不可提交</strong>
                    <p>{manualTradingBlockedReason}</p>
                  </div>
                </div>
              )}
            </article>
          </section>
        )}

        {activeSection === 'strategy' && (
          <section className="section-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">策略管理</span>
                  <h3>模板策略与 Python 策略</h3>
                </div>
                <span className="chip chip--muted">规则策略 + AI 调参</span>
              </div>
              <div className="strategy-list">
                {strategies.map((strategy) => (
                  <button
                    key={strategy.id}
                    type="button"
                    className={`strategy-item ${selectedStrategy?.id === strategy.id ? 'active' : ''}`}
                    onClick={() => setSelectedStrategyId(strategy.id)}
                  >
                    <div>
                      <strong>{strategy.name}</strong>
                      <p>{strategy.description}</p>
                    </div>
                    <div className="strategy-kpis">
                      <span
                        className={`status-chip ${
                          strategy.status === 'running'
                            ? 'status-running'
                            : strategy.status === 'paper_only'
                              ? 'status-applied'
                              : 'status-failed'
                        }`}
                      >
                        {strategyStatusLabel(strategy.status)}
                      </span>
                      <small>{strategy.pnl_7d} / {strategy.max_drawdown}</small>
                    </div>
                  </button>
                ))}
              </div>
            </article>

            <article className="panel">
              {selectedStrategy ? (
                <>
                  <div className="panel-head">
                    <div>
                      <span className="section-label">当前策略</span>
                      <h3>{selectedStrategy.name}</h3>
                    </div>
                    <div className="chip-row">
                      <span className="chip chip--success">{strategyStatusLabel(selectedStrategy.status)}</span>
                      <span className="chip chip--muted">{selectedStrategy.mode.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="detail-grid">
                    <div>
                      <span>策略类型</span>
                      <strong>{selectedStrategy.category === 'template' ? '模板策略' : 'Python 策略'}</strong>
                    </div>
                    <div>
                      <span>版本</span>
                      <strong>{selectedStrategy.version}</strong>
                    </div>
                    <div>
                      <span>7 日收益</span>
                      <strong>{selectedStrategy.pnl_7d}</strong>
                    </div>
                    <div>
                      <span>最大回撤</span>
                      <strong>{selectedStrategy.max_drawdown}</strong>
                    </div>
                  </div>

                  <div className="parameter-grid">
                    {selectedStrategy.parameters.map((parameter) => (
                      <div key={parameter.key} className="parameter-card">
                        <span>{parameter.label}</span>
                        <strong>
                          {String(parameter.value)}
                          {parameter.unit ? ` ${parameter.unit}` : ''}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <div className="hero-actions">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={!serviceAvailable || changeRequestMutation.isPending}
                      onClick={() =>
                        submitStrategyRequest(
                          'strategy.parameter.update',
                          `更新 ${selectedStrategy.name} 参数`,
                          {
                            strategy_id: selectedStrategy.id,
                            parameter_patch: Object.fromEntries(
                              selectedStrategy.parameters.map((parameter) => [parameter.key, parameter.value]),
                            ),
                          },
                        )
                      }
                    >
                      提交参数变更
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={!serviceAvailable || changeRequestMutation.isPending}
                      onClick={() =>
                        submitStrategyRequest(
                          'strategy.pause_resume',
                          `${selectedStrategy.name} 切换策略状态`,
                          { strategy_id: selectedStrategy.id, next_status: selectedStrategy.status === 'running' ? 'paused' : 'running' },
                          'high',
                        )
                      }
                    >
                      启停策略
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={!serviceAvailable || changeRequestMutation.isPending}
                      onClick={() =>
                        submitStrategyRequest(
                          'strategy.risk_update',
                          `${selectedStrategy.name} 更新风控边界`,
                          { strategy_id: selectedStrategy.id, risk_budget: selectedStrategy.risk_budget },
                          'high',
                        )
                      }
                    >
                      更新风控
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-state">暂无策略数据</div>
              )}
            </article>
          </section>
        )}

        {activeSection === 'backtest' && (
          <section className="section-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">回测结果</span>
                  <h3>收益率、回撤与胜率</h3>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!serviceAvailable || backtestMutation.isPending || !selectedStrategy}
                  onClick={submitBacktest}
                >
                  发起回测
                </button>
              </div>
              <div className="backtest-list">
                {backtests.map((item) => (
                  <div key={item.id} className="backtest-card">
                    <div className="backtest-head">
                      <strong>{item.strategy_name}</strong>
                      <span className="chip chip--muted">{item.status}</span>
                    </div>
                    <p>{item.data_range} · {item.timeframe}</p>
                    <div className="backtest-metrics">
                      <div>
                        <span>年化收益</span>
                        <strong>{item.metrics.annual_return}</strong>
                      </div>
                      <div>
                        <span>最大回撤</span>
                        <strong>{item.metrics.max_drawdown}</strong>
                      </div>
                      <div>
                        <span>胜率</span>
                        <strong>{item.metrics.win_rate}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">复核说明</span>
                  <h3>参数快照与数据范围</h3>
                </div>
              </div>
              {backtests[0] ? (
                <div className="stack-list">
                  <div className="stack-row">
                    <strong>数据粒度</strong>
                    <span>{backtests[0].data_granularity}</span>
                  </div>
                  <div className="stack-row">
                    <strong>手续费模型</strong>
                    <span>{backtests[0].fee_model}</span>
                  </div>
                  <div className="stack-row">
                    <strong>滑点模型</strong>
                    <span>{backtests[0].slippage_model}</span>
                  </div>
                  <div className="stack-row">
                    <strong>版本回链</strong>
                    <span>{backtests[0].strategy_id} · 参数快照 {Object.keys(backtests[0].parameter_snapshot).length} 项</span>
                  </div>
                </div>
              ) : (
                <div className="empty-state">暂无回测记录</div>
              )}
            </article>
          </section>
        )}

        {activeSection === 'scheduler' && (
          <section className="section-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">AI 调度</span>
                  <h3>OpenClaw 编排与硬中断</h3>
                </div>
                <span className={`chip ${snapshot?.scheduler.status === 'manual_override' ? 'chip--warning' : 'chip--success'}`}>
                  {schedulerLabel(snapshot?.scheduler.status ?? 'degraded')}
                </span>
              </div>
              <div className="hero-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={!serviceAvailable || schedulerMutation.isPending}
                  onClick={() => runSchedulerCommand('pause', '桌面端暂停 AI 调度')}
                >
                  暂停调度
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!serviceAvailable || schedulerMutation.isPending}
                  onClick={() => runSchedulerCommand('cancel_job', '桌面端终止当前任务', snapshot?.scheduler.current_job_id ?? undefined)}
                >
                  终止当前任务
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!serviceAvailable || schedulerMutation.isPending}
                  onClick={() => runSchedulerCommand('cancel_all', '桌面端清空全部任务')}
                >
                  终止全部任务
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!serviceAvailable || schedulerMutation.isPending}
                  onClick={() => runSchedulerCommand('freeze_publish', '桌面端冻结自动发布')}
                >
                  冻结自动发布
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!serviceAvailable || schedulerMutation.isPending}
                  onClick={() => runSchedulerCommand('enter_manual_override', '桌面端进入人工接管')}
                >
                  进入人工接管
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!serviceAvailable || schedulerMutation.isPending}
                  onClick={() => runSchedulerCommand('resume', '桌面端恢复 AI 调度')}
                >
                  恢复调度
                </button>
              </div>
              <div className="status-strip">
                <div>
                  <span>当前模式</span>
                  <strong>{snapshot?.scheduler.current_mode.toUpperCase()}</strong>
                </div>
                <div>
                  <span>OpenClaw</span>
                  <strong>{openClawStatus?.reachable ? '已连通' : '待接通'}</strong>
                </div>
                <div>
                  <span>心跳</span>
                  <strong>{formatTime(snapshot?.scheduler.last_heartbeat_at)}</strong>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">队列</span>
                  <h3>当前任务</h3>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!serviceAvailable || agentJobMutation.isPending}
                  onClick={submitReviewJob}
                >
                  生成复盘任务
                </button>
              </div>
              <div className="job-list">
                {scheduler?.jobs.map((job) => (
                  <div key={job.id} className="job-row">
                    <div>
                      <strong>{job.job_type}</strong>
                      <p>{Object.keys(job.context).join(' · ') || '上下文待写入'}</p>
                    </div>
                    <div className="job-meta">
                      <span className="chip chip--muted">{job.status}</span>
                      <small>{formatTime(job.updated_at)}</small>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeSection === 'news' && (
          <section className="section-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">新闻事件</span>
                  <h3>与持仓和波动相关的情报</h3>
                </div>
                <span className="chip chip--muted">Bybit 公告 · 宏观日历 · 事件流</span>
              </div>
              <div className="news-grid">
                {news.map((item) => (
                  <article key={item.id} className="news-card">
                    <div className="news-head">
                      <span className="chip chip--muted">{item.symbols.join(', ') || '全市场'}</span>
                      <span className={`chip ${item.impact_score >= 75 ? 'chip--warning' : 'chip--success'}`}>
                        {item.impact_score >= 75 ? '高影响' : '中影响'}
                      </span>
                    </div>
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                    <small>{item.source} · {formatTime(item.published_at)}</small>
                  </article>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeSection === 'alerts' && (
          <section className="section-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">提醒中心</span>
                  <h3>风险、新闻与回测提醒</h3>
                </div>
                <span className="chip chip--warning">{settings?.notification_channels.join(' / ')}</span>
              </div>
              <div className="alert-list">
                {alerts.map((alert) => (
                  <div key={alert.id} className="alert-row">
                    <div>
                      <strong>{alert.title}</strong>
                      <p>{alert.description}</p>
                    </div>
                    <div className="alert-meta">
                      <span className={`status-chip status-${alert.severity.toLowerCase()}`}>{alert.severity}</span>
                      <small>{formatTime(alert.triggered_at)}</small>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeSection === 'trades' && (
          <section className="section-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">账户与委托</span>
                  <h3>账户总览、持仓与未成交委托</h3>
                </div>
                <span className={`chip ${bybitPrivateStatus?.can_query_private ? 'chip--success' : 'chip--warning'}`}>
                  {bybitPrivateStatus?.can_query_private ? 'Bybit 私有 API 已接通' : 'Bybit 私有 API 未配置'}
                </span>
              </div>
              <div className="account-hero-grid">
                <div className="account-hero-card">
                  <span>账户状态</span>
                  <strong>{accountOverview?.source === 'bybit_private' ? '真实账户' : 'Mock 回退'}</strong>
                  <p>{bybitPrivateStatus?.can_query_private ? '当前读取的是程序侧私有 API。' : '尚未检测到可用的私有 API 配置。'}</p>
                </div>
                <div className="account-hero-card">
                  <span>交易链路</span>
                  <strong>{tradeProbeLabel(tradeProbeResult?.outcome)}</strong>
                  <p>{tradeProbeResult?.detail ?? '可使用下方按钮对真实交易 POST 链路做一次安全探测。'}</p>
                </div>
                <div className="account-hero-card">
                  <span>资产分布</span>
                  <strong>{accountOverview?.top_holdings?.length ? `${accountOverview.top_holdings.length} 个币种` : '空账户'}</strong>
                  <p>{accountOverview?.top_holdings?.length ? '当前展示按美元价值排序的前几项资产。' : '这与临时测试账户当前实际状态一致。'}</p>
                </div>
              </div>
              <div className="status-strip">
                <div>
                  <span>总权益</span>
                  <strong>{accountOverview?.total_equity ?? '--'}</strong>
                </div>
                <div>
                  <span>可用余额</span>
                  <strong>{accountOverview?.total_available_balance ?? '--'}</strong>
                </div>
                <div>
                  <span>未实现盈亏</span>
                  <strong>{accountOverview?.unrealised_pnl ?? '--'}</strong>
                </div>
              </div>
              <div className="status-strip">
                <div>
                  <span>持仓数量</span>
                  <strong>{accountOverview?.positions_count ?? accountPositions.length}</strong>
                </div>
                <div>
                  <span>未成交委托</span>
                  <strong>{accountOverview?.open_orders_count ?? accountOrders.length}</strong>
                </div>
                <div>
                  <span>数据来源</span>
                  <strong>{accountOverview?.source === 'bybit_private' ? '真实账户' : 'Mock 回退'}</strong>
                </div>
              </div>
              <div className="stack-list">
                {(accountOverview?.top_holdings ?? []).map((asset) => (
                  <div key={asset.coin} className="stack-row">
                    <div>
                      <strong>{asset.coin}</strong>
                      <span>可用 {asset.available_balance}</span>
                    </div>
                    <div className="trade-meta">
                      <span className="chip chip--muted">{asset.wallet_balance}</span>
                      <small>{asset.usd_value}</small>
                    </div>
                  </div>
                ))}
                {!accountOverview?.top_holdings?.length && (
                  <div className="empty-state">当前账户没有可展示的资产持仓。</div>
                )}
              </div>
              <div className="api-panel api-panel--bottom">
                <span className="section-label">私有 API 状态</span>
                <div className="contract-list">
                  <code>{bybitPrivateStatus?.api_base_url ?? settings?.api_base_url ?? 'https://api.bybit.com'}</code>
                  <code>{bybitPrivateStatus?.key_hint ?? '未检测到 API Key'}</code>
                  <code>{bybitPrivateStatus?.account_type ?? 'UNIFIED'}</code>
                </div>
                <p>
                  这里只读取程序侧私有 API，不读取网页登录状态。网页入口继续用{' '}
                  <a href={settings?.bybit_web_entry ?? 'https://www.bybit-global.com/'} target="_blank" rel="noreferrer">
                    {settings?.bybit_web_entry ?? 'https://www.bybit-global.com/'}
                  </a>
                  ，账户数据读取走私有 API 域名。
                </p>
                <div className="hero-actions hero-actions--compact">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={!bybitPrivateStatus?.can_query_private || tradeProbeMutation.isPending}
                    onClick={probeBybitTradeRoute}
                  >
                    探测真实交易链路
                  </button>
                </div>
                {tradeProbeMutation.data && (
                  <p>
                    {tradeProbeLabel(tradeProbeMutation.data.outcome)} · {tradeProbeMutation.data.detail}
                  </p>
                )}
                {bybitPrivateStatus?.last_error && <p>{bybitPrivateStatus.last_error}</p>}
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">持仓与委托</span>
                  <h3>当前仓位、挂单和成交记录</h3>
                </div>
              </div>
              <div className="trade-list">
                {accountPositions.map((position) => (
                  <div key={`${position.symbol}-${position.side}`} className="trade-row">
                    <div>
                      <strong>{position.symbol} · {position.side === 'long' ? '多仓' : '空仓'}</strong>
                      <p>
                        均价 {position.avg_price} · 标记价 {position.mark_price} · 数量 {position.size}
                      </p>
                    </div>
                    <div className="trade-meta">
                      <span className="chip chip--muted">{position.market === 'perp' ? '永续' : '现货'}</span>
                      <span className="chip chip--muted">{position.leverage}</span>
                      <small>{position.unrealised_pnl}</small>
                    </div>
                  </div>
                ))}
                {accountPositions.length === 0 && <div className="empty-state">当前没有持仓数据</div>}
              </div>
              <div className="trade-list">
                {accountOrders.map((order) => (
                  <div key={order.order_id} className="trade-row">
                    <div>
                      <strong>{order.symbol} · {order.side === 'buy' ? '买单' : '卖单'}</strong>
                      <p>{order.order_type} · 价格 {order.price} · 数量 {order.qty}</p>
                    </div>
                    <div className="trade-meta">
                      <span className="chip chip--muted">{order.market === 'perp' ? '永续' : '现货'}</span>
                      <span className="chip chip--muted">{order.status}</span>
                      <small>{formatTime(order.created_at)}</small>
                    </div>
                  </div>
                ))}
                {accountOrders.length === 0 && <div className="empty-state">当前没有未成交委托</div>}
              </div>
              <div className="trade-list">
                {trades.map((trade) => (
                  <div key={trade.id} className="trade-row">
                    <div>
                      <strong>{trade.symbol} · {trade.side === 'buy' ? '买入' : '卖出'}</strong>
                      <p>{formatNumber(trade.price)} · 数量 {formatNumber(trade.quantity)}</p>
                    </div>
                    <div className="trade-meta">
                      <span className={`chip ${trade.mode === 'live' ? 'chip--warning' : 'chip--muted'}`}>
                        {trade.mode.toUpperCase()}
                      </span>
                      <span className="chip chip--muted">{trade.status}</span>
                      <small>{formatTime(trade.created_at)}</small>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeSection === 'replay' && (
          <section className="section-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">AI 复盘</span>
                  <h3>每日总结与策略提案</h3>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!serviceAvailable || agentJobMutation.isPending}
                  onClick={submitReviewJob}
                >
                  生成复盘
                </button>
              </div>
              <div className="replay-grid">
                {reviews.map((review) => (
                  <article key={review.id} className="replay-card">
                    <strong>{review.title}</strong>
                    <p>{review.summary}</p>
                    <div className="proposal-list">
                      {review.proposals.map((proposal) => (
                        <div key={proposal.id} className="proposal-row">
                          <span>{proposal.title}</span>
                          <small>{proposal.expected_impact}</small>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeSection === 'audit' && (
          <section className="section-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">系统日志 / 审计</span>
                  <h3>执行链路与历史追踪</h3>
                </div>
              </div>
              <div className="audit-list">
                {auditEvents.map((item) => (
                  <div key={item.id} className="audit-row">
                    <span className="audit-time">{formatTime(item.occurred_at)}</span>
                    <span className="chip chip--muted">{item.event_type}</span>
                    <p>{item.source} · {item.symbol ?? '全局'} · {String(item.payload.summary ?? item.payload.command ?? '事件已记录')}</p>
                  </div>
                ))}
              </div>
              <div className="api-panel api-panel--bottom">
                <span className="section-label">配置快照</span>
                <div className="contract-list">
                  <code>{settings?.bybit_web_entry ?? 'https://www.bybit-global.com/'}</code>
                  <code>{settings?.api_base_url ?? 'https://api.bybit.com'}</code>
                  <code>{openClawStatus?.gateway_url ?? settings?.openclaw_gateway_url ?? 'ws://127.0.0.1:18789'}</code>
                </div>
              </div>
            </article>
          </section>
        )}
      </main>
    </div>
  )
}

export default App

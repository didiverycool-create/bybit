import { Suspense, lazy, startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  CandlestickChart,
  Save,
  ClipboardList,
  ExternalLink,
  FileSearch,
  History,
  Newspaper,
  Settings2,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react'

import { api, CONTROL_API_BASE } from './api'
import './App.css'
import type {
  AccountOverview,
  AccountLiveSnapshot,
  AiLiveSnapshot,
  AlertRecord,
  ControlSnapshot,
  ExecutionEvent,
  ExecutionPreview,
  LayoutPreset,
  MarketDetail,
  MarketLiveSnapshot,
  MarketRecentTrade,
  Mode,
  OpsLiveSnapshot,
  OrderRecord,
  RuntimeWorkerStatus,
  SectionKey,
  StrategyActivitySnapshot,
  StrategyActivityJobSummary,
  StrategyRuntimeSnapshot,
  StrategySummary,
  TradeRecord,
  WorkspacePreferences,
} from './types'

const ReactECharts = lazy(() => import('./components/LazyECharts'))

type NavItem = {
  key: SectionKey
  label: string
  hint: string
  group: 'overview' | 'observe' | 'research' | 'control' | 'records'
  icon: typeof Activity
}

const navGroups = [
  { key: 'overview', label: '总览' },
  { key: 'observe', label: '交易观察' },
  { key: 'research', label: '策略研究' },
  { key: 'control', label: '运行控制' },
  { key: 'records', label: '记录审计' },
] as const

const navItems: NavItem[] = [
  { key: 'overview', label: '总览', hint: '运行看板', group: 'overview', icon: Activity },
  { key: 'market', label: '行情', hint: '实时跟踪', group: 'observe', icon: CandlestickChart },
  { key: 'news', label: '新闻事件', hint: '情报与宏观', group: 'observe', icon: Newspaper },
  { key: 'strategy', label: '策略', hint: '参数与启停', group: 'research', icon: ClipboardList },
  { key: 'backtest', label: '回测', hint: '历史验证', group: 'research', icon: FileSearch },
  { key: 'replay', label: 'AI复盘', hint: '日报总结', group: 'research', icon: Sparkles },
  { key: 'settings', label: '设置', hint: '控制与偏好', group: 'control', icon: Settings2 },
  { key: 'scheduler', label: 'AI调度', hint: 'OpenClaw 编排', group: 'control', icon: Bot },
  { key: 'alerts', label: '提醒中心', hint: '风险告警', group: 'control', icon: Bell },
  { key: 'trades', label: '交易记录', hint: '委托与成交', group: 'records', icon: History },
  { key: 'audit', label: '系统日志/审计', hint: '执行追溯', group: 'records', icon: ShieldAlert },
]

const defaultCardOrder = ['ai_center', 'strategy_watch', 'account_center']
const defaultVisibleCards = [...defaultCardOrder]
const WORKSPACE_STORAGE_KEY = 'bybit-control-workspace-v1'
const backtestRangePresets = [
  { value: '2026-03-01 ~ 2026-03-29', label: '近 30 天' },
  { value: '2025-12-01 ~ 2026-03-29', label: '近 90 天' },
  { value: '2025-10-01 ~ 2026-03-29', label: '近 180 天' },
] as const
const backtestTimeframePresets = [
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
] as const
const marketTimeframePresets = [
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
] as const

type WorkspaceBootstrap = {
  active_section: SectionKey
  layout_preset: LayoutPreset
  selected_mode: Mode
  selected_symbol: string
  selected_market_timeframe: '15m' | '1h' | '4h' | '1d'
  selected_strategy_id: string | null
  overview_card_order: string[]
  overview_visible_cards: string[]
  overview_collapsed_cards: string[]
  updated_at: string | null
  source: 'local' | 'default'
}

type ActionFeedback = {
  tone: 'success' | 'warning' | 'error'
  title: string
  detail: string
}

type MarketTimeframe = '15m' | '1h' | '4h' | '1d'
type DesktopNotificationTone = 'normal' | 'critical'
type DesktopNotificationPayload = {
  title: string
  body: string
  urgency?: DesktopNotificationTone
}

async function sendDesktopNotification(
  payload: DesktopNotificationPayload,
  permissionRequestedRef?: { current: boolean },
) {
  if (typeof window === 'undefined') {
    return false
  }

  if (typeof window.bybitApp?.notify === 'function') {
    try {
      return await window.bybitApp.notify(payload)
    } catch (error) {
      console.warn('原生桌面通知发送失败，已回退浏览器通知。', error)
    }
  }

  if (typeof Notification === 'undefined') {
    return false
  }

  if (Notification.permission === 'default' && permissionRequestedRef && !permissionRequestedRef.current) {
    permissionRequestedRef.current = true
    try {
      await Notification.requestPermission()
    } catch (error) {
      console.warn('浏览器通知权限请求失败。', error)
    }
  }

  if (Notification.permission !== 'granted') {
    return false
  }

  new Notification(payload.title, { body: payload.body })
  return true
}

function eventCategoryMeta(eventType: string) {
  if (eventType.includes('change_request')) {
    return { icon: ClipboardList, label: '请求' }
  }
  if (eventType.includes('scheduler') || eventType.includes('review')) {
    return { icon: Bot, label: '调度' }
  }
  if (eventType.includes('workspace')) {
    return { icon: Save, label: '工作台' }
  }
  if (eventType.includes('strategy') || eventType.includes('backtest')) {
    return { icon: FileSearch, label: '策略' }
  }
  if (eventType.includes('trade') || eventType.includes('order')) {
    return { icon: History, label: '交易' }
  }
  if (eventType.includes('alert') || eventType.includes('news')) {
    return { icon: Bell, label: '提醒' }
  }
  return { icon: ShieldAlert, label: '系统' }
}

function summarizeAuditEvent(payload: Record<string, unknown>) {
  const summary = payload.summary
  if (typeof summary === 'string' && summary.trim()) {
    return summary
  }
  const command = payload.command
  if (typeof command === 'string' && command.trim()) {
    return `命令 ${command}`
  }
  const title = payload.title
  if (typeof title === 'string' && title.trim()) {
    return title
  }
  const symbol = payload.symbol
  if (typeof symbol === 'string' && symbol.trim()) {
    return symbol
  }
  return '事件已记录'
}

function getAuditLinkedReviewId(payload: Record<string, unknown>) {
  const linkedReviewId = payload.linked_review_id
  if (typeof linkedReviewId === 'string' && linkedReviewId.trim()) {
    return linkedReviewId
  }
  const reviewId = payload.review_id
  return typeof reviewId === 'string' && reviewId.trim() ? reviewId : null
}

function getAuditStrategyId(payload: Record<string, unknown>) {
  const strategyId = payload.strategy_id
  return typeof strategyId === 'string' && strategyId.trim() ? strategyId : null
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

function normalizeCollapsedCardIds(ids: string[], orderedCardIds: string[]) {
  const order = normalizeCardIds(orderedCardIds)
  const valid = ids.filter((id) => order.includes(id))
  const deduped: string[] = []
  valid.forEach((id) => {
    if (!deduped.includes(id)) {
      deduped.push(id)
    }
  })
  return order.filter((id) => deduped.includes(id))
}

function normalizeWorkspaceMarketTimeframe(value: unknown): MarketTimeframe {
  const normalized = String(value ?? '1h').trim().toLowerCase()
  if (normalized === '15m' || normalized === '15') return '15m'
  if (normalized === '4h' || normalized === '240') return '4h'
  if (normalized === '1d' || normalized === 'd') return '1d'
  return '1h'
}

function buildDefaultWorkspaceBootstrap(): WorkspaceBootstrap {
  return {
    active_section: 'overview',
    layout_preset: 'balanced',
    selected_mode: 'paper',
    selected_symbol: 'BTCUSDT',
    selected_market_timeframe: '1h',
    selected_strategy_id: null,
    overview_card_order: [...defaultCardOrder],
    overview_visible_cards: [...defaultVisibleCards],
    overview_collapsed_cards: [],
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
      selected_market_timeframe: normalizeWorkspaceMarketTimeframe(
        parsed.selected_market_timeframe ?? baseline.selected_market_timeframe,
      ),
      selected_strategy_id: parsed.selected_strategy_id ?? baseline.selected_strategy_id,
      overview_card_order: cardOrder,
      overview_visible_cards: normalizeVisibleCardIds(
        parsed.overview_visible_cards ?? baseline.overview_visible_cards,
        cardOrder,
      ),
      overview_collapsed_cards: normalizeCollapsedCardIds(
        parsed.overview_collapsed_cards ?? baseline.overview_collapsed_cards,
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
      overview_collapsed_cards: normalizeCollapsedCardIds(
        workspace.overview_collapsed_cards,
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
  selected_market_timeframe: '15m' | '1h' | '4h' | '1d'
  selected_strategy_id?: string | null
  overview_card_order: string[]
  overview_visible_cards: string[]
  overview_collapsed_cards: string[]
}) {
  return JSON.stringify({
    active_section: workspace.active_section,
    layout_preset: workspace.layout_preset,
    selected_mode: workspace.selected_mode,
    selected_symbol: workspace.selected_symbol,
    selected_market_timeframe: normalizeWorkspaceMarketTimeframe(workspace.selected_market_timeframe),
    selected_strategy_id: workspace.selected_strategy_id ?? '',
    overview_card_order: normalizeCardIds(workspace.overview_card_order),
    overview_visible_cards: normalizeVisibleCardIds(
      workspace.overview_visible_cards,
      workspace.overview_card_order,
    ),
    overview_collapsed_cards: normalizeCollapsedCardIds(
      workspace.overview_collapsed_cards,
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

function normalizeDraftValue(value: string | number | boolean) {
  return typeof value === 'boolean' ? String(value) : String(value ?? '')
}

function normalizeOrderInputValue(value: string | number) {
  return String(value ?? '').replace(/,/g, '')
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

function coerceParameterValue(
  currentValue: string | number | boolean,
  nextValue: string,
): string | number | boolean {
  if (typeof currentValue === 'boolean') {
    return nextValue.trim().toLowerCase() === 'true'
  }
  if (typeof currentValue === 'number') {
    const parsed = Number(nextValue)
    if (!Number.isFinite(parsed)) {
      return currentValue
    }
    return Number.isInteger(currentValue) ? Math.trunc(parsed) : parsed
  }
  return nextValue
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

function changeRequestStatusLabel(status: string) {
  return (
    {
      draft: '草稿',
      queued: '排队中',
      running: '执行中',
      applied: '已落实',
      failed: '失败',
      rolled_back: '已回滚',
    }[status] ?? status
  )
}

function proposalTypeLabel(type: string) {
  return (
    {
      param_update: '调参建议',
      pause_resume: '启停建议',
      risk_update: '风控建议',
      backtest_request: '回测请求',
      script_patch_proposal: '脚本补丁',
      publish_recommendation: '发布建议',
    }[type] ?? type
  )
}

function proposalStatusLabel(status: string) {
  return (
    {
      pending: '待处理',
      testing: '测试中',
      accepted: '已接受',
      rejected: '已拒绝',
    }[status] ?? status
  )
}

function isStrategyTrackingReview(period?: string | null) {
  return period === 'strategy_issue' || period === 'strategy_change'
}

function reviewPeriodLabel(period?: string | null) {
  return (
    {
      daily: '日度复盘',
      backtest: '回测复盘',
      strategy_issue: '问题跟踪',
      strategy_change: '变更跟踪',
    }[period ?? ''] ?? (period || '复盘')
  )
}

function reviewPeriodChipClass(period?: string | null) {
  if (period === 'backtest') return 'chip chip--warning'
  if (isStrategyTrackingReview(period)) return 'chip chip--muted'
  return 'chip chip--success'
}

function alertSourceMeta(sourceType?: 'rule' | 'news' | 'backtest' | 'system') {
  return (
    {
      rule: { label: '规则提醒', icon: Bell },
      news: { label: '新闻提醒', icon: Newspaper },
      backtest: { label: '回测提醒', icon: FileSearch },
      system: { label: '系统提醒', icon: ShieldAlert },
    }[sourceType ?? 'system'] ?? { label: '系统提醒', icon: ShieldAlert }
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

function bybitRestReachabilityLabel(reachable?: boolean | null) {
  if (reachable == null) return 'REST 未探测'
  return reachable ? 'REST 已可达' : 'REST 不可达'
}

function bybitPrivateRealtimeStatusLabel(status?: {
  realtime_connected?: boolean
  realtime_authenticated?: boolean
  realtime_stale?: boolean
  realtime_stale_seconds?: number
}) {
  if (!status?.realtime_connected) return '私有 WS 未连通'
  if (status.realtime_stale) {
    return `私有 WS 已失活${status.realtime_stale_seconds ? ` / ${status.realtime_stale_seconds}s` : ''}`
  }
  return `私有 WS 已连通${status.realtime_authenticated ? ' / 已鉴权' : ''}`
}

function bybitPublicChannelStatusLabel(
  channel: 'spot' | 'linear',
  status?: {
    enabled?: boolean
    connected_spot?: boolean
    connected_linear?: boolean
    spot_stale?: boolean
    linear_stale?: boolean
    spot_stale_seconds?: number
    linear_stale_seconds?: number
  },
) {
  if (!status?.enabled) return `${channel === 'linear' ? 'Linear' : 'Spot'} WS 未启用`
  const connected = channel === 'linear' ? status?.connected_linear : status?.connected_spot
  const stale = channel === 'linear' ? status?.linear_stale : status?.spot_stale
  const staleSeconds = channel === 'linear' ? status?.linear_stale_seconds : status?.spot_stale_seconds
  if (!connected) return `${channel === 'linear' ? 'Linear' : 'Spot'} WS 未连通`
  if (stale) return `${channel === 'linear' ? 'Linear' : 'Spot'} WS 已失活${staleSeconds ? ` / ${staleSeconds}s` : ''}`
  return `${channel === 'linear' ? 'Linear' : 'Spot'} WS 正常`
}

function bybitPublicDiagnosticSummary(item: {
  issue?: string | null
  channel: 'spot' | 'linear'
  connected: boolean
  has_symbol_feed: boolean
  stale: boolean
  stale_seconds: number
}) {
  if (item.issue) return item.issue
  if (!item.connected) return `${item.channel === 'linear' ? 'Linear' : 'Spot'} 通道未连通。`
  if (!item.has_symbol_feed) return `${item.channel === 'linear' ? 'Linear' : 'Spot'} 通道已连通，但目标品种尚未收到实时 feed。`
  if (item.stale) return `目标品种最近行情已失活，约 ${item.stale_seconds}s 未刷新。`
  return `${item.channel === 'linear' ? 'Linear' : 'Spot'} 通道已连通，目标品种实时行情正常刷新。`
}

function tradeOriginLabel(origin: 'manual' | 'strategy' | 'exchange') {
  return (
    {
      manual: '手动',
      strategy: '策略',
      exchange: '交易所',
    }[origin] ?? origin
  )
}

function jobStatusToneClass(status: string) {
  return `status-chip status-${status}`
}

function jobStatusLabel(status: string) {
  return (
    {
      queued: '排队中',
      running: '执行中',
      waiting: '等待中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
    }[status] ?? status
  )
}

function canRetryAgentJob(status: string) {
  return status === 'failed' || status === 'cancelled'
}

function buildAlertNotification(alert: {
  severity: 'P0' | 'P1' | 'P2'
  symbol: string
  title: string
  description: string
  suggested_action: string
}) {
  const scope = alert.symbol?.trim() ? `${alert.symbol} · ` : ''
  const detail = [alert.description, alert.suggested_action ? `建议：${alert.suggested_action}` : '']
    .filter(Boolean)
    .join(' · ')

  return {
    title: `${alert.severity} ${scope}${alert.title}`.trim(),
    body: detail || '出现新的高优先级提醒，请进入提醒中心查看。',
    urgency: alert.severity === 'P0' ? 'critical' : 'normal',
  } satisfies DesktopNotificationPayload
}

function buildAgentJobNotification(job: {
  job_type: string
  status: 'failed' | 'cancelled'
  result_summary?: string | null
}) {
  return {
    title: `AI 任务${job.status === 'failed' ? '失败' : '已取消'} · ${job.job_type}`,
    body: job.result_summary?.trim() || 'OpenClaw 任务未正常结束，请进入 AI 调度查看详情。',
    urgency: job.status === 'failed' ? 'critical' : 'normal',
  } satisfies DesktopNotificationPayload
}

function buildOpsEventNotification(event: ExecutionEvent) {
  if (event.event_type === 'exchange_order.created') {
    const qty = String(event.payload.quantity ?? event.payload.qty ?? '--')
    const price = String(event.payload.price ?? '--')
    return {
      title: `真实委托已提交 · ${event.symbol ?? '未指定品种'}`,
      body: `${qty} @ ${price} 已提交到 Bybit，等待交易所回报。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'exchange_order.replaced') {
    const qty = String(event.payload.quantity ?? '--')
    const price = String(event.payload.price ?? '--')
    return {
      title: `真实委托已修改 · ${event.symbol ?? '未指定品种'}`,
      body: `最新委托参数已更新为 ${qty} @ ${price}。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'exchange_order.cancelled') {
    return {
      title: `真实委托已撤销 · ${event.symbol ?? '未指定品种'}`,
      body: 'Bybit 撤单请求已经提交并写回当前订单列表。',
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'exchange_order.cancelled_all') {
    const count = String(event.payload.cancelled_count ?? 0)
    return {
      title: '真实委托已批量撤销',
      body: `本次共向 Bybit 提交 ${count} 条撤单请求。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'exchange_position.close_submitted') {
    const qty = String(event.payload.quantity ?? '--')
    const price = String(event.payload.price ?? '--')
    return {
      title: `真实持仓平仓委托已提交 · ${event.symbol ?? '未指定品种'}`,
      body: `${qty} @ ${price} 已按当前模式提交到 Bybit。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'exchange_position.close_all_submitted') {
    const count = String(event.payload.submitted_count ?? 0)
    return {
      title: '真实持仓批量平仓委托已提交',
      body: `本次共向 Bybit 提交 ${count} 条平仓委托。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'strategy.exchange_order.submitted') {
    const qty = String(event.payload.quantity ?? '--')
    const price = String(event.payload.price ?? '--')
    const strategyName = String(event.payload.strategy_name ?? '策略')
    return {
      title: `策略真实委托已提交 · ${event.symbol ?? '未指定品种'}`,
      body: `${strategyName} 已按当前信号提交 ${qty} @ ${price} 的 Bybit 委托。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'strategy.paper_trade.executed_manual') {
    const qty = String(event.payload.quantity ?? '--')
    const price = String(event.payload.price ?? '--')
    const strategyId = String(event.payload.strategy_id ?? '未指定策略')
    return {
      title: `策略纸面信号已执行 · ${event.symbol ?? '未指定品种'}`,
      body: `${strategyId} 已按当前信号写入 ${qty} @ ${price} 的 Paper 成交。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'paper_order.filled') {
    const qty = String(event.payload.qty ?? '--')
    const price = String(event.payload.price ?? '--')
    return {
      title: `Paper 委托已成交 · ${event.symbol ?? '未指定品种'}`,
      body: `${qty} @ ${price} 已写入本地成交与账户账本。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'paper_order.cancelled_all') {
    const count = String(event.payload.cancelled_count ?? 0)
    return {
      title: 'Paper 委托已批量取消',
      body: `本次共取消 ${count} 笔本地限价委托。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'manual_trade.positions_closed_all') {
    const count = String(event.payload.closed_count ?? 0)
    return {
      title: 'Paper 持仓已批量平仓',
      body: `本次共平掉 ${count} 个本地持仓方向。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  return {
    title: '量化控制端事件',
    body: summarizeAuditEvent(event.payload),
    urgency: 'normal',
  } satisfies DesktopNotificationPayload
}

function proposalAcceptBlockedReason(
  proposalType: string,
  schedulerState?: { status?: string; freeze_publish?: boolean } | null,
) {
  if (proposalType !== 'publish_recommendation') {
    return null
  }
  if (schedulerState?.status === 'manual_override') {
    return '当前处于人工接管状态，发布建议已锁定。'
  }
  if (schedulerState?.freeze_publish) {
    return '当前已冻结自动发布，发布建议不能直接接受。'
  }
  return null
}

function getAgentJobRetryCount(job: { retry_count?: number; context?: Record<string, unknown> }) {
  const topLevel = Number(job.retry_count)
  if (Number.isFinite(topLevel) && topLevel > 0) {
    return topLevel
  }
  const fromContext = Number(job.context?.retry_count)
  return Number.isFinite(fromContext) && fromContext > 0 ? fromContext : 0
}

function getAgentJobRetriedFrom(job: { retried_from_job_id?: string | null; context?: Record<string, unknown> }) {
  if (typeof job.retried_from_job_id === 'string' && job.retried_from_job_id.trim()) {
    return job.retried_from_job_id
  }
  const fromContext = job.context?.retried_from_job_id
  return typeof fromContext === 'string' && fromContext.trim() ? fromContext : null
}

function getAgentJobStrategyId(job: { strategy_id?: string | null; context?: Record<string, unknown> }) {
  if (typeof job.strategy_id === 'string' && job.strategy_id.trim()) {
    return job.strategy_id
  }
  const strategyId = job.context?.strategy_id
  return typeof strategyId === 'string' && strategyId.trim() ? strategyId : null
}

function getAgentJobLinkedReviewId(job: { linked_review_id?: string | null; context?: Record<string, unknown> }) {
  if (typeof job.linked_review_id === 'string' && job.linked_review_id.trim()) {
    return job.linked_review_id
  }
  const reviewId = job.context?.linked_review_id
  return typeof reviewId === 'string' && reviewId.trim() ? reviewId : null
}

function getAgentJobLinkedReviewPeriod(job: { linked_review_period?: string | null; context?: Record<string, unknown> }) {
  if (typeof job.linked_review_period === 'string' && job.linked_review_period.trim()) {
    return job.linked_review_period
  }
  const period = job.context?.linked_review_period
  return typeof period === 'string' && period.trim() ? period : null
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

function signalToneClass(signal: 'neutral' | 'watch' | 'active') {
  return (
    {
      neutral: 'tone-signal-neutral',
      watch: 'tone-signal-watch',
      active: 'tone-signal-active',
    }[signal] ?? 'tone-signal-neutral'
  )
}

function riskToneClass(level: 'low' | 'medium' | 'high') {
  return (
    {
      low: 'tone-risk-low',
      medium: 'tone-risk-medium',
      high: 'tone-risk-high',
    }[level] ?? 'tone-risk-medium'
  )
}

function strategyRuntimeSignalLabel(signal: StrategyRuntimeSnapshot['signal']) {
  return (
    {
      long: '做多',
      short: '做空',
      flat: '空仓',
      watch: '观察',
    }[signal] ?? signal
  )
}

function positionSideLabel(side: 'flat' | 'long' | 'short') {
  return (
    {
      flat: '空仓',
      long: '多仓',
      short: '空头',
    }[side] ?? side
  )
}

function strategyRuntimeSignalToneClass(signal: StrategyRuntimeSnapshot['signal']) {
  return (
    {
      long: 'positive',
      short: 'negative',
      flat: 'tone-signal-neutral',
      watch: 'tone-signal-watch',
    }[signal] ?? 'tone-signal-neutral'
  )
}

function strategyRuntimeGuardLabel(runtime: StrategyRuntimeSnapshot | null) {
  if (!runtime || runtime.guard_state === 'none') return null
  return (
    {
      live_stop_loss: '真实止损保护',
      cooldown: '冷却中',
      auto_dispatch_blocked: '执行受阻',
    }[runtime.guard_state] ?? null
  )
}

function strategyPositionAlignmentLabel(runtime: StrategyRuntimeSnapshot | null) {
  if (!runtime) return null
  return (
    {
      aligned: '已对齐',
      reconciling: '对齐中',
      drifted: '已偏离',
      unknown: '待确认',
    }[runtime.position_alignment] ?? null
  )
}

function strategyCurrentPositionLabel(runtime: StrategyRuntimeSnapshot | null) {
  if (!runtime) return null
  if (runtime.current_position_side === 'flat' || !runtime.current_position_size) return '当前仓位 空仓'
  const sideLabel = runtime.current_position_side === 'long' ? '多头' : '空头'
  const avgSuffix = runtime.current_position_avg_price ? ` @ ${runtime.current_position_avg_price}` : ''
  return `当前仓位 ${sideLabel} ${runtime.current_position_size}${avgSuffix}`
}

type StrategyExecutionPreview = {
  mode?: Mode | null
  action?: string | null
  allowed?: boolean | null
  blocked_reason?: string | null
  recommended_action?: string | null
  sizing_risk_budget?: string | null
  sizing_budget_notional?: string | null
  sizing_minimum_required_notional?: string | null
  sizing_available_balance_gap?: string | null
  notional?: string | null
  current_position_side?: 'flat' | 'long' | 'short' | null
  current_position_size?: string | null
  projected_position_side?: 'flat' | 'long' | 'short' | null
  projected_position_size?: string | null
  available_balance_before?: string | null
  available_balance_after?: string | null
  estimated_realized_pnl?: string | null
  warnings?: string[] | null
}

function extractStrategyExecutionPreview(runtime: StrategyRuntimeSnapshot | null): StrategyExecutionPreview | null {
  if (!runtime) return null
  const raw = runtime as StrategyRuntimeSnapshot & {
    execution_preview?: StrategyExecutionPreview
    executionPreview?: StrategyExecutionPreview
    preview?: StrategyExecutionPreview
  }
  return raw.execution_preview ?? raw.executionPreview ?? raw.preview ?? null
}

function strategyExecutionPreviewMatchesMode(preview: StrategyExecutionPreview | null, mode: Mode) {
  return Boolean(preview && preview.mode === mode)
}

function formatStrategySizingSummary(preview: StrategyExecutionPreview | null) {
  if (!preview?.sizing_available_balance_gap) return null
  const budget = preview.sizing_budget_notional ?? '--'
  const minimum = preview.sizing_minimum_required_notional ?? '--'
  const riskBudget = preview.sizing_risk_budget ?? '--'
  return `资金门槛还差 ${preview.sizing_available_balance_gap} · 预算 ${budget} / 最低 ${minimum} · risk_budget ${riskBudget}`
}

function strategySupportsExecutionPreviewMode(
  strategy: StrategySummary | null | undefined,
  mode: Mode,
) {
  if (!strategy) return false
  if (mode === 'paper') {
    return strategy.mode === 'paper' || strategy.status === 'paper_only'
  }
  return strategy.mode === mode
}

function buildStrategyModeMismatchPreview(
  strategy: StrategySummary | null | undefined,
  runtime: StrategyRuntimeSnapshot | null,
  mode: Mode,
): StrategyExecutionPreview | null {
  if (!strategy) return null

  let blockedReason: string | null = null
  if (mode === 'paper') {
    if (!(strategy.mode === 'paper' || strategy.status === 'paper_only')) {
      blockedReason = '当前策略并未运行在 Paper 模式，不能生成 Paper 执行预检。'
    }
  } else if (strategy.mode !== mode) {
    blockedReason = `当前策略并未运行在 ${mode.toUpperCase()} 模式，不能直接按该模式执行。`
  }

  if (!blockedReason) return null

  return {
    mode,
    action: runtime?.next_action ?? '当前执行模式与策略运行模式不匹配。',
    allowed: false,
    blocked_reason: blockedReason,
    warnings: [blockedReason],
    current_position_side: runtime?.current_position_side,
    current_position_size: runtime?.current_position_size,
  }
}

function marketSourceLabel(source?: MarketDetail['source']) {
  return (
    {
      bybit_ws: 'Bybit 公共 WS',
      bybit_rest: 'Bybit 公共 REST',
      mock: 'Mock 回退',
    }[source ?? 'mock'] ?? 'Mock 回退'
  )
}

function marketSourceToneClass(source?: MarketDetail['source']) {
  return source === 'mock' ? 'chip--warning' : 'chip--success'
}

function accountSourceLabel(source?: AccountOverview['source']) {
  return (
    {
      bybit_private: '私有只读',
      paper: 'Paper 账户',
      mock: 'Mock 回退',
    }[source ?? 'mock'] ?? 'Mock 回退'
  )
}

function orderSourceLabel(source?: 'mock' | 'paper' | 'bybit_private') {
  return (
    {
      bybit_private: '交易所',
      paper: 'Paper',
      mock: 'Mock 回退',
    }[source ?? 'mock'] ?? 'Mock 回退'
  )
}

function pnlToneClass(value?: string) {
  if (!value || value === '--') return ''
  return value.trim().startsWith('-') ? 'negative' : 'positive'
}

function executionHealthLabel(health?: ControlSnapshot['execution_health']) {
  if (!health?.top_issue) return '运行稳定'
  return health.top_issue
}

function executionHealthToneClass(health?: ControlSnapshot['execution_health']) {
  if (!health) return ''
  if (health.runtime_worker_issue || health.runtime_worker_stale || health.runtime_worker_stopped) return 'negative'
  if (health.active_stop_loss_guards > 0 || health.rejection_guards > 0) return 'negative'
  if (
    health.stale_order_guards > 0 ||
    health.auto_dispatch_blocked > 0 ||
    health.drifts > 0 ||
    health.cooldowns > 0
  ) {
    return 'tone-risk-medium'
  }
  return 'positive'
}

function executionHealthTooltip(health?: ControlSnapshot['execution_health']) {
  if (!health) return '当前执行健康状态不可用'
  return [
    health.top_issue ? `当前问题 ${health.top_issue}` : null,
    health.top_issue_symbol ? `问题品种 ${health.top_issue_symbol}` : null,
    health.top_issue_strategy_name ? `问题策略 ${health.top_issue_strategy_name}` : null,
    health.top_issue_detail ? `问题详情 ${health.top_issue_detail}` : null,
    health.top_issue_recommended_action ? `建议 ${health.top_issue_recommended_action}` : null,
    `线程运行 ${health.runtime_worker_running ? '是' : '否'}`,
    `线程停滞 ${health.runtime_worker_stale ? '是' : '否'}`,
    `线程未运行 ${health.runtime_worker_stopped ? '是' : '否'}`,
    `止损保护 ${health.active_stop_loss_guards}`,
    `冷却中 ${health.cooldowns}`,
    `执行受阻 ${health.auto_dispatch_blocked}`,
    `连续拒单 ${health.rejection_guards}`,
    `挂单停滞 ${health.stale_order_guards}`,
    `仓位偏离 ${health.drifts}`,
    health.runtime_last_error ? `线程错误 ${health.runtime_last_error}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function executionEventSummary(event: ExecutionEvent) {
  return String(
    event.payload?.detail ??
      event.payload?.message ??
      event.payload?.status ??
      event.source ??
      event.event_type,
  )
}

function activityAlertToneClass(alert: AlertRecord) {
  if (alert.severity === 'P0') return 'negative'
  if (alert.severity === 'P1') return 'tone-risk-medium'
  return ''
}

function orderActivitySummary(order: OrderRecord) {
  return `${order.symbol} · ${order.side === 'buy' ? '买' : '卖'} · ${order.qty}@${order.price}`
}

function tradeActivitySummary(trade: TradeRecord) {
  return `${trade.symbol} · ${trade.side === 'buy' ? '买' : '卖'} · ${trade.quantity}@${trade.price}`
}

function strategyAgentJobSummary(job: StrategyActivityJobSummary) {
  const retryCount = getAgentJobRetryCount(job)
  return `${job.job_type} · ${job.status}${retryCount > 0 ? ` · 第 ${retryCount} 次重试` : ''}`
}

function strategyActivityHeadline(activity?: StrategyActivitySnapshot | null) {
  if (!activity?.runtime) return '运行态尚未准备好'
  return `${strategyRuntimeSignalLabel(activity.runtime.signal)} · ${activity.runtime.next_action}`
}

function runtimeWorkerStatusLabel(
  runtimeStatus?: RuntimeWorkerStatus | null,
  health?: ControlSnapshot['execution_health'],
) {
  if (runtimeStatus) {
    if (runtimeStatus.last_error) return '运行线程异常'
    if (runtimeStatus.stale) return '运行线程停滞'
    if (runtimeStatus.stopped) return '运行线程未运行'
    if (!runtimeStatus.running) return '运行线程未启动'
    return '运行线程正常'
  }
  if (!health) return '运行线程状态不可用'
  if (health.runtime_last_error) return '运行线程异常'
  if (health.runtime_worker_stale) return '运行线程停滞'
  if (health.runtime_worker_stopped) return '运行线程未运行'
  if (!health.runtime_worker_running) return '运行线程未启动'
  return '运行线程正常'
}

function runtimeWorkerStatusDetail(
  runtimeStatus?: RuntimeWorkerStatus | null,
  health?: ControlSnapshot['execution_health'],
) {
  if (runtimeStatus) {
    if (runtimeStatus.last_error) {
      return `最近错误：${runtimeStatus.last_error}`
    }
    if (runtimeStatus.stale) {
      return `最近约 ${runtimeStatus.stale_seconds} 秒未成功刷新。`
    }
    if (runtimeStatus.stopped) {
      return runtimeStatus.last_refresh_at
        ? `最近一次成功刷新：${formatDateTime(runtimeStatus.last_refresh_at)}`
        : '后台线程此前运行过，但当前未处于活跃状态。'
    }
    if (!runtimeStatus.running) {
      return runtimeStatus.recommended_action ?? '后台线程当前未启动。'
    }
    return runtimeStatus.last_refresh_at
      ? `最近一次刷新：${formatDateTime(runtimeStatus.last_refresh_at)}`
      : '后台线程运行中。'
  }
  if (!health) return '本地服务暂未返回运行线程状态。'
  if (health.runtime_last_error) {
    return `最近错误：${health.runtime_last_error}`
  }
  if (health.runtime_worker_stale) {
    return `最近约 ${health.runtime_stale_seconds} 秒未成功刷新。`
  }
  if (health.runtime_worker_stopped) {
    return health.runtime_last_refresh_at
      ? `最近一次成功刷新：${formatDateTime(health.runtime_last_refresh_at)}`
      : '后台线程此前运行过，但当前未处于活跃状态。'
  }
  if (!health.runtime_worker_running) {
    return '后台线程当前未启动。'
  }
  return health.runtime_last_refresh_at
    ? `最近一次刷新：${formatDateTime(health.runtime_last_refresh_at)}`
    : '后台线程运行中。'
}

function runtimeWorkerStatusTooltip(
  runtimeStatus?: RuntimeWorkerStatus | null,
  health?: ControlSnapshot['execution_health'],
) {
  if (runtimeStatus) {
    return [
      `线程运行 ${runtimeStatus.running ? '是' : '否'}`,
      `线程停滞 ${runtimeStatus.stale ? '是' : '否'}`,
      `线程未运行 ${runtimeStatus.stopped ? '是' : '否'}`,
      `已成功启动过 ${runtimeStatus.started_once ? '是' : '否'}`,
      `停滞秒数 ${runtimeStatus.stale_seconds}`,
      runtimeStatus.top_issue ? `当前问题 ${runtimeStatus.top_issue}` : null,
      runtimeStatus.last_error ? `线程错误 ${runtimeStatus.last_error}` : null,
      runtimeStatus.recommended_action ? `建议 ${runtimeStatus.recommended_action}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  return executionHealthTooltip(health)
}

function marketTradeSideLabel(side: MarketRecentTrade['side']) {
  return side === 'buy' ? 'B' : 'S'
}

function marketTradeSideClass(side: MarketRecentTrade['side']) {
  return side === 'buy' ? 'positive' : 'negative'
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
  const [strategyEditorOpen, setStrategyEditorOpen] = useState(false)
  const [strategyActivityPanelOpen, setStrategyActivityPanelOpen] = useState(false)
  const [strategyTrackingPanelOpen, setStrategyTrackingPanelOpen] = useState(false)
  const [reviewInspectorOpen, setReviewInspectorOpen] = useState(false)
  const [reviewInspectorReviewId, setReviewInspectorReviewId] = useState<string | null>(null)
  const [reviewInspectorStrategyId, setReviewInspectorStrategyId] = useState<string | null>(null)
  const [aiSchedulerFocusedJobId, setAiSchedulerFocusedJobId] = useState<string | null>(null)
  const [strategyTrackingKind, setStrategyTrackingKind] = useState<'issue' | 'change'>('issue')
  const [strategyTrackingSummary, setStrategyTrackingSummary] = useState('')
  const [strategyTrackingDetail, setStrategyTrackingDetail] = useState('')
  const [strategyTrackingRequestKey, setStrategyTrackingRequestKey] = useState(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  )
  const [replayFocusedReviewId, setReplayFocusedReviewId] = useState<string | null>(null)
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<'all' | 'P0' | 'P1' | 'P2'>('all')
  const [alertStatusFilter, setAlertStatusFilter] = useState<'all' | 'pending' | 'acknowledged'>('pending')
  const [alertScopeFilter, setAlertScopeFilter] = useState<'all' | 'selected'>('all')
  const [tradeModeFilter, setTradeModeFilter] = useState<'all' | Mode>('all')
  const [tradeOriginFilter, setTradeOriginFilter] = useState<'all' | 'manual' | 'strategy' | 'exchange'>('all')
  const [tradeScopeFilter, setTradeScopeFilter] = useState<'all' | 'selected'>('all')
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'critical'>('all')
  const [auditSourceFilter, setAuditSourceFilter] = useState('all')
  const [auditScopeFilter, setAuditScopeFilter] = useState<'all' | 'selected'>('all')
  const [auditSearch, setAuditSearch] = useState('')
  const [watchlistDraftSymbol, setWatchlistDraftSymbol] = useState('')
  const [watchlistDraftMarket, setWatchlistDraftMarket] = useState<'spot' | 'perp'>('perp')
  const [watchlistAlertDrafts, setWatchlistAlertDrafts] = useState<Record<string, string>>({})
  const [parameterDrafts, setParameterDrafts] = useState<Record<string, string>>({})
  const [riskBudgetDraft, setRiskBudgetDraft] = useState('')
  const [backtestFilter, setBacktestFilter] = useState<'selected' | 'all'>('selected')
  const [replayTrackingScope, setReplayTrackingScope] = useState<'all' | 'selected'>('all')
  const [selectedBacktestId, setSelectedBacktestId] = useState<string | null>(null)
  const [backtestRangeDraft, setBacktestRangeDraft] = useState<string>(backtestRangePresets[1].value)
  const [backtestTimeframeDraft, setBacktestTimeframeDraft] = useState<string>('1h')
  const [manualOrder, setManualOrder] = useState({
    side: 'buy' as 'buy' | 'sell',
    quantity: '1',
    price: '0',
    note: '',
  })
  const manualOrderSymbolRef = useRef<string | null>(null)
  const desktopNotificationPermissionRequestedRef = useRef(false)
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

  const deferredSymbol = useDeferredValue(selectedSymbol)
  const liveMarketEnabled = activeSection === 'overview' || activeSection === 'market'
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
  const watchlistQuery = useQuery({
    queryKey: ['watchlist'],
    queryFn: api.getWatchlist,
    refetchInterval: 12000,
  })
  const marketDetailQuery = useQuery({
    queryKey: ['market', deferredSymbol, selectedMarketTimeframe],
    queryFn: () => api.getMarketDetail(deferredSymbol, selectedMarketTimeframe),
    refetchInterval: 12000,
  })
  const marketLiveQuery = useQuery({
    queryKey: ['market-live', deferredSymbol, selectedMarketTimeframe],
    queryFn: () => api.getMarketLiveSnapshot(deferredSymbol, selectedMarketTimeframe),
    enabled: liveMarketEnabled,
    refetchInterval: 4000,
    staleTime: 0,
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
  const selectedStrategySupportsSelectedMode = strategySupportsExecutionPreviewMode(selectedStrategy, selectedMode)
  const activeStrategyId = selectedStrategy?.id ?? selectedStrategyId ?? ''
  const runtimePreviewMatchesSelectedMode = strategyExecutionPreviewMatchesMode(selectedStrategyExecutionPreview, selectedMode)
  const strategyNameMap = useMemo(() => new Map(strategies.map((item) => [item.id, item.name])), [strategies])
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
  const selectedStrategyReviewsQuery = useQuery({
    queryKey: ['strategy-reviews', activeStrategyId],
    queryFn: () => api.getReviews({ strategyId: activeStrategyId }),
    enabled:
      Boolean(activeStrategyId) &&
      (activeSection === 'strategy' || activeSection === 'backtest' || activeSection === 'replay'),
    refetchInterval:
      activeSection === 'strategy' || activeSection === 'backtest' || activeSection === 'replay' ? 30000 : false,
  })
  const replayTrackingReviewsQuery = useQuery({
    queryKey: ['replay-tracking-reviews', replayTrackingScope, selectedStrategy?.id ?? 'none'],
    queryFn: () =>
      api.getReviews({
        strategyId: replayTrackingScope === 'selected' ? selectedStrategy?.id ?? null : null,
        periods: ['strategy_issue', 'strategy_change'],
      }),
    enabled: activeSection === 'replay' && (replayTrackingScope === 'all' || Boolean(selectedStrategy?.id)),
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

  const applyWorkspaceState = (nextWorkspace: WorkspaceBootstrap | WorkspacePreferences) => {
    setActiveSection(nextWorkspace.active_section)
    setLayoutPreset(nextWorkspace.layout_preset)
    setSelectedMode(nextWorkspace.selected_mode)
    setSelectedSymbol(nextWorkspace.selected_symbol)
    setSelectedMarketTimeframe(normalizeWorkspaceMarketTimeframe(nextWorkspace.selected_market_timeframe))
    setSelectedStrategyId(nextWorkspace.selected_strategy_id ?? null)
    setCardOrder(normalizeCardIds(nextWorkspace.overview_card_order))
    setVisibleOverviewCards(
      normalizeVisibleCardIds(nextWorkspace.overview_visible_cards, nextWorkspace.overview_card_order),
    )
    setCollapsedOverviewCards(
      normalizeCollapsedCardIds(
        nextWorkspace.overview_collapsed_cards ?? [],
        nextWorkspace.overview_card_order,
      ),
    )
    setWorkspaceSavedAt(nextWorkspace.updated_at)
    setLastSyncedWorkspaceSignature(buildWorkspaceSignature(nextWorkspace))
  }

  const showFeedback = (tone: ActionFeedback['tone'], title: string, detail: string) => {
    setActionFeedback({ tone, title, detail })
  }

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
      selected_market_timeframe: selectedMarketTimeframe,
      selected_strategy_id: selectedStrategyId,
      overview_card_order: cardOrder,
      overview_visible_cards: visibleOverviewCards,
      overview_collapsed_cards: collapsedOverviewCards,
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
    selectedMarketTimeframe,
    selectedStrategyId,
    selectedSymbol,
    collapsedOverviewCards,
    visibleOverviewCards,
    workspaceQuery.data,
  ])

  useEffect(() => {
    if (!liveMarketEnabled || !deferredSymbol || typeof EventSource === 'undefined') {
      return
    }

    const stream = new EventSource(
      `${CONTROL_API_BASE}/api/market/stream?symbol=${encodeURIComponent(deferredSymbol)}&timeframe=${encodeURIComponent(selectedMarketTimeframe)}`,
    )

    const handleSnapshot = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as MarketLiveSnapshot
        queryClient.setQueryData(['market-live', deferredSymbol, selectedMarketTimeframe], payload)
        queryClient.setQueryData(['watchlist'], payload.watchlist)
        queryClient.setQueryData(['market', deferredSymbol, selectedMarketTimeframe], payload.detail)
      } catch (error) {
        console.warn('解析市场流快照失败', error)
      }
    }

    stream.addEventListener('snapshot', handleSnapshot as EventListener)

    return () => {
      stream.removeEventListener('snapshot', handleSnapshot as EventListener)
      stream.close()
    }
  }, [deferredSymbol, liveMarketEnabled, queryClient, selectedMarketTimeframe])

  useEffect(() => {
    if (!liveAiEnabled || typeof EventSource === 'undefined') {
      return
    }

    const stream = new EventSource(`${CONTROL_API_BASE}/api/ai/stream`)

    const handleSnapshot = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as AiLiveSnapshot
        queryClient.setQueryData(['ai-live'], payload)
        queryClient.setQueryData(['scheduler'], {
          scheduler: payload.scheduler,
          jobs: payload.jobs,
          change_requests: payload.change_requests,
        })
        queryClient.setQueryData(['change-requests'], payload.change_requests)
      } catch (error) {
        console.warn('解析 AI 调度流快照失败', error)
      }
    }

    stream.addEventListener('snapshot', handleSnapshot as EventListener)

    return () => {
      stream.removeEventListener('snapshot', handleSnapshot as EventListener)
      stream.close()
    }
  }, [liveAiEnabled, queryClient])

  useEffect(() => {
    if (!liveOpsEnabled || typeof EventSource === 'undefined') {
      return
    }

    const stream = new EventSource(`${CONTROL_API_BASE}/api/ops/stream`)

    const handleSnapshot = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as OpsLiveSnapshot
        queryClient.setQueryData(['ops-live'], payload)
        queryClient.setQueryData(['alerts'], payload.alerts)
        queryClient.setQueryData(['trades'], payload.trades)
        queryClient.setQueryData(['audit'], payload.audit_events)
      } catch (error) {
        console.warn('解析 ops 实时流快照失败', error)
      }
    }

    stream.addEventListener('snapshot', handleSnapshot as EventListener)

    return () => {
      stream.removeEventListener('snapshot', handleSnapshot as EventListener)
      stream.close()
    }
  }, [liveOpsEnabled, queryClient])

  useEffect(() => {
    if (!liveAccountEnabled || typeof EventSource === 'undefined') {
      return
    }

    const stream = new EventSource(`${CONTROL_API_BASE}/api/account/stream`)

    const handleSnapshot = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as AccountLiveSnapshot
        queryClient.setQueryData(['account-live'], payload)
        queryClient.setQueryData(['account-overview'], payload.overview)
        queryClient.setQueryData(['account-positions'], payload.positions)
        queryClient.setQueryData(['account-orders'], payload.orders)
        queryClient.setQueryData(['account-order-history'], payload.order_history)
      } catch (error) {
        console.warn('解析账户实时流快照失败', error)
      }
    }

    stream.addEventListener('snapshot', handleSnapshot as EventListener)

    return () => {
      stream.removeEventListener('snapshot', handleSnapshot as EventListener)
      stream.close()
    }
  }, [liveAccountEnabled, queryClient])

  useEffect(() => {
    if (!liveStrategyEnabled || typeof EventSource === 'undefined') {
      return
    }

    const stream = new EventSource(`${CONTROL_API_BASE}/api/strategies/stream`)

    const handleSnapshot = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { items?: StrategyRuntimeSnapshot[] }
        queryClient.setQueryData(['strategy-runtime'], payload.items ?? [])
      } catch (error) {
        console.warn('解析策略运行态流快照失败', error)
      }
    }

    stream.addEventListener('snapshot', handleSnapshot as EventListener)

    return () => {
      stream.removeEventListener('snapshot', handleSnapshot as EventListener)
      stream.close()
    }
  }, [liveStrategyEnabled, queryClient])

  const serviceAvailable = Boolean(healthQuery.data?.ok)
  const snapshot = snapshotQuery.data
  const runtimeWorkerStatus = runtimeWorkerStatusQuery.data
  const watchlist = useMemo(
    () => marketLiveQuery.data?.watchlist ?? watchlistQuery.data ?? [],
    [marketLiveQuery.data?.watchlist, watchlistQuery.data],
  )
  const watchlistAlertSignature = watchlist
    .map((item) => `${item.symbol}:${item.alert_enabled ? '1' : '0'}:${item.alert_threshold_pct}`)
    .join('|')
  const marketDetail = marketLiveQuery.data?.detail ?? marketDetailQuery.data
  const selectedWatchItem = watchlist.find((item) => item.symbol === selectedSymbol)
  const marketPublicTrades = marketDetail?.recent_public_trades ?? []
  const selectedModeStrategyPreview =
    strategyExecutionPreviewQuery.data ?? selectedStrategyModeMismatchPreview ?? selectedStrategyExecutionPreview
  const selectedStrategyActivity = strategyActivityQuery.data
  const selectedStrategyRuntimePreview = selectedStrategyRuntime
    ? selectedModeStrategyPreview ?? {
        action: selectedStrategyRuntime.next_action,
        allowed: false,
        blocked_reason:
          selectedStrategyRuntime.runtime_status === 'paused'
            ? '策略当前处于暂停状态，只有恢复运行后才会继续评估执行。'
            : '当前正在等待该模式下的策略执行预检，请稍后再试。',
        notional: null,
        current_position_side: null,
        current_position_size: null,
        projected_position_side: null,
        projected_position_size: null,
        available_balance_before: null,
        available_balance_after: null,
        estimated_realized_pnl: null,
        warnings: selectedStrategyRuntime.note ? [selectedStrategyRuntime.note] : [],
      }
    : null
  const backtests = backtestsQuery.data ?? []
  const scheduler = aiLiveQuery.data ?? schedulerQuery.data
  const opsLive = opsLiveQuery.data
  const alerts = useMemo(() => opsLive?.alerts ?? alertsQuery.data ?? [], [opsLive?.alerts, alertsQuery.data])
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
  const accountOrderHistory = accountLiveQuery.data?.order_history ?? accountOrderHistoryQuery.data ?? []
  const news = newsQuery.data ?? []
  const trades = opsLive?.trades ?? tradesQuery.data ?? []
  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data])
  const auditEvents = useMemo(
    () => opsLive?.audit_events ?? auditQuery.data ?? [],
    [auditQuery.data, opsLive?.audit_events],
  )
  const changeRequests = aiLiveQuery.data?.change_requests ?? changeRequestsQuery.data ?? scheduler?.change_requests ?? []
  const settings = settingsQuery.data
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
      (bybitPublicIssueDiagnostics.length
        ? bybitPublicIssueDiagnostics
        : (bybitPublicStatus?.watched_symbol_diagnostics ?? []).slice(0, 4)
      ).slice(0, 4),
    [bybitPublicIssueDiagnostics, bybitPublicStatus?.watched_symbol_diagnostics],
  )
  const snapshotExecutionHealth = snapshot?.execution_health
  const desktopNotificationsEnabled = settings?.notification_channels.includes('desktop') ?? true
  const runtimeWorkerNeedsRecovery = runtimeWorkerStatus
    ? runtimeWorkerStatus.issue || runtimeWorkerStatus.stale || runtimeWorkerStatus.stopped || !runtimeWorkerStatus.running
    : Boolean(
        snapshotExecutionHealth?.runtime_worker_issue ||
          snapshotExecutionHealth?.runtime_worker_stale ||
          snapshotExecutionHealth?.runtime_worker_stopped ||
          (snapshotExecutionHealth && !snapshotExecutionHealth.runtime_worker_running),
      )
  const runtimeWorkerRestoreHint =
    runtimeWorkerStatus?.recommended_action ??
    '当前策略运行线程异常、停滞或未运行，恢复后后台自动执行链会重新接管。'
  const aiActivityFeed = aiLiveQuery.data?.activity_feed ?? auditEvents.filter((event) => event.source === 'openclaw' || event.source === 'desktop').slice(0, 5)
  const strategyBacktests = selectedStrategy
    ? backtests.filter((item) => item.strategy_id === selectedStrategy.id)
    : []
  const latestStrategyBacktest = strategyBacktests[0]
  const strategyProposals = selectedStrategy
    ? reviews
        .flatMap((review) => review.proposals)
        .filter((proposal) => proposal.strategy_id === selectedStrategy.id)
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    : []
  const selectedStrategyReviews = selectedStrategy
    ? (selectedStrategyReviewsQuery.data ?? reviews)
        .filter(
          (review) =>
            review.strategy_id === selectedStrategy.id ||
            review.proposals.some((proposal) => proposal.strategy_id === selectedStrategy.id),
        )
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    : []
  const reviewCatalog = useMemo(() => {
    const combined = [
      ...reviews,
      ...(selectedStrategyReviewsQuery.data ?? []),
      ...(replayTrackingReviewsQuery.data ?? []),
    ]
    const seen = new Set<string>()
    return combined.filter((review) => {
      if (seen.has(review.id)) {
        return false
      }
      seen.add(review.id)
      return true
    })
  }, [reviews, selectedStrategyReviewsQuery.data, replayTrackingReviewsQuery.data])
  const selectedStrategyPrimaryReviews = selectedStrategyReviews.filter(
    (review) => !isStrategyTrackingReview(review.period),
  )
  const openStrategyProposals = strategyProposals.filter((proposal) => ['pending', 'testing'].includes(proposal.status))
  const gatedPublishProposalCount = openStrategyProposals.filter(
    (proposal) => proposal.proposal_type === 'publish_recommendation',
  ).length
  const strategyChangeRequests = selectedStrategy
    ? changeRequests
        .filter((request) => String(request.payload.strategy_id ?? '') === selectedStrategy.id)
        .slice(0, 6)
    : []
  const selectedStrategyReview = selectedStrategyPrimaryReviews[0] ?? selectedStrategyReviews[0] ?? null
  const selectedStrategyParameterSignature = JSON.stringify(
    (selectedStrategy?.parameters ?? []).map((parameter) => [parameter.key, parameter.value]),
  )
  const backtestsForWorkspace =
    backtestFilter === 'selected' && selectedStrategy
      ? backtests.filter((item) => item.strategy_id === selectedStrategy.id)
      : backtests
  const selectedBacktest =
    backtestsForWorkspace.find((item) => item.id === selectedBacktestId) ?? backtestsForWorkspace[0]
  const latestWorkspaceBacktest = backtestsForWorkspace[0]
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

  useEffect(() => {
    if (!desktopNotificationsEnabled || !alertsNotificationBootstrapReady) {
      return
    }

    const importantAlerts = alerts.filter(
      (alert) => !alert.acknowledged && (alert.severity === 'P0' || alert.severity === 'P1'),
    )

    if (!notificationBootstrapRef.current.alerts) {
      importantAlerts.forEach((alert) => {
        seenAlertNotificationIdsRef.current.add(alert.id)
      })
      notificationBootstrapRef.current.alerts = true
      return
    }

    importantAlerts.forEach((alert) => {
      if (seenAlertNotificationIdsRef.current.has(alert.id)) {
        return
      }
      seenAlertNotificationIdsRef.current.add(alert.id)
      void sendDesktopNotification(
        buildAlertNotification(alert),
        desktopNotificationPermissionRequestedRef,
      )
    })
  }, [alerts, alertsNotificationBootstrapReady, desktopNotificationsEnabled])

  useEffect(() => {
    if (!desktopNotificationsEnabled || !jobsNotificationBootstrapReady) {
      return
    }

    const jobs = scheduler?.jobs ?? []

    if (!notificationBootstrapRef.current.jobs) {
      const statusMap = seenAgentJobStatusRef.current
      jobs.forEach((job) => {
        statusMap.set(job.id, job.status)
      })
      notificationBootstrapRef.current.jobs = true
      return
    }

    const statusMap = seenAgentJobStatusRef.current
    jobs.forEach((job) => {
      const previousStatus = statusMap.get(job.id)
      statusMap.set(job.id, job.status)

      if (previousStatus === job.status) {
        return
      }

      if (job.status === 'failed' || job.status === 'cancelled') {
        void sendDesktopNotification(
          buildAgentJobNotification({
            job_type: job.job_type,
            status: job.status,
            result_summary: job.result_summary,
          }),
          desktopNotificationPermissionRequestedRef,
        )
      }
    })
  }, [desktopNotificationsEnabled, jobsNotificationBootstrapReady, scheduler?.jobs])

  useEffect(() => {
    if (!desktopNotificationsEnabled) {
      return
    }

    const schedulerState = scheduler?.scheduler
    const nextStatus = schedulerState?.status
    if (!nextStatus) {
      return
    }

    if (!notificationBootstrapRef.current.scheduler) {
      lastSchedulerStatusRef.current = nextStatus
      notificationBootstrapRef.current.scheduler = true
      return
    }

    const previousStatus = lastSchedulerStatusRef.current
    lastSchedulerStatusRef.current = nextStatus

    if (previousStatus === nextStatus) {
      return
    }

    if (nextStatus === 'degraded' || nextStatus === 'manual_override') {
      void sendDesktopNotification(
        {
          title: `AI 调度${nextStatus === 'degraded' ? '降级' : '进入人工接管'}`,
          body: `当前状态：${schedulerLabel(nextStatus)} · 队列 ${schedulerState.queue_depth} 个，请进入 AI 调度页查看。`,
          urgency: nextStatus === 'degraded' ? 'critical' : 'normal',
        },
        desktopNotificationPermissionRequestedRef,
      )
    }
  }, [desktopNotificationsEnabled, scheduler?.scheduler])

  useEffect(() => {
    if (!desktopNotificationsEnabled || !opsNotificationBootstrapReady) {
      return
    }

    const interestingEvents = auditEvents.filter((event) =>
      [
        'exchange_order.created',
        'exchange_order.replaced',
        'exchange_order.cancelled',
        'exchange_order.cancelled_all',
        'exchange_position.close_submitted',
        'exchange_position.close_all_submitted',
        'strategy.exchange_order.submitted',
        'strategy.paper_trade.executed_manual',
        'paper_order.filled',
        'paper_order.cancelled_all',
        'manual_trade.positions_closed_all',
      ].includes(event.event_type),
    )

    if (!notificationBootstrapRef.current.ops) {
      interestingEvents.forEach((event) => {
        seenOpsNotificationIdsRef.current.add(event.id)
      })
      notificationBootstrapRef.current.ops = true
      return
    }

    interestingEvents.forEach((event) => {
      if (seenOpsNotificationIdsRef.current.has(event.id)) {
        return
      }
      seenOpsNotificationIdsRef.current.add(event.id)
      void sendDesktopNotification(
        buildOpsEventNotification(event),
        desktopNotificationPermissionRequestedRef,
      )
    })
  }, [auditEvents, desktopNotificationsEnabled, opsNotificationBootstrapReady])

  useEffect(() => {
    const currentParameters = selectedStrategy?.parameters ?? []
    const currentRiskBudget = selectedStrategy?.risk_budget ?? ''

    if (!selectedStrategyId || currentParameters.length === 0) {
      setParameterDrafts({})
      setRiskBudgetDraft('')
      return
    }
    setParameterDrafts(
      Object.fromEntries(
        currentParameters.map((parameter) => [parameter.key, normalizeDraftValue(parameter.value)]),
      ),
    )
    setRiskBudgetDraft(currentRiskBudget)
  }, [selectedStrategy, selectedStrategyId, selectedStrategyParameterSignature])

  useEffect(() => {
    setWatchlistAlertDrafts(
      Object.fromEntries(watchlist.map((item) => [item.symbol, item.alert_threshold_pct.toFixed(1)])),
    )
  }, [watchlist, watchlistAlertSignature])

  useEffect(() => {
    if (backtestsForWorkspace.length === 0) {
      setSelectedBacktestId(null)
      return
    }
    const exists = backtestsForWorkspace.some((item) => item.id === selectedBacktestId)
    if (!selectedBacktestId || !exists) {
      setSelectedBacktestId(backtestsForWorkspace[0].id)
    }
  }, [backtestsForWorkspace, selectedBacktestId])

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

  const manualOrderQuantity = Number(manualOrder.quantity)
  const manualOrderPrice = Number(manualOrder.price)
  const requiresPrivateTrading = selectedMode !== 'paper'
  const privateModeMismatch =
    requiresPrivateTrading && Boolean(bybitPrivateStatus?.can_query_private) && bybitPrivateStatus?.mode !== selectedMode
  const manualTradePreviewQuery = useQuery({
    queryKey: [
      'execution-preview',
      marketDetail?.symbol ?? 'unknown',
      marketDetail?.market ?? 'perp',
      selectedMode,
      manualOrder.side,
      manualOrderQuantity,
      manualOrderPrice,
      editingOrderId ?? 'new',
    ],
    queryFn: () =>
      api.previewExecution({
        symbol: marketDetail!.symbol,
        market: marketDetail!.market,
        mode: selectedMode,
        side: manualOrder.side,
        quantity: manualOrderQuantity,
        price: manualOrderPrice,
        origin: 'manual',
        exclude_order_id: editingOrderId ?? undefined,
      }),
    enabled:
      manualTradePanelOpen &&
      serviceAvailable &&
      Boolean(marketDetail) &&
      Number.isFinite(manualOrderQuantity) &&
      manualOrderQuantity > 0 &&
      Number.isFinite(manualOrderPrice) &&
      manualOrderPrice > 0,
    staleTime: 0,
    refetchInterval: manualTradePanelOpen ? 5000 : false,
  })
  const manualTradePreview: ExecutionPreview | undefined = manualTradePreviewQuery.data
  const manualTradePreviewBlockedReason = manualTradePreview && !manualTradePreview.allowed ? manualTradePreview.blocked_reason : null
  const manualTradePreviewBlockedMessage =
    manualTradePreviewBlockedReason && manualTradePreview?.recommended_action
      ? `${manualTradePreviewBlockedReason} 建议 ${manualTradePreview.recommended_action}`
      : manualTradePreviewBlockedReason
  const selectedStrategyNeedsRuntimeRecovery = Boolean(
    (selectedStrategyRuntimePreview?.blocked_reason && selectedStrategyRuntimePreview.blocked_reason.includes('恢复运行线程')) ||
      (selectedStrategyRuntime?.guard_detail && selectedStrategyRuntime.guard_detail.includes('恢复运行线程')) ||
      (selectedMode !== 'paper' && runtimeWorkerNeedsRecovery),
  )
  const manualTradingBlockedReason =
    !serviceAvailable
      ? '本地控制服务当前未连接，无法提交手动交易。'
      : !marketDetail
        ? '当前品种行情尚未就绪，稍后再试。'
        : !Number.isFinite(manualOrderQuantity) || manualOrderQuantity <= 0
          ? '手动交易数量必须大于 0。'
          : !Number.isFinite(manualOrderPrice) || manualOrderPrice <= 0
            ? '手动交易价格必须大于 0。'
            : requiresPrivateTrading && !bybitPrivateStatus?.can_query_private
              ? '当前未检测到 Bybit 私有 API 配置，无法提交真实委托。'
              : privateModeMismatch
                ? `当前私有 API 指向 ${String(bybitPrivateStatus?.mode ?? '').toUpperCase()}，和当前 ${selectedMode.toUpperCase()} 模式不一致。`
                : manualTradePreviewBlockedMessage

  const refreshControlData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['snapshot'] }),
      queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
      queryClient.invalidateQueries({ queryKey: ['market'] }),
      queryClient.invalidateQueries({ queryKey: ['account-live'] }),
      queryClient.invalidateQueries({ queryKey: ['account-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['account-positions'] }),
      queryClient.invalidateQueries({ queryKey: ['account-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['account-order-history'] }),
      queryClient.invalidateQueries({ queryKey: ['bybit-private'] }),
      queryClient.invalidateQueries({ queryKey: ['bybit-public'] }),
      queryClient.invalidateQueries({ queryKey: ['scheduler'] }),
      queryClient.invalidateQueries({ queryKey: ['ops-live'] }),
      queryClient.invalidateQueries({ queryKey: ['change-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['alerts'] }),
      queryClient.invalidateQueries({ queryKey: ['backtests'] }),
      queryClient.invalidateQueries({ queryKey: ['strategies'] }),
      queryClient.invalidateQueries({ queryKey: ['strategy-activity'] }),
      queryClient.invalidateQueries({ queryKey: ['runtime-worker-status'] }),
      queryClient.invalidateQueries({ queryKey: ['reviews'] }),
      queryClient.invalidateQueries({ queryKey: ['trades'] }),
      queryClient.invalidateQueries({ queryKey: ['audit'] }),
      queryClient.invalidateQueries({ queryKey: ['workspace'] }),
    ])
  }

  const schedulerMutation = useMutation({
    mutationFn: api.sendSchedulerCommand,
    onSuccess: refreshControlData,
  })
  const restartRuntimeWorkerMutation = useMutation({
    mutationFn: api.restartStrategyRuntimeWorker,
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

  const executeStrategySignalMutation = useMutation({
    mutationFn: ({ strategyId, note, mode }: { strategyId: string; note?: string; mode?: 'paper' | 'demo' | 'live' }) =>
      api.executeStrategySignal(strategyId, { requested_by: 'desktop_operator', note, mode }),
    onSuccess: refreshControlData,
  })

  const agentJobMutation = useMutation({
    mutationFn: api.createAgentJob,
    onSuccess: refreshControlData,
  })
  const strategyTrackingMutation = useMutation({
    mutationFn: ({
      strategyId,
      payload,
    }: {
      strategyId: string
      payload: {
        review_kind: 'issue' | 'change'
        summary: string
        detail?: string
        requested_by?: string
        request_key?: string
      }
    }) => api.createStrategyTrackingReview(strategyId, payload),
    onSuccess: refreshControlData,
  })

  const retryAgentJobMutation = useMutation({
    mutationFn: (jobId: string) => api.retryAgentJob(jobId, 'desktop_operator'),
    onSuccess: refreshControlData,
  })

  const manualTradeMutation = useMutation({
    mutationFn: api.createManualTrade,
    onSuccess: refreshControlData,
  })

  const exchangeOrderMutation = useMutation({
    mutationFn: api.createExchangeOrder,
    onSuccess: refreshControlData,
  })

  const replaceExchangeOrderMutation = useMutation({
    mutationFn: ({ orderId, quantity, price }: { orderId: string; quantity: number; price: number }) =>
      api.replaceExchangeOrder(orderId, { quantity, price, requested_by: 'desktop_operator' }),
    onSuccess: refreshControlData,
  })

  const paperOrderMutation = useMutation({
    mutationFn: api.createPaperOrder,
    onSuccess: refreshControlData,
  })

  const closePaperPositionMutation = useMutation({
    mutationFn: (symbol: string) => api.closePaperPosition(symbol, 'desktop_operator'),
    onSuccess: refreshControlData,
  })

  const closeExchangePositionMutation = useMutation({
    mutationFn: (symbol: string) => api.closeExchangePosition(symbol, 'desktop_operator'),
    onSuccess: refreshControlData,
  })

  const closeAllPaperPositionsMutation = useMutation({
    mutationFn: () => api.closeAllPaperPositions('desktop_operator'),
    onSuccess: refreshControlData,
  })

  const closeAllExchangePositionsMutation = useMutation({
    mutationFn: () => api.closeAllExchangePositions('desktop_operator'),
    onSuccess: refreshControlData,
  })

  const cancelExchangeOrderMutation = useMutation({
    mutationFn: (orderId: string) => api.cancelExchangeOrder(orderId, 'desktop_operator'),
    onSuccess: refreshControlData,
  })

  const cancelAllExchangeOrdersMutation = useMutation({
    mutationFn: () => api.cancelAllExchangeOrders('desktop_operator'),
    onSuccess: refreshControlData,
  })

  const cancelPaperOrderMutation = useMutation({
    mutationFn: (orderId: string) => api.cancelPaperOrder(orderId, 'desktop_operator'),
    onSuccess: refreshControlData,
  })

  const cancelAllPaperOrdersMutation = useMutation({
    mutationFn: () => api.cancelAllPaperOrders('desktop_operator'),
    onSuccess: refreshControlData,
  })

  const replacePaperOrderMutation = useMutation({
    mutationFn: ({ orderId, quantity, price }: { orderId: string; quantity: number; price: number }) =>
      api.replacePaperOrder(orderId, { quantity, price, requested_by: 'desktop_operator' }),
    onSuccess: refreshControlData,
  })

  const alertMutation = useMutation({
    mutationFn: ({ alertId, acknowledged }: { alertId: string; acknowledged: boolean }) =>
      api.acknowledgeAlert(alertId, acknowledged),
    onSuccess: refreshControlData,
  })

  const watchlistAddMutation = useMutation({
    mutationFn: api.addWatchlistItem,
    onSuccess: refreshControlData,
  })

  const watchlistRemoveMutation = useMutation({
    mutationFn: api.removeWatchlistItem,
    onSuccess: refreshControlData,
  })

  const proposalMutation = useMutation({
    mutationFn: ({ proposalId, action }: { proposalId: string; action: 'accept' | 'reject' }) =>
      api.applyStrategyProposalAction(proposalId, action),
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

  const restartStrategyRuntimeWorker = async () => {
    try {
      const result = await restartRuntimeWorkerMutation.mutateAsync()
      showFeedback('success', '运行线程已恢复', result.message)
    } catch (error) {
      showFeedback('error', '恢复运行线程失败', resolveErrorMessage(error))
    }
  }

  const openStrategyActivity = (strategyId?: string | null) => {
    if (!strategyId) {
      return
    }
    startTransition(() => {
      setActiveSection('strategy')
      setSelectedStrategyId(strategyId)
      setStrategyActivityPanelOpen(true)
    })
  }

  const openStrategyReplay = (strategyId?: string | null) => {
    if (!strategyId) {
      return
    }
    startTransition(() => {
      setActiveSection('replay')
      setSelectedStrategyId(strategyId)
      setReplayTrackingScope('selected')
      setReplayFocusedReviewId(null)
    })
  }

  const openReviewInspector = (reviewId?: string | null, strategyId?: string | null) => {
    if (!reviewId) {
      return
    }
    setReviewInspectorReviewId(reviewId)
    setReviewInspectorStrategyId(strategyId ?? null)
    setReviewInspectorOpen(true)
  }

  const openAiSchedulerJob = (jobId?: string | null) => {
    if (!jobId) {
      return
    }
    startTransition(() => {
      setActiveSection('ai-scheduler')
      setAiSchedulerFocusedJobId(jobId)
    })
    setReviewInspectorOpen(false)
  }

  const openReplayReview = (reviewId?: string | null, strategyId?: string | null, scope: 'all' | 'selected' = 'all') => {
    if (!reviewId && !strategyId) {
      return
    }
    startTransition(() => {
      setActiveSection('replay')
      if (strategyId) {
        setSelectedStrategyId(strategyId)
      }
      setReplayTrackingScope(scope)
      setReplayFocusedReviewId(reviewId ?? null)
    })
  }

  const resetStrategyTrackingDraft = (kind: 'issue' | 'change' = 'issue', nextSummary = '', nextDetail = '') => {
    setStrategyTrackingKind(kind)
    setStrategyTrackingSummary(nextSummary)
    setStrategyTrackingDetail(nextDetail)
    setStrategyTrackingRequestKey(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  }

  const openStrategyTrackingPanel = (kind: 'issue' | 'change' = 'issue') => {
    const defaultSummary =
      kind === 'issue'
        ? `${selectedStrategy?.name ?? '当前策略'} 需要继续跟踪当前执行问题`
        : `${selectedStrategy?.name ?? '当前策略'} 最近有一项变更需要继续跟踪`
    const defaultDetail =
      kind === 'issue'
        ? selectedStrategyRuntime?.guard_detail ||
          selectedStrategyRuntime?.last_execution_detail ||
          selectedStrategyRuntime?.note ||
          ''
        : selectedStrategyRuntime?.note || ''
    resetStrategyTrackingDraft(kind, defaultSummary, defaultDetail)
    setStrategyTrackingPanelOpen(true)
  }

  const submitStrategyTrackingReview = async () => {
    if (!selectedStrategy) {
      return
    }
    if (!strategyTrackingSummary.trim()) {
      showFeedback('warning', '跟踪摘要不能为空', '请先填写这次策略跟踪的摘要，再创建 AI 跟踪任务。')
      return
    }

    try {
      const job = await strategyTrackingMutation.mutateAsync({
        strategyId: selectedStrategy.id,
        payload: {
          review_kind: strategyTrackingKind,
          summary: strategyTrackingSummary.trim(),
          detail: strategyTrackingDetail.trim() || undefined,
          requested_by: 'desktop_operator',
          request_key: strategyTrackingRequestKey,
        },
      })
      setStrategyTrackingPanelOpen(false)
      setStrategyActivityPanelOpen(true)
      resetStrategyTrackingDraft(strategyTrackingKind)
      showFeedback(
        'success',
        strategyTrackingKind === 'issue' ? '问题跟踪已排队' : '变更跟踪已排队',
        `${selectedStrategy.name} 已创建 ${job.job_type === 'review_strategy_issue' ? '问题' : '变更'} AI 跟踪任务，稍后会写回策略活动与 AI 复盘。`,
      )
    } catch (error) {
      showFeedback('error', '策略跟踪任务创建失败', resolveErrorMessage(error))
    }
  }

  const triggerDesktopNotificationTest = async () => {
    if (!desktopNotificationsEnabled) {
      showFeedback('warning', '桌面通知当前已关闭', '请先在通知通道中保留 desktop，再测试系统通知。')
      return
    }

    const delivered = await sendDesktopNotification(
      {
        title: '桌面通知测试',
        body: '这是一条来自量化交易控制端的测试通知，用于确认原生提醒链路可用。',
        urgency: 'normal',
      },
      desktopNotificationPermissionRequestedRef,
    )

    if (delivered) {
      showFeedback('success', '测试通知已发送', '原生通知链路已触发，可以继续用它接收高优先级提醒和 AI 任务失败通知。')
      return
    }

    showFeedback('warning', '测试通知未显示', '当前环境没有可用的原生通知能力，或浏览器通知权限未开启。')
  }

  const submitStrategyRequest = async (
    type: string,
    summary: string,
    payload: Record<string, unknown>,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal',
  ) => {
    try {
      const result = await changeRequestMutation.mutateAsync({
        type,
        payload,
        requested_by: 'desktop_operator',
        target_mode: selectedMode,
        priority,
        summary,
      })
      showFeedback(
        'success',
        result.status === 'applied' ? '变更已落实' : 'ChangeRequest 已创建',
        result.status === 'applied' ? `${summary} 已由本地编排链路落实。` : `${summary} 已进入执行队列。`,
      )
    } catch (error) {
      showFeedback('error', 'ChangeRequest 创建失败', resolveErrorMessage(error))
    }
  }

  const submitBacktest = async () => {
    if (!selectedStrategy) return
    try {
      await backtestMutation.mutateAsync({
        strategy_id: selectedStrategy.id,
        data_range: backtestRangeDraft,
        timeframe: backtestTimeframeDraft,
      })
      showFeedback(
        'success',
        '回测任务已完成',
        `${selectedStrategy.name} 已按 ${backtestTimeframeDraft} / ${backtestRangeDraft} 写回新的回测结果。`,
      )
    } catch (error) {
      showFeedback('error', '回测发起失败', resolveErrorMessage(error))
    }
  }

  const executeSelectedStrategySignal = async () => {
    if (!selectedStrategy || !selectedStrategyRuntimePreview) return
    if (!selectedStrategyRuntimePreview.allowed) {
      showFeedback(
        'warning',
        '当前策略信号不可执行',
        selectedStrategyRuntimePreview.recommended_action
          ? `${selectedStrategyRuntimePreview.blocked_reason ?? '当前策略执行预估未通过。'} 建议 ${selectedStrategyRuntimePreview.recommended_action}`
          : selectedStrategyRuntimePreview.blocked_reason ?? '当前策略执行预估未通过。',
      )
      return
    }

    try {
      const result = await executeStrategySignalMutation.mutateAsync({
        strategyId: selectedStrategy.id,
        note:
          selectedStrategyRuntime?.next_action ??
          `${selectedStrategy.name} 按当前策略信号提交${selectedMode === 'paper' ? '纸面执行' : '真实委托'}`,
        mode: selectedMode,
      })
      if (result.kind === 'paper_trade' && result.trade) {
        showFeedback(
          'success',
          '策略纸面信号已执行',
          `${result.trade.symbol} 已按当前策略运行态写入一笔 ${result.trade.side === 'buy' ? '买入' : '卖出'} 纸面成交。`,
        )
        return
      }
      if (result.kind === 'exchange_order' && result.order) {
        showFeedback(
          'success',
          '策略真实委托已提交',
          `${result.order.symbol} 已按当前策略信号向 Bybit 提交一笔 ${result.order.side === 'buy' ? '买入' : '卖出'} 限价委托。`,
        )
        return
      }
      showFeedback('success', '策略执行已提交', result.message)
    } catch (error) {
      showFeedback(
        'error',
        selectedMode === 'paper' ? '策略纸面信号执行失败' : '策略真实委托提交失败',
        resolveErrorMessage(error),
      )
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

  const retryAgentJob = async (jobId: string) => {
    try {
      const job = await retryAgentJobMutation.mutateAsync(jobId)
      const retryCount = getAgentJobRetryCount(job)
      showFeedback(
        'success',
        'AI 任务已重新排队',
        retryCount > 0 ? `已创建第 ${retryCount} 次重试任务。` : '失败任务已重新加入调度队列。',
      )
    } catch (error) {
      showFeedback('error', 'AI 任务重试失败', resolveErrorMessage(error))
    }
  }

  const closeManualTradePanel = () => {
    setManualTradePanelOpen(false)
    setEditingOrderId(null)
  }

  const openOrderEditor = (order: OrderRecord) => {
    startTransition(() => setSelectedSymbol(order.symbol))
    manualOrderSymbolRef.current = order.symbol
    setManualOrder({
      side: order.side,
      quantity: normalizeOrderInputValue(order.qty),
      price: normalizeOrderInputValue(order.price),
      note: '',
    })
    setEditingOrderId(order.order_id)
    setManualTradePanelOpen(true)
  }

  const submitManualOrder = async () => {
    if (!marketDetail) return
    if (manualTradingBlockedReason) {
      showFeedback('warning', '当前不能提交手动交易', manualTradingBlockedReason)
      return
    }

    try {
      if (selectedMode === 'paper') {
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
      } else {
        const order = await exchangeOrderMutation.mutateAsync({
          symbol: marketDetail.symbol,
          market: marketDetail.market,
          mode: selectedMode,
          side: manualOrder.side,
          quantity: manualOrderQuantity,
          price: manualOrderPrice,
          note: manualOrder.note,
        })
        showFeedback(
          'success',
          `${selectedMode.toUpperCase()} 委托已提交`,
          `${order.symbol} 已向 Bybit 提交 ${order.side === 'buy' ? '买入' : '卖出'} 限价委托，订单号 ${order.order_id}。`,
        )
      }
      setManualOrder((current) => ({ ...current, note: '' }))
    } catch (error) {
      showFeedback('error', '手动交易提交失败', resolveErrorMessage(error))
    }
  }

  const closePaperPosition = async (symbol: string) => {
    try {
      const trade = await closePaperPositionMutation.mutateAsync(symbol)
      showFeedback('success', 'Paper 持仓已平仓', `${trade.symbol} 已按当前参考价写入一笔纸面平仓。`)
    } catch (error) {
      showFeedback('error', 'Paper 平仓失败', resolveErrorMessage(error))
    }
  }

  const closeExchangePosition = async (symbol: string) => {
    try {
      const order = await closeExchangePositionMutation.mutateAsync(symbol)
      showFeedback(
        'success',
        '真实持仓平仓委托已提交',
        `${order.symbol} 的平仓限价委托已提交到 Bybit，订单号 ${order.order_id}。`,
      )
    } catch (error) {
      showFeedback('error', '真实持仓平仓失败', resolveErrorMessage(error))
    }
  }

  const closeAllPaperPositions = async () => {
    try {
      const result = await closeAllPaperPositionsMutation.mutateAsync()
      showFeedback(
        'success',
        result.closed_count > 0 ? '已批量平掉 Paper 持仓' : '当前没有可平的 Paper 持仓',
        result.closed_count > 0
          ? `本次共按参考价平掉 ${result.closed_count} 个本地持仓方向。`
          : 'Paper 持仓当前为空。',
      )
    } catch (error) {
      showFeedback('error', '批量平仓失败', resolveErrorMessage(error))
    }
  }

  const closeAllExchangePositions = async () => {
    try {
      const result = await closeAllExchangePositionsMutation.mutateAsync()
      showFeedback(
        'success',
        result.submitted_count > 0 ? '已批量提交真实持仓平仓委托' : '当前没有可平的真实持仓',
        result.submitted_count > 0
          ? `本次共向 Bybit 提交 ${result.submitted_count} 条真实平仓委托。`
          : '当前真实持仓为空。',
      )
    } catch (error) {
      showFeedback('error', '批量提交真实平仓委托失败', resolveErrorMessage(error))
    }
  }

  const submitPaperOrder = async () => {
    if (!marketDetail) return
    if (manualTradingBlockedReason) {
      showFeedback('warning', '当前不能创建本地限价委托', manualTradingBlockedReason)
      return
    }

    try {
      const order = await paperOrderMutation.mutateAsync({
        symbol: marketDetail.symbol,
        market: marketDetail.market,
        mode: selectedMode,
        side: manualOrder.side,
        quantity: manualOrderQuantity,
        price: manualOrderPrice,
        note: manualOrder.note,
      })
      showFeedback('success', 'Paper 限价委托已挂入本地委托簿', `${order.symbol} ${order.side === 'buy' ? '买单' : '卖单'} 已进入未成交委托列表。`)
      setManualOrder((current) => ({ ...current, note: '' }))
    } catch (error) {
      showFeedback('error', 'Paper 限价委托创建失败', resolveErrorMessage(error))
    }
  }

  const cancelPaperOrder = async (orderId: string) => {
    try {
      const order = await cancelPaperOrderMutation.mutateAsync(orderId)
      showFeedback('success', 'Paper 委托已取消', `${order.symbol} 的本地限价委托已取消。`)
      if (editingOrderId === orderId) {
        setEditingOrderId(null)
        setManualTradePanelOpen(false)
      }
    } catch (error) {
      showFeedback('error', '取消 Paper 委托失败', resolveErrorMessage(error))
    }
  }

  const cancelExchangeOrder = async (orderId: string) => {
    try {
      const order = await cancelExchangeOrderMutation.mutateAsync(orderId)
      showFeedback('success', '真实委托已撤销', `${order.symbol} 的 Bybit 委托 ${order.order_id} 已提交撤单。`)
      if (editingOrderId === orderId) {
        setEditingOrderId(null)
        setManualTradePanelOpen(false)
      }
    } catch (error) {
      showFeedback('error', '真实委托撤单失败', resolveErrorMessage(error))
    }
  }

  const cancelAllExchangeOrders = async () => {
    try {
      const result = await cancelAllExchangeOrdersMutation.mutateAsync()
      showFeedback(
        'success',
        result.cancelled_count > 0 ? '已批量撤销真实委托' : '当前没有可撤的真实委托',
        result.cancelled_count > 0
          ? `本次共向 Bybit 提交 ${result.cancelled_count} 条真实委托撤单。`
          : '当前未成交真实委托为空。',
      )
    } catch (error) {
      showFeedback('error', '批量撤销真实委托失败', resolveErrorMessage(error))
    }
  }

  const cancelAllPaperOrders = async () => {
    try {
      const result = await cancelAllPaperOrdersMutation.mutateAsync()
      showFeedback(
        'success',
        result.cancelled_count > 0 ? '已批量取消 Paper 委托' : '当前没有可取消的 Paper 委托',
        result.cancelled_count > 0
          ? `本次共取消 ${result.cancelled_count} 笔本地限价委托。`
          : '未成交委托列表当前为空。',
      )
      setEditingOrderId(null)
      setManualTradePanelOpen(false)
    } catch (error) {
      showFeedback('error', '批量取消 Paper 委托失败', resolveErrorMessage(error))
    }
  }

  const replacePaperOrder = async () => {
    if (!editingOrderId) return
    if (manualTradingBlockedReason) {
      showFeedback('warning', '当前不能修改本地限价委托', manualTradingBlockedReason)
      return
    }

    try {
      const order = await replacePaperOrderMutation.mutateAsync({
        orderId: editingOrderId,
        quantity: manualOrderQuantity,
        price: manualOrderPrice,
      })
      showFeedback(
        'success',
        order.status === 'Filled' ? 'Paper 委托已修改并成交' : 'Paper 委托已修改',
        order.status === 'Filled'
          ? `${order.symbol} 的本地限价委托在改价后已立即成交。`
          : `${order.symbol} 的本地限价委托已更新到新价格和数量。`,
      )
      setManualOrder((current) => ({ ...current, note: '' }))
      setEditingOrderId(null)
      setManualTradePanelOpen(false)
    } catch (error) {
      showFeedback('error', 'Paper 委托修改失败', resolveErrorMessage(error))
    }
  }

  const replaceExchangeOrder = async () => {
    if (!editingOrderId) return
    if (manualTradingBlockedReason) {
      showFeedback('warning', '当前不能修改真实委托', manualTradingBlockedReason)
      return
    }

    try {
      const order = await replaceExchangeOrderMutation.mutateAsync({
        orderId: editingOrderId,
        quantity: manualOrderQuantity,
        price: manualOrderPrice,
      })
      showFeedback(
        'success',
        '真实委托已修改',
        `${order.symbol} 的 Bybit 委托 ${order.order_id} 已更新为价格 ${order.price}、数量 ${order.qty}。`,
      )
      setManualOrder((current) => ({ ...current, note: '' }))
      setEditingOrderId(null)
      setManualTradePanelOpen(false)
    } catch (error) {
      showFeedback('error', '真实委托修改失败', resolveErrorMessage(error))
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

  const toggleAlertAcknowledged = async (alertId: string, acknowledged: boolean) => {
    try {
      const result = await alertMutation.mutateAsync({ alertId, acknowledged })
      showFeedback(
        'success',
        acknowledged ? '提醒已确认' : '提醒已恢复待处理',
        `${result.symbol} · ${result.title}`,
      )
    } catch (error) {
      showFeedback('error', '提醒状态更新失败', resolveErrorMessage(error))
    }
  }

  const submitWatchlistItem = async () => {
    const normalizedSymbol = watchlistDraftSymbol.toUpperCase().replace(/\//g, '').replace(/-/g, '').trim()
    if (!normalizedSymbol) {
      showFeedback('warning', '请输入品种代码', '例如 BTCUSDT、ETHUSDT、SOLUSDT。')
      return
    }

    try {
      const item = await watchlistAddMutation.mutateAsync({
        symbol: normalizedSymbol,
        market: watchlistDraftMarket,
        requested_by: 'desktop_operator',
      })
      setSelectedSymbol(item.symbol)
      setWatchlistDraftSymbol('')
      setWatchlistManagerOpen(false)
      showFeedback('success', '自选已更新', `${item.symbol} 已加入自选列表。`)
    } catch (error) {
      showFeedback('error', '自选添加失败', resolveErrorMessage(error))
    }
  }

  const removeWatchlistItem = async (symbol: string) => {
    try {
      const result = await watchlistRemoveMutation.mutateAsync(symbol)
      if (result.next_selected_symbol) {
        setSelectedSymbol(result.next_selected_symbol)
      }
      showFeedback('success', '自选已移除', `${result.symbol} 已从自选列表移除。`)
    } catch (error) {
      showFeedback('error', '自选移除失败', resolveErrorMessage(error))
    }
  }

  const submitWatchlistAlertRule = async (
    item: (typeof watchlist)[number],
    options?: { alertEnabled?: boolean },
  ) => {
    const rawThreshold = watchlistAlertDrafts[item.symbol] ?? item.alert_threshold_pct.toFixed(1)
    const threshold = Number(rawThreshold)

    if (!Number.isFinite(threshold) || threshold <= 0) {
      showFeedback('warning', '提醒阈值无效', '请输入大于 0 的百分比阈值，例如 2.5。')
      return
    }

    await submitStrategyRequest(
      'alert.rule.update',
      `${item.symbol} 更新波动提醒`,
      {
        symbol: item.symbol,
        threshold_pct: Number(threshold.toFixed(2)),
        alert_enabled: options?.alertEnabled ?? item.alert_enabled,
      },
    )
  }

  const handleProposalAction = async (proposalId: string, action: 'accept' | 'reject') => {
    const proposal =
      strategyProposals.find((item) => item.id === proposalId) ??
      replayProposalFeed.find((item) => item.proposal.id === proposalId)?.proposal
    const blockedReason =
      action === 'accept' && proposal
        ? proposalAcceptBlockedReason(proposal.proposal_type, snapshot?.scheduler)
        : null
    if (blockedReason) {
      showFeedback('warning', '当前不能接受该提案', blockedReason)
      return
    }
    try {
      const result = await proposalMutation.mutateAsync({ proposalId, action })
      const detail =
        action === 'accept'
          ? result.created_backtest
            ? `${result.proposal.title} 已转成回测任务并写回结果。`
            : result.created_change_request
              ? result.created_change_request.status === 'applied'
                ? `${result.proposal.title} 已转成 ChangeRequest 并完成落实。`
                : `${result.proposal.title} 已转成 ChangeRequest，等待编排层落实。`
              : `${result.proposal.title} 已标记为接受。`
          : `${result.proposal.title} 已被拒绝，不会继续进入执行链路。`
      showFeedback('success', action === 'accept' ? 'AI 提案已接受' : 'AI 提案已拒绝', detail)
    } catch (error) {
      showFeedback('error', '提案动作失败', resolveErrorMessage(error))
    }
  }

  const orderedVisibleCards = normalizeVisibleCardIds(visibleOverviewCards, cardOrder)
  const showStrategyWatch = true
  const compactStrategyWatch = layoutPreset !== 'balanced'
  const currentWorkspaceDraft = {
    active_section: activeSection,
    layout_preset: layoutPreset,
    selected_mode: selectedMode,
    selected_symbol: selectedSymbol,
    selected_market_timeframe: selectedMarketTimeframe,
    selected_strategy_id: (selectedStrategy?.id ?? selectedStrategyId) || null,
    overview_card_order: normalizeCardIds(cardOrder),
    overview_visible_cards: orderedVisibleCards,
    overview_collapsed_cards: normalizeCollapsedCardIds(collapsedOverviewCards, cardOrder),
  }
  const workspaceDirty = buildWorkspaceSignature(currentWorkspaceDraft) !== lastSyncedWorkspaceSignature
  const headlineAlert = [...alerts]
    .filter((item) => !item.acknowledged)
    .sort((left, right) => {
      const severityRank = { P0: 0, P1: 1, P2: 2 }
      return severityRank[left.severity] - severityRank[right.severity]
    })[0]
  const rankedAlerts = [...alerts].sort((left, right) => {
    const severityRank = { P0: 0, P1: 1, P2: 2 }
    const acknowledgedRank = Number(left.acknowledged) - Number(right.acknowledged)
    if (acknowledgedRank !== 0) {
      return acknowledgedRank
    }
    return severityRank[left.severity] - severityRank[right.severity]
  })
  const pendingAlertsCount = rankedAlerts.filter((item) => !item.acknowledged).length
  const filteredAlerts = rankedAlerts.filter((item) => {
    if (alertSeverityFilter !== 'all' && item.severity !== alertSeverityFilter) {
      return false
    }
    if (alertStatusFilter === 'pending' && item.acknowledged) {
      return false
    }
    if (alertStatusFilter === 'acknowledged' && !item.acknowledged) {
      return false
    }
    if (alertScopeFilter === 'selected' && item.symbol !== selectedSymbol) {
      return false
    }
    return true
  })
  const filteredTrades = trades.filter((item) => {
    if (tradeModeFilter !== 'all' && item.mode !== tradeModeFilter) {
      return false
    }
    if (tradeOriginFilter !== 'all' && item.origin !== tradeOriginFilter) {
      return false
    }
    if (tradeScopeFilter === 'selected' && item.symbol !== selectedSymbol) {
      return false
    }
    return true
  })
  const filteredAccountOrders = accountOrders.filter((item) => {
    if ((tradeOriginFilter === 'manual' || tradeOriginFilter === 'strategy') && item.origin !== tradeOriginFilter) {
      return false
    }
    if (tradeScopeFilter === 'selected' && item.symbol !== selectedSymbol) {
      return false
    }
    return true
  })
  const filteredOrderHistory = accountOrderHistory.filter((item) => {
    if ((tradeOriginFilter === 'manual' || tradeOriginFilter === 'strategy') && item.origin !== tradeOriginFilter) {
      return false
    }
    if (tradeScopeFilter === 'selected' && item.symbol !== selectedSymbol) {
      return false
    }
    return true
  })
  const auditSourceOptions = Array.from(new Set(auditEvents.map((item) => item.source))).slice(0, 8)
  const filteredAuditEvents = auditEvents.filter((item) => {
    if (auditSeverityFilter !== 'all' && item.severity !== auditSeverityFilter) {
      return false
    }
    if (auditSourceFilter !== 'all' && item.source !== auditSourceFilter) {
      return false
    }
    if (auditScopeFilter === 'selected' && item.symbol !== selectedSymbol) {
      return false
    }
    if (!auditSearch.trim()) {
      return true
    }
    const needle = auditSearch.trim().toLowerCase()
    const payloadText = JSON.stringify(item.payload).toLowerCase()
    return (
      item.event_type.toLowerCase().includes(needle) ||
      item.source.toLowerCase().includes(needle) ||
      String(item.symbol ?? '').toLowerCase().includes(needle) ||
      payloadText.includes(needle)
    )
  })
  const schedulerNeedsAttention =
    ['paused', 'manual_override', 'degraded'].includes(snapshot?.scheduler.status ?? 'degraded') ||
    Boolean(snapshot?.scheduler.freeze_publish)
  const statusInspectorHasNotice =
    !serviceAvailable ||
    workspaceDirty ||
    workspaceConflict ||
    Boolean(actionFeedback) ||
    Boolean(headlineAlert) ||
    schedulerNeedsAttention ||
    pendingAlertsCount > 0
  const overviewWatchlistItems = showStrategyWatch ? watchlist.slice(0, compactStrategyWatch ? 6 : 10) : []
  const overviewAiEvents = aiActivityFeed.slice(0, 6)
  const overviewQueuedRequests = changeRequests.filter((item) => item.status !== 'applied').slice(0, 4)
  const replayPrimaryReviews = reviews.filter((review) => !isStrategyTrackingReview(review.period))
  const replayTrackingReviews =
    replayTrackingReviewsQuery.data ?? reviews.filter((review) => isStrategyTrackingReview(review.period))
  const scopedReplayPrimaryReviews =
    replayTrackingScope === 'selected' && selectedStrategy ? selectedStrategyPrimaryReviews : replayPrimaryReviews
  const filteredReplayTrackingReviews =
    replayTrackingScope === 'selected' && selectedStrategy
      ? replayTrackingReviews.filter(
          (review) =>
            review.strategy_id === selectedStrategy.id ||
            review.proposals.some((proposal) => proposal.strategy_id === selectedStrategy.id),
        )
      : replayTrackingReviews
  const latestReview = scopedReplayPrimaryReviews[0] ?? null
  const latestTrackingReview = filteredReplayTrackingReviews[0] ?? null
  const replayTrackingJobs = (scheduler?.jobs ?? []).filter(
    (job) => job.job_type === 'review_strategy_issue' || job.job_type === 'review_strategy_change',
  )
  const filteredReplayTrackingJobs =
    replayTrackingScope === 'selected' && selectedStrategy
      ? replayTrackingJobs.filter((job) => getAgentJobStrategyId(job) === selectedStrategy.id)
      : replayTrackingJobs
  const replayVisibleReviews =
    replayTrackingScope === 'selected' && selectedStrategy ? selectedStrategyReviews : reviews
  const replayFocusReview =
    replayVisibleReviews.find((review) => review.id === replayFocusedReviewId) ??
    latestReview ??
    latestTrackingReview ??
    null
  const reviewInspectorReview =
    reviewCatalog.find((review) => review.id === reviewInspectorReviewId) ?? null
  const selectedWatchAlertLabel = selectedWatchItem
    ? selectedWatchItem.alert_enabled
      ? `提醒 ${selectedWatchItem.alert_threshold_pct.toFixed(1)}%`
      : '提醒已关闭'
    : '提醒未配置'
  const replayProposalFeed = scopedReplayPrimaryReviews.flatMap((review) =>
    review.proposals.map((proposal) => ({
      reviewId: review.id,
      reviewTitle: review.title,
      reviewPeriod: review.period,
      proposal,
    })),
  )

  useEffect(() => {
    persistLocalWorkspace({
      active_section: activeSection,
      layout_preset: layoutPreset,
      selected_mode: selectedMode,
      selected_symbol: selectedSymbol,
      selected_market_timeframe: selectedMarketTimeframe,
      selected_strategy_id: (selectedStrategy?.id ?? selectedStrategyId) || null,
      overview_card_order: normalizeCardIds(cardOrder),
      overview_visible_cards: orderedVisibleCards,
      overview_collapsed_cards: normalizeCollapsedCardIds(collapsedOverviewCards, cardOrder),
      updated_at: workspaceSavedAt,
    })
  }, [
    activeSection,
    cardOrder,
    collapsedOverviewCards,
    layoutPreset,
    orderedVisibleCards,
    selectedMode,
    selectedMarketTimeframe,
    selectedStrategy?.id,
    selectedStrategyId,
    selectedSymbol,
    workspaceSavedAt,
  ])

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
      selected_market_timeframe: defaults.selected_market_timeframe,
      selected_strategy_id: strategies[0]?.id ?? defaults.selected_strategy_id,
      overview_card_order: [...defaultCardOrder],
      overview_visible_cards: [...defaultVisibleCards],
      overview_collapsed_cards: [],
    }
    setActiveSection(nextDraft.active_section)
    setLayoutPreset(nextDraft.layout_preset)
    setSelectedMode(nextDraft.selected_mode)
    setSelectedSymbol(nextDraft.selected_symbol)
    setSelectedMarketTimeframe(nextDraft.selected_market_timeframe)
    setSelectedStrategyId(nextDraft.selected_strategy_id)
    setCardOrder(nextDraft.overview_card_order)
    setVisibleOverviewCards(nextDraft.overview_visible_cards)
    setCollapsedOverviewCards(nextDraft.overview_collapsed_cards)
    await syncWorkspacePreferences(nextDraft)
  }

  const applyServerWorkspace = async () => {
    if (!workspaceQuery.data) return
    applyWorkspaceState(workspaceQuery.data)
    setWorkspaceConflict(false)
    showFeedback('success', '已应用控制端状态', '当前界面已切换到服务端保存的工作台配置。')
  }

  const openSection = (section: SectionKey) => {
    setActiveSection(section)
  }

  const marketHeader = marketDetail?.headline ?? '等待本地量化服务返回当前品种的跟踪摘要'
  const inlineToast = actionFeedback
    ? {
        tone: actionFeedback.tone === 'error' ? 'error' : actionFeedback.tone === 'warning' ? 'warning' : 'success',
        title: actionFeedback.title,
        detail: actionFeedback.detail,
        icon: actionFeedback.tone === 'error' ? AlertTriangle : Bell,
      }
    : headlineAlert && ['P0', 'P1'].includes(headlineAlert.severity)
      ? {
          tone: headlineAlert.severity === 'P0' ? 'error' : 'warning',
          title: headlineAlert.title,
          detail: `${headlineAlert.symbol} · ${headlineAlert.suggested_action}`,
          icon: Bell,
        }
      : null
  const InlineToastIcon = inlineToast?.icon

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
          {navGroups.map((group) => (
            <div key={group.key} className="nav-group">
              <span className="nav-group__label">{group.label}</span>
              <div className="nav-group__items">
                {navItems
                  .filter((item) => item.group === group.key)
                  .map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`nav-item ${activeSection === item.key ? 'active' : ''}`}
                        title={item.hint}
                        onClick={() => {
                          startTransition(() => openSection(item.key))
                        }}
                      >
                        <span className="nav-item__label">
                          <Icon size={15} />
                          {item.label}
                        </span>
                      </button>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar__identity">
            <div className="topbar__title-group">
              <span className="topbar__title">量化控制端</span>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className={`icon-button ${statusInspectorHasNotice ? 'icon-button--primary' : ''}`}
              title={`打开运行状态窗口：AI ${schedulerLabel(snapshot?.scheduler.status ?? 'degraded')}，队列 ${snapshot?.scheduler.queue_depth ?? 0} 个，未处理提醒 ${pendingAlertsCount} 条。`}
              aria-label="打开运行状态窗口"
              onClick={() => setStatusInspectorOpen(true)}
            >
              <Activity size={16} />
            </button>
          </div>
        </header>

        {inlineToast && (
          <div className={`inline-toast inline-toast--${inlineToast.tone}`}>
            <div className="inline-toast__main">
              <strong>
                {InlineToastIcon ? <InlineToastIcon size={14} /> : null}
                {inlineToast.title}
              </strong>
              <span>{inlineToast.detail}</span>
            </div>
          </div>
        )}

        {statusInspectorOpen && (
          <div className="floating-panel-backdrop" onClick={() => setStatusInspectorOpen(false)}>
            <aside
              className="floating-panel"
              role="dialog"
              aria-modal="true"
              aria-label="运行状态窗口"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="floating-panel__head">
                <div>
                  <span className="section-label">二级状态窗口</span>
                  <h3>运行状态与消息</h3>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  title="关闭状态窗口"
                  aria-label="关闭状态窗口"
                  onClick={() => setStatusInspectorOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="floating-panel__body">
                <div className="floating-panel__grid">
                  {[
                    {
                      key: 'scheduler',
                      icon: Bot,
                      label: 'AI 调度',
                      value: `${schedulerLabel(snapshot?.scheduler.status ?? 'degraded')} · 队列 ${snapshot?.scheduler.queue_depth ?? 0}`,
                      detail: snapshot?.scheduler.freeze_publish ? '自动发布已冻结' : '自动发布开放',
                      tone: schedulerNeedsAttention ? 'warn' : 'good',
                    },
                    {
                      key: 'mode',
                      icon: CandlestickChart,
                      label: '当前模式',
                      value: selectedMode.toUpperCase(),
                      detail: 'Paper / Demo / Live 三路径隔离',
                      tone: 'muted',
                    },
                    {
                      key: 'service',
                      icon: Activity,
                      label: '本地服务',
                      value: serviceAvailable ? '在线' : '回退中',
                      detail: serviceAvailable ? '当前正在读取真实服务数据' : '当前展示 fallback 数据',
                      tone: serviceAvailable ? 'good' : 'warn',
                    },
                    {
                      key: 'claw',
                      icon: ShieldAlert,
                      label: 'OpenClaw',
                      value: openClawStatus?.reachable ? '已连通' : '待接通',
                      detail: openClawStatus?.gateway_url ?? settings?.openclaw_gateway_url ?? 'ws://127.0.0.1:18789',
                      tone: openClawStatus?.reachable ? 'good' : 'muted',
                    },
                    {
                      key: 'workspace',
                      icon: Save,
                      label: '工作台同步',
                      value: workspaceDirty ? '有未同步草稿' : '已同步',
                      detail: workspaceDirty
                        ? '当前本地布局和控制端保存状态不同'
                        : `上次保存 ${formatTime(workspaceSavedAt ?? workspacePreferences?.updated_at)}`,
                      tone: workspaceDirty ? 'warn' : 'muted',
                    },
                    {
                      key: 'alerts',
                      icon: Bell,
                      label: '提醒中心',
                      value: pendingAlertsCount ? `${pendingAlertsCount} 条待处理` : '暂无待处理',
                      detail: headlineAlert ? `${headlineAlert.severity} · ${headlineAlert.symbol}` : '无最高优先级提醒',
                      tone: pendingAlertsCount ? 'warn' : 'good',
                    },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.key} className={`floating-status-card floating-status-card--${item.tone}`}>
                        <div className="floating-status-card__head">
                          <span className="floating-status-card__label">
                            <Icon size={14} />
                            {item.label}
                          </span>
                          <strong>{item.value}</strong>
                        </div>
                        <small>{item.detail}</small>
                      </div>
                    )
                  })}
                </div>

                <div className="console-panel">
                  <div className="watchlist-module__header">
                    <span className="section-label">消息与提示</span>
                    <strong>
                      {[!serviceAvailable, Boolean(actionFeedback), workspaceConflict, Boolean(headlineAlert), pendingAlertsCount > 0]
                        .filter(Boolean)
                        .length} 条
                    </strong>
                  </div>
                  <div className="job-list">
                    {!serviceAvailable && (
                      <div className="job-row">
                        <div className="console-row__main">
                          <strong>
                            <AlertTriangle size={13} />
                            服务 · 本地控制服务未连通
                          </strong>
                          <p>启动 `python3 services/control-api/main.py` 后，桌面端会自动切回真实数据与命令通道。</p>
                        </div>
                      </div>
                    )}
                    {actionFeedback && (
                      <div className="job-row">
                        <div className="console-row__main">
                          <strong>
                            <Bell size={13} />
                            提示 · {actionFeedback.title}
                          </strong>
                          <p>{actionFeedback.detail}</p>
                        </div>
                      </div>
                    )}
                    {workspaceConflict && (
                      <div className="job-row">
                        <div className="console-row__main">
                          <strong>
                            <Save size={13} />
                            工作台 · 检测到控制端状态冲突
                          </strong>
                          <p>当前先保留你的本地调整；你也可以直接应用控制端版本。</p>
                        </div>
                        <div className="job-meta">
                          <button type="button" className="ghost-button ghost-button--inline" onClick={applyServerWorkspace}>
                            应用控制端状态
                          </button>
                        </div>
                      </div>
                    )}
                    {headlineAlert && (
                      <div className="job-row">
                        <div className="console-row__main">
                          <strong>
                            <Bell size={13} />
                            提醒 · {headlineAlert.title}
                          </strong>
                          <p>{headlineAlert.symbol} · {headlineAlert.suggested_action}</p>
                        </div>
                      </div>
                    )}
                    {!serviceAvailable && !actionFeedback && !workspaceConflict && !headlineAlert && pendingAlertsCount === 0 && (
                      <div className="empty-state empty-state--inline">当前没有需要单独处理的状态消息。</div>
                    )}
                  </div>
                </div>

                <div className="inline-actions">
                  <button
                    type="button"
                    className="ghost-button ghost-button--inline"
                    onClick={() => {
                      setStatusInspectorOpen(false)
                      startTransition(() => openSection('alerts'))
                    }}
                  >
                    打开提醒中心
                  </button>
                  <button
                    type="button"
                    className="ghost-button ghost-button--inline"
                    onClick={() => {
                      setStatusInspectorOpen(false)
                      startTransition(() => openSection('scheduler'))
                    }}
                  >
                    打开 AI 调度
                  </button>
                  <button
                    type="button"
                    className="ghost-button ghost-button--inline"
                    onClick={() => {
                      setStatusInspectorOpen(false)
                      startTransition(() => openSection('settings'))
                    }}
                  >
                    打开设置
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {watchlistManagerOpen && (
          <div className="floating-panel-backdrop" onClick={() => setWatchlistManagerOpen(false)}>
            <aside
              className="floating-panel"
              role="dialog"
              aria-modal="true"
              aria-label="自选管理"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="floating-panel__head">
                <div>
                  <span className="section-label">自选管理</span>
                  <h3>新增或移除关注品种</h3>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  title="关闭自选管理"
                  aria-label="关闭自选管理"
                  onClick={() => setWatchlistManagerOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="floating-panel__body">
                <div className="field-grid">
                  <label className="field">
                    <span>品种代码</span>
                    <input
                      value={watchlistDraftSymbol}
                      onChange={(event) => setWatchlistDraftSymbol(event.target.value)}
                      placeholder="例如 BTCUSDT"
                    />
                  </label>
                  <label className="field">
                    <span>市场类型</span>
                    <select
                      value={watchlistDraftMarket}
                      onChange={(event) => setWatchlistDraftMarket(event.target.value as 'spot' | 'perp')}
                    >
                      <option value="perp">永续</option>
                      <option value="spot">现货</option>
                    </select>
                  </label>
                  <div className="field">
                    <span>动作</span>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={watchlistAddMutation.isPending}
                      onClick={submitWatchlistItem}
                    >
                      添加到自选
                    </button>
                  </div>
                </div>

                <div className="job-list">
                  {watchlist.map((item) => (
                    <div key={item.symbol} className="job-row">
                      <div className="console-row__main">
                        <strong>{item.symbol}</strong>
                        <p>
                          {item.market === 'perp' ? '永续' : '现货'}
                          {' · '}
                          <span className={signalToneClass(item.signal)}>{signalLabel(item.signal)}</span>
                          {' · '}
                          <span className={riskToneClass(item.risk_level)}>{riskLevelLabel(item.risk_level)}</span>
                          {' · '}
                          {item.alert_enabled ? `提醒 ${item.alert_threshold_pct.toFixed(1)}%` : '提醒已关闭'}
                        </p>
                      </div>
                      <div className="job-meta job-meta--watchlist">
                        <label className="watchlist-rule-editor">
                          <span>提醒阈值 %</span>
                          <input
                            value={watchlistAlertDrafts[item.symbol] ?? item.alert_threshold_pct.toFixed(1)}
                            onChange={(event) =>
                              setWatchlistAlertDrafts((current) => ({
                                ...current,
                                [item.symbol]: event.target.value,
                              }))
                            }
                            inputMode="decimal"
                            placeholder="2.5"
                          />
                        </label>
                        <div className="inline-actions inline-actions--tight">
                          <button
                            type="button"
                            className="ghost-button ghost-button--inline"
                            disabled={!serviceAvailable || changeRequestMutation.isPending}
                            onClick={() => submitWatchlistAlertRule(item)}
                          >
                            更新提醒
                          </button>
                          <button
                            type="button"
                            className="ghost-button ghost-button--inline"
                            disabled={!serviceAvailable || changeRequestMutation.isPending}
                            onClick={() =>
                              submitWatchlistAlertRule(item, {
                                alertEnabled: !item.alert_enabled,
                              })
                            }
                          >
                            {item.alert_enabled ? '关闭提醒' : '启用提醒'}
                          </button>
                        </div>
                      </div>
                      <div className="job-meta">
                        <button
                          type="button"
                          className="ghost-button ghost-button--inline"
                          disabled={watchlistRemoveMutation.isPending}
                          onClick={() => removeWatchlistItem(item.symbol)}
                        >
                          移除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}

        {schedulerControlsOpen && (
          <div className="floating-panel-backdrop" onClick={() => setSchedulerControlsOpen(false)}>
            <aside
              className="floating-panel"
              role="dialog"
              aria-modal="true"
              aria-label="AI 调度高级控制"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="floating-panel__head">
                <div>
                  <span className="section-label">AI 调度高级控制</span>
                  <h3>低频中断与发布门禁</h3>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  title="关闭 AI 调度高级控制"
                  aria-label="关闭 AI 调度高级控制"
                  onClick={() => setSchedulerControlsOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="floating-panel__body">
                <div className="floating-panel__grid">
                  <div className="floating-status-card">
                    <div className="floating-status-card__head">
                      <span className="floating-status-card__label">
                        <Bot size={13} />
                        当前任务
                      </span>
                      <strong>{snapshot?.scheduler.current_job_id ?? 'idle'}</strong>
                    </div>
                    <small>仅在需要强制介入时再使用下面的中断与门禁控制。</small>
                  </div>
                  <div className="floating-status-card">
                    <div className="floating-status-card__head">
                      <span className="floating-status-card__label">
                        <ShieldAlert size={13} />
                        发布门禁
                      </span>
                      <strong>
                        {snapshot?.scheduler.status === 'manual_override'
                          ? '人工接管'
                          : snapshot?.scheduler.freeze_publish
                            ? '已冻结'
                            : '开放'}
                      </strong>
                    </div>
                    <small>人工接管或冻结后，发布类提案不会自动落地。</small>
                  </div>
                </div>

                <div className="inline-actions">
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
                    onClick={() => {
                      setSchedulerControlsOpen(false)
                      setGrafanaPreviewOpen(true)
                    }}
                  >
                    监控预览
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {grafanaPreviewOpen && (
          <div className="floating-panel-backdrop" onClick={() => setGrafanaPreviewOpen(false)}>
            <aside
              className="floating-panel floating-panel--wide"
              role="dialog"
              aria-modal="true"
              aria-label="Grafana 监控预览"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="floating-panel__head">
                <div>
                  <span className="section-label">Grafana / 监控预览</span>
                  <h3>AI 调度与系统监控</h3>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  title="关闭监控预览"
                  aria-label="关闭监控预览"
                  onClick={() => setGrafanaPreviewOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="floating-panel__body">
                <div className="floating-panel__grid">
                  <div className="floating-status-card">
                    <div className="floating-status-card__head">
                      <span className="floating-status-card__label">
                        <Bot size={13} />
                        调度队列
                      </span>
                      <strong>{snapshot?.scheduler.queue_depth ?? 0} 个</strong>
                    </div>
                    <p className="panel-note">当前 AI 调度状态：{schedulerLabel(snapshot?.scheduler.status ?? 'degraded')}</p>
                  </div>
                  <div className="floating-status-card">
                    <div className="floating-status-card__head">
                      <span className="floating-status-card__label">
                        <ShieldAlert size={13} />
                        风险提醒
                      </span>
                      <strong>{pendingAlertsCount} 条</strong>
                    </div>
                    <p className="panel-note">优先用 Grafana 观察服务状态、告警堆积和任务吞吐。</p>
                  </div>
                </div>

                <div className="contract-list">
                  <code>{CONTROL_API_BASE}{grafanaStatus?.metrics_path ?? '/metrics'}</code>
                  <code>{grafanaStatus?.dashboard_url ?? '未配置 Grafana 仪表盘 URL'}</code>
                </div>

                {grafanaStatus?.configured && grafanaStatus.dashboard_url ? (
                  <div className="grafana-embed">
                    <iframe
                      src={grafanaStatus.dashboard_url}
                      title="Grafana 仪表盘预览"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="console-panel">
                    <div className="panel-head panel-head--compact">
                      <div>
                        <span className="section-label">Prometheus 指标预览</span>
                        <h3>本地监控端点</h3>
                      </div>
                    </div>
                    <div className="metrics-preview">
                      {metricsPreviewLines.map((line) => (
                        <code key={line}>{line}</code>
                      ))}
                      {!metricsPreviewLines.length && (
                        <div className="empty-state empty-state--inline">当前还没有可展示的监控指标</div>
                      )}
                    </div>
                    <p className="panel-note">
                      当前前端只把 Grafana 用在系统监控，不替代主交易图。要嵌入 Grafana 仪表盘，需要在 Grafana 侧开启嵌入并配置仪表盘地址。
                    </p>
                  </div>
                )}

                <div className="hero-actions hero-actions--compact">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => window.open(`${CONTROL_API_BASE}${grafanaStatus?.metrics_path ?? '/metrics'}`, '_blank', 'noopener,noreferrer')}
                  >
                    查看指标端点
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={!grafanaStatus?.dashboard_url}
                    onClick={() => {
                      if (grafanaStatus?.dashboard_url) {
                        window.open(grafanaStatus.dashboard_url, '_blank', 'noopener,noreferrer')
                      }
                    }}
                  >
                    打开 Grafana
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {manualTradePanelOpen && (
          <div className="floating-panel-backdrop" onClick={closeManualTradePanel}>
            <aside
              className="floating-panel"
              role="dialog"
              aria-modal="true"
              aria-label="手动交易窗口"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="floating-panel__head">
                <div>
                  <span className="section-label">
                    {editingOrder
                      ? editingOrder.source === 'paper'
                        ? 'Paper 委托改单'
                        : `${selectedMode.toUpperCase()} 委托改单`
                      : selectedMode === 'paper'
                        ? '手动交易'
                        : `${selectedMode.toUpperCase()} 委托`}
                  </span>
                  <h3>
                    {selectedSymbol} ·{' '}
                    {editingOrder
                      ? editingOrder.source === 'paper'
                        ? '修改本地限价委托'
                        : '修改 Bybit 真实限价委托'
                      : selectedMode === 'paper'
                        ? 'Paper 辅助录入'
                        : '向 Bybit 提交真实限价委托'}
                  </h3>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  title="关闭手动交易窗口"
                  aria-label="关闭手动交易窗口"
                  onClick={closeManualTradePanel}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="floating-panel__body">
                <div className="field-grid">
                  <label className="field">
                    <span>方向</span>
                    <select
                      value={manualOrder.side}
                      disabled={Boolean(editingOrder)}
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
                {(manualTradePreviewQuery.isLoading || manualTradePreview) && (
                  <div
                    className={`execution-preview ${manualTradePreview?.allowed === false ? 'is-blocked' : ''}`}
                    aria-live="polite"
                  >
                    <div className="execution-preview__head">
                      <span className="section-label">执行预检</span>
                      {manualTradePreview && <strong>{manualTradePreview.action}</strong>}
                    </div>
                    {manualTradePreviewQuery.isLoading && !manualTradePreview ? (
                      <div className="execution-preview__line">
                        正在评估本次成交对{selectedMode === 'paper' ? ' Paper 账户' : '当前 Bybit 账户'}和持仓的影响...
                      </div>
                    ) : manualTradePreview ? (
                      <>
                        <div className="execution-preview__line">
                          <span>名义价值 {manualTradePreview.notional}</span>
                          <span>
                            可用余额 {manualTradePreview.available_balance_before} {'→'}{' '}
                            {manualTradePreview.available_balance_after}
                          </span>
                        </div>
                        <div className="execution-preview__line">
                          <span>
                            当前持仓 {positionSideLabel(manualTradePreview.current_position_side)} · {manualTradePreview.current_position_size}
                          </span>
                          <span>
                            成交后 {positionSideLabel(manualTradePreview.projected_position_side)} · {manualTradePreview.projected_position_size}
                          </span>
                        </div>
                        <div className="execution-preview__line">
                          <span>参考均价 {manualTradePreview.current_avg_price}</span>
                          <span>成交后均价 {manualTradePreview.projected_avg_price}</span>
                          <span>预估已实现 {manualTradePreview.estimated_realized_pnl}</span>
                        </div>
                        {!manualTradePreview.allowed && manualTradePreview.blocked_reason && (
                          <div className="execution-preview__line">
                            <span>{manualTradePreview.blocked_reason}</span>
                          </div>
                        )}
                        {manualTradePreview.recommended_action && (
                          <div className="execution-preview__line">
                            <span>建议 {manualTradePreview.recommended_action}</span>
                          </div>
                        )}
                        {manualTradePreview.warnings.length > 0 && (
                          <div className="execution-preview__warnings">
                            {manualTradePreview.warnings.map((warning) => (
                              <span key={warning}>{warning}</span>
                            ))}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
                <div className="inline-actions">
                  {editingOrder ? (
                    <>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={
                          Boolean(manualTradingBlockedReason) ||
                          replacePaperOrderMutation.isPending ||
                          replaceExchangeOrderMutation.isPending
                        }
                        onClick={editingOrder.source === 'paper' ? replacePaperOrder : replaceExchangeOrder}
                      >
                        提交改单
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={
                          !serviceAvailable ||
                          cancelPaperOrderMutation.isPending ||
                          cancelExchangeOrderMutation.isPending
                        }
                        onClick={() =>
                          editingOrder.source === 'paper'
                            ? cancelPaperOrder(editingOrder.order_id)
                            : cancelExchangeOrder(editingOrder.order_id)
                        }
                      >
                        撤销当前委托
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={
                          Boolean(manualTradingBlockedReason) ||
                          manualTradeMutation.isPending ||
                          exchangeOrderMutation.isPending
                        }
                        onClick={submitManualOrder}
                      >
                        {selectedMode === 'paper' ? '提交手动交易' : `提交 ${selectedMode.toUpperCase()} 委托`}
                      </button>
                      {selectedMode === 'paper' && (
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={Boolean(manualTradingBlockedReason) || paperOrderMutation.isPending}
                          onClick={submitPaperOrder}
                        >
                          挂 Paper 限价单
                        </button>
                      )}
                    </>
                  )}
                </div>
                {manualTradingBlockedReason && (
                  <div className="service-banner service-banner--warning service-banner--inline">
                    <AlertTriangle size={16} />
                    <div>
                      <strong>
                        {editingOrder
                          ? editingOrder.source === 'paper'
                            ? '当前不能修改本地限价委托'
                            : '当前不能修改真实委托'
                          : selectedMode === 'paper'
                            ? '手动交易暂不可提交'
                            : '真实委托暂不可提交'}
                      </strong>
                      <p>{manualTradingBlockedReason}</p>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {orderHistoryPanelOpen && (
          <div className="floating-panel-backdrop" onClick={() => setOrderHistoryPanelOpen(false)}>
            <aside
              className="floating-panel floating-panel--wide"
              role="dialog"
              aria-modal="true"
              aria-label="历史订单窗口"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="floating-panel__head">
                <div>
                  <span className="section-label">历史订单</span>
                  <h3>历史订单与当前品种过滤</h3>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  title="关闭历史订单窗口"
                  aria-label="关闭历史订单窗口"
                  onClick={() => setOrderHistoryPanelOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="floating-panel__body">
                <div className="inline-actions inline-actions--tight">
                  {(['all', 'manual', 'strategy'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`pill pill--compact ${tradeOriginFilter === value ? 'active' : ''}`}
                      onClick={() => setTradeOriginFilter(value)}
                    >
                      {value === 'all' ? '全部来源' : value === 'manual' ? '手动单' : '策略单'}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`pill pill--compact ${tradeScopeFilter === 'selected' ? 'active' : ''}`}
                    onClick={() => setTradeScopeFilter((current) => (current === 'selected' ? 'all' : 'selected'))}
                  >
                    {tradeScopeFilter === 'selected' ? `${selectedSymbol}` : '当前品种'}
                  </button>
                  <span className="section-label">
                    {accountOverview?.source === 'paper'
                      ? '当前历史订单来自本地 Paper 成交派生；真实网页登录入口仍使用 '
                      : '当前只读历史订单来自程序侧私有 API；网页登录入口仍使用 '}
                    {settings?.bybit_web_entry ?? 'https://www.bybit-global.com/'}。
                  </span>
                </div>
                <div className="trade-list trade-list--dense">
                  {filteredOrderHistory.map((order, index) => (
                    <div key={`${order.order_id}-${index}`} className="trade-row trade-row--fade" style={{ animationDelay: `${index * 18}ms` }}>
                      <div className="console-row__main">
                        <strong>{order.symbol} · {order.side === 'buy' ? '买单' : '卖单'}</strong>
                        <p>
                          {order.order_type} · 价格 {order.price} · 数量 {order.qty} · {order.status}
                          {order.origin === 'strategy' && order.strategy_id ? ` · 策略 ${order.strategy_id}` : ''}
                        </p>
                      </div>
                      <div className="trade-meta">
                        <span className="console-tag">{orderSourceLabel(order.source)}</span>
                        <span className="console-tag">{order.market === 'perp' ? '永续' : '现货'}</span>
                        <span className="console-tag">{tradeOriginLabel(order.origin)}</span>
                        <small>{formatTime(order.created_at)}</small>
                      </div>
                    </div>
                  ))}
                  {filteredOrderHistory.length === 0 && (
                    <div className="empty-state empty-state--inline">当前筛选下没有可展示的历史订单。</div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        {accountInspectorOpen && (
          <div className="floating-panel-backdrop" onClick={() => setAccountInspectorOpen(false)}>
            <aside
              className="floating-panel floating-panel--wide"
              role="dialog"
              aria-modal="true"
              aria-label="账户详情窗口"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="floating-panel__head">
                <div>
                  <span className="section-label">账户详情</span>
                  <h3>账户来源、链路与持仓摘要</h3>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  title="关闭账户详情窗口"
                  aria-label="关闭账户详情窗口"
                  onClick={() => setAccountInspectorOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="floating-panel__body">
                <div className="account-inspector-grid">
                  <div className="account-hero-card account-hero-card--headline">
                    <span>账户状态</span>
                    <strong>{accountSourceLabel(accountOverview?.source)}</strong>
                    <p>
                      {accountOverview?.source === 'paper'
                        ? '当前账户、持仓与余额由本地 Paper 成交派生。'
                        : bybitPrivateStatus?.can_query_private
                          ? '程序侧私有 API 已接入，切到 Demo / Live 会读取真实账户。'
                          : '尚未检测到可用的私有 API 配置。'}
                    </p>
                  </div>
                  <div className="account-hero-card account-hero-card--headline">
                    <span>交易链路</span>
                    <strong>{tradeProbeLabel(tradeProbeResult?.outcome)}</strong>
                    <p>{tradeProbeResult?.detail ?? '可使用右侧按钮对真实交易 POST 链路做一次安全探测。'}</p>
                  </div>
                  <div className="api-panel api-panel--bottom account-inspector-grid__wide">
                    <span className="section-label">私有 API 状态</span>
                    <div className="contract-list">
                      <code>{bybitPrivateStatus?.api_base_url ?? settings?.api_base_url ?? 'https://api.bybit.com'}</code>
                      <code>{bybitPrivateStatus?.key_hint ?? '未检测到 API Key'}</code>
                      <code>{bybitPrivateStatus?.account_type ?? 'UNIFIED'}</code>
                      <code>{bybitPrivateRealtimeStatusLabel(bybitPrivateStatus)}</code>
                    </div>
                    <p>
                      账户读取走程序侧私有 API，网页入口仍使用{' '}
                      <a href={settings?.bybit_web_entry ?? 'https://www.bybit-global.com/'} target="_blank" rel="noreferrer">
                        {settings?.bybit_web_entry ?? 'https://www.bybit-global.com/'}
                      </a>
                      ，数据读取走私有 API 域名。
                    </p>
                    {bybitPrivateStatus?.realtime_recommended_action && (
                      <p className="panel-note">{bybitPrivateStatus.realtime_recommended_action}</p>
                    )}
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
                    {!!bybitPrivateStatus?.usdt_balance_diagnostics?.length && (
                      <div className="trade-list trade-list--dense account-inspector-list">
                        {bybitPrivateStatus.usdt_balance_diagnostics.map((item) => (
                          <div
                            key={`${item.account_type}-${item.coin}`}
                            className="trade-row trade-row--fade"
                          >
                            <div className="console-row__main">
                              <strong>{item.account_type}</strong>
                              <p>
                                可用 {item.available_balance} {item.coin} · 钱包 {item.wallet_balance} {item.coin}
                              </p>
                            </div>
                            <div className="trade-meta">
                              <span className={`console-tag ${item.error ? 'console-tag--warn' : ''}`}>
                                {item.error ? '查询失败' : item.source === 'wallet-balance' ? '钱包快照' : '账户余额'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {bybitPrivateStatus?.last_error && <p>{bybitPrivateStatus.last_error}</p>}
                    <span className="section-label">公共行情链路</span>
                    <div className="contract-list">
                      <code>{bybitRestReachabilityLabel(bybitPublicStatus?.rest_reachable)}</code>
                      <code>{bybitPublicChannelStatusLabel('linear', bybitPublicStatus)}</code>
                      <code>{bybitPublicChannelStatusLabel('spot', bybitPublicStatus)}</code>
                      <code>{formatTime(bybitPublicStatus?.rest_tested_at ?? bybitPublicStatus?.updated_at)}</code>
                    </div>
                    <p className="panel-note">
                      {bybitPublicStatus?.recommended_action ?? '当前 Bybit 公共实时链路正常，目标品种实时行情会继续作为真实执行门禁。'}
                    </p>
                    {bybitPublicStatus?.last_error && <p>最近错误：{bybitPublicStatus.last_error}</p>}
                  </div>
                </div>
                <div className="trade-list trade-list--dense account-inspector-list">
                  {(accountOverview?.top_holdings ?? []).map((asset, index) => (
                    <div key={asset.coin} className="trade-row trade-row--fade" style={{ animationDelay: `${index * 18}ms` }}>
                      <div className="console-row__main">
                        <strong>{asset.coin}</strong>
                        <p>可用 {asset.available_balance} · 账面 {asset.wallet_balance}</p>
                      </div>
                      <div className="trade-meta">
                        <span className="console-tag">{asset.usd_value}</span>
                      </div>
                    </div>
                  ))}
                  {!accountOverview?.top_holdings?.length && (
                    <div className="empty-state empty-state--inline">当前账户没有可展示的资产持仓。</div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        {strategyEditorOpen && selectedStrategy && (
          <div className="floating-panel-backdrop" onClick={() => setStrategyEditorOpen(false)}>
            <aside
              className="floating-panel floating-panel--wide"
              role="dialog"
              aria-modal="true"
              aria-label="策略参数编辑窗口"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="floating-panel__head">
                <div>
                  <span className="section-label">策略参数编辑</span>
                  <h3>{selectedStrategy.name}</h3>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  title="关闭策略参数编辑窗口"
                  aria-label="关闭策略参数编辑窗口"
                  onClick={() => setStrategyEditorOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="floating-panel__body">
                <div className="parameter-grid">
                  {selectedStrategy.parameters.map((parameter) => (
                    <div key={parameter.key} className="parameter-card">
                      <span>{parameter.label}</span>
                      <input
                        value={parameterDrafts[parameter.key] ?? normalizeDraftValue(parameter.value)}
                        onChange={(event) =>
                          setParameterDrafts((current) => ({
                            ...current,
                            [parameter.key]: event.target.value,
                          }))
                        }
                      />
                      {parameter.unit ? <small>{parameter.unit}</small> : null}
                    </div>
                  ))}
                  <div className="parameter-card">
                    <span>风险预算</span>
                    <input value={riskBudgetDraft} onChange={(event) => setRiskBudgetDraft(event.target.value)} />
                    <small>支持直接填写如 18%</small>
                  </div>
                </div>

                {(hasParameterDraftChanges || riskBudgetChanged) && (
                  <p className="panel-note">
                    当前有未提交修改: 参数 {Object.keys(parameterDraftPatch).length} 项，风险预算 {riskBudgetChanged ? '已修改' : '未修改'}。
                  </p>
                )}

                <div className="inline-actions">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!serviceAvailable || changeRequestMutation.isPending || !hasParameterDraftChanges}
                    onClick={() => {
                      if (!hasParameterDraftChanges) {
                        showFeedback('warning', '没有可提交的参数变更', '你还没有修改当前策略参数。')
                        return
                      }
                      submitStrategyRequest(
                        'strategy.parameter.update',
                        `更新 ${selectedStrategy.name} 参数`,
                        {
                          strategy_id: selectedStrategy.id,
                          parameter_patch: parameterDraftPatch,
                        },
                      )
                    }}
                  >
                    提交参数变更
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={!serviceAvailable || changeRequestMutation.isPending || !riskBudgetChanged}
                    onClick={() =>
                      submitStrategyRequest(
                        'strategy.risk_update',
                        `${selectedStrategy.name} 更新风控边界`,
                        { strategy_id: selectedStrategy.id, risk_budget: riskBudgetDraft },
                        'high',
                      )
                    }
                  >
                    更新风控
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {strategyTrackingPanelOpen && selectedStrategy && (
          <div className="floating-panel-backdrop" onClick={() => setStrategyTrackingPanelOpen(false)}>
            <aside
              className="floating-panel"
              role="dialog"
              aria-modal="true"
              aria-label="策略跟踪窗口"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="floating-panel__head">
                <div>
                  <span className="section-label">策略跟踪</span>
                  <h3>{selectedStrategy.name}</h3>
                  <p className="panel-note">手动发起问题或变更跟踪，任务会写回策略活动和 AI 复盘。</p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  title="关闭策略跟踪窗口"
                  aria-label="关闭策略跟踪窗口"
                  onClick={() => setStrategyTrackingPanelOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="floating-panel__body">
                <div className="chip-row">
                  <button
                    type="button"
                    className={`pill pill--compact ${strategyTrackingKind === 'issue' ? 'active' : ''}`}
                    onClick={() => setStrategyTrackingKind('issue')}
                  >
                    问题跟踪
                  </button>
                  <button
                    type="button"
                    className={`pill pill--compact ${strategyTrackingKind === 'change' ? 'active' : ''}`}
                    onClick={() => setStrategyTrackingKind('change')}
                  >
                    变更跟踪
                  </button>
                </div>
                <div className="field-grid backtest-field-grid">
                  <label className="field field--wide">
                    <span>跟踪摘要</span>
                    <input
                      value={strategyTrackingSummary}
                      onChange={(event) => setStrategyTrackingSummary(event.target.value)}
                      placeholder={
                        strategyTrackingKind === 'issue'
                          ? '例如：ETH 策略最近两次真实执行被风控拦截'
                          : '例如：BTC 趋势策略刚刚调整了参数与风险预算'
                      }
                    />
                  </label>
                  <label className="field field--wide">
                    <span>补充说明</span>
                    <textarea
                      value={strategyTrackingDetail}
                      onChange={(event) => setStrategyTrackingDetail(event.target.value)}
                      placeholder="补充背景、你的判断或希望 AI 重点跟踪的观察点。"
                      rows={4}
                    />
                  </label>
                </div>
                <div className="hero-actions hero-actions--compact">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!serviceAvailable || strategyTrackingMutation.isPending}
                    onClick={() => {
                      void submitStrategyTrackingReview()
                    }}
                  >
                    {strategyTrackingKind === 'issue' ? '创建问题跟踪' : '创建变更跟踪'}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setStrategyTrackingPanelOpen(false)}
                  >
                    取消
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {reviewInspectorOpen && (
          <div className="floating-panel-backdrop" onClick={() => setReviewInspectorOpen(false)}>
            <aside
              className="floating-panel floating-panel--wide"
              role="dialog"
              aria-modal="true"
              aria-label="复盘结果详情窗口"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="floating-panel__head">
                <div>
                  <span className="section-label">复盘结果</span>
                  <h3>{reviewInspectorReview?.title ?? '结果暂不可用'}</h3>
                  {reviewInspectorReview && (
                    <p className="panel-note">
                      {reviewPeriodLabel(reviewInspectorReview.period)}
                      {reviewInspectorStrategyId ? ` · ${strategyNameMap.get(reviewInspectorStrategyId) ?? reviewInspectorStrategyId}` : ''}
                      {reviewInspectorReview.source_job_type ? ` · 任务 ${reviewInspectorReview.source_job_type}` : ''}
                      {reviewInspectorReview.source_job_status ? ` · ${jobStatusLabel(reviewInspectorReview.source_job_status)}` : ''}
                      {` · ${formatDateTime(reviewInspectorReview.created_at)}`}
                    </p>
                  )}
                </div>
                <div className="inline-actions inline-actions--tight">
                  {reviewInspectorReview && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => {
                        if (reviewInspectorStrategyId) {
                          openStrategyReplay(reviewInspectorStrategyId)
                          return
                        }
                        startTransition(() => {
                          setActiveSection('replay')
                          setReplayFocusedReviewId(reviewInspectorReview.id)
                        })
                      }}
                    >
                      打开复盘页
                    </button>
                  )}
                  {(reviewInspectorStrategyId || reviewInspectorReview?.strategy_id) && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => openStrategyActivity(reviewInspectorStrategyId ?? reviewInspectorReview?.strategy_id)}
                    >
                      打开策略
                    </button>
                  )}
                  {reviewInspectorReview?.source_job_id && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => openAiSchedulerJob(reviewInspectorReview.source_job_id)}
                    >
                      打开任务
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button"
                    title="关闭复盘结果详情窗口"
                    aria-label="关闭复盘结果详情窗口"
                    onClick={() => setReviewInspectorOpen(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="floating-panel__body">
                {!reviewInspectorReview && (
                  <div className="empty-state empty-state--inline">当前结果暂未加载完成，请稍后再试。</div>
                )}
                {reviewInspectorReview && (
                  <div className="review-inspector">
                    <div className="review-inspector__summary">
                      <p>{reviewInspectorReview.summary}</p>
                    </div>
                    <div className="review-inspector__grid">
                      <div className="review-inspector__section">
                        <span className="section-label">亮点</span>
                        <ul className="replay-bullet-list">
                          {reviewInspectorReview.highlights.length ? (
                            reviewInspectorReview.highlights.slice(0, 6).map((item) => <li key={item}>{item}</li>)
                          ) : (
                            <li>当前没有额外亮点摘要。</li>
                          )}
                        </ul>
                      </div>
                      <div className="review-inspector__section">
                        <span className="section-label">风险</span>
                        <ul className="replay-bullet-list replay-bullet-list--warn">
                          {reviewInspectorReview.risks.length ? (
                            reviewInspectorReview.risks.slice(0, 6).map((item) => <li key={item}>{item}</li>)
                          ) : (
                            <li>当前没有额外风险摘要。</li>
                          )}
                        </ul>
                      </div>
                    </div>
                    <div className="review-inspector__section">
                      <div className="panel-head panel-head--compact">
                        <div>
                          <span className="section-label">提案</span>
                          <h3>本次结果关联的策略建议</h3>
                        </div>
                        <span className="chip chip--muted">{reviewInspectorReview.proposals.length} 条</span>
                      </div>
                      <div className="job-list">
                        {reviewInspectorReview.proposals.map((proposal, index) => (
                          <div key={proposal.id} className="job-row job-row--fade" style={{ animationDelay: `${index * 24}ms` }}>
                            <div className="console-row__main">
                              <strong>
                                <Sparkles size={13} />
                                {proposal.title}
                              </strong>
                              <p>{proposalTypeLabel(proposal.proposal_type)} · {proposal.expected_impact}</p>
                            </div>
                            <div className="job-meta">
                              <span className="console-tag">{proposalStatusLabel(proposal.status)}</span>
                              <small>{formatTime(proposal.created_at)}</small>
                            </div>
                          </div>
                        ))}
                        {!reviewInspectorReview.proposals.length && (
                          <div className="empty-state empty-state--inline">当前结果没有附带额外提案。</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {strategyActivityPanelOpen && selectedStrategy && (
          <div className="floating-panel-backdrop" onClick={() => setStrategyActivityPanelOpen(false)}>
            <aside
              className="floating-panel floating-panel--wide"
              role="dialog"
              aria-modal="true"
              aria-label="策略最近活动窗口"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="floating-panel__head">
                <div>
                  <span className="section-label">策略最近活动</span>
                  <h3>{selectedStrategy.name}</h3>
                  <p className="panel-note">
                    {strategyActivityHeadline(selectedStrategyActivity)}
                    {selectedStrategyActivity?.generated_at
                      ? ` · 更新于 ${formatDateTime(selectedStrategyActivity.generated_at)}`
                      : ''}
                  </p>
                </div>
                <div className="inline-actions inline-actions--tight">
                  <button
                    type="button"
                    className="micro-action"
                    disabled={!serviceAvailable || strategyTrackingMutation.isPending}
                    onClick={() => openStrategyTrackingPanel('issue')}
                  >
                    发起跟踪
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    title="关闭策略最近活动窗口"
                    aria-label="关闭策略最近活动窗口"
                    onClick={() => setStrategyActivityPanelOpen(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="floating-panel__body">
                {strategyActivityQuery.isFetching && !selectedStrategyActivity && (
                  <div className="empty-state empty-state--inline">正在拉取当前策略最近活动...</div>
                )}
                {!strategyActivityQuery.isFetching && !selectedStrategyActivity && (
                  <div className="empty-state empty-state--inline">当前策略最近活动暂不可用。</div>
                )}
                {selectedStrategyActivity && (
                  <div className="floating-panel__grid">
                    <div>
                      {(selectedStrategyActivity.latest_primary_review ||
                        selectedStrategyActivity.latest_tracking_review ||
                        selectedStrategyActivity.latest_tracking_job) && (
                        <div className="panel-note">
                          {selectedStrategyActivity.latest_primary_review
                            ? `最近复盘: ${selectedStrategyActivity.latest_primary_review.summary}`
                            : '最近复盘: 暂无'}
                          {selectedStrategyActivity.latest_tracking_review
                            ? ` · 最近跟踪: ${selectedStrategyActivity.latest_tracking_review.summary}`
                            : ''}
                          {selectedStrategyActivity.latest_tracking_job
                            ? ` · 最近任务: ${strategyAgentJobSummary(selectedStrategyActivity.latest_tracking_job)}`
                            : ''}
                        </div>
                      )}
                      <span className="section-label">AI 跟踪</span>
                      <div className="trade-list trade-list--dense">
                        {selectedStrategyActivity.recent_reviews
                          .filter((review) => isStrategyTrackingReview(review.period))
                          .map((review) => (
                            <div key={review.id} className="trade-row trade-row--fade">
                              <div className="console-row__main">
                                <strong>{review.title}</strong>
                                <p>{review.summary}</p>
                              </div>
                              <div className="trade-meta">
                                <span className="console-tag">{reviewPeriodLabel(review.period)}</span>
                                {review.source_job_id && (
                                  <button
                                    type="button"
                                    className="micro-action"
                                    onClick={() => openAiSchedulerJob(review.source_job_id)}
                                  >
                                    打开任务
                                  </button>
                                )}
                                {selectedStrategy?.id && (
                                  <button
                                    type="button"
                                    className="micro-action"
                                    onClick={() => openReviewInspector(review.id, selectedStrategy.id)}
                                  >
                                    查看结果
                                  </button>
                                )}
                                <small>{formatDateTime(review.created_at)}</small>
                              </div>
                            </div>
                          ))}
                        {!selectedStrategyActivity.recent_reviews.filter((review) => isStrategyTrackingReview(review.period)).length && (
                          <div className="empty-state empty-state--inline">当前没有策略问题或变更跟踪。</div>
                        )}
                      </div>
                      <span className="section-label">复盘记录</span>
                      <div className="trade-list trade-list--dense">
                        {selectedStrategyActivity.recent_reviews
                          .filter((review) => !isStrategyTrackingReview(review.period))
                          .map((review) => (
                            <div key={review.id} className="trade-row trade-row--fade">
                              <div className="console-row__main">
                                <strong>{review.title}</strong>
                                <p>{review.summary}</p>
                              </div>
                              <div className="trade-meta">
                                <span className="console-tag">{reviewPeriodLabel(review.period)}</span>
                                {selectedStrategy?.id && (
                                  <button
                                    type="button"
                                    className="micro-action"
                                    onClick={() => openReplayReview(review.id, selectedStrategy.id, 'selected')}
                                  >
                                    打开复盘
                                  </button>
                                )}
                                <small>
                                  {review.proposal_count > 0
                                    ? `${review.proposal_count} 条提案 · ${formatDateTime(review.created_at)}`
                                    : formatDateTime(review.created_at)}
                                </small>
                              </div>
                            </div>
                          ))}
                        {!selectedStrategyActivity.recent_reviews.filter((review) => !isStrategyTrackingReview(review.period)).length && (
                          <div className="empty-state empty-state--inline">当前没有策略关联的 AI 复盘。</div>
                        )}
                      </div>
                      <span className="section-label">跟踪任务</span>
                      <div className="trade-list trade-list--dense">
                        {selectedStrategyActivity.recent_agent_jobs.map((job) => (
                          <div key={job.id} className="trade-row trade-row--fade">
                            <div className="console-row__main">
                              <strong>{strategyAgentJobSummary(job)}</strong>
                              <p>
                                {job.result_summary || `${job.writeback_target} · ${job.requested_by || 'system'}`}
                                {job.linked_review_title ? ` · 结果 ${job.linked_review_title}` : ''}
                              </p>
                            </div>
                            <div className="trade-meta">
                              <span className="console-tag">{job.writeback_target}</span>
                              {job.linked_review_period && (
                                <span className={reviewPeriodChipClass(job.linked_review_period)}>
                                  {reviewPeriodLabel(job.linked_review_period)}
                                </span>
                              )}
                              {job.linked_review_id && selectedStrategy?.id && (
                                <button
                                  type="button"
                                  className="micro-action"
                                  onClick={() => openReviewInspector(job.linked_review_id, selectedStrategy.id)}
                                >
                                  查看结果
                                </button>
                              )}
                              {!job.linked_review_id &&
                                (job.job_type === 'review_strategy_issue' || job.job_type === 'review_strategy_change') &&
                                selectedStrategy?.id && (
                                  <button
                                    type="button"
                                    className="micro-action"
                                    onClick={() => openStrategyReplay(selectedStrategy.id)}
                                  >
                                    打开复盘
                                  </button>
                                )}
                              {(job.status === 'failed' || job.status === 'cancelled') && (
                                <button
                                  type="button"
                                  className="micro-action"
                                  disabled={!serviceAvailable || retryAgentJobMutation.isPending}
                                  onClick={() => {
                                    void retryAgentJob(job.id)
                                  }}
                                >
                                  重试
                                </button>
                              )}
                              <small>{formatDateTime(job.updated_at || job.created_at)}</small>
                            </div>
                          </div>
                        ))}
                        {!selectedStrategyActivity.recent_agent_jobs.length && (
                          <div className="empty-state empty-state--inline">当前没有策略关联的 AI 跟踪任务。</div>
                        )}
                      </div>

                      <span className="section-label">提醒 / 审计</span>
                      <div className="trade-list trade-list--dense">
                        {selectedStrategyActivity.recent_alerts.map((alert) => (
                          <div key={alert.id} className="trade-row trade-row--fade">
                            <div className="console-row__main">
                              <strong className={activityAlertToneClass(alert)}>
                                {alert.severity} · {alert.title}
                              </strong>
                              <p>{alert.description}</p>
                            </div>
                            <div className="trade-meta">
                              <small>{formatDateTime(alert.triggered_at)}</small>
                            </div>
                          </div>
                        ))}
                        {!selectedStrategyActivity.recent_alerts.length && (
                          <div className="empty-state empty-state--inline">当前没有未完成的策略提醒。</div>
                        )}
                      </div>
                      <div className="trade-list trade-list--dense">
                        {selectedStrategyActivity.recent_audit_events.map((event) => (
                          <div key={event.id} className="trade-row trade-row--fade">
                            <div className="console-row__main">
                              <strong>{event.event_type}</strong>
                              <p>{executionEventSummary(event)}</p>
                            </div>
                            <div className="trade-meta">
                              <span className="console-tag">{event.severity}</span>
                              <small>{formatDateTime(event.occurred_at)}</small>
                            </div>
                          </div>
                        ))}
                        {!selectedStrategyActivity.recent_audit_events.length && (
                          <div className="empty-state empty-state--inline">当前没有可展示的策略审计事件。</div>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="section-label">委托 / 成交</span>
                      <div className="trade-list trade-list--dense">
                        {selectedStrategyActivity.active_orders.map((order) => (
                          <div key={`active-${order.order_id}`} className="trade-row trade-row--fade">
                            <div className="console-row__main">
                              <strong>{orderActivitySummary(order)}</strong>
                              <p>{order.status}</p>
                            </div>
                            <div className="trade-meta">
                              <span className="console-tag">{order.market.toUpperCase()}</span>
                              <small>{formatDateTime(order.created_at)}</small>
                            </div>
                          </div>
                        ))}
                        {!selectedStrategyActivity.active_orders.length && (
                          <div className="empty-state empty-state--inline">当前没有活跃的策略关联委托。</div>
                        )}
                      </div>
                      <div className="trade-list trade-list--dense">
                        {selectedStrategyActivity.recent_orders.map((order) => (
                          <div key={`history-${order.order_id}`} className="trade-row trade-row--fade">
                            <div className="console-row__main">
                              <strong>{orderActivitySummary(order)}</strong>
                              <p>{order.status}</p>
                            </div>
                            <div className="trade-meta">
                              <span className="console-tag">{orderSourceLabel(order.source)}</span>
                              <small>{formatDateTime(order.created_at)}</small>
                            </div>
                          </div>
                        ))}
                        {!selectedStrategyActivity.recent_orders.length && (
                          <div className="empty-state empty-state--inline">当前没有策略历史委托记录。</div>
                        )}
                      </div>
                      <div className="trade-list trade-list--dense">
                        {selectedStrategyActivity.recent_trades.map((trade) => (
                          <div key={trade.id} className="trade-row trade-row--fade">
                            <div className="console-row__main">
                              <strong>{tradeActivitySummary(trade)}</strong>
                              <p>{trade.pnl}</p>
                            </div>
                            <div className="trade-meta">
                              <span className="console-tag">{trade.mode.toUpperCase()}</span>
                              <small>{formatDateTime(trade.created_at)}</small>
                            </div>
                          </div>
                        ))}
                        {!selectedStrategyActivity.recent_trades.length && (
                          <div className="empty-state empty-state--inline">当前没有策略成交记录。</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {activeSection === 'overview' && (
          <section key={activeSection} className={`overview-studio overview-studio--${layoutPreset} section-entrance`}>
            <div className="overview-shell no-editor">
              <div className="overview-canvas">
                <div className={`terminal-home terminal-home--${layoutPreset}`}>
                  <div className="terminal-home__stage">
                    <div className="terminal-stage__toolbar">
                      <div className="terminal-stage__meta">
                        <div className="terminal-stage__title-row">
                          <div className="terminal-stage__title">
                            <h3>{selectedSymbol}</h3>
                            {selectedStrategy?.name && <p className="terminal-stage__subline">{selectedStrategy.name}</p>}
                          </div>
                          <div className="chip-row">
                            {showStrategyWatch && (
                              <div className="terminal-watchstrip terminal-watchstrip--toolbar">
                                {overviewWatchlistItems.map((item) => (
                                  <button
                                    key={item.symbol}
                                    type="button"
                                    className={`terminal-watchstrip__item ${item.symbol === selectedSymbol ? 'active' : ''}`}
                                    title={`${item.symbol} · ${formatNumber(item.last_price)} · ${signalLabel(item.signal)} · ${riskLevelLabel(item.risk_level)} · ${formatPercent(item.change_24h)}`}
                                    onClick={() => {
                                      startTransition(() => setSelectedSymbol(item.symbol))
                                      setManualOrder((current) => ({ ...current, price: item.last_price.toFixed(2) }))
                                    }}
                                  >
                                    <strong>{item.symbol}</strong>
                                    <small className={item.change_24h >= 0 ? 'positive' : 'negative'}>
                                      {formatPercent(item.change_24h)}
                                    </small>
                                  </button>
                                ))}
                              </div>
                            )}
                            {marketTimeframePresets.map((preset) => (
                              <button
                                key={`overview-tf-${preset.value}`}
                                type="button"
                                className={selectedMarketTimeframe === preset.value ? 'pill active' : 'pill'}
                                onClick={() => setSelectedMarketTimeframe(preset.value)}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="terminal-stage__hero">
                      <div className="terminal-stage__chartblock">
                        <div className="terminal-stage__chart">
                          {marketDetail && (
                            <Suspense fallback={<div className="empty-state empty-state--inline">图表加载中…</div>}>
                              <ReactECharts
                                option={buildCandleOption(marketDetail)}
                                style={{ height: '100%', width: '100%' }}
                                notMerge
                              />
                            </Suspense>
                          )}
                        </div>
                        <div className="terminal-stage__metrics terminal-stage__metrics--compact">
                          <div title="主图当前价格">
                            <span>最新价</span>
                            <strong>{marketDetail ? formatNumber(marketDetail.candles.at(-1)?.close ?? 0) : '--'}</strong>
                          </div>
                          <div title="24H 涨跌幅">
                            <span>24H</span>
                            <strong className={(selectedWatchItem?.change_24h ?? 0) >= 0 ? 'positive' : 'negative'}>
                              {formatPercent(selectedWatchItem?.change_24h ?? 0)}
                            </strong>
                          </div>
                          <div title="信号与风险会在 hover 时在完整行情页与提醒里展开">
                            <span>信号 / 风险</span>
                            <strong>
                              {selectedWatchItem ? `${signalLabel(selectedWatchItem.signal)} · ${riskLevelLabel(selectedWatchItem.risk_level)}` : '--'}
                            </strong>
                          </div>
                          <div title="成交量">
                            <span>成交量</span>
                            <strong>{formatCompactNumber(selectedWatchItem?.volume_24h ?? 0)}</strong>
                          </div>
                          <div title={executionHealthTooltip(snapshotExecutionHealth)}>
                            <span>执行健康</span>
                            <strong className={executionHealthToneClass(snapshotExecutionHealth)}>
                              {executionHealthLabel(snapshotExecutionHealth)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="terminal-dock">
                <div className="terminal-dock__panel">
                  <div className="console-panel console-panel--stream">
                    <div className="terminal-block__head terminal-block__head--compact">
                        <div>
                          <span className="section-label">AI 实时日志</span>
                          <h3>当前动作流</h3>
                        </div>
                        <span className="chip chip--muted">
                          {overviewAiEvents.length + overviewQueuedRequests.length + (scheduler?.jobs.length ? 1 : 0)} 条
                        </span>
                      </div>
                      <div className="console-list">
                        {scheduler?.jobs.slice(0, 1).map((job) => (
                          <div key={job.id} className="console-row console-row--highlight">
                            <div className="console-row__main">
                              <strong>
                                <Bot size={13} />
                                任务 · {job.job_type}
                              </strong>
                              <p>{job.status} · 写回 {job.writeback_target}</p>
                            </div>
                            <div className="console-row__meta">
                              <span className="console-tag console-tag--warn">当前任务</span>
                              <small>{formatTime(job.updated_at)}</small>
                            </div>
                          </div>
                        ))}
                        {overviewAiEvents.map((event, index) => (
                          (() => {
                            const meta = eventCategoryMeta(event.event_type)
                            const Icon = meta.icon
                            return (
                              <div key={event.id} className="console-row console-row--fade" style={{ animationDelay: `${index * 32}ms` }}>
                                <div className="console-row__main">
                                  <strong>
                                    <Icon size={13} />
                                    {meta.label} · {event.event_type}
                                  </strong>
                                  <p>{event.source === 'openclaw' ? 'OpenClaw' : '桌面控制端'} · {event.symbol ?? '系统'} · {event.strategy_id ?? '无策略'}</p>
                                </div>
                                <div className="console-row__meta">
                                  <span className="console-tag">{event.severity}</span>
                                  {getAuditLinkedReviewId(event.payload) && (
                                    <button
                                      type="button"
                                      className="micro-action"
                                      onClick={() =>
                                        openReviewInspector(
                                          getAuditLinkedReviewId(event.payload),
                                          event.strategy_id ?? getAuditStrategyId(event.payload),
                                        )
                                      }
                                    >
                                      查看结果
                                    </button>
                                  )}
                                  {!getAuditLinkedReviewId(event.payload) && (event.strategy_id || getAuditStrategyId(event.payload)) && (
                                    <button
                                      type="button"
                                      className="micro-action"
                                      onClick={() => openStrategyActivity(event.strategy_id ?? getAuditStrategyId(event.payload))}
                                    >
                                      打开策略
                                    </button>
                                  )}
                                  <small>{formatTime(event.occurred_at)}</small>
                                </div>
                              </div>
                            )
                          })()
                        ))}
                        {overviewQueuedRequests.map((item, index) => (
                          <div key={item.id} className="console-row console-row--fade" style={{ animationDelay: `${(overviewAiEvents.length + index) * 32}ms` }}>
                            <div className="console-row__main">
                              <strong>
                                <ClipboardList size={13} />
                                请求 · {item.type}
                              </strong>
                              <p>{String(item.payload.strategy_id ?? item.payload.symbol ?? '系统')} · {item.reason}</p>
                            </div>
                            <div className="console-row__meta">
                              <span className="console-tag console-tag--good">{item.status}</span>
                              <small>{formatTime(item.updated_at)}</small>
                            </div>
                          </div>
                        ))}
                        {!scheduler?.jobs.length && !overviewAiEvents.length && !overviewQueuedRequests.length && (
                          <div className="empty-state empty-state--inline">当前没有 AI 调度或待落实动作。</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'settings' && (
          <section className="section-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">运行控制</span>
                  <h3>模式、调度与人工接管</h3>
                </div>
                <span className={`chip ${workspaceDirty ? 'chip--warning' : 'chip--success'}`}>
                  {workspaceDirty ? '有未同步改动' : '已同步'}
                </span>
              </div>
              <div className="settings-grid">
                <div className="settings-block">
                  <span className="section-label">运行模式</span>
                  <div className="compact-switch settings-switch">
                    {(['paper', 'demo', 'live'] as Mode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={selectedMode === mode ? 'pill pill--compact active' : 'pill pill--compact'}
                        onClick={() => setSelectedMode(mode)}
                      >
                        {mode === 'paper' ? '模拟' : mode === 'demo' ? 'Demo' : '实盘'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="settings-block">
                  <span className="section-label">首页布局</span>
                  <div className="compact-switch settings-switch">
                    {(['balanced', 'focus', 'dense'] as LayoutPreset[]).map((layout) => (
                      <button
                        key={layout}
                        type="button"
                        className={layoutPreset === layout ? 'pill pill--compact active' : 'pill pill--compact'}
                        onClick={() => setLayoutPreset(layout)}
                      >
                        {layout === 'balanced' ? '均衡' : layout === 'focus' ? '专注' : '紧凑'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="hero-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={!serviceAvailable || schedulerMutation.isPending}
                  onClick={() => runSchedulerCommand('pause', '设置页暂停 AI 调度')}
                >
                  暂停调度
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!serviceAvailable || schedulerMutation.isPending}
                  onClick={() => runSchedulerCommand('resume', '设置页恢复 AI 调度')}
                >
                  恢复调度
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!serviceAvailable || schedulerMutation.isPending}
                  onClick={() => runSchedulerCommand('cancel_job', '设置页终止当前任务', snapshot?.scheduler.current_job_id ?? undefined)}
                >
                  终止当前任务
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!serviceAvailable || schedulerMutation.isPending}
                  onClick={() => runSchedulerCommand('freeze_publish', snapshot?.scheduler.freeze_publish ? '设置页解除自动发布冻结' : '设置页冻结自动发布')}
                >
                  {snapshot?.scheduler.freeze_publish ? '解除冻结发布' : '冻结自动发布'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!serviceAvailable || schedulerMutation.isPending}
                  onClick={() => runSchedulerCommand('enter_manual_override', '设置页进入人工接管')}
                >
                  进入人工接管
                </button>
                {runtimeWorkerNeedsRecovery && (
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={!serviceAvailable || restartRuntimeWorkerMutation.isPending}
                    title={runtimeWorkerRestoreHint}
                    onClick={() => {
                      void restartStrategyRuntimeWorker()
                    }}
                  >
                    恢复运行线程
                  </button>
                )}
              </div>
              <p className="runtime-worker-note" title={runtimeWorkerStatusTooltip(runtimeWorkerStatus, snapshotExecutionHealth)}>
                <strong>{runtimeWorkerStatusLabel(runtimeWorkerStatus, snapshotExecutionHealth)}</strong>
                <span>{runtimeWorkerStatusDetail(runtimeWorkerStatus, snapshotExecutionHealth)}</span>
              </p>
              <div className="inline-actions">
                <button
                  type="button"
                  className="ghost-button ghost-button--inline"
                  onClick={() => {
                    void triggerDesktopNotificationTest()
                  }}
                >
                  测试通知
                </button>
                <button
                  type="button"
                  className="ghost-button ghost-button--inline"
                  disabled={workspaceMutation.isPending}
                  onClick={() => syncWorkspacePreferences()}
                >
                  同步到控制端
                </button>
                <button
                  type="button"
                  className="ghost-button ghost-button--inline"
                  disabled={workspaceMutation.isPending}
                  onClick={restoreDefaultWorkspace}
                >
                  恢复首页默认
                </button>
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">接入配置</span>
                  <h3>网页入口、API 与 OpenClaw</h3>
                </div>
              </div>
              <div className="contract-list">
                <code>{settings?.bybit_web_entry ?? 'https://www.bybit-global.com/'}</code>
                <code>{settings?.api_base_url ?? 'https://api.bybit.com'}</code>
                <code>{openClawStatus?.gateway_url ?? settings?.openclaw_gateway_url ?? 'ws://127.0.0.1:18789'}</code>
              </div>
              <p className="panel-note">
                网页登录与账户入口继续使用 {settings?.bybit_web_entry ?? 'https://www.bybit-global.com/'}；
                程序读取账户与行情时走 API 域名，两者用途不同。
              </p>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">Bybit 链路诊断</span>
                  <h3>公共行情与私有执行状态</h3>
                </div>
                <div className="chip-row">
                  <span className={`chip ${bybitPublicStatus?.recommended_action ? 'chip--warning' : 'chip--success'}`}>
                    {bybitPublicStatus?.recommended_action ? '公共行情链路待处理' : '公共行情链路正常'}
                  </span>
                  <span className={`chip ${bybitPrivateStatus?.realtime_recommended_action ? 'chip--warning' : bybitPrivateStatus?.can_query_private ? 'chip--success' : 'chip--warning'}`}>
                    {bybitPrivateStatus?.realtime_recommended_action
                      ? '私有执行链路待处理'
                      : bybitPrivateStatus?.can_query_private
                        ? '私有执行链路正常'
                        : '私有执行链路未配置'}
                  </span>
                </div>
              </div>
              <div className="settings-grid">
                <div className="settings-block">
                  <span className="section-label">公共行情链路</span>
                  <div className="contract-list">
                    <code>{bybitRestReachabilityLabel(bybitPublicStatus?.rest_reachable)}</code>
                    <code>{bybitPublicChannelStatusLabel('linear', bybitPublicStatus)}</code>
                    <code>{bybitPublicChannelStatusLabel('spot', bybitPublicStatus)}</code>
                  </div>
                  <p className="panel-note">
                    {bybitPublicStatus?.recommended_action ??
                      '当前 Bybit 公共实时链路正常，watchlist 目标品种会继续按实时 feed 做真实执行门禁。'}
                  </p>
                  {bybitPublicStatus?.last_error && <p className="panel-note">最近错误：{bybitPublicStatus.last_error}</p>}
                  {bybitPublicStatus?.rest_last_error && <p className="panel-note">REST 探针错误：{bybitPublicStatus.rest_last_error}</p>}
                </div>
                <div className="settings-block">
                  <span className="section-label">私有执行链路</span>
                  <div className="contract-list">
                    <code>{bybitPrivateStatus?.account_type ?? 'UNIFIED'}</code>
                    <code>{bybitPrivateRealtimeStatusLabel(bybitPrivateStatus)}</code>
                    <code>{bybitPrivateStatus?.key_hint ?? '未检测到 API Key'}</code>
                  </div>
                  <p className="panel-note">
                    {bybitPrivateStatus?.realtime_recommended_action ??
                      (bybitPrivateStatus?.can_query_private
                        ? '当前 Bybit 私有账户链路正常，可继续作为 Demo / Live 只读与真实执行门禁依据。'
                        : '尚未检测到可用的 Bybit 私有 API 配置。')}
                  </p>
                  {bybitPrivateStatus?.realtime_last_error && (
                    <p className="panel-note">最近错误：{bybitPrivateStatus.realtime_last_error}</p>
                  )}
                </div>
              </div>
              <div className="trade-list trade-list--dense">
                {bybitPublicVisibleDiagnostics.map((item) => (
                  <div key={`${item.symbol}-${item.market}`} className="trade-row trade-row--fade">
                    <div className="console-row__main">
                      <strong>{item.symbol} · {item.market === 'perp' ? '永续' : '现货'}</strong>
                      <p>{bybitPublicDiagnosticSummary(item)}</p>
                      {item.recommended_action && <p>{item.recommended_action}</p>}
                    </div>
                    <div className="trade-meta">
                      <span className={`console-tag ${item.issue ? 'console-tag--warn' : ''}`}>
                        {item.channel === 'linear' ? 'Linear' : 'Spot'}
                      </span>
                      <span className={`console-tag ${item.connected ? '' : 'console-tag--warn'}`}>
                        {item.connected ? '已连通' : '未连通'}
                      </span>
                      <span className={`console-tag ${item.has_symbol_feed ? '' : 'console-tag--warn'}`}>
                        {item.has_symbol_feed ? '有 feed' : '缺首帧'}
                      </span>
                      {item.stale ? <span className="console-tag console-tag--warn">已失活</span> : null}
                      <small>{formatTime(item.last_message_at)}</small>
                    </div>
                  </div>
                ))}
                {!bybitPublicVisibleDiagnostics.length && (
                  <div className="empty-state empty-state--inline">当前没有可展示的公共链路诊断。</div>
                )}
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">Grafana / 监控</span>
                  <h3>Grafana-ready 接入</h3>
                </div>
                <span className={`chip ${grafanaStatus?.configured ? 'chip--success' : 'chip--warning'}`}>
                  {grafanaStatus?.configured ? '已配置 Grafana' : '未配置 Grafana'}
                </span>
              </div>
              <div className="contract-list">
                <code>{CONTROL_API_BASE}{grafanaStatus?.metrics_path ?? '/metrics'}</code>
                <code>{grafanaStatus?.dashboard_url ?? '等待配置 Grafana 仪表盘 URL'}</code>
              </div>
              <p className="panel-note">
                {grafanaStatus?.note ?? 'Grafana 更适合系统监控，不建议直接替代主交易 K 线。'}
              </p>
              <div className="hero-actions hero-actions--compact">
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!grafanaStatus?.dashboard_url}
                  onClick={() => {
                    if (grafanaStatus?.dashboard_url) {
                      window.open(grafanaStatus.dashboard_url, '_blank', 'noopener,noreferrer')
                    }
                  }}
                >
                  <ExternalLink size={14} />
                  打开 Grafana
                </button>
              </div>
            </article>
          </section>
        )}

        {activeSection === 'market' && (
          <section key={activeSection} className="section-grid section-grid--market section-entrance">
            <article className="panel panel--hero">
              <div className="panel-head">
                <div>
                  <span className="section-label">实时行情</span>
                  <h3>自选品种与 K 线跟踪</h3>
                </div>
                <button
                  type="button"
                  className="ghost-button ghost-button--inline"
                  onClick={() => setWatchlistManagerOpen(true)}
                >
                  管理自选
                </button>
              </div>
              <div className="market-toolbar market-toolbar--compact">
                <div className="terminal-watchstrip terminal-watchstrip--market">
                  {watchlist.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      className={`terminal-watchstrip__item ${selectedSymbol === item.symbol ? 'active' : ''}`}
                      onClick={() => {
                        startTransition(() => setSelectedSymbol(item.symbol))
                        setManualOrder((current) => ({ ...current, price: item.last_price.toFixed(2) }))
                      }}
                      title={`${item.symbol} · ${formatNumber(item.last_price)} · ${signalLabel(item.signal)} · ${riskLevelLabel(item.risk_level)}`}
                    >
                      <strong>{item.symbol}</strong>
                      <small className={item.change_24h >= 0 ? 'positive' : 'negative'}>
                        {formatPercent(item.change_24h)}
                      </small>
                    </button>
                  ))}
                </div>
                <div className="market-toolbar__meta">
                  <span className={`chip ${marketSourceToneClass(marketDetail?.source)}`}>
                    {marketSourceLabel(marketDetail?.source)}
                  </span>
                  {marketTimeframePresets.map((preset) => (
                    <button
                      key={`market-tf-${preset.value}`}
                      type="button"
                      className={selectedMarketTimeframe === preset.value ? 'pill active' : 'pill'}
                      onClick={() => setSelectedMarketTimeframe(preset.value)}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <span className="chip chip--muted">{selectedWatchAlertLabel}</span>
                </div>
              </div>
              <div className="market-hero-layout market-hero-layout--compact">
                <div className="chart-frame">
                  <div className="chart-stage chart-stage--live" title={marketHeader}>
                    {marketDetail && (
                      <Suspense fallback={<div className="empty-state empty-state--inline">图表加载中…</div>}>
                        <ReactECharts
                          option={buildCandleOption(marketDetail)}
                          style={{ height: '100%', width: '100%' }}
                          notMerge
                        />
                      </Suspense>
                    )}
                  </div>
                  <div className="terminal-summary-strip terminal-summary-strip--compact market-summary-strip">
                    <div className="terminal-summary-strip__item">
                      <span>最新价</span>
                      <strong>{marketDetail ? formatNumber(marketDetail.candles.at(-1)?.close ?? 0) : '--'}</strong>
                    </div>
                    <div className="terminal-summary-strip__item">
                      <span>24H</span>
                      <strong className={(selectedWatchItem?.change_24h ?? 0) >= 0 ? 'positive' : 'negative'}>
                        {formatPercent(selectedWatchItem?.change_24h ?? 0)}
                      </strong>
                    </div>
                    <div className="terminal-summary-strip__item">
                      <span>信号</span>
                      <strong className={selectedWatchItem ? signalToneClass(selectedWatchItem.signal) : ''}>
                        {selectedWatchItem ? signalLabel(selectedWatchItem.signal) : '--'}
                      </strong>
                    </div>
                    <div className="terminal-summary-strip__item">
                      <span>风险</span>
                      <strong className={selectedWatchItem ? riskToneClass(selectedWatchItem.risk_level) : ''}>
                        {selectedWatchItem ? riskLevelLabel(selectedWatchItem.risk_level) : '--'}
                      </strong>
                    </div>
                    <div className="terminal-summary-strip__item">
                      <span>成交量</span>
                      <strong>{formatCompactNumber(selectedWatchItem?.volume_24h ?? 0)}</strong>
                    </div>
                    <div className="terminal-summary-strip__item">
                      <span>更新时间</span>
                      <strong>{formatTime(marketDetail?.updated_at)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">盘口与手动交易</span>
                  <h3>辅助交易面板</h3>
                </div>
                <div className="chip-row">
                  <button
                    type="button"
                    className="ghost-button ghost-button--inline"
                    onClick={() => {
                      setEditingOrderId(null)
                      setManualTradePanelOpen(true)
                    }}
                  >
                    打开手动交易
                  </button>
                  <span className="chip chip--muted" title="Paper 走本地成交，Demo / Live 走 Bybit 真实限价委托。">
                    手动交易入口
                  </span>
                  <span className="chip chip--muted">{selectedWatchAlertLabel}</span>
                </div>
              </div>
              <div className="market-liquidity-grid market-liquidity-grid--tight">
                <div className="orderbook-column">
                  <strong>买盘</strong>
                  {marketDetail?.bids.slice(0, 4).map((item) => (
                    <div key={`bid-${item.price}`} className="orderbook-row">
                      <span>{formatNumber(item.price)}</span>
                      <span>{formatNumber(item.size)}</span>
                      <span>{formatNumber(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="orderbook-column">
                  <strong>卖盘</strong>
                  {marketDetail?.asks.slice(0, 4).map((item) => (
                    <div key={`ask-${item.price}`} className="orderbook-row">
                      <span>{formatNumber(item.price)}</span>
                      <span>{formatNumber(item.size)}</span>
                      <span>{formatNumber(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="trade-tape-column">
                  <div className="trade-tape-column__head">
                    <strong>最近成交</strong>
                    <span>{marketPublicTrades.length} 条</span>
                  </div>
                  <div className="trade-tape-list">
                    {marketPublicTrades.slice(0, 6).map((item, index) => (
                      <div key={`${item.occurred_at}-${item.price}-${index}`} className="trade-tape-row trade-tape-row--fade" style={{ animationDelay: `${index * 24}ms` }}>
                        <span className={`trade-tape-row__badge ${marketTradeSideClass(item.side)}`}>
                          {marketTradeSideLabel(item.side)}
                        </span>
                        <strong className={marketTradeSideClass(item.side)}>{formatNumber(item.price)}</strong>
                        <span>{formatNumber(item.size)}</span>
                        <span>{formatTime(item.occurred_at)}</span>
                      </div>
                    ))}
                    {marketPublicTrades.length === 0 && (
                      <div className="empty-state empty-state--inline">当前没有可展示的公共成交流。</div>
                    )}
                  </div>
                </div>
              </div>

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
          <section key={activeSection} className="section-grid section-grid--strategy section-entrance">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">策略管理</span>
                  <h3>模板策略与 Python 策略</h3>
                </div>
                <span className="chip chip--muted">规则策略 + AI 调参</span>
              </div>
              <div className="strategy-list">
                {strategies.map((strategy, index) => (
                  <button
                    key={strategy.id}
                    type="button"
                    className={`strategy-item strategy-item--fade ${selectedStrategy?.id === strategy.id ? 'active' : ''}`}
                    style={{ animationDelay: `${index * 40}ms` }}
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
                    </div>
                  </div>
                  <div className="terminal-summary-strip terminal-summary-strip--compact strategy-summary-strip">
                    <div className="terminal-summary-strip__item">
                      <span>类型</span>
                      <strong>{selectedStrategy.category === 'template' ? '模板策略' : 'Python 策略'}</strong>
                    </div>
                    <div className="terminal-summary-strip__item">
                      <span>版本 / 模式</span>
                      <strong>{selectedStrategy.version} · {selectedStrategy.mode.toUpperCase()}</strong>
                    </div>
                    <div className="terminal-summary-strip__item">
                      <span>7 日收益</span>
                      <strong>{selectedStrategy.pnl_7d}</strong>
                    </div>
                    <div className="terminal-summary-strip__item">
                      <span>最大回撤</span>
                      <strong>{selectedStrategy.max_drawdown}</strong>
                    </div>
                    <div className="terminal-summary-strip__item">
                      <span>最新回测</span>
                      <strong>{latestStrategyBacktest?.metrics.annual_return ?? '--'}</strong>
                    </div>
                    <div className="terminal-summary-strip__item">
                      <span>待处理提案</span>
                      <strong>{openStrategyProposals.length} 条</strong>
                    </div>
                    <div className="terminal-summary-strip__item" title={selectedStrategyRuntime?.note ?? '等待运行态刷新'}>
                      <span>运行信号</span>
                      <strong className={selectedStrategyRuntime ? strategyRuntimeSignalToneClass(selectedStrategyRuntime.signal) : ''}>
                        {selectedStrategyRuntime ? strategyRuntimeSignalLabel(selectedStrategyRuntime.signal) : '--'}
                      </strong>
                    </div>
                    <div className="terminal-summary-strip__item" title={selectedStrategyRuntime?.next_action ?? '等待运行态刷新'}>
                      <span>运行置信度</span>
                      <strong>{selectedStrategyRuntime ? `${selectedStrategyRuntime.confidence.toFixed(1)}%` : '--'}</strong>
                    </div>
                  </div>
                  {selectedStrategyRuntimePreview && (
                    <div
                      className={`terminal-summary-strip terminal-summary-strip--compact strategy-execution-strip ${
                        selectedStrategyRuntimePreview.allowed === false ? 'strategy-execution-strip--blocked' : ''
                      }`}
                      title={
                        selectedStrategyRuntimePreview.recommended_action
                          ? `${selectedStrategyRuntimePreview.blocked_reason ?? selectedStrategyRuntimePreview.warnings?.[0] ?? selectedStrategyRuntimePreview.action ?? '等待执行预估'} 建议 ${selectedStrategyRuntimePreview.recommended_action}`
                          : selectedStrategyRuntimePreview.blocked_reason ??
                            selectedStrategyRuntimePreview.warnings?.[0] ??
                            selectedStrategyRuntimePreview.action ??
                            '等待执行预估'
                      }
                    >
                      <div className="terminal-summary-strip__item">
                        <span>执行预估</span>
                        <strong
                          className={
                            selectedStrategyRuntimePreview.allowed === false
                              ? 'negative'
                              : selectedStrategyRuntimePreview.action
                                ? 'positive'
                                : ''
                          }
                        >
                          {selectedStrategyRuntimePreview.action ?? '--'}
                        </strong>
                        <small>
                          {selectedStrategyRuntimePreview.blocked_reason ??
                            selectedStrategyRuntimePreview.warnings?.[0] ??
                            `由策略运行态和当前${selectedMode === 'paper' ? '纸面' : selectedMode.toUpperCase()}执行链路共同给出`}
                        </small>
                        {selectedStrategyRuntimePreview.recommended_action && (
                          <small>建议 {selectedStrategyRuntimePreview.recommended_action}</small>
                        )}
                      </div>
                      <div className="terminal-summary-strip__item">
                        <span>仓位影响</span>
                        <strong>
                          {selectedStrategyRuntimePreview.current_position_side &&
                          selectedStrategyRuntimePreview.projected_position_side
                            ? `${positionSideLabel(selectedStrategyRuntimePreview.current_position_side)} → ${positionSideLabel(selectedStrategyRuntimePreview.projected_position_side)}`
                            : selectedStrategyRuntimePreview.current_position_side
                              ? positionSideLabel(selectedStrategyRuntimePreview.current_position_side)
                              : '--'}
                        </strong>
                        <small>
                          {selectedStrategyRuntimePreview.current_position_size &&
                          selectedStrategyRuntimePreview.projected_position_size
                            ? `${selectedStrategyRuntimePreview.current_position_size} → ${selectedStrategyRuntimePreview.projected_position_size}`
                            : selectedStrategyRuntimePreview.current_position_size
                              ? `当前 ${selectedStrategyRuntimePreview.current_position_size}`
                              : '等待后端返回执行预估'}
                        </small>
                      </div>
                      <div className="terminal-summary-strip__item">
                        <span>余额 / 盈亏</span>
                        <strong>
                          {selectedStrategyRuntimePreview.available_balance_before &&
                          selectedStrategyRuntimePreview.available_balance_after
                            ? `${selectedStrategyRuntimePreview.available_balance_before} → ${selectedStrategyRuntimePreview.available_balance_after}`
                            : '--'}
                        </strong>
                        <small>
                          {formatStrategySizingSummary(selectedStrategyRuntimePreview) ??
                            selectedStrategyRuntimePreview.estimated_realized_pnl ??
                            `预估已实现盈亏会在${selectedMode === 'paper' ? '执行预检' : `${selectedMode.toUpperCase()} 预检`}可用时显示`}
                        </small>
                      </div>
                    </div>
                  )}

                  <div className="hero-actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => setStrategyEditorOpen(true)}
                    >
                      编辑参数 / 风控
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={
                        !serviceAvailable ||
                        executeStrategySignalMutation.isPending ||
                        !selectedStrategyRuntimePreview ||
                        !selectedStrategyRuntimePreview.allowed
                      }
                      title={
                        !selectedStrategyRuntimePreview
                          ? '等待策略运行态返回执行预估'
                          : !selectedStrategyRuntimePreview.allowed
                            ? selectedStrategyRuntimePreview.recommended_action
                              ? `${selectedStrategyRuntimePreview.blocked_reason ?? '当前策略执行预估未通过'} 建议 ${selectedStrategyRuntimePreview.recommended_action}`
                              : selectedStrategyRuntimePreview.blocked_reason ?? '当前策略执行预估未通过'
                            : selectedMode === 'paper'
                              ? '按当前策略信号写入一笔 Paper 执行'
                              : '按当前策略信号向 Bybit 提交真实委托'
                      }
                      onClick={executeSelectedStrategySignal}
                    >
                      {selectedMode === 'paper' ? '执行当前信号' : '提交真实委托'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => setStrategyActivityPanelOpen(true)}
                    >
                      最近活动
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={!serviceAvailable || strategyTrackingMutation.isPending}
                      onClick={() => openStrategyTrackingPanel('issue')}
                    >
                      发起跟踪
                    </button>
                    {selectedStrategyNeedsRuntimeRecovery && (
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={!serviceAvailable || restartRuntimeWorkerMutation.isPending}
                        title={runtimeWorkerRestoreHint}
                        onClick={() => {
                          void restartStrategyRuntimeWorker()
                        }}
                      >
                        恢复运行线程
                      </button>
                    )}
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={!serviceAvailable || backtestMutation.isPending}
                      onClick={submitBacktest}
                    >
                      发起回测
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
                  </div>

                  {(hasParameterDraftChanges || riskBudgetChanged) && (
                    <p className="panel-note">
                      当前有未提交修改: 参数 {Object.keys(parameterDraftPatch).length} 项，风险预算 {riskBudgetChanged ? '已修改' : '未修改'}。
                    </p>
                  )}

                  {selectedStrategyRuntime && (
                    <p className="panel-note">
                      运行态:{' '}
                      {strategyRuntimeGuardLabel(selectedStrategyRuntime)
                        ? `${strategyRuntimeGuardLabel(selectedStrategyRuntime)} · ${selectedStrategyRuntime.note}`
                        : selectedStrategyRuntime.note}{' '}
                      · 仓位 {strategyPositionAlignmentLabel(selectedStrategyRuntime)}
                      {selectedStrategyRuntime.position_alignment_detail ? ` (${selectedStrategyRuntime.position_alignment_detail})` : ''}
                      {strategyCurrentPositionLabel(selectedStrategyRuntime)
                        ? ` · ${strategyCurrentPositionLabel(selectedStrategyRuntime)}`
                        : ''}
                      {' '}
                      下一步 {selectedStrategyRuntime.next_action}
                      {selectedStrategyRuntime.active_order
                        ? ` · 关联委托 ${selectedStrategyRuntime.active_order.side === 'buy' ? '买入' : '卖出'} ${selectedStrategyRuntime.active_order.qty}@${selectedStrategyRuntime.active_order.price} (${selectedStrategyRuntime.active_order.status})`
                        : selectedStrategyRuntime.active_order_count > 0
                          ? ` · 当前关联委托 ${selectedStrategyRuntime.active_order_count} 笔`
                          : ''}
                    </p>
                  )}

                  {selectedStrategyReview && (
                    <p className="panel-note">
                      最近 AI 复盘: {selectedStrategyReview.summary}
                    </p>
                  )}

                  <div className="composite-grid">
                      <div className="console-panel console-panel--stream">
                      <div className="panel-head panel-head--compact">
                        <div>
                          <span className="section-label">最新回测与请求</span>
                          <h3>围绕当前策略的执行上下文</h3>
                        </div>
                        <span className="chip chip--muted">{selectedStrategy.symbols.join(' / ')}</span>
                      </div>
                      {latestStrategyBacktest ? (
                        <div className="stack-list">
                          <div className="stack-row">
                            <strong>回测区间</strong>
                            <span>{latestStrategyBacktest.data_range}</span>
                          </div>
                          <div className="stack-row">
                            <strong>数据与滑点</strong>
                            <span>{latestStrategyBacktest.data_granularity} · {latestStrategyBacktest.slippage_model}</span>
                          </div>
                          <div className="stack-row">
                            <strong>收益 / 回撤 / 夏普</strong>
                            <span>
                              {latestStrategyBacktest.metrics.annual_return} · {latestStrategyBacktest.metrics.max_drawdown} · {latestStrategyBacktest.metrics.sharpe}
                            </span>
                          </div>
                          <div className="stack-row">
                            <strong>成交数</strong>
                            <span>{latestStrategyBacktest.metrics.trades} 笔</span>
                          </div>
                          {selectedStrategyRuntime && (
                            <div className="stack-row">
                              <strong>运行态</strong>
                              <span>
                                <span className={strategyRuntimeSignalToneClass(selectedStrategyRuntime.signal)}>
                                  {strategyRuntimeSignalLabel(selectedStrategyRuntime.signal)}
                                </span>
                                {' · '}
                                参考价 {formatNumber(selectedStrategyRuntime.reference_price)}
                                {' · '}
                                最新 {formatNumber(selectedStrategyRuntime.last_price)}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="empty-state empty-state--inline">当前策略还没有回测记录</div>
                      )}
                      <div className="watchlist-module__header">
                        <span className="section-label">待落实 ChangeRequest</span>
                        <strong>{strategyChangeRequests.length} 条</strong>
                      </div>
                      <div className="job-list">
                        {strategyChangeRequests.map((request, index) => (
                          <div key={request.id} className="job-row job-row--fade" style={{ animationDelay: `${index * 28}ms` }}>
                            <div className="console-row__main">
                              <strong>{request.summary}</strong>
                              <p>{request.type} · {request.requested_by}</p>
                            </div>
                            <div className="job-meta">
                              <span className="console-tag">{changeRequestStatusLabel(request.status)}</span>
                              <small>{formatTime(request.updated_at)}</small>
                            </div>
                          </div>
                        ))}
                        {strategyChangeRequests.length === 0 && (
                          <div className="empty-state empty-state--inline">当前策略没有待落实的请求</div>
                        )}
                      </div>
                    </div>

                      <div className="console-panel console-panel--stream">
                      <div className="panel-head panel-head--compact">
                        <div>
                          <span className="section-label">AI 提案</span>
                          <h3>接受后会直接进入控制链路</h3>
                        </div>
                        <span className="chip chip--warning">{openStrategyProposals.length} 条待处理</span>
                      </div>
                      {gatedPublishProposalCount > 0 && (
                        <p className="panel-note">
                          当前有 {gatedPublishProposalCount} 条发布建议；若启用人工接管或冻结自动发布，前端会直接禁止接受。
                        </p>
                      )}
                      <div className="job-list">
                        {strategyProposals.map((proposal, index) => (
                          <div key={proposal.id} className="job-row job-row--fade" style={{ animationDelay: `${index * 28}ms` }}>
                            <div className="console-row__main">
                              <strong>{proposal.title}</strong>
                              <p>{proposalTypeLabel(proposal.proposal_type)} · {proposal.expected_impact}</p>
                            </div>
                            <div className="job-meta">
                              <span className="console-tag">{proposalStatusLabel(proposal.status)}</span>
                              <small>{formatTime(proposal.created_at)}</small>
                            </div>
                          </div>
                        ))}
                        {strategyProposals.length === 0 && (
                          <div className="empty-state empty-state--inline">当前策略暂时没有 AI 提案</div>
                        )}
                      </div>
                      {strategyProposals.length > 0 && (
                        <div className="inline-actions">
                          {strategyProposals
                            .filter((proposal) => proposal.status === 'pending' || proposal.status === 'testing')
                            .slice(0, 2)
                            .map((proposal) => {
                              const blockedReason = proposalAcceptBlockedReason(proposal.proposal_type, snapshot?.scheduler)
                              return (
                              <div key={`${proposal.id}-actions`} className="toggle-card__actions">
                                <button
                                  type="button"
                                  title={blockedReason ?? `接受 ${proposalTypeLabel(proposal.proposal_type)}`}
                                  disabled={!serviceAvailable || proposalMutation.isPending || Boolean(blockedReason)}
                                  onClick={() => handleProposalAction(proposal.id, 'accept')}
                                >
                                  接受 {proposalTypeLabel(proposal.proposal_type)}
                                </button>
                                <button
                                  type="button"
                                  disabled={!serviceAvailable || proposalMutation.isPending}
                                  onClick={() => handleProposalAction(proposal.id, 'reject')}
                                >
                                  拒绝
                                </button>
                              </div>
                            )})}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state">暂无策略数据</div>
              )}
            </article>
          </section>
        )}

        {activeSection === 'backtest' && (
          <section key={activeSection} className="section-grid section-entrance">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">回测工作台</span>
                  <h3>按策略研究、筛选和比较回测</h3>
                </div>
                <div className="chip-row">
                  <span className="chip chip--muted">
                    {backtestFilter === 'selected' ? '仅当前策略' : '全策略'}
                  </span>
                  <span className="chip chip--muted">{selectedStrategy?.name ?? '等待策略'}</span>
                </div>
              </div>
              <div className="console-strip console-strip--compact backtest-summary-strip">
                <div>
                  <span>当前策略</span>
                  <strong>{selectedStrategy?.name ?? '--'}</strong>
                </div>
                <div>
                  <span>记录数</span>
                  <strong>{backtestsForWorkspace.length} 组</strong>
                </div>
                <div>
                  <span>最近结果</span>
                  <strong>{latestWorkspaceBacktest?.metrics.annual_return ?? '--'}</strong>
                </div>
                <div>
                  <span>AI 提案</span>
                  <strong>{openStrategyProposals.length} 条</strong>
                </div>
              </div>
              <div className="field-grid backtest-field-grid">
                <label className="field">
                  <span>策略</span>
                  <select
                    value={selectedStrategy?.id ?? ''}
                    onChange={(event) => setSelectedStrategyId(event.target.value)}
                  >
                    {strategies.map((strategy) => (
                      <option key={strategy.id} value={strategy.id}>
                        {strategy.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>时间周期</span>
                  <select
                    value={backtestTimeframeDraft}
                    onChange={(event) => setBacktestTimeframeDraft(event.target.value)}
                  >
                    {backtestTimeframePresets.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>区间</span>
                  <select value={backtestRangeDraft} onChange={(event) => setBacktestRangeDraft(event.target.value)}>
                    {backtestRangePresets.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>结果视图</span>
                  <select
                    value={backtestFilter}
                    onChange={(event) => setBacktestFilter(event.target.value as 'selected' | 'all')}
                  >
                    <option value="selected">仅当前策略</option>
                    <option value="all">全部策略</option>
                  </select>
                </label>
              </div>
              <div className="hero-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={!serviceAvailable || backtestMutation.isPending || !selectedStrategy}
                  onClick={submitBacktest}
                >
                  发起回测
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => startTransition(() => openSection('strategy'))}
                >
                  返回策略页
                </button>
              </div>
              <div className="terminal-block__head terminal-block__head--compact backtest-list-head">
                <div>
                  <span className="section-label">结果列表</span>
                  <h3>终端式回测时间线</h3>
                </div>
              </div>
              <div className="job-list">
                {backtestsForWorkspace.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`job-row job-row--selectable job-row--fade ${selectedBacktest?.id === item.id ? 'job-row--active' : ''}`}
                    style={{ animationDelay: `${index * 28}ms` }}
                    onClick={() => setSelectedBacktestId(item.id)}
                  >
                    <div className="console-row__main">
                      <strong>{item.strategy_name}</strong>
                      <p>{item.data_range} · {item.timeframe} · {item.metrics.annual_return}</p>
                    </div>
                    <div className="job-meta">
                      <span className="console-tag">{item.status}</span>
                      <small>{formatTime(item.finished_at ?? item.started_at)}</small>
                    </div>
                  </button>
                ))}
                {backtestsForWorkspace.length === 0 && (
                  <div className="empty-state empty-state--inline">当前筛选条件下还没有回测记录</div>
                )}
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">回测详情</span>
                  <h3>{selectedBacktest?.strategy_name ?? '等待选择回测结果'}</h3>
                </div>
                {selectedBacktest && <span className="chip chip--warning">{selectedBacktest.timeframe}</span>}
              </div>
              {selectedBacktest ? (
                <>
                  <div className="status-strip">
                    <div>
                      <span>年化收益</span>
                      <strong>{selectedBacktest.metrics.annual_return}</strong>
                    </div>
                    <div>
                      <span>最大回撤</span>
                      <strong>{selectedBacktest.metrics.max_drawdown}</strong>
                    </div>
                    <div>
                      <span>净收益</span>
                      <strong>{selectedBacktest.metrics.pnl}</strong>
                    </div>
                    <div>
                      <span>成交数</span>
                      <strong>{selectedBacktest.metrics.trades}</strong>
                    </div>
                  </div>
                  <div className="composite-grid">
                    <div className="console-panel">
                      <div className="panel-head panel-head--compact">
                        <div>
                          <span className="section-label">实验环境</span>
                          <h3>区间、成本与执行假设</h3>
                        </div>
                      </div>
                      <div className="stack-list">
                        <div className="stack-row">
                          <strong>回测区间</strong>
                          <span>{selectedBacktest.data_range}</span>
                        </div>
                        <div className="stack-row">
                          <strong>数据粒度</strong>
                          <span>{selectedBacktest.data_granularity}</span>
                        </div>
                        <div className="stack-row">
                          <strong>手续费 / 滑点</strong>
                          <span>{selectedBacktest.fee_model} · {selectedBacktest.slippage_model}</span>
                        </div>
                        <div className="stack-row">
                          <strong>起止时间</strong>
                          <span>
                            {formatTime(selectedBacktest.started_at)}
                            {' -> '}
                            {formatTime(selectedBacktest.finished_at ?? selectedBacktest.started_at)}
                          </span>
                        </div>
                        <div className="stack-row">
                          <strong>说明</strong>
                          <span>{selectedBacktest.notes}</span>
                        </div>
                      </div>
                    </div>
                    <div className="console-panel">
                      <div className="panel-head panel-head--compact">
                        <div>
                          <span className="section-label">参数对比</span>
                          <h3>当前策略 vs 回测快照</h3>
                        </div>
                      </div>
                      <div className="job-list">
                        {backtestParameterComparison.map((item) => (
                          <div key={item.key} className="job-row">
                            <div className="console-row__main">
                              <strong>{item.label}</strong>
                              <p>快照 {item.backtestValue} · 当前 {item.currentValue}</p>
                            </div>
                            <div className="job-meta">
                              <span className={`console-tag ${item.changed ? 'console-tag--warn' : ''}`}>
                                {item.changed ? '已变更' : '一致'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="console-panel backtest-linked-panel">
                    <div className="panel-head panel-head--compact">
                      <div>
                        <span className="section-label">关联 AI 上下文</span>
                        <h3>复盘摘要与待处理提案</h3>
                      </div>
                    </div>
                    {selectedStrategyReview ? (
                      <>
                        <p className="panel-note">{selectedStrategyReview.summary}</p>
                        <div className="job-list">
                          {strategyProposals.map((proposal) => (
                            <div key={proposal.id} className="job-row">
                              <div className="console-row__main">
                                <strong>{proposal.title}</strong>
                                <p>{proposalTypeLabel(proposal.proposal_type)} · {proposal.expected_impact}</p>
                              </div>
                              <div className="job-meta">
                                <span className="console-tag">{proposalStatusLabel(proposal.status)}</span>
                                <small>{formatTime(proposal.created_at)}</small>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="empty-state empty-state--inline">当前策略还没有关联的 AI 复盘记录</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state">暂无回测记录</div>
              )}
            </article>
          </section>
        )}

        {activeSection === 'scheduler' && (
          <section key={activeSection} className="section-grid section-entrance">
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
                  onClick={() =>
                    runSchedulerCommand(
                      snapshot?.scheduler.status === 'paused' ? 'resume' : 'pause',
                      snapshot?.scheduler.status === 'paused' ? '桌面端恢复 AI 调度' : '桌面端暂停 AI 调度',
                    )
                  }
                >
                  {snapshot?.scheduler.status === 'paused' ? '恢复调度' : '暂停调度'}
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
                  onClick={() => setSchedulerControlsOpen(true)}
                >
                  更多控制
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setGrafanaPreviewOpen(true)}
                >
                  监控预览
                </button>
              </div>
              {(snapshot?.scheduler.freeze_publish || snapshot?.scheduler.status === 'manual_override') && (
                <div className="service-banner service-banner--warning service-banner--inline">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>发布门禁已开启</strong>
                    <p>
                      {snapshot?.scheduler.status === 'manual_override'
                        ? '当前处于人工接管状态，发布建议不会自动落地。'
                        : '当前已冻结自动发布，发布建议需要先解除冻结后才能接受。'}
                    </p>
                  </div>
                </div>
              )}
              <div className="terminal-summary-strip terminal-summary-strip--compact scheduler-summary-strip">
                <div className="terminal-summary-strip__item">
                  <span>当前模式</span>
                  <strong>{snapshot?.scheduler.current_mode.toUpperCase()}</strong>
                </div>
                <div className="terminal-summary-strip__item">
                  <span>OpenClaw</span>
                  <strong>{openClawStatus?.reachable ? '已连通' : '待接通'}</strong>
                </div>
                <div className="terminal-summary-strip__item">
                  <span>心跳</span>
                  <strong>{formatTime(snapshot?.scheduler.last_heartbeat_at)}</strong>
                </div>
                <div className="terminal-summary-strip__item">
                  <span>发布门禁</span>
                  <strong>
                    {snapshot?.scheduler.status === 'manual_override'
                      ? '人工接管'
                      : snapshot?.scheduler.freeze_publish
                        ? '已冻结'
                        : '开放'}
                  </strong>
                </div>
              </div>
              {(!openClawStatus?.reachable || snapshot?.scheduler.status === 'degraded') &&
                (openClawStatus?.status_output || openClawStatus?.health_output) && (
                <div className="api-panel api-panel--bottom">
                  <span className="section-label">OpenClaw 运行状态</span>
                  <p>{openClawStatus.status_output ?? openClawStatus.health_output}</p>
                </div>
              )}
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">队列与实时轨迹</span>
                  <h3>当前任务与 AI 操作日志</h3>
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
              <div className="record-stack record-stack--terminal">
                <div className="console-panel console-panel--stream">
                  <div className="watchlist-module__header">
                    <span className="section-label">任务队列</span>
                    <strong>{scheduler?.jobs.length ?? 0} 条</strong>
                  </div>
                  <div className="job-list">
                    {scheduler?.jobs.map((job, index) => (
                      <div
                        key={job.id}
                        className={`job-row job-row--fade${aiSchedulerFocusedJobId === job.id ? ' job-row--active' : ''}`}
                        style={{ animationDelay: `${index * 26}ms` }}
                      >
                        <div className="console-row__main">
                          <strong>
                            <Bot size={13} />
                            任务 · {job.job_type}
                          </strong>
                          <p>
                            {job.result_summary || Object.keys(job.context).join(' · ') || '上下文待写入'}
                            {getAgentJobRetryCount(job) > 0 ? ` · 第 ${getAgentJobRetryCount(job)} 次重试` : ''}
                            {getAgentJobRetriedFrom(job) ? ` · 源任务 ${getAgentJobRetriedFrom(job)}` : ''}
                          </p>
                        </div>
                      <div className="job-meta">
                        <span className={jobStatusToneClass(job.status)}>{jobStatusLabel(job.status)}</span>
                        {getAgentJobLinkedReviewPeriod(job) && (
                          <span className={reviewPeriodChipClass(getAgentJobLinkedReviewPeriod(job))}>
                            {reviewPeriodLabel(getAgentJobLinkedReviewPeriod(job))}
                          </span>
                        )}
                        {getAgentJobLinkedReviewId(job) && (
                          <button
                            type="button"
                            className="micro-action"
                            onClick={() =>
                              openReviewInspector(getAgentJobLinkedReviewId(job), getAgentJobStrategyId(job))
                            }
                          >
                            查看结果
                          </button>
                        )}
                        {getAgentJobStrategyId(job) && (
                          <button
                            type="button"
                            className="micro-action"
                            onClick={() => openStrategyActivity(getAgentJobStrategyId(job))}
                          >
                            打开策略
                          </button>
                        )}
                        {canRetryAgentJob(job.status) && (
                          <button
                            type="button"
                            className="micro-action"
                              disabled={!serviceAvailable || retryAgentJobMutation.isPending}
                              onClick={() => retryAgentJob(job.id)}
                            >
                              重试
                            </button>
                          )}
                          <small>{formatTime(job.updated_at)}</small>
                        </div>
                      </div>
                    ))}
                    {!scheduler?.jobs.length && <div className="empty-state empty-state--inline">当前没有排队任务</div>}
                  </div>
                </div>
                <div className="console-panel console-panel--stream">
                  <div className="watchlist-module__header">
                    <span className="section-label">AI 实时操作</span>
                    <strong>{aiActivityFeed.length} 条</strong>
                  </div>
                  <div className="job-list">
                    {aiActivityFeed.map((event, index) => (
                      (() => {
                        const meta = eventCategoryMeta(event.event_type)
                        const Icon = meta.icon
                        return (
                          <div key={event.id} className="job-row job-row--fade" style={{ animationDelay: `${index * 26}ms` }}>
                            <div className="console-row__main">
                              <strong>
                                <Icon size={13} />
                                {meta.label} · {event.event_type}
                              </strong>
                              <p>{event.source === 'openclaw' ? 'OpenClaw' : '桌面控制端'} · {event.symbol ?? '系统'} · {event.strategy_id ?? '无策略'}</p>
                            </div>
                            <div className="job-meta">
                              <span className="console-tag">{event.severity}</span>
                              {getAuditLinkedReviewId(event.payload) && (
                                <button
                                  type="button"
                                  className="micro-action"
                                  onClick={() =>
                                    openReviewInspector(
                                      getAuditLinkedReviewId(event.payload),
                                      event.strategy_id ?? getAuditStrategyId(event.payload),
                                    )
                                  }
                                >
                                  查看结果
                                </button>
                              )}
                              {!getAuditLinkedReviewId(event.payload) && (event.strategy_id || getAuditStrategyId(event.payload)) && (
                                <button
                                  type="button"
                                  className="micro-action"
                                  onClick={() => openStrategyActivity(event.strategy_id ?? getAuditStrategyId(event.payload))}
                                >
                                  打开策略
                                </button>
                              )}
                              <small>{formatTime(event.occurred_at)}</small>
                            </div>
                          </div>
                        )
                      })()
                    ))}
                  </div>
                </div>
              </div>
            </article>
          </section>
        )}

        {activeSection === 'news' && (
          <section key={activeSection} className="section-grid section-entrance">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">新闻事件</span>
                  <h3>与持仓和波动相关的情报</h3>
                </div>
                <span className="chip chip--muted">Bybit 公告 · 宏观日历 · 事件流</span>
              </div>
              <div className="news-grid news-grid--compact">
                {news.map((item, index) => (
                  <article key={item.id} className="news-card news-card--fade" style={{ animationDelay: `${index * 36}ms` }}>
                    <div className="news-head">
                      <span className="chip chip--muted">{item.symbols.join(', ') || '全市场'}</span>
                      <span className={`chip ${item.impact_score >= 75 ? 'chip--warning' : 'chip--success'}`}>
                        {item.impact_score >= 75 ? '高影响' : '中影响'}
                      </span>
                      {item.related_alert_ids.length ? <span className="chip chip--warning">已生成提醒</span> : null}
                    </div>
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                    <div className="inline-actions inline-actions--tight">
                      <small>{item.source} · {formatTime(item.published_at)}</small>
                      {item.url ? (
                        <a
                          className="ghost-button ghost-button--inline"
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          打开原文
                        </a>
                      ) : null}
                      {item.related_alert_ids.length ? (
                        <button
                          type="button"
                          className="ghost-button ghost-button--inline"
                          onClick={() => startTransition(() => openSection('alerts'))}
                        >
                          查看提醒
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeSection === 'alerts' && (
          <section key={activeSection} className="section-grid section-entrance">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">提醒中心</span>
                  <h3>风险、新闻与回测提醒</h3>
                </div>
                <span className="chip chip--warning">
                  未处理 {opsLive?.summary.pending_alerts ?? pendingAlertsCount} · P0 {opsLive?.summary.p0_alerts ?? 0}
                </span>
              </div>
              <div className="ops-toolbar">
                <div className="ops-toolbar__group">
                  <span className="section-label">级别</span>
                  {(['all', 'P0', 'P1', 'P2'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`pill pill--compact ${alertSeverityFilter === value ? 'active' : ''}`}
                      onClick={() => setAlertSeverityFilter(value)}
                    >
                      {value === 'all' ? '全部' : value}
                    </button>
                  ))}
                </div>
                <div className="ops-toolbar__group">
                  <span className="section-label">状态</span>
                  {([
                    ['pending', '待处理'],
                    ['acknowledged', '已确认'],
                    ['all', '全部'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`pill pill--compact ${alertStatusFilter === value ? 'active' : ''}`}
                      onClick={() => setAlertStatusFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`pill pill--compact ${alertScopeFilter === 'selected' ? 'active' : ''}`}
                    onClick={() =>
                      setAlertScopeFilter((current) => (current === 'selected' ? 'all' : 'selected'))
                    }
                  >
                    {alertScopeFilter === 'selected' ? `${selectedSymbol}` : '当前品种'}
                  </button>
                </div>
                <span className="chip chip--muted">{settings?.notification_channels.join(' / ')}</span>
              </div>
              <div className="alert-list alert-list--compact">
                {filteredAlerts.map((alert, index) => {
                  const sourceMeta = alertSourceMeta(alert.source_type)
                  const SourceIcon = sourceMeta.icon
                  return (
                    <div key={alert.id} className="alert-row alert-row--fade" style={{ animationDelay: `${index * 26}ms` }}>
                      <div>
                        <strong>{alert.title}</strong>
                        <p>
                          <span className="alert-row__source">
                            <SourceIcon size={12} />
                            {sourceMeta.label}
                          </span>
                          {typeof alert.trigger_value === 'number' && typeof alert.threshold_value === 'number'
                            ? ` · 触发 ${formatPercent(alert.trigger_value)} / 阈值 ${alert.threshold_value.toFixed(2)}%`
                            : ''}
                          {' · '}
                          {alert.description}
                          {' · '}
                          建议 {alert.suggested_action}
                        </p>
                      </div>
                      <div className="alert-meta">
                        <span className={`chip ${alert.acknowledged ? 'chip--muted' : 'chip--success'}`}>
                          {alert.acknowledged ? '已确认' : '待处理'}
                        </span>
                        <span className={`status-chip status-${alert.severity.toLowerCase()}`}>{alert.severity}</span>
                        <div className="inline-actions inline-actions--tight">
                          {alert.symbol ? (
                            <button
                              type="button"
                              className="ghost-button ghost-button--inline"
                              onClick={() => {
                                startTransition(() => setSelectedSymbol(alert.symbol))
                                startTransition(() => openSection('market'))
                              }}
                            >
                              查看行情
                            </button>
                          ) : null}
                          {alert.source_type === 'rule' ? (
                            <button
                              type="button"
                              className="ghost-button ghost-button--inline"
                              onClick={() => setWatchlistManagerOpen(true)}
                            >
                              自选规则
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="ghost-button ghost-button--inline"
                            disabled={alertMutation.isPending}
                            onClick={() => toggleAlertAcknowledged(alert.id, !alert.acknowledged)}
                          >
                            {alert.acknowledged ? '恢复提醒' : '确认已读'}
                          </button>
                        </div>
                        <small>{formatTime(alert.triggered_at)}</small>
                      </div>
                    </div>
                  )
                })}
                {filteredAlerts.length === 0 && <div className="empty-state empty-state--inline">当前筛选下没有提醒</div>}
              </div>
            </article>
          </section>
        )}

        {activeSection === 'trades' && (
          <section key={activeSection} className="section-grid section-entrance">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">账户与委托</span>
                  <h3>账户总览、持仓与未成交委托</h3>
                </div>
                <div className="chip-row">
                  <span className={`chip ${bybitPrivateStatus?.can_query_private ? 'chip--success' : 'chip--warning'}`}>
                    {bybitPrivateStatus?.can_query_private ? 'Bybit 私有 API 已接通' : 'Bybit 私有 API 未配置'}
                  </span>
                  <button
                    type="button"
                    className="ghost-button ghost-button--inline"
                    onClick={() => setAccountInspectorOpen(true)}
                  >
                    账户详情
                  </button>
                </div>
              </div>
              <div className="status-strip status-strip--compact status-strip--account">
                <div>
                  <span>总权益</span>
                  <strong>{accountOverview?.total_equity ?? '--'}</strong>
                </div>
                <div>
                  <span>可用余额</span>
                  <strong>{accountOverview?.total_available_balance ?? '--'}</strong>
                </div>
                <div>
                  <span>已实现盈亏</span>
                  <strong className={pnlToneClass(snapshot?.today_performance.realized_pnl)}>
                    {snapshot?.today_performance.realized_pnl ?? '--'}
                  </strong>
                </div>
                <div>
                  <span>未实现盈亏</span>
                  <strong className={pnlToneClass(accountOverview?.unrealised_pnl)}>{accountOverview?.unrealised_pnl ?? '--'}</strong>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">持仓与委托</span>
                  <h3>当前仓位、挂单和成交记录</h3>
                </div>
                <div className="inline-actions inline-actions--tight">
                  <span className="chip chip--muted">
                    成交 {opsLive?.summary.recent_trades ?? trades.length} · 手动 {opsLive?.summary.manual_trades ?? 0} · 来源 {accountSourceLabel(accountOverview?.source)}
                  </span>
                  <button
                    type="button"
                    className="ghost-button ghost-button--inline"
                    onClick={() => setOrderHistoryPanelOpen(true)}
                  >
                    历史订单
                  </button>
                </div>
              </div>
              <div className="ops-toolbar">
                <div className="ops-toolbar__group">
                  <span className="section-label">模式</span>
                  {(['all', 'paper', 'demo', 'live'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`pill pill--compact ${tradeModeFilter === value ? 'active' : ''}`}
                      onClick={() => setTradeModeFilter(value)}
                    >
                      {value === 'all' ? '全部' : value.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="ops-toolbar__group">
                  <span className="section-label">来源</span>
                  {([
                    ['all', '全部'],
                    ['manual', '手动'],
                    ['strategy', '策略'],
                    ['exchange', '交易所'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`pill pill--compact ${tradeOriginFilter === value ? 'active' : ''}`}
                      onClick={() => setTradeOriginFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`pill pill--compact ${tradeScopeFilter === 'selected' ? 'active' : ''}`}
                    onClick={() =>
                      setTradeScopeFilter((current) => (current === 'selected' ? 'all' : 'selected'))
                    }
                  >
                    {tradeScopeFilter === 'selected' ? `${selectedSymbol}` : '当前品种'}
                  </button>
                </div>
              </div>
              <div className="record-stack record-stack--compact">
                <div className="console-panel console-panel--stream">
                  <div className="watchlist-module__header">
                    <div>
                      <span className="section-label">当前持仓</span>
                      <strong>{accountPositions.length} 条</strong>
                    </div>
                    {selectedMode === 'paper' && accountPositions.some((position) => position.source === 'paper') && (
                      <button
                        type="button"
                        className="ghost-button ghost-button--inline"
                        disabled={!serviceAvailable || closeAllPaperPositionsMutation.isPending}
                        onClick={closeAllPaperPositions}
                      >
                        全平
                      </button>
                    )}
                    {selectedMode !== 'paper' && accountPositions.some((position) => position.source === 'bybit_private') && (
                      <button
                        type="button"
                        className="ghost-button ghost-button--inline"
                        disabled={!serviceAvailable || closeAllExchangePositionsMutation.isPending}
                        onClick={closeAllExchangePositions}
                      >
                        全平
                      </button>
                    )}
                  </div>
                  <div className="trade-list trade-list--dense">
                    {accountPositions.map((position, index) => (
                      <div key={`${position.symbol}-${position.side}`} className="trade-row trade-row--fade" style={{ animationDelay: `${index * 24}ms` }}>
                        <div className="console-row__main">
                          <strong>{position.symbol} · {position.side === 'long' ? '多仓' : '空仓'}</strong>
                          <p>
                            均价 {position.avg_price} · 标记价 {position.mark_price} · 数量 {position.size}
                          </p>
                        </div>
                        <div className="trade-meta">
                          <span className="console-tag">{position.market === 'perp' ? '永续' : '现货'}</span>
                          <span className="console-tag">{position.leverage}</span>
                          {position.source === 'paper' && selectedMode === 'paper' && (
                            <button
                              type="button"
                              className="micro-action"
                              disabled={!serviceAvailable || closePaperPositionMutation.isPending}
                              onClick={() => closePaperPosition(position.symbol)}
                            >
                              平仓
                            </button>
                          )}
                          {position.source === 'bybit_private' && selectedMode !== 'paper' && (
                            <button
                              type="button"
                              className="micro-action"
                              disabled={!serviceAvailable || closeExchangePositionMutation.isPending}
                              onClick={() => closeExchangePosition(position.symbol)}
                            >
                              平仓
                            </button>
                          )}
                          <small>{position.unrealised_pnl}</small>
                        </div>
                      </div>
                    ))}
                    {accountPositions.length === 0 && <div className="empty-state empty-state--inline">当前没有持仓数据</div>}
                  </div>
                </div>
                <div className="console-panel">
                  <div className="watchlist-module__header">
                    <div>
                      <span className="section-label">未成交委托</span>
                      <strong>{filteredAccountOrders.length} 条</strong>
                    </div>
                    {selectedMode === 'paper' && filteredAccountOrders.some((order) => order.source === 'paper') && (
                      <button
                        type="button"
                        className="ghost-button ghost-button--inline"
                        disabled={!serviceAvailable || cancelAllPaperOrdersMutation.isPending}
                        onClick={cancelAllPaperOrders}
                      >
                        全撤
                      </button>
                    )}
                    {selectedMode !== 'paper' && filteredAccountOrders.some((order) => order.source === 'bybit_private') && (
                      <button
                        type="button"
                        className="ghost-button ghost-button--inline"
                        disabled={!serviceAvailable || cancelAllExchangeOrdersMutation.isPending}
                        onClick={cancelAllExchangeOrders}
                      >
                        全撤
                      </button>
                    )}
                  </div>
                  <div className="trade-list trade-list--dense">
                    {filteredAccountOrders.map((order, index) => (
                      <div key={order.order_id} className="trade-row trade-row--fade" style={{ animationDelay: `${index * 24}ms` }}>
                        <div className="console-row__main">
                          <strong>{order.symbol} · {order.side === 'buy' ? '买单' : '卖单'}</strong>
                          <p>
                            {order.order_type} · 价格 {order.price} · 数量 {order.qty}
                            {order.origin === 'strategy' && order.strategy_id ? ` · 策略 ${order.strategy_id}` : ''}
                          </p>
                        </div>
                        <div className="trade-meta">
                          <span className="console-tag">{order.market === 'perp' ? '永续' : '现货'}</span>
                          <span className="console-tag">{tradeOriginLabel(order.origin)}</span>
                          <span className="console-tag">{order.status}</span>
                          {order.source === 'paper' && selectedMode === 'paper' && (
                            <>
                              <button
                                type="button"
                                className="micro-action"
                                disabled={!serviceAvailable || replacePaperOrderMutation.isPending}
                                onClick={() => openOrderEditor(order)}
                              >
                                改单
                              </button>
                              <button
                                type="button"
                                className="micro-action"
                                disabled={!serviceAvailable || cancelPaperOrderMutation.isPending}
                                onClick={() => cancelPaperOrder(order.order_id)}
                              >
                                撤单
                              </button>
                            </>
                          )}
                          {order.source === 'bybit_private' && selectedMode !== 'paper' && (
                            <>
                              <button
                                type="button"
                                className="micro-action"
                                disabled={!serviceAvailable || replaceExchangeOrderMutation.isPending}
                                onClick={() => openOrderEditor(order)}
                              >
                                改单
                              </button>
                              <button
                                type="button"
                                className="micro-action"
                                disabled={!serviceAvailable || cancelExchangeOrderMutation.isPending}
                                onClick={() => cancelExchangeOrder(order.order_id)}
                              >
                                撤单
                              </button>
                            </>
                          )}
                          <small>{formatTime(order.created_at)}</small>
                        </div>
                      </div>
                    ))}
                    {filteredAccountOrders.length === 0 && <div className="empty-state empty-state--inline">当前筛选下没有未成交委托</div>}
                  </div>
                </div>
                <div className="console-panel">
                  <div className="watchlist-module__header">
                    <span className="section-label">最近成交</span>
                    <strong>{filteredTrades.length} 条</strong>
                  </div>
                  <div className="trade-list trade-list--dense">
                    {filteredTrades.map((trade, index) => (
                      <div key={trade.id} className="trade-row trade-row--fade" style={{ animationDelay: `${index * 24}ms` }}>
                        <div className="console-row__main">
                          <strong>{trade.symbol} · {trade.side === 'buy' ? '买入' : '卖出'}</strong>
                          <p>{formatNumber(trade.price)} · 数量 {formatNumber(trade.quantity)} · {tradeOriginLabel(trade.origin)}</p>
                        </div>
                        <div className="trade-meta">
                          <span className={`console-tag ${trade.mode === 'live' ? 'console-tag--warn' : ''}`}>
                            {trade.mode.toUpperCase()}
                          </span>
                          <span className="console-tag">{trade.status}</span>
                          <small className={pnlToneClass(trade.pnl)}>{trade.pnl !== '--' ? trade.pnl : formatTime(trade.created_at)}</small>
                        </div>
                      </div>
                    ))}
                    {filteredTrades.length === 0 && <div className="empty-state empty-state--inline">当前筛选下没有成交记录</div>}
                  </div>
                </div>
              </div>
            </article>
          </section>
        )}

        {activeSection === 'replay' && (
          <section key={activeSection} className="two-column replay-layout section-entrance">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">AI 复盘</span>
                  <h3>{replayFocusReview && isStrategyTrackingReview(replayFocusReview.period) ? '策略跟踪结果' : '每日总结与策略提案'}</h3>
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
              {replayFocusReview ? (
                <div className="replay-focus">
                  <div className="replay-focus__summary">
                    <span className={reviewPeriodChipClass(replayFocusReview.period)}>
                      {reviewPeriodLabel(replayFocusReview.period)}
                    </span>
                    <strong>{replayFocusReview.title}</strong>
                    <p>{replayFocusReview.summary}</p>
                    {(replayFocusReview.source_job_type || replayFocusReview.source_job_status) && (
                      <p className="panel-note">
                        {replayFocusReview.source_job_type ? `来源任务 · ${replayFocusReview.source_job_type}` : '来源任务'}
                        {replayFocusReview.source_job_status ? ` · ${jobStatusLabel(replayFocusReview.source_job_status)}` : ''}
                      </p>
                    )}
                    <div className="inline-actions inline-actions--tight">
                      {replayFocusReview.source_job_id && (
                        <button
                          type="button"
                          className="micro-action"
                          onClick={() => openAiSchedulerJob(replayFocusReview.source_job_id)}
                        >
                          打开任务
                        </button>
                      )}
                      {replayFocusReview.strategy_id && (
                        <button
                          type="button"
                          className="micro-action"
                          onClick={() => openStrategyActivity(replayFocusReview.strategy_id)}
                        >
                          打开策略
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="replay-focus__signals">
                    <div>
                      <span>亮点</span>
                      <ul className="replay-bullet-list">
                        {replayFocusReview.highlights.slice(0, 4).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span>风险</span>
                      <ul className="replay-bullet-list replay-bullet-list--warn">
                        {replayFocusReview.risks.slice(0, 4).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  当前还没有{replayTrackingScope === 'selected' && selectedStrategy ? '该策略的' : ''}日报或回测复盘
                  {latestTrackingReview ? '，但已经生成策略跟踪记录。' : ''}
                </div>
              )}
              <div className="replay-tracking-section">
                <div className="panel-head panel-head--compact">
                  <div>
                    <span className="section-label">策略跟踪</span>
                    <h3>问题与变更的后续追踪</h3>
                  </div>
                  <span className="chip chip--muted">{filteredReplayTrackingReviews.length} 条</span>
                </div>
                <div className="chip-row">
                  <button
                    type="button"
                    className={`pill pill--compact ${replayTrackingScope === 'all' ? 'active' : ''}`}
                    onClick={() => setReplayTrackingScope('all')}
                  >
                    全部策略
                  </button>
                  {selectedStrategy && (
                    <button
                      type="button"
                      className={`pill pill--compact ${replayTrackingScope === 'selected' ? 'active' : ''}`}
                      onClick={() => setReplayTrackingScope('selected')}
                    >
                      当前策略
                    </button>
                  )}
                </div>
                <div className="job-list">
                  {filteredReplayTrackingReviews.slice(0, 6).map((review, index) => (
                    <div key={review.id} className="job-row job-row--fade" style={{ animationDelay: `${index * 22}ms` }}>
                      <div className="console-row__main">
                        <strong>
                          <Sparkles size={13} />
                          {review.title}
                        </strong>
                        <p>
                          {replayTrackingScope === 'all' && review.strategy_id
                            ? `${strategyNameMap.get(review.strategy_id) ?? review.strategy_id} · ${review.summary}`
                            : review.summary}
                        </p>
                      </div>
                      <div className="job-meta">
                        <span className={reviewPeriodChipClass(review.period)}>{reviewPeriodLabel(review.period)}</span>
                        {review.source_job_id && (
                          <button
                            type="button"
                            className="micro-action"
                            onClick={() => openAiSchedulerJob(review.source_job_id)}
                          >
                            打开任务
                          </button>
                        )}
                        {review.strategy_id && (
                          <button
                            type="button"
                            className="micro-action"
                            onClick={() => openReviewInspector(review.id, review.strategy_id)}
                          >
                            查看结果
                          </button>
                        )}
                        {review.strategy_id && (
                          <button
                            type="button"
                            className="micro-action"
                            onClick={() => openStrategyActivity(review.strategy_id)}
                          >
                            打开策略
                          </button>
                        )}
                        <small>{formatTime(review.created_at)}</small>
                      </div>
                    </div>
                  ))}
                  {!filteredReplayTrackingReviews.length && (
                    <div className="empty-state empty-state--inline">当前还没有策略问题或变更跟踪记录</div>
                  )}
                </div>
                <div className="panel-head panel-head--compact">
                  <div>
                    <span className="section-label">跟踪任务</span>
                    <h3>最近排队或执行过的 AI 跟踪任务</h3>
                  </div>
                  <span className="chip chip--muted">{filteredReplayTrackingJobs.length} 条</span>
                </div>
                <div className="job-list">
                  {filteredReplayTrackingJobs.slice(0, 6).map((job, index) => (
                    <div key={job.id} className="job-row job-row--fade" style={{ animationDelay: `${index * 22}ms` }}>
                      <div className="console-row__main">
                        <strong>
                          <Bot size={13} />
                          {strategyAgentJobSummary(job)}
                        </strong>
                        <p>
                          {(() => {
                            const strategyId = getAgentJobStrategyId(job)
                            const strategyPrefix =
                              replayTrackingScope === 'all' && strategyId
                                ? `${strategyNameMap.get(strategyId) ?? strategyId} · `
                                : ''
                            return `${strategyPrefix}${job.result_summary || `${job.writeback_target} · ${jobStatusLabel(job.status)}`}`
                          })()}
                        </p>
                      </div>
                      <div className="job-meta">
                        <span className="console-tag">{jobStatusLabel(job.status)}</span>
                        {job.linked_review_period && (
                          <span className={reviewPeriodChipClass(job.linked_review_period)}>
                            {reviewPeriodLabel(job.linked_review_period)}
                          </span>
                        )}
                        {job.linked_review_id && (
                          <button
                            type="button"
                            className="micro-action"
                            onClick={() => openReviewInspector(job.linked_review_id, getAgentJobStrategyId(job))}
                          >
                            查看结果
                          </button>
                        )}
                        {getAgentJobStrategyId(job) && (
                          <button
                            type="button"
                            className="micro-action"
                            onClick={() => openStrategyActivity(getAgentJobStrategyId(job))}
                          >
                            打开策略
                          </button>
                        )}
                        {(job.status === 'failed' || job.status === 'cancelled') && (
                          <button
                            type="button"
                            className="micro-action"
                            disabled={!serviceAvailable || retryAgentJobMutation.isPending}
                            onClick={() => {
                              void retryAgentJob(job.id)
                            }}
                          >
                            重试
                          </button>
                        )}
                        <small>{formatTime(job.updated_at || job.created_at)}</small>
                      </div>
                    </div>
                  ))}
                  {!filteredReplayTrackingJobs.length && (
                    <div className="empty-state empty-state--inline">当前还没有策略跟踪任务</div>
                  )}
                </div>
              </div>
            </article>

            <article className="panel">
                <div className="panel-head">
                  <div>
                    <span className="section-label">提案流</span>
                    <h3>按时间查看待处理策略建议</h3>
                  </div>
                  <span className="chip chip--muted">{replayProposalFeed.length} 条</span>
                </div>
              <div className="job-list">
                {replayProposalFeed.map((item, index) => (
                  <div key={item.proposal.id} className="job-row job-row--fade" style={{ animationDelay: `${index * 26}ms` }}>
                    <div className="console-row__main">
                      <strong>
                        <Sparkles size={13} />
                        {item.proposal.title}
                      </strong>
                      <p>{item.reviewTitle} · {proposalTypeLabel(item.proposal.proposal_type)} · {item.proposal.expected_impact}</p>
                    </div>
                    <div className="job-meta">
                      <span className="console-tag">{proposalStatusLabel(item.proposal.status)}</span>
                      <small>{formatTime(item.proposal.created_at)}</small>
                      {(item.proposal.status === 'pending' || item.proposal.status === 'testing') && (
                        <div className="inline-actions">
                          {(() => {
                            const blockedReason = proposalAcceptBlockedReason(item.proposal.proposal_type, snapshot?.scheduler)
                            return (
                          <button
                            type="button"
                            className="ghost-button ghost-button--inline"
                            title={blockedReason ?? '接受当前提案'}
                            disabled={!serviceAvailable || proposalMutation.isPending || Boolean(blockedReason)}
                            onClick={() => handleProposalAction(item.proposal.id, 'accept')}
                          >
                            接受
                          </button>
                            )
                          })()}
                          <button
                            type="button"
                            className="ghost-button ghost-button--inline"
                            disabled={!serviceAvailable || proposalMutation.isPending}
                            onClick={() => handleProposalAction(item.proposal.id, 'reject')}
                          >
                            拒绝
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {!replayProposalFeed.length && <div className="empty-state empty-state--inline">当前没有可处理的提案</div>}
              </div>
            </article>
          </section>
        )}

        {activeSection === 'audit' && (
          <section key={activeSection} className="section-grid section-entrance">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="section-label">系统日志 / 审计</span>
                  <h3>执行链路与历史追踪</h3>
                </div>
                <span className="chip chip--muted">
                  warning {opsLive?.summary.audit_warnings ?? 0} · critical {opsLive?.summary.audit_critical ?? 0}
                </span>
              </div>
              <div className="ops-toolbar">
                <div className="ops-toolbar__group">
                  <span className="section-label">级别</span>
                  {(['all', 'info', 'warning', 'error', 'critical'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`pill pill--compact ${auditSeverityFilter === value ? 'active' : ''}`}
                      onClick={() => setAuditSeverityFilter(value)}
                    >
                      {value === 'all' ? '全部' : value}
                    </button>
                  ))}
                </div>
                <div className="ops-toolbar__group">
                  <span className="section-label">来源</span>
                  <button
                    type="button"
                    className={`pill pill--compact ${auditSourceFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setAuditSourceFilter('all')}
                  >
                    全部
                  </button>
                  {auditSourceOptions.map((source) => (
                    <button
                      key={source}
                      type="button"
                      className={`pill pill--compact ${auditSourceFilter === source ? 'active' : ''}`}
                      onClick={() => setAuditSourceFilter(source)}
                    >
                      {source}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`pill pill--compact ${auditScopeFilter === 'selected' ? 'active' : ''}`}
                    onClick={() =>
                      setAuditScopeFilter((current) => (current === 'selected' ? 'all' : 'selected'))
                    }
                  >
                    {auditScopeFilter === 'selected' ? `${selectedSymbol}` : '当前品种'}
                  </button>
                </div>
                <div className="ops-toolbar__group ops-toolbar__group--search">
                  <span className="section-label">检索</span>
                  <input
                    value={auditSearch}
                    onChange={(event) => setAuditSearch(event.target.value)}
                    placeholder="事件类型 / source / symbol"
                  />
                </div>
              </div>
              <div className="audit-list audit-list--compact">
                {filteredAuditEvents.map((item, index) => {
                  const meta = eventCategoryMeta(item.event_type)
                  const MetaIcon = meta.icon
                  return (
                    <div key={item.id} className="audit-row audit-row--fade" style={{ animationDelay: `${index * 24}ms` }}>
                      <div className="console-row__main">
                        <strong>
                          <MetaIcon size={13} />
                          {meta.label} · {item.event_type}
                        </strong>
                        <p>{item.source} · {item.symbol ?? '全局'} · {summarizeAuditEvent(item.payload)}</p>
                      </div>
                      <div className="trade-meta">
                        <span className={`status-chip status-${item.severity}`}>{item.severity}</span>
                        {getAuditLinkedReviewId(item.payload) && (
                          <button
                            type="button"
                            className="micro-action"
                            onClick={() =>
                              openReviewInspector(
                                getAuditLinkedReviewId(item.payload),
                                getAuditStrategyId(item.payload),
                              )
                            }
                          >
                            查看结果
                          </button>
                        )}
                        {!getAuditLinkedReviewId(item.payload) && getAuditStrategyId(item.payload) && (
                          <button
                            type="button"
                            className="micro-action"
                            onClick={() => openStrategyActivity(getAuditStrategyId(item.payload))}
                          >
                            打开策略
                          </button>
                        )}
                        <small>{formatTime(item.occurred_at)}</small>
                      </div>
                    </div>
                  )
                })}
                {filteredAuditEvents.length === 0 && <div className="empty-state empty-state--inline">当前筛选下没有审计事件</div>}
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

import { Bell, Bot, ClipboardList, FileSearch, History, Newspaper, Save, ShieldAlert } from 'lucide-react'

import type {
  AccountOverview,
  AgentJob,
  AlertRecord,
  BacktestRun,
  ChangeRequest,
  ControlSnapshot,
  ExecutionEvent,
  LatestSchedulerCommand,
  MarketDetail,
  MarketLiveDiagnostics,
  MarketLiveSnapshot,
  MarketRecentTrade,
  Mode,
  OrderRecord,
  ReviewDocument,
  RuntimeWorkerStatus,
  SchedulerCommandResult,
  SchedulerCommandType,
  SettingsPayload,
  StrategyActivityJobSummary,
  StrategyActivitySnapshot,
  StrategyProposal,
  StrategyRuntimeSnapshot,
  StrategySummary,
  TradeRecord,
} from '../types'

export type DesktopNotificationTone = 'normal' | 'critical'
export type DesktopNotificationPayload = {
  title: string
  body: string
  urgency?: DesktopNotificationTone
}

export type DesktopNotificationDelivery = 'delivered' | 'suppressed' | 'unavailable'
export const duplicateDesktopNotificationCooldownMs = 2 * 60 * 1000

if (typeof window !== 'undefined') {
  const diagnosticWindow = window as Window & { __bybitGlobalErrorBridgeInstalled?: boolean }
  if (!diagnosticWindow.__bybitGlobalErrorBridgeInstalled) {
    diagnosticWindow.__bybitGlobalErrorBridgeInstalled = true
    window.addEventListener('error', (event) => {
      console.error(
        '[app:window-error]',
        event.message,
        event.error instanceof Error ? event.error.stack ?? event.error.message : event.error ?? null,
      )
    })
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason
      console.error(
        '[app:unhandled-rejection]',
        reason instanceof Error ? reason.stack ?? reason.message : reason ?? null,
      )
    })
  }
}

export const settingsNotificationChannelOptions = [
  { value: 'desktop', label: '桌面通知' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'email', label: '邮件' },
] as const

export type SettingsNotificationChannel = (typeof settingsNotificationChannelOptions)[number]['value']

export type SettingsDraft = {
  bybitWebEntry: string
  apiBaseUrl: string
  defaultMode: Mode
  notificationChannels: SettingsNotificationChannel[]
  notificationQuietHoursEnabled: boolean
  notificationQuietHoursStart: string
  notificationQuietHoursEnd: string
  productLanguage: string
  grafanaBaseUrl: string
  grafanaDashboardUid: string
  grafanaOrgId: string
  grafanaTheme: 'dark' | 'light'
}

export function normalizeSettingsUrl(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim()
  return trimmed ? trimmed.replace(/\/+$/, '') : ''
}

export function normalizeSettingsText(value: string | null | undefined) {
  return String(value ?? '').trim()
}

export function normalizeSettingsQuietTime(value: string | null | undefined, fallback: string) {
  const trimmed = String(value ?? '').trim()
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(trimmed) ? trimmed : fallback
}

export function normalizeSettingsNotificationChannels(
  channels: readonly string[] | null | undefined,
): SettingsNotificationChannel[] {
  const allowed = new Set<SettingsNotificationChannel>(settingsNotificationChannelOptions.map((item) => item.value))
  const unique: SettingsNotificationChannel[] = []
  for (const item of channels ?? []) {
    const candidate = String(item ?? '').trim().toLowerCase() as SettingsNotificationChannel
    if (!allowed.has(candidate) || unique.includes(candidate)) {
      continue
    }
    unique.push(candidate)
  }
  return unique
}

export function buildSettingsDraft(settings?: SettingsPayload | null): SettingsDraft {
  return {
    bybitWebEntry: normalizeSettingsUrl(settings?.bybit_web_entry ?? 'https://www.bybit-global.com/'),
    apiBaseUrl: normalizeSettingsUrl(settings?.api_base_url ?? 'https://api.bybit.com'),
    defaultMode: settings?.default_mode ?? 'paper',
    notificationChannels: normalizeSettingsNotificationChannels(settings?.notification_channels ?? ['desktop', 'telegram', 'email']),
    notificationQuietHoursEnabled: settings?.notification_quiet_hours_enabled ?? false,
    notificationQuietHoursStart: normalizeSettingsQuietTime(settings?.notification_quiet_hours_start ?? '23:00', '23:00'),
    notificationQuietHoursEnd: normalizeSettingsQuietTime(settings?.notification_quiet_hours_end ?? '08:00', '08:00'),
    productLanguage: normalizeSettingsText(settings?.product_language ?? 'zh-CN'),
    grafanaBaseUrl: normalizeSettingsUrl(settings?.grafana_base_url ?? ''),
    grafanaDashboardUid: normalizeSettingsText(settings?.grafana_dashboard_uid ?? ''),
    grafanaOrgId: String(settings?.grafana_org_id ?? 1),
    grafanaTheme: settings?.grafana_theme ?? 'dark',
  }
}

export function settingsDraftEqualsSettings(draft: SettingsDraft, settings?: SettingsPayload | null) {
  if (!settings) {
    return false
  }
  return (
    normalizeSettingsUrl(draft.bybitWebEntry) === normalizeSettingsUrl(settings.bybit_web_entry) &&
    normalizeSettingsUrl(draft.apiBaseUrl) === normalizeSettingsUrl(settings.api_base_url) &&
    draft.defaultMode === settings.default_mode &&
    draft.notificationQuietHoursEnabled === (settings.notification_quiet_hours_enabled ?? false) &&
    draft.notificationQuietHoursStart === normalizeSettingsQuietTime(settings.notification_quiet_hours_start ?? '23:00', '23:00') &&
    draft.notificationQuietHoursEnd === normalizeSettingsQuietTime(settings.notification_quiet_hours_end ?? '08:00', '08:00') &&
    draft.productLanguage.trim() === normalizeSettingsText(settings.product_language) &&
    draft.grafanaBaseUrl.trim() === normalizeSettingsUrl(settings.grafana_base_url ?? '') &&
    draft.grafanaDashboardUid.trim() === normalizeSettingsText(settings.grafana_dashboard_uid ?? '') &&
    draft.grafanaOrgId.trim() === String(settings.grafana_org_id ?? 1) &&
    draft.grafanaTheme === (settings.grafana_theme ?? 'dark') &&
    JSON.stringify(normalizeSettingsNotificationChannels(draft.notificationChannels)) ===
      JSON.stringify(normalizeSettingsNotificationChannels(settings.notification_channels))
  )
}

export async function sendDesktopNotification(
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

export function quietHoursMinuteOfDay(value: string | null | undefined) {
  const normalized = normalizeSettingsQuietTime(value, '')
  if (!normalized) {
    return null
  }
  const [hoursText, minutesText] = normalized.split(':')
  const hours = Number.parseInt(hoursText, 10)
  const minutes = Number.parseInt(minutesText, 10)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null
  }
  return hours * 60 + minutes
}

export function isNotificationQuietHoursActive(settings?: SettingsPayload | null, now = new Date()) {
  if (!settings?.notification_quiet_hours_enabled) {
    return false
  }
  const startMinutes = quietHoursMinuteOfDay(settings.notification_quiet_hours_start)
  const endMinutes = quietHoursMinuteOfDay(settings.notification_quiet_hours_end)
  if (startMinutes == null || endMinutes == null || startMinutes === endMinutes) {
    return false
  }
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes
}

export function notificationQuietHoursLabel(settings?: SettingsPayload | null) {
  if (!settings?.notification_quiet_hours_enabled) {
    return '静默时段未开启'
  }
  return `${settings.notification_quiet_hours_start} - ${settings.notification_quiet_hours_end}`
}

export async function sendDesktopNotificationWithSettings(
  payload: DesktopNotificationPayload,
  settings: SettingsPayload | null | undefined,
  permissionRequestedRef?: { current: boolean },
): Promise<DesktopNotificationDelivery> {
  if (payload.urgency !== 'critical' && isNotificationQuietHoursActive(settings)) {
    return 'suppressed'
  }
  return (await sendDesktopNotification(payload, permissionRequestedRef)) ? 'delivered' : 'unavailable'
}

export function desktopNotificationSignature(payload: DesktopNotificationPayload) {
  return [payload.urgency ?? 'normal', payload.title ?? '', payload.body ?? ''].join('::')
}

export function eventCategoryMeta(eventType: string) {
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

function isExecutionEventLike(value: Record<string, unknown> | ExecutionEvent): value is ExecutionEvent {
  return 'payload' in value && 'event_type' in value
}

function auditPayload(input: Record<string, unknown> | ExecutionEvent) {
  return isExecutionEventLike(input) ? input.payload ?? {} : input
}

export function summarizeAuditEvent(input: Record<string, unknown> | ExecutionEvent) {
  const eventSummary = isExecutionEventLike(input) ? input.summary : null
  if (typeof eventSummary === 'string' && eventSummary.trim()) {
    return eventSummary.trim()
  }
  const payload = auditPayload(input)
  const summary = payload.summary
  if (typeof summary === 'string' && summary.trim()) {
    return summary
  }
  const resultSummary = payload.result_summary
  if (typeof resultSummary === 'string' && resultSummary.trim()) {
    return resultSummary
  }
  const command = payload.command
  if (typeof command === 'string' && command.trim()) {
    return `命令 ${command}`
  }
  const title = payload.title
  if (typeof title === 'string' && title.trim()) {
    return title
  }
  const detail = payload.detail
  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }
  const symbol = payload.symbol
  if (typeof symbol === 'string' && symbol.trim()) {
    return symbol
  }
  return '事件已记录'
}

export function getAuditStringList(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  if (!Array.isArray(value)) return []
  const next: string[] = []
  value.forEach((item) => {
    if (typeof item !== 'string') return
    const normalized = item.trim()
    if (normalized && !next.includes(normalized)) {
      next.push(normalized)
    }
  })
  return next
}

export function getAuditLinkedReviewId(payload: Record<string, unknown>) {
  const linkedReviewId = payload.linked_review_id
  if (typeof linkedReviewId === 'string' && linkedReviewId.trim()) {
    return linkedReviewId
  }
  const reviewId = payload.review_id
  return typeof reviewId === 'string' && reviewId.trim() ? reviewId : null
}

export function getAuditJobId(payload: Record<string, unknown>) {
  const retryJobId = payload.retry_job_id
  if (typeof retryJobId === 'string' && retryJobId.trim()) {
    return retryJobId
  }
  const jobId = payload.job_id
  return typeof jobId === 'string' && jobId.trim() ? jobId : null
}

export function getAuditChangeRequestId(payload: Record<string, unknown>) {
  const changeRequestId = payload.change_request_id
  if (typeof changeRequestId === 'string' && changeRequestId.trim()) {
    return changeRequestId
  }
  const createdChangeRequestId = payload.created_change_request_id
  if (typeof createdChangeRequestId === 'string' && createdChangeRequestId.trim()) {
    return createdChangeRequestId
  }
  const sourceChangeRequestId = payload.source_change_request_id
  return typeof sourceChangeRequestId === 'string' && sourceChangeRequestId.trim() ? sourceChangeRequestId : null
}

export function getAuditStrategyId(payload: Record<string, unknown>) {
  const strategyId = payload.strategy_id
  if (typeof strategyId === 'string' && strategyId.trim()) {
    return strategyId
  }
  const cancelledStrategyIds = getAuditStringList(payload, 'cancelled_strategy_ids')
  return cancelledStrategyIds.length === 1 ? cancelledStrategyIds[0] : null
}

export function getAuditBacktestId(payload: Record<string, unknown>) {
  const backtestId = payload.backtest_id
  if (typeof backtestId === 'string' && backtestId.trim()) {
    return backtestId
  }
  const cancelledBacktestIds = getAuditStringList(payload, 'cancelled_backtest_ids')
  return cancelledBacktestIds.length === 1 ? cancelledBacktestIds[0] : null
}

export function getAuditSourceBacktestId(payload: Record<string, unknown>) {
  const backtestId = payload.source_backtest_id
  if (typeof backtestId === 'string' && backtestId.trim()) {
    return backtestId
  }
  const cancelledBacktestIds = getAuditStringList(payload, 'cancelled_source_backtest_ids')
  return cancelledBacktestIds.length === 1 ? cancelledBacktestIds[0] : null
}

export function getAuditSourceReviewId(payload: Record<string, unknown>) {
  const reviewId = payload.source_review_id
  if (typeof reviewId === 'string' && reviewId.trim()) {
    return reviewId
  }
  const cancelledReviewIds = getAuditStringList(payload, 'cancelled_source_review_ids')
  return cancelledReviewIds.length === 1 ? cancelledReviewIds[0] : null
}

export function getAuditSourceProposalId(payload: Record<string, unknown>) {
  const proposalId = payload.source_proposal_id
  if (typeof proposalId === 'string' && proposalId.trim()) {
    return proposalId
  }
  const cancelledProposalIds = getAuditStringList(payload, 'cancelled_source_proposal_ids')
  return cancelledProposalIds.length === 1 ? cancelledProposalIds[0] : null
}

export function auditImpactMeta(input: Record<string, unknown> | ExecutionEvent) {
  const eventImpactDetail = isExecutionEventLike(input) ? input.impact_detail : null
  if (typeof eventImpactDetail === 'string' && eventImpactDetail.trim()) {
    return {
      detail: eventImpactDetail.trim(),
    }
  }
  const payload = auditPayload(input)
  const jobTypes = getAuditStringList(payload, 'cancelled_job_types')
  const strategyIds = getAuditStringList(payload, 'cancelled_strategy_ids')
  const backtestIds = getAuditStringList(payload, 'cancelled_backtest_ids')
  const sourceChangeRequestIds = getAuditStringList(payload, 'cancelled_source_change_request_ids')
  const sourceBacktestIds = getAuditStringList(payload, 'cancelled_source_backtest_ids')
  const sourceReviewIds = getAuditStringList(payload, 'cancelled_source_review_ids')
  const sourceProposalIds = getAuditStringList(payload, 'cancelled_source_proposal_ids')
  const triggerReasons = getAuditStringList(payload, 'cancelled_trigger_reasons')
  const decisionReadinessValues = getAuditStringList(payload, 'cancelled_decision_readiness_values')
  const parts: string[] = []
  if (jobTypes.length) {
    parts.push(`任务 ${jobTypes.join(' / ')}`)
  }
  if (strategyIds.length) {
    parts.push(strategyIds.length === 1 ? `策略 ${strategyIds[0]}` : `策略 ${strategyIds.length} 条`)
  }
  if (backtestIds.length) {
    parts.push(backtestIds.length === 1 ? `回测 ${backtestIds[0]}` : `回测 ${backtestIds.length} 轮`)
  }
  if (sourceChangeRequestIds.length) {
    parts.push(
      sourceChangeRequestIds.length === 1
        ? `来源变更 ${sourceChangeRequestIds[0]}`
        : `来源变更 ${sourceChangeRequestIds.length} 条`,
    )
  }
  if (sourceBacktestIds.length) {
    parts.push(sourceBacktestIds.length === 1 ? `来源回测 ${sourceBacktestIds[0]}` : `来源回测 ${sourceBacktestIds.length} 轮`)
  }
  if (sourceReviewIds.length) {
    parts.push(sourceReviewIds.length === 1 ? `来源复盘 ${sourceReviewIds[0]}` : `来源复盘 ${sourceReviewIds.length} 条`)
  }
  if (sourceProposalIds.length) {
    parts.push(sourceProposalIds.length === 1 ? `来源提案 ${sourceProposalIds[0]}` : `来源提案 ${sourceProposalIds.length} 条`)
  }
  if (triggerReasons.length) {
    parts.push(`触发 ${triggerReasons.join(' / ')}`)
  }
  if (decisionReadinessValues.length) {
    parts.push(`门禁 ${decisionReadinessValues.join(' / ')}`)
  }
  const manualFollowupRequired = payload.manual_followup_required === true
  const manualFollowupDetail =
    typeof payload.manual_followup_detail === 'string' && payload.manual_followup_detail.trim()
      ? payload.manual_followup_detail.trim()
      : typeof payload.detail === 'string' && payload.detail.trim() && getAuditChangeRequestId(payload)
        ? payload.detail.trim()
        : null
  if (manualFollowupRequired || manualFollowupDetail) {
    parts.push(manualFollowupDetail ? `需人工跟进 · ${manualFollowupDetail}` : '需人工跟进')
  }
  if (!parts.length) {
    return null
  }
  return {
    detail: parts.join(' · '),
  }
}

export function auditNotificationBody(payload: Record<string, unknown> | ExecutionEvent) {
  const summary = summarizeAuditEvent(payload)
  const impactMeta = auditImpactMeta(payload)
  if (!impactMeta) {
    return summary
  }
  if (impactMeta.detail === summary) {
    return summary
  }
  return `${summary} · ${impactMeta.detail}`
}

export function schedulerCommandSnapshotMeta(command?: LatestSchedulerCommand | null) {
  if (!command) {
    return null
  }
  return {
    command: command.command ?? null,
    commandLabel: schedulerCommandLabel(command.command ?? null),
    summary: command.summary,
    impactDetail: command.impact_detail ?? null,
    jobId: command.job_id ?? null,
    linkedReviewId: command.linked_review_id ?? null,
    strategyId: command.strategy_id ?? null,
    backtestId: command.backtest_id ?? null,
    sourceChangeRequestId: command.source_change_request_id ?? null,
    sourceBacktestId: command.source_backtest_id ?? null,
    sourceReviewId: command.source_review_id ?? null,
    sourceProposalId: command.source_proposal_id ?? null,
    occurredAt: command.occurred_at,
    tone:
      command.severity === 'warning' || command.severity === 'error' || command.severity === 'critical'
        ? 'warning'
        : 'success',
  } as const
}

export function schedulerCommandEventMeta(event?: ExecutionEvent | null) {
  if (!event || event.event_type !== 'scheduler.command') {
    return null
  }
  const payload = event.payload ?? {}
  const impactMeta = auditImpactMeta(event)
  const command = typeof payload.command === 'string' && payload.command.trim() ? payload.command.trim() : null
  return {
    command,
    commandLabel: schedulerCommandLabel(command),
    summary: summarizeAuditEvent(event),
    impactDetail: impactMeta?.detail ?? null,
    jobId: getAuditJobId(payload),
    linkedReviewId: getAuditLinkedReviewId(payload),
    strategyId: getAuditStrategyId(payload),
    backtestId: getAuditBacktestId(payload),
    sourceChangeRequestId: getAuditChangeRequestId(payload),
    sourceBacktestId: getAuditSourceBacktestId(payload),
    sourceReviewId: getAuditSourceReviewId(payload),
    sourceProposalId: getAuditSourceProposalId(payload),
    occurredAt: event.occurred_at,
    tone: event.severity === 'warning' || event.severity === 'error' || event.severity === 'critical' ? 'warning' : 'success',
  } as const
}

export function auditEventPriority(event?: ExecutionEvent | null) {
  if (typeof event?.priority === 'number' && Number.isFinite(event.priority)) {
    return event.priority
  }
  const eventType = String(event?.event_type ?? '').trim()
  if (eventType === 'scheduler.command') return 0
  if (eventType.startsWith('openclaw.job.')) return 1
  if (eventType.startsWith('strategy.issue.review.') || eventType.startsWith('strategy.change.review.')) return 1
  if (eventType.startsWith('change_request.') || eventType.startsWith('strategy.review.')) return 2
  if (eventType.startsWith('exchange_order.')) return 3
  if (eventType.startsWith('strategy.')) return 4
  if (eventType.startsWith('alert.')) return 5
  return 6
}

export function pickLatestKeyAuditEvent(events: ExecutionEvent[]) {
  if (!events.length) return null
  const ranked = events
    .map((event, index) => ({ event, index, priority: auditEventPriority(event) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
  return ranked[0]?.event ?? null
}

export function schedulerCommandFeedbackDetail(result: SchedulerCommandResult, fallbackReason: string) {
  const summary =
    typeof result.summary === 'string' && result.summary.trim()
      ? result.summary.trim()
      : fallbackReason
  const detailParts: string[] = []
  const impactMeta = auditImpactMeta(result as unknown as Record<string, unknown>)
  if (impactMeta?.detail && impactMeta.detail !== summary) {
    detailParts.push(impactMeta.detail)
  }
  if (typeof result.backtest_id === 'string' && result.backtest_id.trim()) {
    detailParts.push(`回测 ${result.backtest_id}`)
  }
  if (typeof result.source_change_request_id === 'string' && result.source_change_request_id.trim()) {
    detailParts.push(`来源变更 ${result.source_change_request_id}`)
  }
  if (typeof result.source_backtest_id === 'string' && result.source_backtest_id.trim()) {
    detailParts.push(`来源回测 ${result.source_backtest_id}`)
  }
  if (typeof result.source_review_id === 'string' && result.source_review_id.trim()) {
    detailParts.push(`来源复盘 ${result.source_review_id}`)
  }
  if (typeof result.source_proposal_id === 'string' && result.source_proposal_id.trim()) {
    detailParts.push(`来源提案 ${result.source_proposal_id}`)
  }
  if (typeof result.decision_readiness === 'string' && result.decision_readiness.trim()) {
    detailParts.push(`门禁 ${result.decision_readiness}`)
  }
  if (!detailParts.length) {
    return summary
  }
  return `${summary} · ${detailParts.join(' · ')}`
}

export function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function formatUnsignedPercent(value: number) {
  return `${Math.max(value, 0).toFixed(2)}%`
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)
}

export function withDraftPresetOption(
  presets: readonly { value: string; label: string }[],
  draft: string,
  customLabelPrefix: string,
) {
  const normalizedDraft = draft.trim()
  if (!normalizedDraft) {
    return [...presets]
  }
  if (presets.some((preset) => preset.value === normalizedDraft)) {
    return [...presets]
  }
  return [{ value: normalizedDraft, label: `${customLabelPrefix} · ${normalizedDraft}` }, ...presets]
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: value >= 1_000_000 ? 2 : 1,
  }).format(value)
}

export function normalizeDraftValue(value: string | number | boolean) {
  return typeof value === 'boolean' ? String(value) : String(value ?? '')
}

export function normalizeOrderInputValue(value: string | number) {
  return String(value ?? '').replace(/,/g, '')
}

export function formatTime(value?: string | null) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatDateTime(value?: string | null) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function resolveErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return '未知错误，请检查本地控制服务日志。'
}

export function coerceParameterValue(
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

export function schedulerLabel(status: string) {
  return (
    {
      running: '运行中',
      paused: '已暂停',
      manual_override: '人工接管',
      degraded: '降级运行',
    }[status] ?? status
  )
}

export function schedulerCommandLabel(command?: SchedulerCommandType | string | null) {
  return (
    {
      pause: '暂停调度',
      resume: '恢复调度',
      cancel_job: '终止任务',
      cancel_all: '终止全部任务',
      freeze_publish: '切换发布门禁',
      enter_manual_override: '进入人工接管',
    }[command ?? ''] ?? (command || '调度命令')
  )
}

export function strategyStatusLabel(status: StrategySummary['status']) {
  return (
    {
      running: '运行中',
      paused: '已暂停',
      paper_only: '仅模拟盘',
      shadow: '影子模式',
    }[status] ?? status
  )
}

export function changeRequestStatusLabel(status: string) {
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

export function changeRequestTriggerReasonLabel(reason?: string | null) {
  return (
    {
      manual_create: '手动创建',
      proposal_accept: '接受提案',
    }[reason ?? ''] ?? (reason || '来源未标记')
  )
}

export function getChangeRequestStrategyId(request?: ChangeRequest | null, fallbackStrategyId?: string | null) {
  if (!request) {
    return fallbackStrategyId ?? null
  }
  const payloadStrategyId = request.payload?.strategy_id
  if (typeof payloadStrategyId === 'string' && payloadStrategyId.trim()) {
    return payloadStrategyId.trim()
  }
  return fallbackStrategyId ?? null
}

export function getReviewFocusStrategyId(review: ReviewDocument | null | undefined, fallbackStrategyId?: string | null) {
  if (!review) {
    return fallbackStrategyId ?? null
  }
  if (typeof review.strategy_id === 'string' && review.strategy_id.trim()) {
    return review.strategy_id.trim()
  }
  const proposals = Array.isArray(review.proposals) ? review.proposals : []
  const strategyIds = Array.from(
    new Set(
      proposals
        .map((proposal) => (typeof proposal.strategy_id === 'string' ? proposal.strategy_id.trim() : ''))
        .filter(Boolean),
    ),
  )
  if (strategyIds.length === 1) {
    return strategyIds[0]
  }
  return fallbackStrategyId ?? null
}

export function getChangeRequestSourceProposalId(request?: ChangeRequest | null) {
  if (!request) {
    return null
  }
  if (typeof request.source_proposal_id === 'string' && request.source_proposal_id.trim()) {
    return request.source_proposal_id.trim()
  }
  const payloadProposalId = request.payload?.proposal_id
  return typeof payloadProposalId === 'string' && payloadProposalId.trim() ? payloadProposalId.trim() : null
}

export function getChangeRequestSourceBacktestId(request: ChangeRequest) {
  return typeof request.source_backtest_id === 'string' && request.source_backtest_id.trim()
    ? request.source_backtest_id.trim()
    : null
}

export function getChangeRequestLinkedBacktestId(request: ChangeRequest) {
  return typeof request.linked_backtest_id === 'string' && request.linked_backtest_id.trim()
    ? request.linked_backtest_id.trim()
    : null
}

export function getChangeRequestManualFollowupDetail(request?: ChangeRequest | null) {
  if (!request?.manual_followup_required) {
    return null
  }
  return typeof request.manual_followup_detail === 'string' && request.manual_followup_detail.trim()
    ? request.manual_followup_detail.trim()
    : '该变更当前仍需人工或编排链后续落实。'
}

export function getChangeRequestLinkedBacktestDecisionMeta(request: ChangeRequest) {
  return backtestDecisionReadinessMeta({
    decision_readiness: request.linked_backtest_decision_readiness ?? null,
    decision_readiness_detail: request.linked_backtest_decision_readiness_detail ?? null,
    decision_recommended_data_range: request.linked_backtest_decision_recommended_data_range ?? null,
    decision_recommended_timeframe: request.linked_backtest_decision_recommended_timeframe ?? null,
    decision_readiness_action: request.linked_backtest_decision_readiness_action ?? null,
  })
}

export function getChangeRequestLinkedBacktestSampleMeta(
  request: ChangeRequest,
  linkedBacktest?: BacktestRun | null,
) {
  const linkedMeta = backtestSampleQualityMeta(linkedBacktest)
  if (linkedMeta) {
    return linkedMeta
  }
  if (!request.linked_backtest_sample_quality) {
    return null
  }
  return backtestSampleQualityMeta({
    sample_quality: request.linked_backtest_sample_quality,
    reference_only: request.linked_backtest_sample_quality === 'reference_only',
  })
}

export function getChangeRequestLinkedBacktestWindowMeta(
  request: ChangeRequest,
  linkedBacktest?: BacktestRun | null,
) {
  const linkedMeta = backtestWindowMeta(linkedBacktest)
  if (linkedMeta) {
    return linkedMeta
  }
  return backtestWindowMeta({
    history_source:
      request.linked_backtest_history_source === 'market_detail_fallback'
        ? 'market_detail_fallback'
        : 'exchange_history',
    history_source_reason:
      request.linked_backtest_history_source_reason === 'exchange_fetch_failed'
        ? 'exchange_fetch_failed'
        : request.linked_backtest_history_source_reason === 'insufficient_exchange_samples'
          ? 'insufficient_exchange_samples'
          : 'none',
    history_source_detail: request.linked_backtest_history_source_detail ?? null,
    history_source_recommended_action: request.linked_backtest_history_source_recommended_action ?? null,
    requested_candle_estimate: Number(request.linked_backtest_requested_candle_estimate ?? 0),
    requested_candle_limit: Number(request.linked_backtest_requested_candle_limit ?? 0),
    requested_range_start: request.linked_backtest_requested_range_start ?? null,
    requested_range_end: request.linked_backtest_requested_range_end ?? null,
    retrieved_window_completion_pct: Number(request.linked_backtest_retrieved_window_completion_pct ?? 0),
    used_window_completion_pct: Number(request.linked_backtest_used_window_completion_pct ?? 0),
    retrieved_candle_count: Number(request.linked_backtest_retrieved_candle_count ?? 0),
    used_candle_count: Number(request.linked_backtest_used_candle_count ?? 0),
    retrieved_range_start: request.linked_backtest_retrieved_range_start ?? null,
    retrieved_range_end: request.linked_backtest_retrieved_range_end ?? null,
    used_range_start: request.linked_backtest_used_range_start ?? null,
    used_range_end: request.linked_backtest_used_range_end ?? null,
    history_truncated: Boolean(request.linked_backtest_history_truncated),
    history_gap_reason:
      request.linked_backtest_history_gap_reason === 'insufficient_history'
        ? 'insufficient_history'
        : request.linked_backtest_history_gap_reason === 'sample_cap'
          ? 'sample_cap'
          : 'none',
    full_window_recommended_data_range: request.linked_backtest_full_window_recommended_data_range ?? null,
    full_window_recommended_timeframe: request.linked_backtest_full_window_recommended_timeframe ?? null,
    full_window_recommended_action: request.linked_backtest_full_window_recommended_action ?? null,
  })
}

export function getChangeRequestLinkedBacktestRecommendation(
  request: ChangeRequest,
  linkedBacktest?: BacktestRun | null,
) {
  const linkedHistorySourceReason =
    linkedBacktest?.history_source_reason === 'exchange_fetch_failed'
      ? 'exchange_fetch_failed'
      : linkedBacktest?.history_source_reason === 'insufficient_exchange_samples'
        ? 'insufficient_exchange_samples'
        : request.linked_backtest_history_source_reason === 'exchange_fetch_failed'
          ? 'exchange_fetch_failed'
          : request.linked_backtest_history_source_reason === 'insufficient_exchange_samples'
            ? 'insufficient_exchange_samples'
            : 'none'

  const decisionMeta = linkedBacktest
    ? backtestDecisionReadinessMeta(linkedBacktest)
    : getChangeRequestLinkedBacktestDecisionMeta(request)
  if (
    linkedHistorySourceReason !== 'exchange_fetch_failed' &&
    decisionMeta?.recommendedRange &&
    decisionMeta?.recommendedTimeframe
  ) {
    return {
      recommendedRange: decisionMeta.recommendedRange,
      recommendedTimeframe: decisionMeta.recommendedTimeframe,
      nextAction: decisionMeta.nextAction,
    }
  }

  const fullWindowRange =
    typeof linkedBacktest?.full_window_recommended_data_range === 'string' &&
    linkedBacktest.full_window_recommended_data_range.trim()
      ? linkedBacktest.full_window_recommended_data_range.trim()
      : typeof request.linked_backtest_full_window_recommended_data_range === 'string' &&
          request.linked_backtest_full_window_recommended_data_range.trim()
        ? request.linked_backtest_full_window_recommended_data_range.trim()
      : null
  const fullWindowTimeframe =
    typeof linkedBacktest?.full_window_recommended_timeframe === 'string' &&
    linkedBacktest.full_window_recommended_timeframe.trim()
      ? linkedBacktest.full_window_recommended_timeframe.trim()
      : typeof request.linked_backtest_full_window_recommended_timeframe === 'string' &&
          request.linked_backtest_full_window_recommended_timeframe.trim()
        ? request.linked_backtest_full_window_recommended_timeframe.trim()
      : null
  if (fullWindowRange && fullWindowTimeframe) {
    return {
      recommendedRange: fullWindowRange,
      recommendedTimeframe: fullWindowTimeframe,
      nextAction:
        typeof linkedBacktest?.full_window_recommended_action === 'string' &&
        linkedBacktest.full_window_recommended_action.trim()
          ? linkedBacktest.full_window_recommended_action.trim()
          : typeof request.linked_backtest_full_window_recommended_action === 'string' &&
              request.linked_backtest_full_window_recommended_action.trim()
            ? request.linked_backtest_full_window_recommended_action.trim()
          : null,
    }
  }

  const historyRange =
    typeof linkedBacktest?.history_source_recommended_data_range === 'string' &&
    linkedBacktest.history_source_recommended_data_range.trim()
      ? linkedBacktest.history_source_recommended_data_range.trim()
      : typeof request.linked_backtest_history_source_recommended_data_range === 'string' &&
          request.linked_backtest_history_source_recommended_data_range.trim()
        ? request.linked_backtest_history_source_recommended_data_range.trim()
      : null
  const historyTimeframe =
    typeof linkedBacktest?.history_source_recommended_timeframe === 'string' &&
    linkedBacktest.history_source_recommended_timeframe.trim()
      ? linkedBacktest.history_source_recommended_timeframe.trim()
      : typeof request.linked_backtest_history_source_recommended_timeframe === 'string' &&
          request.linked_backtest_history_source_recommended_timeframe.trim()
        ? request.linked_backtest_history_source_recommended_timeframe.trim()
      : null
  if (
    linkedHistorySourceReason !== 'exchange_fetch_failed' &&
    historyRange &&
    historyTimeframe
  ) {
    return {
      recommendedRange: historyRange,
      recommendedTimeframe: historyTimeframe,
      nextAction:
        typeof linkedBacktest?.history_source_recommended_action === 'string' &&
        linkedBacktest.history_source_recommended_action.trim()
          ? linkedBacktest.history_source_recommended_action.trim()
          : typeof request.linked_backtest_history_source_recommended_action === 'string' &&
              request.linked_backtest_history_source_recommended_action.trim()
            ? request.linked_backtest_history_source_recommended_action.trim()
          : null,
    }
  }

  return null
}

export function getChangeRequestSourceReviewId(request: ChangeRequest) {
  return typeof request.source_review_id === 'string' && request.source_review_id.trim()
    ? request.source_review_id.trim()
    : null
}

export function proposalTypeLabel(type: string) {
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

export function proposalStatusLabel(status: string) {
  return (
    {
      pending: '待处理',
      testing: '测试中',
      accepted: '已接受',
      rejected: '已拒绝',
    }[status] ?? status
  )
}

export function proposalManualFollowupMeta(proposal: StrategyProposal, linkedChangeRequest?: ChangeRequest | null) {
  const linkedDetail = getChangeRequestManualFollowupDetail(linkedChangeRequest)
  if (linkedChangeRequest?.manual_followup_required) {
    return {
      label: '需人工跟进',
      detail: linkedDetail ?? '该提案已转成待处理 ChangeRequest，需后续人工或编排链落实。',
    }
  }
  if (proposal.proposal_type === 'script_patch_proposal' && (proposal.status === 'pending' || proposal.status === 'testing')) {
    return {
      label: '接受后需人工跟进',
      detail: '接受后会转成待处理 ChangeRequest，需人工或编排链后续落实。',
    }
  }
  return null
}

export function proposalOutcomeDetails(
  proposal: StrategyProposal,
  linkedChangeRequest?: ChangeRequest | null,
  linkedBacktest?: BacktestRun | null,
  linkedReview?: ReviewDocument | null,
  linkedJob?: AgentJob | null,
) {
  const details: string[] = []
  const manualFollowupDetail = getChangeRequestManualFollowupDetail(linkedChangeRequest)
  const manualFollowupMeta = proposalManualFollowupMeta(proposal, linkedChangeRequest)
  if (linkedChangeRequest) {
    let detail = `已生成变更 ${linkedChangeRequest.id}`
    if (manualFollowupDetail) {
      detail += ` · 需人工跟进 · ${manualFollowupDetail}`
    }
    details.push(detail)
  } else if (manualFollowupMeta) {
    details.push(manualFollowupMeta.detail)
  }
  if (linkedBacktest) {
    const parts = [`已生成回测 ${linkedBacktest.id}`]
    if (linkedBacktest.timeframe) {
      parts.push(linkedBacktest.timeframe)
    }
    if (linkedBacktest.data_range) {
      parts.push(linkedBacktest.data_range)
    }
    details.push(parts.join(' · '))
  }
  if (linkedReview) {
    details.push(`已生成复盘 ${linkedReview.id} · ${reviewPeriodLabel(linkedReview.period)}`)
  }
  if (linkedChangeRequest?.follow_up_job_type) {
    const parts = [`跟踪任务 ${linkedChangeRequest.follow_up_job_type}`]
    if (linkedChangeRequest.follow_up_job_status) {
      parts.push(jobStatusLabel(linkedChangeRequest.follow_up_job_status))
    }
    if (linkedChangeRequest.linked_review_title) {
      parts.push(`结果 ${linkedChangeRequest.linked_review_title}`)
    } else if (linkedChangeRequest.follow_up_result_summary) {
      parts.push(linkedChangeRequest.follow_up_result_summary)
    }
    details.push(parts.join(' · '))
  } else if (linkedJob) {
    const parts = [`跟踪任务 ${linkedJob.job_type}`]
    if (linkedJob.status) {
      parts.push(jobStatusLabel(linkedJob.status))
    }
    if (linkedJob.linked_review_title) {
      parts.push(`结果 ${linkedJob.linked_review_title}`)
    } else if (linkedJob.result_summary) {
      parts.push(linkedJob.result_summary)
    }
    details.push(parts.join(' · '))
  }
  return Array.from(new Set(details.filter(Boolean)))
}

export function isStrategyTrackingReview(period?: string | null) {
  return period === 'strategy_issue' || period === 'strategy_change'
}

export function reviewPeriodLabel(period?: string | null) {
  return (
    {
      daily: '日度复盘',
      backtest: '回测复盘',
      strategy_issue: '问题跟踪',
      strategy_change: '变更跟踪',
    }[period ?? ''] ?? (period || '复盘')
  )
}

export function reviewPeriodChipClass(period?: string | null) {
  if (period === 'backtest') return 'chip chip--warning'
  if (isStrategyTrackingReview(period)) return 'chip chip--muted'
  return 'chip chip--success'
}

export function backtestSampleQualityMeta(backtest?: Pick<BacktestRun, 'sample_quality' | 'reference_only'> | null) {
  if (!backtest) return null
  if (backtest.sample_quality === 'reference_only' || backtest.reference_only) {
    return {
      label: '参考路径',
      description: '未命中真实入场信号',
      chipClass: 'chip chip--warning',
    }
  }
  if (backtest.sample_quality === 'low_sample') {
    return {
      label: '低样本',
      description: '真实成交少于 5 笔',
      chipClass: 'chip chip--muted',
    }
  }
  return {
    label: '样本达标',
    description: '真实成交已达最小门槛',
    chipClass: 'chip chip--success',
  }
}

export function backtestDecisionReadinessMeta(
  backtest?: {
    decision_readiness?: 'ready' | 'sample_incomplete' | 'research_only' | null
    decision_readiness_detail?: string | null
    decision_recommended_data_range?: string | null
    decision_recommended_timeframe?: string | null
    decision_readiness_action?: string | null
  } | null,
) {
  if (!backtest) return null
  const readiness =
    backtest.decision_readiness === 'research_only'
      ? 'research_only'
      : backtest.decision_readiness === 'sample_incomplete'
        ? 'sample_incomplete'
        : 'ready'
  const detail =
    typeof backtest.decision_readiness_detail === 'string' && backtest.decision_readiness_detail.trim()
      ? backtest.decision_readiness_detail.trim()
      : readiness === 'research_only'
        ? '当前结果仅供研究参考'
        : readiness === 'sample_incomplete'
          ? '当前样本仍需补充'
          : '当前结果可继续结合策略上下文判断'
  const nextAction =
    typeof backtest.decision_readiness_action === 'string' && backtest.decision_readiness_action.trim()
      ? backtest.decision_readiness_action.trim()
      : null
  const recommendedRange =
    typeof backtest.decision_recommended_data_range === 'string' && backtest.decision_recommended_data_range.trim()
      ? backtest.decision_recommended_data_range.trim()
      : null
  const recommendedTimeframe =
    typeof backtest.decision_recommended_timeframe === 'string' && backtest.decision_recommended_timeframe.trim()
      ? backtest.decision_recommended_timeframe.trim()
      : null
  if (readiness === 'research_only') {
    return {
      label: '研究参考',
      description: detail,
      recommendedRange,
      recommendedTimeframe,
      nextAction,
      chipClass: 'chip chip--warning',
    }
  }
  if (readiness === 'sample_incomplete') {
    return {
      label: '待补样本',
      description: detail,
      recommendedRange,
      recommendedTimeframe,
      nextAction,
      chipClass: 'chip chip--muted',
    }
  }
  return {
    label: '可继续判断',
    description: detail,
    recommendedRange,
    recommendedTimeframe,
    nextAction,
    chipClass: 'chip chip--success',
  }
}

export function backtestTriggerReasonLabel(reason?: string | null) {
  return (
    {
      manual_create: '手动创建',
      decision_rerun: '门禁重跑',
      review_decision_rerun: '复盘建议重跑',
      proposal_accept: '接受提案',
    }[reason ?? ''] ?? (reason || '未标注')
  )
}

export function backtestLineageMeta(
  backtest?: Pick<
    BacktestRun,
    'source_change_request_id' | 'source_backtest_id' | 'source_review_id' | 'source_proposal_id' | 'trigger_reason'
  > | null,
) {
  if (!backtest) return null
  const sourceChangeRequestId =
    typeof backtest.source_change_request_id === 'string' && backtest.source_change_request_id.trim()
      ? backtest.source_change_request_id.trim()
      : null
  const sourceBacktestId =
    typeof backtest.source_backtest_id === 'string' && backtest.source_backtest_id.trim()
      ? backtest.source_backtest_id.trim()
      : null
  const sourceReviewId =
    typeof backtest.source_review_id === 'string' && backtest.source_review_id.trim()
      ? backtest.source_review_id.trim()
      : null
  const sourceProposalId =
    typeof backtest.source_proposal_id === 'string' && backtest.source_proposal_id.trim()
      ? backtest.source_proposal_id.trim()
      : null
  const triggerReason =
    typeof backtest.trigger_reason === 'string' && backtest.trigger_reason.trim()
      ? backtest.trigger_reason.trim()
      : null
  if (!triggerReason && !sourceChangeRequestId && !sourceBacktestId && !sourceReviewId && !sourceProposalId) {
    return null
  }
  const detailParts = [backtestTriggerReasonLabel(triggerReason)]
  if (sourceChangeRequestId) {
    detailParts.push(`来源变更 ${sourceChangeRequestId}`)
  }
  if (sourceBacktestId) {
    detailParts.push(`来源回测 ${sourceBacktestId}`)
  }
  if (sourceReviewId) {
    detailParts.push(`来源复盘 ${sourceReviewId}`)
  }
  if (sourceProposalId) {
    detailParts.push(`来源提案 ${sourceProposalId}`)
  }
  return {
    label: backtestTriggerReasonLabel(triggerReason),
    detail: detailParts.join(' · '),
  }
}

export function backtestWindowMeta(
  backtest?: Pick<
    BacktestRun,
    | 'history_source'
    | 'history_source_reason'
    | 'history_source_detail'
    | 'history_source_recommended_action'
    | 'requested_candle_estimate'
    | 'requested_candle_limit'
    | 'requested_range_start'
    | 'requested_range_end'
    | 'retrieved_window_completion_pct'
    | 'used_window_completion_pct'
    | 'retrieved_candle_count'
    | 'used_candle_count'
    | 'retrieved_range_start'
    | 'retrieved_range_end'
    | 'used_range_start'
    | 'used_range_end'
    | 'history_truncated'
    | 'history_gap_reason'
    | 'full_window_recommended_data_range'
    | 'full_window_recommended_timeframe'
    | 'full_window_recommended_action'
  > | null,
) {
  if (!backtest) return null
  const historySource =
    backtest.history_source === 'market_detail_fallback' ? 'market_detail_fallback' : 'exchange_history'
  const historySourceReason =
    backtest.history_source_reason === 'exchange_fetch_failed'
      ? 'exchange_fetch_failed'
      : backtest.history_source_reason === 'insufficient_exchange_samples'
        ? 'insufficient_exchange_samples'
        : 'none'
  const historySourceDetail =
    typeof backtest.history_source_detail === 'string' && backtest.history_source_detail.trim()
      ? backtest.history_source_detail.trim()
      : null
  const historySourceRecommendedAction =
    typeof backtest.history_source_recommended_action === 'string' && backtest.history_source_recommended_action.trim()
      ? backtest.history_source_recommended_action.trim()
      : null
  const requestedEstimate = Number(backtest.requested_candle_estimate ?? 0)
  const requestedLimit = Number(backtest.requested_candle_limit ?? 0)
  const requestedRangeStart =
    typeof backtest.requested_range_start === 'string' && backtest.requested_range_start.trim()
      ? backtest.requested_range_start.trim()
      : null
  const requestedRangeEnd =
    typeof backtest.requested_range_end === 'string' && backtest.requested_range_end.trim()
      ? backtest.requested_range_end.trim()
      : null
  const retrievedWindowCompletionPct = Number(backtest.retrieved_window_completion_pct ?? 0)
  const usedWindowCompletionPct = Number(backtest.used_window_completion_pct ?? 0)
  const retrievedCount = Number(backtest.retrieved_candle_count ?? 0)
  const usedCount = Number(backtest.used_candle_count ?? 0)
  const retrievedRangeStart =
    typeof backtest.retrieved_range_start === 'string' && backtest.retrieved_range_start.trim()
      ? backtest.retrieved_range_start.trim()
      : null
  const retrievedRangeEnd =
    typeof backtest.retrieved_range_end === 'string' && backtest.retrieved_range_end.trim()
      ? backtest.retrieved_range_end.trim()
      : null
  const usedRangeStart =
    typeof backtest.used_range_start === 'string' && backtest.used_range_start.trim()
      ? backtest.used_range_start.trim()
      : null
  const usedRangeEnd =
    typeof backtest.used_range_end === 'string' && backtest.used_range_end.trim()
      ? backtest.used_range_end.trim()
      : null
  const recommendedAction =
    typeof backtest.full_window_recommended_action === 'string' && backtest.full_window_recommended_action.trim()
      ? backtest.full_window_recommended_action.trim()
      : null
  if (requestedEstimate <= 0 && requestedLimit <= 0 && retrievedCount <= 0 && usedCount <= 0) {
    return null
  }
  const truncated = Boolean(backtest.history_truncated)
  const gapReason =
    backtest.history_gap_reason === 'insufficient_history'
      ? 'insufficient_history'
      : backtest.history_gap_reason === 'sample_cap'
        ? 'sample_cap'
        : 'none'
  const requestedRangeText =
    requestedRangeStart && requestedRangeEnd ? `${formatTime(requestedRangeStart)} -> ${formatTime(requestedRangeEnd)}` : null
  const retrievedRangeText =
    retrievedRangeStart && retrievedRangeEnd ? `${formatTime(retrievedRangeStart)} -> ${formatTime(retrievedRangeEnd)}` : null
  const usedRangeText =
    usedRangeStart && usedRangeEnd ? `${formatTime(usedRangeStart)} -> ${formatTime(usedRangeEnd)}` : null
  const detail = `理论 ${formatNumber(requestedEstimate || requestedLimit || retrievedCount || usedCount)} 根 · 当前上限 ${formatNumber(
    requestedLimit || retrievedCount || usedCount || requestedEstimate,
  )} 根 · 取到 ${formatNumber(retrievedCount || usedCount || requestedLimit || requestedEstimate)} 根 (${formatUnsignedPercent(
    retrievedWindowCompletionPct,
  )}) · 使用 ${formatNumber(usedCount || retrievedCount || requestedLimit || requestedEstimate)} 根 (${formatUnsignedPercent(
    usedWindowCompletionPct,
  )})`
  const rangeParts: string[] = []
  if (
    requestedRangeText &&
    requestedRangeText !== retrievedRangeText &&
    requestedRangeText !== usedRangeText
  ) {
    rangeParts.push(`请求 ${requestedRangeText}`)
  }
  if (retrievedRangeText && usedRangeText) {
    if (retrievedRangeText === usedRangeText) {
      rangeParts.push(`覆盖 ${retrievedRangeText}`)
    } else {
      rangeParts.push(`取样 ${retrievedRangeText}`)
      rangeParts.push(`回测 ${usedRangeText}`)
    }
  } else if (retrievedRangeText) {
    rangeParts.push(`覆盖 ${retrievedRangeText}`)
  } else if (usedRangeText) {
    rangeParts.push(`回测 ${usedRangeText}`)
  }
  if (historySource === 'market_detail_fallback') {
    const historySourceReasonLabel =
      historySourceReason === 'exchange_fetch_failed'
        ? '历史拉取报错'
        : historySourceReason === 'insufficient_exchange_samples'
          ? '交易所样本不足'
          : null
    rangeParts.push(
      `数据源 ${historySourceReasonLabel ? `行情快照回退（${historySourceReasonLabel}）` : '行情快照回退'}`,
    )
    if (historySourceDetail) {
      rangeParts.push(`原因 ${historySourceDetail}`)
    }
  }
  const detailWithRange = rangeParts.length ? `${detail} · ${rangeParts.join(' · ')}` : detail
  if (truncated) {
    return {
      attention: true,
      truncated,
      label: gapReason === 'insufficient_history' ? '历史不足' : '样本截断',
      description:
        recommendedAction ??
        `理论 ${formatNumber(requestedEstimate || requestedLimit)} 根，上限 ${formatNumber(requestedLimit || retrievedCount || usedCount)} 根`,
      detail: recommendedAction ? `${recommendedAction} · ${detailWithRange}` : detailWithRange,
      nextAction: recommendedAction,
      chipClass: 'chip chip--warning',
    }
  }
  return {
    attention: historySource === 'market_detail_fallback',
    truncated,
    label: historySource === 'market_detail_fallback' ? '快照回退' : '样本窗口',
    description:
      historySource === 'market_detail_fallback'
        ? historySourceReason === 'exchange_fetch_failed'
          ? '交易所历史拉取报错，当前改用工作台行情快照样本'
          : historySourceReason === 'insufficient_exchange_samples'
            ? '交易所历史样本不足，当前改用工作台行情快照样本'
            : '当前使用工作台行情快照样本'
        : `本次使用 ${formatNumber(usedCount || retrievedCount || requestedLimit || requestedEstimate)} 根样本`,
    detail: detailWithRange,
    nextAction: historySourceRecommendedAction,
    chipClass: historySource === 'market_detail_fallback' ? 'chip chip--warning' : 'chip chip--success',
  }
}

export function alertSourceMeta(sourceType?: 'rule' | 'news' | 'backtest' | 'system') {
  return (
    {
      rule: { label: '规则提醒', icon: Bell },
      news: { label: '新闻提醒', icon: Newspaper },
      backtest: { label: '回测提醒', icon: FileSearch },
      system: { label: '系统提醒', icon: ShieldAlert },
    }[sourceType ?? 'system'] ?? { label: '系统提醒', icon: ShieldAlert }
  )
}

export function tradeProbeLabel(outcome?: string) {
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

export function bybitRestReachabilityLabel(reachable?: boolean | null) {
  if (reachable == null) return 'REST 未探测'
  return reachable ? 'REST 已可达' : 'REST 不可达'
}

export function bybitPrivateRealtimeStatusLabel(status?: {
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

export function bybitPrivateConfigSourceLabel(source?: 'env' | 'file' | 'none') {
  if (source === 'env') return '环境变量优先'
  if (source === 'file') return '读取本地配置文件'
  return '未检测到私有配置'
}

export function configPresenceLabel(exists?: boolean | null) {
  return exists ? '配置文件已存在' : '配置文件不存在'
}

export function openClawCommandLabel(commandAvailable?: boolean | null) {
  return commandAvailable ? 'openclaw 命令可用' : '未检测到 openclaw 命令'
}

export function isAbsoluteLocalPath(value?: string | null) {
  return typeof value === 'string' && value.startsWith('/')
}

export function bybitPublicChannelStatusLabel(
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

export function bybitPublicDiagnosticSummary(item: {
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

export function tradeOriginLabel(origin: 'manual' | 'strategy' | 'exchange') {
  return (
    {
      manual: '手动',
      strategy: '策略',
      exchange: '交易所',
    }[origin] ?? origin
  )
}

export function jobStatusToneClass(status: string) {
  return `status-chip status-${status}`
}

export function jobStatusLabel(status: string) {
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

export function canRetryAgentJob(status: string) {
  return status === 'failed' || status === 'cancelled'
}

export function buildAlertNotification(alert: {
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

export function buildAgentJobNotification(job: {
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

export function buildOpsEventNotification(event?: ExecutionEvent | null) {
  const payload = event?.payload ?? {}
  if (!event) {
    return {
      title: '量化控制端事件',
      body: '收到一条空事件，已忽略。',
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'exchange_order.created') {
    const qty = String(payload.quantity ?? payload.qty ?? '--')
    const price = String(payload.price ?? '--')
    return {
      title: `真实委托已提交 · ${event.symbol ?? '未指定品种'}`,
      body: `${qty} @ ${price} 已提交到 Bybit，等待交易所回报。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'exchange_order.replaced') {
    const qty = String(payload.quantity ?? '--')
    const price = String(payload.price ?? '--')
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
    const count = String(payload.cancelled_count ?? 0)
    return {
      title: '真实委托已批量撤销',
      body: `本次共向 Bybit 提交 ${count} 条撤单请求。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'exchange_position.close_submitted') {
    const qty = String(payload.quantity ?? '--')
    const price = String(payload.price ?? '--')
    return {
      title: `真实持仓平仓委托已提交 · ${event.symbol ?? '未指定品种'}`,
      body: `${qty} @ ${price} 已按当前模式提交到 Bybit。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'exchange_position.close_all_submitted') {
    const count = String(payload.submitted_count ?? 0)
    return {
      title: '真实持仓批量平仓委托已提交',
      body: `本次共向 Bybit 提交 ${count} 条平仓委托。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'strategy.exchange_order.submitted') {
    const qty = String(payload.quantity ?? '--')
    const price = String(payload.price ?? '--')
    const strategyName = String(payload.strategy_name ?? '策略')
    return {
      title: `策略真实委托已提交 · ${event.symbol ?? '未指定品种'}`,
      body: `${strategyName} 已按当前信号提交 ${qty} @ ${price} 的 Bybit 委托。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'strategy.paper_trade.executed_manual') {
    const qty = String(payload.quantity ?? '--')
    const price = String(payload.price ?? '--')
    const strategyId = String(payload.strategy_id ?? '未指定策略')
    return {
      title: `策略纸面信号已执行 · ${event.symbol ?? '未指定品种'}`,
      body: `${strategyId} 已按当前信号写入 ${qty} @ ${price} 的 Paper 成交。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'paper_order.filled') {
    const qty = String(payload.qty ?? '--')
    const price = String(payload.price ?? '--')
    return {
      title: `Paper 委托已成交 · ${event.symbol ?? '未指定品种'}`,
      body: `${qty} @ ${price} 已写入本地成交与账户账本。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'paper_order.cancelled_all') {
    const count = String(payload.cancelled_count ?? 0)
    return {
      title: 'Paper 委托已批量取消',
      body: `本次共取消 ${count} 笔本地限价委托。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  if (event.event_type === 'manual_trade.positions_closed_all') {
    const count = String(payload.closed_count ?? 0)
    return {
      title: 'Paper 持仓已批量平仓',
      body: `本次共平掉 ${count} 个本地持仓方向。`,
      urgency: 'normal',
    } satisfies DesktopNotificationPayload
  }

  return {
    title: '量化控制端事件',
    body: auditNotificationBody(payload),
    urgency: 'normal',
  } satisfies DesktopNotificationPayload
}

export function proposalAcceptBlockedReason(
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

export function getAgentJobRetryCount(job: { retry_count?: number; context?: Record<string, unknown> }) {
  const topLevel = Number(job.retry_count)
  if (Number.isFinite(topLevel) && topLevel > 0) {
    return topLevel
  }
  const fromContext = Number(job.context?.retry_count)
  return Number.isFinite(fromContext) && fromContext > 0 ? fromContext : 0
}

export function getAgentJobRetriedFrom(job: { retried_from_job_id?: string | null; context?: Record<string, unknown> }) {
  if (typeof job.retried_from_job_id === 'string' && job.retried_from_job_id.trim()) {
    return job.retried_from_job_id
  }
  const fromContext = job.context?.retried_from_job_id
  return typeof fromContext === 'string' && fromContext.trim() ? fromContext : null
}

export function getAgentJobStrategyId(job: { strategy_id?: string | null; context?: Record<string, unknown> }) {
  if (typeof job.strategy_id === 'string' && job.strategy_id.trim()) {
    return job.strategy_id
  }
  const strategyId = job.context?.strategy_id
  return typeof strategyId === 'string' && strategyId.trim() ? strategyId : null
}

export function getAgentJobLinkedReviewId(job: { linked_review_id?: string | null; context?: Record<string, unknown> }) {
  if (typeof job.linked_review_id === 'string' && job.linked_review_id.trim()) {
    return job.linked_review_id
  }
  const reviewId = job.context?.linked_review_id
  return typeof reviewId === 'string' && reviewId.trim() ? reviewId : null
}

export function getAgentJobLinkedReviewPeriod(job: { linked_review_period?: string | null; context?: Record<string, unknown> }) {
  if (typeof job.linked_review_period === 'string' && job.linked_review_period.trim()) {
    return job.linked_review_period
  }
  const period = job.context?.linked_review_period
  return typeof period === 'string' && period.trim() ? period : null
}

export function getAgentJobBacktestId(job: { backtest_id?: string | null; context?: Record<string, unknown> }) {
  if (typeof job.backtest_id === 'string' && job.backtest_id.trim()) {
    return job.backtest_id
  }
  const backtestId = job.context?.backtest_id
  return typeof backtestId === 'string' && backtestId.trim() ? backtestId : null
}

export function getAgentJobChangeRequestId(job: { source_change_request_id?: string | null; context?: Record<string, unknown> }) {
  const changeRequestId = job.context?.change_request_id
  if (typeof changeRequestId === 'string' && changeRequestId.trim()) {
    return changeRequestId
  }
  if (typeof job.source_change_request_id === 'string' && job.source_change_request_id.trim()) {
    return job.source_change_request_id
  }
  const sourceChangeRequestId = job.context?.source_change_request_id
  return typeof sourceChangeRequestId === 'string' && sourceChangeRequestId.trim() ? sourceChangeRequestId : null
}

export function getAgentJobSourceChangeRequestId(job: { source_change_request_id?: string | null; context?: Record<string, unknown> }) {
  if (typeof job.source_change_request_id === 'string' && job.source_change_request_id.trim()) {
    return job.source_change_request_id
  }
  const changeRequestId = job.context?.source_change_request_id
  return typeof changeRequestId === 'string' && changeRequestId.trim() ? changeRequestId : null
}

export function getAgentJobSourceBacktestId(job: { source_backtest_id?: string | null; context?: Record<string, unknown> }) {
  if (typeof job.source_backtest_id === 'string' && job.source_backtest_id.trim()) {
    return job.source_backtest_id
  }
  const backtestId = job.context?.source_backtest_id
  return typeof backtestId === 'string' && backtestId.trim() ? backtestId : null
}

export function getAgentJobSourceReviewId(job: { source_review_id?: string | null; context?: Record<string, unknown> }) {
  if (typeof job.source_review_id === 'string' && job.source_review_id.trim()) {
    return job.source_review_id
  }
  const reviewId = job.context?.source_review_id
  return typeof reviewId === 'string' && reviewId.trim() ? reviewId : null
}

export function getAgentJobSourceProposalId(job: { source_proposal_id?: string | null; context?: Record<string, unknown> }) {
  if (typeof job.source_proposal_id === 'string' && job.source_proposal_id.trim()) {
    return job.source_proposal_id
  }
  const proposalId = job.context?.source_proposal_id
  return typeof proposalId === 'string' && proposalId.trim() ? proposalId : null
}

export function agentJobContextMeta(job?: AgentJob | null) {
  if (!job) return null
  const parts: string[] = []
  const strategyId = getAgentJobStrategyId(job)
  const backtestId = getAgentJobBacktestId(job)
  const changeRequestId = getAgentJobChangeRequestId(job)
  const sourceChangeRequestId = getAgentJobSourceChangeRequestId(job)
  const sourceBacktestId = getAgentJobSourceBacktestId(job)
  const sourceReviewId = getAgentJobSourceReviewId(job)
  const sourceProposalId = getAgentJobSourceProposalId(job)
  const retryCount = getAgentJobRetryCount(job)
  const retriedFrom = getAgentJobRetriedFrom(job)
  const linkedReviewId = getAgentJobLinkedReviewId(job)

  if (strategyId) {
    parts.push(`策略 ${strategyId}`)
  }
  if (backtestId) {
    parts.push(`回测 ${backtestId}`)
  }
  if (changeRequestId) {
    parts.push(`变更 ${changeRequestId}`)
  }
  if (sourceChangeRequestId && sourceChangeRequestId !== changeRequestId) {
    parts.push(`来源变更 ${sourceChangeRequestId}`)
  }
  if (sourceBacktestId && sourceBacktestId !== backtestId) {
    parts.push(`来源回测 ${sourceBacktestId}`)
  }
  if (sourceReviewId && sourceReviewId !== linkedReviewId) {
    parts.push(`来源复盘 ${sourceReviewId}`)
  }
  if (sourceProposalId) {
    parts.push(`来源提案 ${sourceProposalId}`)
  }
  if (retryCount > 0) {
    parts.push(`第 ${retryCount} 次重试`)
  }
  if (retriedFrom) {
    parts.push(`源任务 ${retriedFrom}`)
  }
  return parts.length ? parts.join(' · ') : null
}

export function backtestReviewJobMeta(
  job?: Pick<AgentJob, 'status' | 'result_summary' | 'retry_count' | 'context'> | StrategyActivityJobSummary | null,
  hasReview = false,
) {
  if (!job) return null
  const retryCount = getAgentJobRetryCount(job)
  let detail =
    typeof job.result_summary === 'string' && job.result_summary.trim()
      ? job.result_summary.trim()
      : null

  if (!detail) {
    if (job.status === 'queued') {
      detail = '回测复盘任务已进入 AI 调度队列，等待 OpenClaw 处理。'
    } else if (job.status === 'running') {
      detail = 'OpenClaw 正在生成这轮回测的复盘结果。'
    } else if (job.status === 'waiting') {
      detail = '当前任务正在等待外部依赖或上游资源返回。'
    } else if (job.status === 'completed' && !hasReview) {
      detail = '任务已完成，复盘结果正在写回列表。'
    } else if (job.status === 'failed') {
      detail = '复盘任务失败，可进入 AI 调度查看错误详情或直接重试。'
    } else if (job.status === 'cancelled') {
      detail = '复盘任务已取消，可进入 AI 调度查看原因或重新发起。'
    } else {
      detail = '当前这轮回测已有对应的 AI 复盘任务记录。'
    }
  }

  return {
    label: jobStatusLabel(job.status),
    detail: retryCount > 0 ? `${detail} · 第 ${retryCount} 次重试` : detail,
    canRetry: canRetryAgentJob(job.status),
  }
}

export function signalLabel(signal: 'neutral' | 'watch' | 'active') {
  return (
    {
      neutral: '中性观察',
      watch: '重点跟踪',
      active: '策略激活',
    }[signal] ?? signal
  )
}

export function riskLevelLabel(level: 'low' | 'medium' | 'high') {
  return (
    {
      low: '低风险',
      medium: '中风险',
      high: '高风险',
    }[level] ?? level
  )
}

export function signalToneClass(signal: 'neutral' | 'watch' | 'active') {
  return (
    {
      neutral: 'tone-signal-neutral',
      watch: 'tone-signal-watch',
      active: 'tone-signal-active',
    }[signal] ?? 'tone-signal-neutral'
  )
}

export function riskToneClass(level: 'low' | 'medium' | 'high') {
  return (
    {
      low: 'tone-risk-low',
      medium: 'tone-risk-medium',
      high: 'tone-risk-high',
    }[level] ?? 'tone-risk-medium'
  )
}

export function strategyRuntimeSignalLabel(signal: StrategyRuntimeSnapshot['signal']) {
  return (
    {
      long: '做多',
      short: '做空',
      flat: '空仓',
      watch: '观察',
    }[signal] ?? signal
  )
}

export function positionSideLabel(side: 'flat' | 'long' | 'short') {
  return (
    {
      flat: '空仓',
      long: '多仓',
      short: '空头',
    }[side] ?? side
  )
}

export function strategyRuntimeSignalToneClass(signal: StrategyRuntimeSnapshot['signal']) {
  return (
    {
      long: 'positive',
      short: 'negative',
      flat: 'tone-signal-neutral',
      watch: 'tone-signal-watch',
    }[signal] ?? 'tone-signal-neutral'
  )
}

export function strategyRuntimeGuardLabel(runtime: StrategyRuntimeSnapshot | null) {
  if (!runtime || runtime.guard_state === 'none') return null
  return (
    {
      live_stop_loss: '真实止损保护',
      cooldown: '冷却中',
      auto_dispatch_blocked: '执行受阻',
    }[runtime.guard_state] ?? null
  )
}

export function strategyPositionAlignmentLabel(runtime: StrategyRuntimeSnapshot | null) {
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

export function strategyCurrentPositionLabel(runtime: StrategyRuntimeSnapshot | null) {
  if (!runtime) return null
  if (runtime.current_position_side === 'flat' || !runtime.current_position_size) return '当前仓位 空仓'
  const sideLabel = runtime.current_position_side === 'long' ? '多头' : '空头'
  const avgSuffix = runtime.current_position_avg_price ? ` @ ${runtime.current_position_avg_price}` : ''
  return `当前仓位 ${sideLabel} ${runtime.current_position_size}${avgSuffix}`
}

export type StrategyExecutionPreview = {
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

export function extractStrategyExecutionPreview(runtime: StrategyRuntimeSnapshot | null): StrategyExecutionPreview | null {
  if (!runtime) return null
  const raw = runtime as StrategyRuntimeSnapshot & {
    execution_preview?: StrategyExecutionPreview
    executionPreview?: StrategyExecutionPreview
    preview?: StrategyExecutionPreview
  }
  return raw.execution_preview ?? raw.executionPreview ?? raw.preview ?? null
}

export function strategyExecutionPreviewMatchesMode(preview: StrategyExecutionPreview | null, mode: Mode) {
  return Boolean(preview && preview.mode === mode)
}

export function formatStrategySizingSummary(preview: StrategyExecutionPreview | null) {
  if (!preview?.sizing_available_balance_gap) return null
  const budget = preview.sizing_budget_notional ?? '--'
  const minimum = preview.sizing_minimum_required_notional ?? '--'
  const riskBudget = preview.sizing_risk_budget ?? '--'
  return `资金门槛还差 ${preview.sizing_available_balance_gap} · 预算 ${budget} / 最低 ${minimum} · risk_budget ${riskBudget}`
}

export function strategySupportsExecutionPreviewMode(
  strategy: StrategySummary | null | undefined,
  mode: Mode,
) {
  if (!strategy) return false
  if (mode === 'paper') {
    return strategy.mode === 'paper' || strategy.status === 'paper_only'
  }
  return strategy.mode === mode
}

export function buildStrategyModeMismatchPreview(
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

export function marketSourceLabel(source?: MarketDetail['source']) {
  return (
    {
      bybit_ws: 'Bybit 公共 WS',
      bybit_rest: 'Bybit 公共 REST',
      fallback: '本地回退',
      mock: '本地回退',
    }[source ?? 'fallback'] ?? '本地回退'
  )
}

export function isMarketFallbackSource(source?: MarketDetail['source']) {
  return source === 'fallback' || source === 'mock'
}

export function marketSourceToneClass(source?: MarketDetail['source']) {
  return isMarketFallbackSource(source) ? 'chip--warning' : 'chip--success'
}

export function deriveMarketLiveDiagnostics(
  payload: MarketLiveSnapshot,
  detail: MarketDetail,
  requestedSymbol: string,
  timeframe: string,
): MarketLiveDiagnostics {
  const diagnostics = payload.diagnostics
  const normalizedRequestedSymbol = String(requestedSymbol || '').trim().toUpperCase()
  return {
    requested_symbol: normalizedRequestedSymbol,
    effective_symbol: String(detail.symbol || diagnostics?.effective_symbol || normalizedRequestedSymbol).trim().toUpperCase(),
    timeframe,
    selection_corrected:
      String(detail.symbol || '').trim().toUpperCase() !== normalizedRequestedSymbol,
    detail_source: detail.source ?? diagnostics?.detail_source ?? 'fallback',
    detail_candle_count: detail.candles.length,
    watchlist_symbol_count: diagnostics?.watchlist_symbol_count ?? payload.watchlist.length,
    watchlist_real_detail_count:
      diagnostics?.watchlist_real_detail_count ??
      (payload.watchlist_details ?? []).filter((item) => item.source === 'bybit_ws' || item.source === 'bybit_rest').length,
    watchlist_fallback_detail_count:
      diagnostics?.watchlist_fallback_detail_count ??
      (payload.watchlist_details ?? []).filter((item) => isMarketFallbackSource(item.source)).length,
    watchlist_source_breakdown: diagnostics?.watchlist_source_breakdown ?? {},
    generated_in_ms: diagnostics?.generated_in_ms ?? 0,
  }
}

export function marketDiagnosticsSummaryShort(diagnostics?: MarketLiveDiagnostics | null) {
  if (!diagnostics) {
    return '--'
  }
  const source = marketSourceLabel(diagnostics.detail_source)
  const coverage = `${diagnostics.watchlist_real_detail_count}/${diagnostics.watchlist_symbol_count || 0}`
  const correction = diagnostics.selection_corrected ? ' · 已纠正' : ''
  return `${source} · ${coverage}${correction}`
}

export function marketDiagnosticsSummaryLong(diagnostics?: MarketLiveDiagnostics | null) {
  if (!diagnostics) {
    return '当前还没有行情切换诊断。'
  }
  const breakdown = Object.entries(diagnostics.watchlist_source_breakdown || {})
    .map(([source, count]) => `${marketSourceLabel(source as MarketDetail['source'])} ${count}`)
    .join(' / ')
  return [
    `主图 ${marketSourceLabel(diagnostics.detail_source)} · ${diagnostics.detail_candle_count} 根`,
    `自选命中 ${diagnostics.watchlist_real_detail_count}/${diagnostics.watchlist_symbol_count}`,
    diagnostics.selection_corrected ? `已自动纠正到 ${diagnostics.effective_symbol}` : null,
    diagnostics.generated_in_ms > 0 ? `本次构建 ${diagnostics.generated_in_ms}ms` : null,
    breakdown ? `来源分布 ${breakdown}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function marketDiagnosticsToneClass(diagnostics?: MarketLiveDiagnostics | null) {
  if (!diagnostics) {
    return ''
  }
  if (isMarketFallbackSource(diagnostics.detail_source) || diagnostics.watchlist_fallback_detail_count > 0) {
    return 'warning'
  }
  return 'positive'
}

export function accountSourceLabel(source?: AccountOverview['source']) {
  return (
    {
      bybit_private: '私有只读',
      paper: 'Paper 账户',
      mock: 'Mock 回退',
    }[source ?? 'mock'] ?? 'Mock 回退'
  )
}

export function orderSourceLabel(source?: 'mock' | 'paper' | 'bybit_private') {
  return (
    {
      bybit_private: '交易所',
      paper: 'Paper',
      mock: 'Mock 回退',
    }[source ?? 'mock'] ?? 'Mock 回退'
  )
}

export function pnlToneClass(value?: string) {
  if (!value || value === '--') return ''
  return value.trim().startsWith('-') ? 'negative' : 'positive'
}

export function executionHealthLabel(health?: ControlSnapshot['execution_health']) {
  if (!health?.top_issue) return '运行稳定'
  return health.top_issue
}

export function executionHealthToneClass(health?: ControlSnapshot['execution_health']) {
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

export function executionHealthTooltip(health?: ControlSnapshot['execution_health']) {
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

export function activityAlertToneClass(alert: AlertRecord) {
  if (alert.severity === 'P0') return 'negative'
  if (alert.severity === 'P1') return 'tone-risk-medium'
  return ''
}

export function orderActivitySummary(order: OrderRecord) {
  return `${order.symbol} · ${order.side === 'buy' ? '买' : '卖'} · ${order.qty}@${order.price}`
}

export function orderAppearsActive(order?: OrderRecord | null) {
  if (!order) return false
  const status = String(order.status || '').trim().toLowerCase()
  if (!status) return false
  return !(
    status.includes('fill') ||
    status.includes('cancel') ||
    status.includes('reject') ||
    status.includes('deactiv') ||
    status.includes('close')
  )
}

export function tradeActivitySummary(trade: TradeRecord) {
  return `${trade.symbol} · ${trade.side === 'buy' ? '买' : '卖'} · ${trade.quantity}@${trade.price}`
}

export function strategyActivityLatestOrderSummary(
  activity?: StrategyActivitySnapshot | null,
  latestOrderRecord?: OrderRecord | null,
) {
  if (activity?.latest_order) return activity.latest_order
  const order = latestOrderRecord ?? activity?.latest_order_record ?? activity?.recent_orders[0]
  return order ? `${orderActivitySummary(order)} · ${order.status}` : null
}

export function strategyActivityLatestHistoricalOrderSummary(
  activity?: StrategyActivitySnapshot | null,
  latestHistoricalOrderRecord?: OrderRecord | null,
) {
  if (activity?.latest_historical_order) return activity.latest_historical_order
  const order =
    latestHistoricalOrderRecord ?? activity?.latest_historical_order_record ?? activity?.recent_orders[0]
  return order ? `${orderActivitySummary(order)} · ${order.status}` : null
}

export function strategyActivityLatestTradeSummary(
  activity?: StrategyActivitySnapshot | null,
  latestTradeRecord?: TradeRecord | null,
) {
  if (activity?.latest_trade) return activity.latest_trade
  const trade = latestTradeRecord ?? activity?.latest_trade_record ?? activity?.recent_trades[0]
  return trade ? `${tradeActivitySummary(trade)} · ${trade.status ?? 'filled'} · pnl ${trade.pnl}` : null
}

export function strategyActivityLatestAlertSummary(
  activity?: StrategyActivitySnapshot | null,
  latestAlertRecord?: AlertRecord | null,
) {
  if (activity?.latest_alert) return activity.latest_alert
  const alert = latestAlertRecord ?? activity?.latest_alert_record ?? activity?.recent_alerts[0]
  if (!alert) return null
  const detail = [alert.description, alert.suggested_action].filter(Boolean).join(' · ')
  return `${alert.severity} ${alert.title}${detail ? ` · ${detail}` : ''}`
}

export function strategyActivityLatestPendingAlertSummary(
  activity?: StrategyActivitySnapshot | null,
  latestPendingAlertRecord?: AlertRecord | null,
) {
  if (activity?.latest_pending_alert) return activity.latest_pending_alert
  const alert =
    latestPendingAlertRecord ??
    activity?.latest_pending_alert_record ??
    activity?.recent_alerts.find((item) => !item.acknowledged) ??
    null
  if (!alert) return null
  const detail = [alert.description, alert.suggested_action].filter(Boolean).join(' · ')
  return `${alert.severity} ${alert.title}${detail ? ` · ${detail}` : ''}`
}

export function strategyActivityLatestAuditSummary(
  activity?: StrategyActivitySnapshot | null,
  latestAuditEventRecord?: ExecutionEvent | null,
) {
  if (activity?.latest_audit_event) return activity.latest_audit_event
  const event = latestAuditEventRecord ?? activity?.latest_audit_event_record ?? activity?.recent_audit_events[0]
  return event ? `${event.event_type} · ${summarizeAuditEvent(event)}` : null
}

export function strategyActivityLatestProposalSummary(
  proposal: StrategyProposal | null,
  linkedChangeRequest?: ChangeRequest | null,
  linkedBacktest?: BacktestRun | null,
  linkedReview?: ReviewDocument | null,
  linkedJob?: AgentJob | null,
) {
  if (!proposal) return null
  const parts = [`${proposalTypeLabel(proposal.proposal_type)} · ${proposalStatusLabel(proposal.status)}`, proposal.title]
  const outcomes = proposalOutcomeDetails(proposal, linkedChangeRequest, linkedBacktest, linkedReview, linkedJob)
  if (outcomes.length) {
    parts.push(outcomes[0]!)
  }
  return parts.join(' · ')
}

export function strategyActivityLatestChangeRequestSummary(request: ChangeRequest | null) {
  if (!request) return null
  const parts = [`${request.id} · ${changeRequestStatusLabel(request.status)}`, request.type]
  if (request.manual_followup_required) {
    parts.push('需人工跟进')
  }
  if (request.linked_backtest_id) {
    parts.push(`回测 ${request.linked_backtest_id}`)
  }
  if (request.linked_review_id) {
    parts.push(`复盘 ${request.linked_review_id}`)
  } else if (request.follow_up_result_summary) {
    parts.push(request.follow_up_result_summary)
  }
  return parts.join(' · ')
}

export function prependUniqueActivityItem<T>(
  items: T[],
  item: T | null | undefined,
  getId: (value: T) => string,
  maxVisible: number,
) {
  if (!item) return items
  const itemId = getId(item)
  if (!itemId || items.some((existing) => getId(existing) === itemId)) {
    return items
  }
  return [item, ...items.slice(0, maxVisible - 1)]
}

export function strategyAgentJobSummary(job: StrategyActivityJobSummary | AgentJob) {
  const retryCount = getAgentJobRetryCount(job)
  return `${job.job_type} · ${job.status}${retryCount > 0 ? ` · 第 ${retryCount} 次重试` : ''}`
}

export function strategyActivityHeadline(activity?: StrategyActivitySnapshot | null) {
  if (!activity?.runtime) return '运行态尚未准备好'
  return `${strategyRuntimeSignalLabel(activity.runtime.signal)} · ${activity.runtime.next_action}`
}

export function runtimeWorkerStatusLabel(
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

export function runtimeWorkerStatusDetail(
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

export function runtimeWorkerStatusTooltip(
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

export function marketTradeSideLabel(side: MarketRecentTrade['side']) {
  return side === 'buy' ? 'B' : 'S'
}

export function marketTradeSideClass(side: MarketRecentTrade['side']) {
  return side === 'buy' ? 'positive' : 'negative'
}

export function buildCandleOption(detail: MarketDetail) {
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

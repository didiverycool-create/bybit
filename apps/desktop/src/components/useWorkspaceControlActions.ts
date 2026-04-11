import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

import { api } from '../api'
import type { SettingsPayload, WatchlistInstrument } from '../types'
import type {
  DesktopNotificationDelivery,
  DesktopNotificationPayload,
  SettingsDraft,
  SettingsNotificationChannel,
} from '../utils/app-helpers'
import {
  buildSettingsDraft,
  normalizeSettingsNotificationChannels,
  normalizeSettingsQuietTime,
  normalizeSettingsText,
  normalizeSettingsUrl,
  notificationQuietHoursLabel,
  resolveErrorMessage,
  schedulerCommandFeedbackDetail,
} from '../utils/app-helpers'

type ActionTone = 'success' | 'warning' | 'error'

type SubmitStrategyRequest = (
  type: string,
  summary: string,
  payload: Record<string, unknown>,
  priority?: 'low' | 'normal' | 'high' | 'critical',
) => Promise<void>

type UseWorkspaceControlActionsArgs = {
  refreshControlData: () => Promise<void>
  queryClient: QueryClient
  settings: SettingsPayload | null | undefined
  settingsDraft: SettingsDraft
  settingsDraftDirty: boolean
  setSettingsDraft: Dispatch<SetStateAction<SettingsDraft>>
  lastLoadedSettingsSignatureRef: MutableRefObject<string>
  desktopNotificationsEnabled: boolean
  dispatchDesktopNotification: (
    payload: DesktopNotificationPayload,
    options?: {
      bypassCooldown?: boolean
      dedupeKey?: string | null
    },
  ) => Promise<DesktopNotificationDelivery>
  watchlistDraftSymbol: string
  watchlistDraftMarket: string
  watchlistAlertDrafts: Record<string, string>
  setSelectedSymbol: Dispatch<SetStateAction<string>>
  setWatchlistDraftSymbol: Dispatch<SetStateAction<string>>
  setWatchlistManagerOpen: Dispatch<SetStateAction<boolean>>
  showFeedback: (tone: ActionTone, title: string, detail: string) => void
  submitStrategyRequest: SubmitStrategyRequest
}

export function useWorkspaceControlActions({
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
}: UseWorkspaceControlActionsArgs) {
  const schedulerMutation = useMutation({
    mutationFn: api.sendSchedulerCommand,
    onSuccess: refreshControlData,
  })

  const restartRuntimeWorkerMutation = useMutation({
    mutationFn: api.restartStrategyRuntimeWorker,
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

  const settingsMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: async (nextSettings) => {
      queryClient.setQueryData(['settings'], nextSettings)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['settings'] }),
        queryClient.invalidateQueries({ queryKey: ['grafana'] }),
        refreshControlData(),
      ])
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
          : schedulerCommandFeedbackDetail(result, reason)
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

  const toggleSettingsNotificationChannel = (channel: SettingsNotificationChannel) => {
    const channels = normalizeSettingsNotificationChannels(settingsDraft.notificationChannels)
    if (channels.includes(channel) && channels.length === 1) {
      showFeedback('warning', '至少保留一个通知渠道', '桌面端至少需要保留一个可用通知渠道，避免关键提醒被完全关闭。')
      return
    }
    setSettingsDraft((current) => {
      const currentChannels = normalizeSettingsNotificationChannels(current.notificationChannels)
      return currentChannels.includes(channel)
        ? {
            ...current,
            notificationChannels: currentChannels.filter((item) => item !== channel),
          }
        : {
            ...current,
            notificationChannels: normalizeSettingsNotificationChannels([...currentChannels, channel]),
          }
    })
  }

  const restoreSettingsDraft = () => {
    if (!settings) {
      return
    }
    const nextDraft = buildSettingsDraft(settings)
    setSettingsDraft(nextDraft)
    lastLoadedSettingsSignatureRef.current = JSON.stringify(nextDraft)
  }

  const saveSettings = async () => {
    if (!settings) {
      showFeedback('warning', '设置尚未就绪', '本地控制服务还没有返回当前设置，请稍后再试。')
      return
    }
    if (!settingsDraftDirty) {
      showFeedback('warning', '当前没有可保存的设置', '你还没有修改本地设置。')
      return
    }

    const bybitWebEntry = normalizeSettingsUrl(settingsDraft.bybitWebEntry)
    const apiBaseUrl = normalizeSettingsUrl(settingsDraft.apiBaseUrl)
    const productLanguage = normalizeSettingsText(settingsDraft.productLanguage)
    const notificationQuietHoursStart = normalizeSettingsQuietTime(settingsDraft.notificationQuietHoursStart, '')
    const notificationQuietHoursEnd = normalizeSettingsQuietTime(settingsDraft.notificationQuietHoursEnd, '')
    const grafanaBaseUrl = normalizeSettingsUrl(settingsDraft.grafanaBaseUrl)
    const grafanaDashboardUid = normalizeSettingsText(settingsDraft.grafanaDashboardUid)
    const grafanaOrgId = Number.parseInt(settingsDraft.grafanaOrgId.trim(), 10)

    if (!bybitWebEntry) {
      showFeedback('warning', '网页入口不能为空', '登录、账户设置和 API Key 创建统一使用 bybit-global.com 网页入口。')
      return
    }
    if (!apiBaseUrl) {
      showFeedback('warning', 'API Base URL 不能为空', '请输入 Bybit 公共 API 域名，例如 https://api.bybit.com。')
      return
    }
    if (!productLanguage) {
      showFeedback('warning', '产品语言不能为空', '请输入产品语言代码，例如 zh-CN、zh-TW 或 en-US。')
      return
    }
    if (!notificationQuietHoursStart || !notificationQuietHoursEnd) {
      showFeedback('warning', '静默时段格式无效', '请使用 HH:MM 的 24 小时格式，例如 23:00 或 08:30。')
      return
    }
    if (settingsDraft.notificationQuietHoursEnabled && notificationQuietHoursStart === notificationQuietHoursEnd) {
      showFeedback('warning', '静默时段无效', '通知静默开始和结束时间不能相同。')
      return
    }
    if (!Number.isFinite(grafanaOrgId) || grafanaOrgId < 1) {
      showFeedback('warning', 'Grafana Org ID 无效', 'Grafana Org ID 必须是大于等于 1 的整数。')
      return
    }

    try {
      const nextSettings = await settingsMutation.mutateAsync({
        bybit_web_entry: bybitWebEntry,
        api_base_url: apiBaseUrl,
        default_mode: settingsDraft.defaultMode,
        notification_channels: normalizeSettingsNotificationChannels(settingsDraft.notificationChannels),
        notification_quiet_hours_enabled: settingsDraft.notificationQuietHoursEnabled,
        notification_quiet_hours_start: notificationQuietHoursStart,
        notification_quiet_hours_end: notificationQuietHoursEnd,
        product_language: productLanguage,
        grafana_base_url: grafanaBaseUrl,
        grafana_dashboard_uid: grafanaDashboardUid,
        grafana_org_id: grafanaOrgId,
        grafana_theme: settingsDraft.grafanaTheme,
      })
      const nextDraft = buildSettingsDraft(nextSettings)
      setSettingsDraft(nextDraft)
      lastLoadedSettingsSignatureRef.current = JSON.stringify(nextDraft)
      showFeedback('success', '本地设置已保存', '网页入口、公共 API、通知通道与 Grafana 配置已经写回控制端并立即生效。')
    } catch (error) {
      showFeedback('error', '本地设置保存失败', resolveErrorMessage(error))
    }
  }

  const triggerDesktopNotificationTest = async () => {
    if (!desktopNotificationsEnabled) {
      showFeedback('warning', '桌面通知当前已关闭', '请先在通知通道中保留 desktop，再测试系统通知。')
      return
    }

    const delivered = await dispatchDesktopNotification(
      {
        title: '桌面通知测试',
        body: '这是一条来自量化交易控制端的测试通知，用于确认原生提醒链路可用。',
        urgency: 'normal',
      },
      { bypassCooldown: true },
    )

    if (delivered === 'delivered') {
      showFeedback('success', '测试通知已发送', '原生通知链路已触发，可以继续用它接收高优先级提醒和 AI 任务失败通知。')
      return
    }

    if (delivered === 'suppressed') {
      showFeedback(
        'warning',
        '测试通知已静默',
        `当前正处于通知静默时段 ${notificationQuietHoursLabel(settings)}，普通通知不会弹出；critical 级提醒仍会继续放行。`,
      )
      return
    }

    showFeedback('warning', '测试通知未显示', '当前环境没有可用的原生通知能力，或浏览器通知权限未开启。')
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
    item: WatchlistInstrument,
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

  return {
    schedulerMutationPending: schedulerMutation.isPending,
    restartRuntimeWorkerPending: restartRuntimeWorkerMutation.isPending,
    alertMutationPending: alertMutation.isPending,
    watchlistAddPending: watchlistAddMutation.isPending,
    watchlistRemovePending: watchlistRemoveMutation.isPending,
    settingsMutationPending: settingsMutation.isPending,
    runSchedulerCommand,
    restartStrategyRuntimeWorker,
    toggleSettingsNotificationChannel,
    restoreSettingsDraft,
    saveSettings,
    triggerDesktopNotificationTest,
    toggleAlertAcknowledged,
    submitWatchlistItem,
    removeWatchlistItem,
    submitWatchlistAlertRule,
  }
}

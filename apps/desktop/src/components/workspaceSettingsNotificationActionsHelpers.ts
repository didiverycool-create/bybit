import type { DesktopNotificationDelivery, DesktopNotificationPayload, SettingsDraft } from '../utils/app-helpers'
import {
  normalizeSettingsNotificationChannels,
  normalizeSettingsQuietTime,
  normalizeSettingsText,
  normalizeSettingsUrl,
  notificationQuietHoursLabel,
} from '../utils/app-helpers'
import type { SettingsPayload } from '../types'

type ActionTone = 'success' | 'warning' | 'error'

export type WorkspaceSettingsNotificationSaveInput = {
  bybit_web_entry: string
  api_base_url: string
  default_mode: SettingsDraft['defaultMode']
  notification_channels: SettingsDraft['notificationChannels']
  notification_quiet_hours_enabled: boolean
  notification_quiet_hours_start: string
  notification_quiet_hours_end: string
  product_language: string
  grafana_base_url: string
  grafana_dashboard_uid: string
  grafana_org_id: number
  grafana_theme: SettingsDraft['grafanaTheme']
}

export type WorkspaceSettingsNotificationSaveValidationResult =
  | {
      ok: true
      input: WorkspaceSettingsNotificationSaveInput
    }
  | {
      ok: false
      tone: ActionTone
      title: string
      detail: string
    }

export function validateWorkspaceSettingsNotificationSave({
  settings,
  settingsDraft,
  settingsDraftDirty,
}: {
  settings: SettingsPayload | null | undefined
  settingsDraft: SettingsDraft
  settingsDraftDirty: boolean
}): WorkspaceSettingsNotificationSaveValidationResult {
  if (!settings) {
    return {
      ok: false,
      tone: 'warning',
      title: '设置尚未就绪',
      detail: '本地控制服务还没有返回当前设置，请稍后再试。',
    }
  }
  if (!settingsDraftDirty) {
    return {
      ok: false,
      tone: 'warning',
      title: '当前没有可保存的设置',
      detail: '你还没有修改本地设置。',
    }
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
    return {
      ok: false,
      tone: 'warning',
      title: '网页入口不能为空',
      detail: '登录、账户设置和 API Key 创建统一使用 bybit-global.com 网页入口。',
    }
  }
  if (!apiBaseUrl) {
    return {
      ok: false,
      tone: 'warning',
      title: 'API Base URL 不能为空',
      detail: '请输入 Bybit 公共 API 域名，例如 https://api.bybit.com。',
    }
  }
  if (!productLanguage) {
    return {
      ok: false,
      tone: 'warning',
      title: '产品语言不能为空',
      detail: '请输入产品语言代码，例如 zh-CN、zh-TW 或 en-US。',
    }
  }
  if (!notificationQuietHoursStart || !notificationQuietHoursEnd) {
    return {
      ok: false,
      tone: 'warning',
      title: '静默时段格式无效',
      detail: '请使用 HH:MM 的 24 小时格式，例如 23:00 或 08:30。',
    }
  }
  if (settingsDraft.notificationQuietHoursEnabled && notificationQuietHoursStart === notificationQuietHoursEnd) {
    return {
      ok: false,
      tone: 'warning',
      title: '静默时段无效',
      detail: '通知静默开始和结束时间不能相同。',
    }
  }
  if (!Number.isFinite(grafanaOrgId) || grafanaOrgId < 1) {
    return {
      ok: false,
      tone: 'warning',
      title: 'Grafana Org ID 无效',
      detail: 'Grafana Org ID 必须是大于等于 1 的整数。',
    }
  }

  return {
    ok: true,
    input: {
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
    },
  }
}

export async function triggerWorkspaceSettingsNotificationTest({
  settings,
  desktopNotificationsEnabled,
  dispatchDesktopNotification,
  showFeedback,
}: {
  settings: SettingsPayload | null | undefined
  desktopNotificationsEnabled: boolean
  dispatchDesktopNotification: (
    payload: DesktopNotificationPayload,
    options?: {
      bypassCooldown?: boolean
      dedupeKey?: string | null
    },
  ) => Promise<DesktopNotificationDelivery>
  showFeedback: (tone: ActionTone, title: string, detail: string) => void
}) {
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

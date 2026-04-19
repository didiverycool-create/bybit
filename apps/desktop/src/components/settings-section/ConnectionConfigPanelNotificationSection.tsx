import type { ConnectionConfigPanelNotificationSectionProps } from './ConnectionConfigPanel.types'
import {
  formatNotificationSnoozeUntilLabel,
  isNotificationSnoozeActive,
  notificationQuietHoursLabel,
  notificationSnoozePresetsMinutes,
  remainingNotificationSnoozeMinutes,
  settingsNotificationChannelOptions,
} from '../../utils/app-helpers'
import { useNotificationSnooze } from '../useNotificationSnooze'

function buildSnoozePresetLabel(minutes: number) {
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60} 小时`
  }
  return `${minutes} 分钟`
}

export default function ConnectionConfigPanelNotificationSection({
  settingsMutationPending,
  settingsQueryLoading,
  settingsDraft,
  setSettingsDraft,
  onToggleSettingsNotificationChannel,
  settings,
  notificationQuietHoursActive,
}: ConnectionConfigPanelNotificationSectionProps) {
  const { snoozeUntilMs, activateSnoozeMinutes, clearSnooze } = useNotificationSnooze()
  const snoozeActive = isNotificationSnoozeActive(snoozeUntilMs)
  const snoozeRemainingMinutes = remainingNotificationSnoozeMinutes(snoozeUntilMs)
  const snoozeUntilLabel = formatNotificationSnoozeUntilLabel(snoozeUntilMs)
  const controlsDisabled = settingsMutationPending || settingsQueryLoading

  return (
    <div className="settings-block">
      <span className="section-label">通知通道</span>
      <div className="compact-switch settings-switch">
        {settingsNotificationChannelOptions.map((item) => {
          const active = settingsDraft.notificationChannels.includes(item.value)
          return (
            <button
              key={item.value}
              type="button"
              className={active ? 'pill pill--compact active' : 'pill pill--compact'}
              disabled={controlsDisabled}
              onClick={() => onToggleSettingsNotificationChannel(item.value)}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <p className="panel-note">
        保存后会立即更新桌面通知通道；若移除 <code>desktop</code>，设置页里的测试通知也会一并停用。
      </p>
      <div className="field-grid">
        <label className="field">
          <span>通知静默</span>
          <select
            value={settingsDraft.notificationQuietHoursEnabled ? 'enabled' : 'disabled'}
            disabled={controlsDisabled}
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                notificationQuietHoursEnabled: event.target.value === 'enabled',
              }))
            }
          >
            <option value="disabled">关闭</option>
            <option value="enabled">开启</option>
          </select>
        </label>
        <label className="field">
          <span>静默开始</span>
          <input
            type="time"
            value={settingsDraft.notificationQuietHoursStart}
            disabled={controlsDisabled}
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                notificationQuietHoursStart: event.target.value,
              }))
            }
          />
        </label>
        <label className="field">
          <span>静默结束</span>
          <input
            type="time"
            value={settingsDraft.notificationQuietHoursEnd}
            disabled={controlsDisabled}
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                notificationQuietHoursEnd: event.target.value,
              }))
            }
          />
        </label>
      </div>
      <p className="panel-note">
        当前配置：{notificationQuietHoursLabel(settings)}。
        {notificationQuietHoursActive
          ? ' 当前正处于静默时段，普通桌面通知会被静默，critical 级提醒仍会继续放行。'
          : ' 普通桌面通知会按这里的静默时段自动抑制，critical 级提醒不会被静默。'}
      </p>
      <div className="settings-block__snooze">
        <span className="section-label">临时静默</span>
        <div className="compact-switch settings-switch" role="group" aria-label="临时静默时长选择">
          {notificationSnoozePresetsMinutes.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className="pill pill--compact"
              onClick={() => activateSnoozeMinutes(minutes)}
              aria-label={`临时静默 ${buildSnoozePresetLabel(minutes)}`}
            >
              {buildSnoozePresetLabel(minutes)}
            </button>
          ))}
          <button
            type="button"
            className={snoozeActive ? 'pill pill--compact active' : 'pill pill--compact'}
            onClick={clearSnooze}
            disabled={!snoozeActive}
            aria-label="立刻取消临时静默"
          >
            取消静默
          </button>
        </div>
        <p className="panel-note">
          {snoozeActive && snoozeUntilLabel
            ? `临时静默中，剩余约 ${snoozeRemainingMinutes} 分钟（预计 ${snoozeUntilLabel} 解除）。critical 级提醒仍然放行。`
            : '未启用临时静默。点击上方按钮可以在不改动静默时段配置的情况下，临时静音普通桌面通知。'}
        </p>
      </div>
      <p className="panel-note">
        同内容的普通桌面通知当前还会自动做 2 分钟短时去重，避免同类提醒短时间重复刷屏；测试通知和 critical 级提醒不受这条去重影响。
      </p>
    </div>
  )
}

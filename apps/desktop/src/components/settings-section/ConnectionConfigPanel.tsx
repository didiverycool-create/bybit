import type { Dispatch, SetStateAction } from 'react'
import { ExternalLink, Save } from 'lucide-react'

import type {
  BybitPrivateStatus,
  Mode,
  OpenClawStatus,
  SettingsPayload,
  StrategySummary,
} from '../../types'
import {
  bybitPrivateConfigSourceLabel,
  configPresenceLabel,
  isAbsoluteLocalPath,
  notificationQuietHoursLabel,
  openClawCommandLabel,
  settingsNotificationChannelOptions,
} from '../../utils/app-helpers'
import type { SettingsDraft, SettingsNotificationChannel } from '../../utils/app-helpers'

type OpenLocalPathOptions = {
  label: string
  revealInFolder?: boolean
}

export type ConnectionConfigPanelProps = {
  selectedStrategy?: StrategySummary | null
  serviceAvailable: boolean
  settingsMutationPending: boolean
  settingsQueryLoading: boolean
  settingsDraftDirty: boolean
  settingsDraft: SettingsDraft
  setSettingsDraft: Dispatch<SetStateAction<SettingsDraft>>
  onToggleSettingsNotificationChannel: (value: SettingsNotificationChannel) => void
  settings?: SettingsPayload | null
  notificationQuietHoursActive: boolean
  bybitPrivateStatus?: BybitPrivateStatus | null
  openClawStatus?: OpenClawStatus | null
  onOpenLocalPath: (path?: string | null, options?: OpenLocalPathOptions) => void | Promise<void>
  onSaveSettings: () => void
  onRestoreSettingsDraft: () => void
}

export default function ConnectionConfigPanel({
  selectedStrategy,
  serviceAvailable,
  settingsMutationPending,
  settingsQueryLoading,
  settingsDraftDirty,
  settingsDraft,
  setSettingsDraft,
  onToggleSettingsNotificationChannel,
  settings,
  notificationQuietHoursActive,
  bybitPrivateStatus,
  openClawStatus,
  onOpenLocalPath,
  onSaveSettings,
  onRestoreSettingsDraft,
}: ConnectionConfigPanelProps) {
  return (
    <article
      className="panel"
      data-strategy-current-panel="1"
      data-strategy-current-id={selectedStrategy?.id ?? ''}
      data-strategy-current-name={selectedStrategy?.name ?? ''}
    >
      <div className="panel-head">
        <div>
          <span className="section-label">接入配置</span>
          <h3>网页入口、API 与 OpenClaw</h3>
        </div>
        <span
          className={`chip ${
            settingsMutationPending ? 'chip--warning' : settingsDraftDirty ? 'chip--warning' : 'chip--success'
          }`}
        >
          {settingsMutationPending ? '设置保存中' : settingsDraftDirty ? '有未保存设置' : '设置已同步'}
        </span>
      </div>
      <div className="field-grid">
        <label className="field field--wide">
          <span>Bybit 网页入口</span>
          <input
            value={settingsDraft.bybitWebEntry}
            disabled={settingsMutationPending || settingsQueryLoading}
            placeholder="https://www.bybit-global.com/"
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                bybitWebEntry: event.target.value,
              }))
            }
          />
        </label>
        <label className="field field--wide">
          <span>公共 API Base URL</span>
          <input
            value={settingsDraft.apiBaseUrl}
            disabled={settingsMutationPending || settingsQueryLoading}
            placeholder="https://api.bybit.com"
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                apiBaseUrl: event.target.value,
              }))
            }
          />
        </label>
        <label className="field">
          <span>默认模式</span>
          <select
            value={settingsDraft.defaultMode}
            disabled={settingsMutationPending || settingsQueryLoading}
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                defaultMode: event.target.value as Mode,
              }))
            }
          >
            <option value="paper">paper</option>
            <option value="demo">demo</option>
            <option value="live">live</option>
          </select>
        </label>
        <label className="field">
          <span>产品语言</span>
          <input
            value={settingsDraft.productLanguage}
            disabled={settingsMutationPending || settingsQueryLoading}
            placeholder="zh-CN"
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                productLanguage: event.target.value,
              }))
            }
          />
        </label>
        <label className="field field--wide">
          <span>Grafana Base URL</span>
          <input
            value={settingsDraft.grafanaBaseUrl}
            disabled={settingsMutationPending || settingsQueryLoading}
            placeholder="留空表示未配置"
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                grafanaBaseUrl: event.target.value,
              }))
            }
          />
        </label>
        <label className="field">
          <span>Grafana Dashboard UID</span>
          <input
            value={settingsDraft.grafanaDashboardUid}
            disabled={settingsMutationPending || settingsQueryLoading}
            placeholder="留空表示未配置"
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                grafanaDashboardUid: event.target.value,
              }))
            }
          />
        </label>
        <label className="field">
          <span>Grafana Org ID</span>
          <input
            type="number"
            min="1"
            value={settingsDraft.grafanaOrgId}
            disabled={settingsMutationPending || settingsQueryLoading}
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                grafanaOrgId: event.target.value,
              }))
            }
          />
        </label>
        <label className="field">
          <span>Grafana Theme</span>
          <select
            value={settingsDraft.grafanaTheme}
            disabled={settingsMutationPending || settingsQueryLoading}
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                grafanaTheme: event.target.value as 'dark' | 'light',
              }))
            }
          >
            <option value="dark">dark</option>
            <option value="light">light</option>
          </select>
        </label>
      </div>
      <div className="settings-grid">
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
                  disabled={settingsMutationPending || settingsQueryLoading}
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
                disabled={settingsMutationPending || settingsQueryLoading}
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
                disabled={settingsMutationPending || settingsQueryLoading}
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
                disabled={settingsMutationPending || settingsQueryLoading}
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
          <p className="panel-note">
            同内容的普通桌面通知当前还会自动做 2 分钟短时去重，避免同类提醒短时间重复刷屏；测试通知和 critical 级提醒不受这条去重影响。
          </p>
        </div>
        <div className="settings-block">
          <span className="section-label">Bybit 私有只读配置</span>
          <div className="contract-list">
            <code>{bybitPrivateConfigSourceLabel(bybitPrivateStatus?.source)}</code>
            <code>{bybitPrivateStatus?.config_path ?? '~/.bybit-control/private-api.json'}</code>
            <code>{configPresenceLabel(bybitPrivateStatus?.config_exists)}</code>
          </div>
          <p className="panel-note">
            当前 API 域名：<code>{bybitPrivateStatus?.api_base_url ?? settingsDraft.apiBaseUrl ?? 'https://api.bybit.com'}</code>。
            浏览器里的登录、账户设置和 API Key 创建仍使用 {settingsDraft.bybitWebEntry || 'https://www.bybit-global.com/'}，两者用途不同。
          </p>
          <p className="panel-note">
            示例文件：<code>{bybitPrivateStatus?.example_config_path ?? '/Users/leo/Desktop/Work/bybit/services/control-api/private-api.example.json'}</code>。
            如果同时设置环境变量，环境变量会覆盖本地配置文件。
          </p>
          <div className="hero-actions hero-actions--compact">
            <button
              type="button"
              className="ghost-button"
              disabled={!isAbsoluteLocalPath(bybitPrivateStatus?.config_path)}
              onClick={() =>
                void onOpenLocalPath(bybitPrivateStatus?.config_path, {
                  label: 'Bybit 私有配置目录',
                  revealInFolder: true,
                })
              }
            >
              <ExternalLink size={14} />
              打开配置目录
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={!isAbsoluteLocalPath(bybitPrivateStatus?.example_config_path)}
              onClick={() =>
                void onOpenLocalPath(bybitPrivateStatus?.example_config_path, {
                  label: 'Bybit 私有配置示例',
                })
              }
            >
              <ExternalLink size={14} />
              打开示例文件
            </button>
          </div>
        </div>
        <div className="settings-block">
          <span className="section-label">OpenClaw 运行配置</span>
          <div className="contract-list">
            <code>{openClawCommandLabel(openClawStatus?.command_available)}</code>
            <code>{openClawStatus?.config_path ?? '~/.openclaw/openclaw.json'}</code>
            <code>{configPresenceLabel(openClawStatus?.config_exists)}</code>
            <code>{openClawStatus?.gateway_url ?? settings?.openclaw_gateway_url ?? 'ws://127.0.0.1:18789'}</code>
            <code>{openClawStatus?.resolved_agent ?? settings?.openclaw_agent ?? 'codex'}</code>
          </div>
          <p className="panel-note">
            OpenClaw 网关地址与默认 Agent 继续由本机外部配置驱动，这里只读展示，避免出现"界面已改但运行态未切换"。
          </p>
          <div className="hero-actions hero-actions--compact">
            <button
              type="button"
              className="ghost-button"
              disabled={!isAbsoluteLocalPath(openClawStatus?.config_path)}
              onClick={() =>
                void onOpenLocalPath(openClawStatus?.config_path, {
                  label: 'OpenClaw 配置目录',
                  revealInFolder: true,
                })
              }
            >
              <ExternalLink size={14} />
              打开配置目录
            </button>
          </div>
        </div>
      </div>
      <div className="hero-actions hero-actions--compact">
        <button
          type="button"
          className="primary-button"
          disabled={!serviceAvailable || settingsMutationPending || settingsQueryLoading || !settingsDraftDirty}
          onClick={onSaveSettings}
        >
          <Save size={14} />
          保存设置
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={settingsMutationPending || settingsQueryLoading || !settingsDraftDirty}
          onClick={onRestoreSettingsDraft}
        >
          恢复已保存值
        </button>
      </div>
      <p className="panel-note">
        网页登录、账户设置和 API Key 创建继续使用 {settingsDraft.bybitWebEntry || 'https://www.bybit-global.com/'}；
        程序读取行情与账户时走 API 域名，两者用途不同。Grafana 项留空表示关闭本地仪表盘跳转配置。
      </p>
    </article>
  )
}

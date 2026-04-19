import type { Mode } from '../../types'
import type { ConnectionConfigPanelFormSectionProps } from './ConnectionConfigPanel.types'

export default function ConnectionConfigPanelFormSection({
  settingsMutationPending,
  settingsQueryLoading,
  settingsDraft,
  setSettingsDraft,
}: ConnectionConfigPanelFormSectionProps) {
  return (
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
  )
}

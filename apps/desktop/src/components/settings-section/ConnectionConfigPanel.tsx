import type { ConnectionConfigPanelProps } from './ConnectionConfigPanel.types'
import ConnectionConfigPanelActionSection from './ConnectionConfigPanelActionSection'
import ConnectionConfigPanelFormSection from './ConnectionConfigPanelFormSection'
import ConnectionConfigPanelNotificationSection from './ConnectionConfigPanelNotificationSection'
import ConnectionConfigPanelOpenClawStatusSection from './ConnectionConfigPanelOpenClawStatusSection'
import ConnectionConfigPanelPrivateStatusSection from './ConnectionConfigPanelPrivateStatusSection'

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

      <ConnectionConfigPanelFormSection
        settingsMutationPending={settingsMutationPending}
        settingsQueryLoading={settingsQueryLoading}
        settingsDraft={settingsDraft}
        setSettingsDraft={setSettingsDraft}
      />

      <div className="settings-grid">
        <ConnectionConfigPanelNotificationSection
          settingsMutationPending={settingsMutationPending}
          settingsQueryLoading={settingsQueryLoading}
          settingsDraft={settingsDraft}
          setSettingsDraft={setSettingsDraft}
          onToggleSettingsNotificationChannel={onToggleSettingsNotificationChannel}
          settings={settings}
          notificationQuietHoursActive={notificationQuietHoursActive}
        />
        <ConnectionConfigPanelPrivateStatusSection
          settingsDraft={settingsDraft}
          bybitPrivateStatus={bybitPrivateStatus}
          onOpenLocalPath={onOpenLocalPath}
        />
        <ConnectionConfigPanelOpenClawStatusSection
          settings={settings}
          openClawStatus={openClawStatus}
          onOpenLocalPath={onOpenLocalPath}
        />
      </div>

      <ConnectionConfigPanelActionSection
        serviceAvailable={serviceAvailable}
        settingsMutationPending={settingsMutationPending}
        settingsQueryLoading={settingsQueryLoading}
        settingsDraftDirty={settingsDraftDirty}
        onSaveSettings={onSaveSettings}
        onRestoreSettingsDraft={onRestoreSettingsDraft}
      />
    </article>
  )
}

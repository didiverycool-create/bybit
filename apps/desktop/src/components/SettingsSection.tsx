import type { Dispatch, SetStateAction } from 'react'

import type {
  BybitPrivateStatus,
  BybitPublicStatus,
  BybitPublicSymbolDiagnostic,
  ExecutionHealthSummary,
  GrafanaIntegrationStatus,
  LayoutPreset,
  Mode,
  OpenClawStatus,
  RuntimeWorkerStatus,
  SchedulerCommandType,
  SettingsPayload,
  StrategySummary,
} from '../types'
import type { OpenLocalPathOptions, SettingsDraft, SettingsNotificationChannel } from './settings-section/ConnectionConfigPanel.types'
import {
  BybitDiagnosticsPanel,
  ConnectionConfigPanel,
  GrafanaStatusPanel,
  RuntimeControlPanel,
} from './settings-section'

type SettingsSectionProps = {
  workspaceDirty: boolean
  selectedMode: Mode
  onSelectMode: (mode: Mode) => void
  layoutPreset: LayoutPreset
  onSelectLayoutPreset: (layout: LayoutPreset) => void
  serviceAvailable: boolean
  schedulerMutationPending: boolean
  currentSchedulerJobId?: string | null
  schedulerFreezePublish?: boolean
  onRunSchedulerCommand: (command: SchedulerCommandType, reason: string, jobId?: string) => void
  runtimeWorkerNeedsRecovery: boolean
  runtimeWorkerRestartPending: boolean
  runtimeWorkerRestoreHint: string
  onRestartRuntimeWorker: () => void
  runtimeWorkerStatus?: RuntimeWorkerStatus | null
  snapshotExecutionHealth?: ExecutionHealthSummary | null
  onTriggerDesktopNotificationTest: () => void
  workspaceMutationPending: boolean
  onSyncWorkspacePreferences: () => void
  onRestoreDefaultWorkspace: () => void
  selectedStrategy?: StrategySummary | null
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
  bybitPublicStatus?: BybitPublicStatus | null
  bybitPublicVisibleDiagnostics: BybitPublicSymbolDiagnostic[]
  grafanaStatus?: GrafanaIntegrationStatus | null
  grafanaMetricsUrl: string
}

export default function SettingsSection({
  workspaceDirty,
  selectedMode,
  onSelectMode,
  layoutPreset,
  onSelectLayoutPreset,
  serviceAvailable,
  schedulerMutationPending,
  currentSchedulerJobId,
  schedulerFreezePublish,
  onRunSchedulerCommand,
  runtimeWorkerNeedsRecovery,
  runtimeWorkerRestartPending,
  runtimeWorkerRestoreHint,
  onRestartRuntimeWorker,
  runtimeWorkerStatus,
  snapshotExecutionHealth,
  onTriggerDesktopNotificationTest,
  workspaceMutationPending,
  onSyncWorkspacePreferences,
  onRestoreDefaultWorkspace,
  selectedStrategy,
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
  bybitPublicStatus,
  bybitPublicVisibleDiagnostics,
  grafanaStatus,
  grafanaMetricsUrl,
}: SettingsSectionProps) {
  return (
    <section className="section-grid">
      <RuntimeControlPanel
        workspaceDirty={workspaceDirty}
        selectedMode={selectedMode}
        onSelectMode={onSelectMode}
        layoutPreset={layoutPreset}
        onSelectLayoutPreset={onSelectLayoutPreset}
        serviceAvailable={serviceAvailable}
        schedulerMutationPending={schedulerMutationPending}
        currentSchedulerJobId={currentSchedulerJobId}
        schedulerFreezePublish={schedulerFreezePublish}
        onRunSchedulerCommand={onRunSchedulerCommand}
        runtimeWorkerNeedsRecovery={runtimeWorkerNeedsRecovery}
        runtimeWorkerRestartPending={runtimeWorkerRestartPending}
        runtimeWorkerRestoreHint={runtimeWorkerRestoreHint}
        onRestartRuntimeWorker={onRestartRuntimeWorker}
        runtimeWorkerStatus={runtimeWorkerStatus}
        snapshotExecutionHealth={snapshotExecutionHealth}
        onTriggerDesktopNotificationTest={onTriggerDesktopNotificationTest}
        workspaceMutationPending={workspaceMutationPending}
        onSyncWorkspacePreferences={onSyncWorkspacePreferences}
        onRestoreDefaultWorkspace={onRestoreDefaultWorkspace}
      />

      <ConnectionConfigPanel
        selectedStrategy={selectedStrategy}
        serviceAvailable={serviceAvailable}
        settingsMutationPending={settingsMutationPending}
        settingsQueryLoading={settingsQueryLoading}
        settingsDraftDirty={settingsDraftDirty}
        settingsDraft={settingsDraft}
        setSettingsDraft={setSettingsDraft}
        onToggleSettingsNotificationChannel={onToggleSettingsNotificationChannel}
        settings={settings}
        notificationQuietHoursActive={notificationQuietHoursActive}
        bybitPrivateStatus={bybitPrivateStatus}
        openClawStatus={openClawStatus}
        onOpenLocalPath={onOpenLocalPath}
        onSaveSettings={onSaveSettings}
        onRestoreSettingsDraft={onRestoreSettingsDraft}
      />

      <BybitDiagnosticsPanel
        bybitPublicStatus={bybitPublicStatus}
        bybitPrivateStatus={bybitPrivateStatus}
        bybitPublicVisibleDiagnostics={bybitPublicVisibleDiagnostics}
      />

      <GrafanaStatusPanel
        grafanaStatus={grafanaStatus}
        grafanaMetricsUrl={grafanaMetricsUrl}
      />
    </section>
  )
}

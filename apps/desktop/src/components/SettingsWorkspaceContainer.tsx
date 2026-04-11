import type { ComponentProps } from 'react'

import SettingsSection from './SettingsSection'

type SettingsSectionProps = ComponentProps<typeof SettingsSection>

type SettingsWorkspaceContainerProps = {
  workspaceState: {
    workspaceDirty: SettingsSectionProps['workspaceDirty']
    selectedMode: SettingsSectionProps['selectedMode']
    layoutPreset: SettingsSectionProps['layoutPreset']
    serviceAvailable: SettingsSectionProps['serviceAvailable']
    schedulerMutationPending: SettingsSectionProps['schedulerMutationPending']
    currentSchedulerJobId: SettingsSectionProps['currentSchedulerJobId']
    schedulerFreezePublish: SettingsSectionProps['schedulerFreezePublish']
    runtimeWorkerNeedsRecovery: SettingsSectionProps['runtimeWorkerNeedsRecovery']
    runtimeWorkerRestartPending: SettingsSectionProps['runtimeWorkerRestartPending']
    runtimeWorkerRestoreHint: SettingsSectionProps['runtimeWorkerRestoreHint']
    runtimeWorkerStatus: SettingsSectionProps['runtimeWorkerStatus']
    snapshotExecutionHealth: SettingsSectionProps['snapshotExecutionHealth']
    workspaceMutationPending: SettingsSectionProps['workspaceMutationPending']
    selectedStrategy: SettingsSectionProps['selectedStrategy']
  }
  settingsState: {
    settingsMutationPending: SettingsSectionProps['settingsMutationPending']
    settingsQueryLoading: SettingsSectionProps['settingsQueryLoading']
    settingsDraftDirty: SettingsSectionProps['settingsDraftDirty']
    settingsDraft: SettingsSectionProps['settingsDraft']
    settings: SettingsSectionProps['settings']
    notificationQuietHoursActive: SettingsSectionProps['notificationQuietHoursActive']
    bybitPrivateStatus: SettingsSectionProps['bybitPrivateStatus']
    openClawStatus: SettingsSectionProps['openClawStatus']
    bybitPublicStatus: SettingsSectionProps['bybitPublicStatus']
    bybitPublicVisibleDiagnostics: SettingsSectionProps['bybitPublicVisibleDiagnostics']
    grafanaStatus: SettingsSectionProps['grafanaStatus']
    grafanaMetricsUrl: SettingsSectionProps['grafanaMetricsUrl']
  }
  actions: Pick<
    SettingsSectionProps,
    | 'onSelectMode'
    | 'onSelectLayoutPreset'
    | 'onRunSchedulerCommand'
    | 'onRestartRuntimeWorker'
    | 'onTriggerDesktopNotificationTest'
    | 'onSyncWorkspacePreferences'
    | 'onRestoreDefaultWorkspace'
    | 'setSettingsDraft'
    | 'onToggleSettingsNotificationChannel'
    | 'onOpenLocalPath'
    | 'onSaveSettings'
    | 'onRestoreSettingsDraft'
  >
}

export default function SettingsWorkspaceContainer({
  workspaceState,
  settingsState,
  actions,
}: SettingsWorkspaceContainerProps) {
  return (
    <SettingsSection
      workspaceDirty={workspaceState.workspaceDirty}
      selectedMode={workspaceState.selectedMode}
      onSelectMode={actions.onSelectMode}
      layoutPreset={workspaceState.layoutPreset}
      onSelectLayoutPreset={actions.onSelectLayoutPreset}
      serviceAvailable={workspaceState.serviceAvailable}
      schedulerMutationPending={workspaceState.schedulerMutationPending}
      currentSchedulerJobId={workspaceState.currentSchedulerJobId}
      schedulerFreezePublish={workspaceState.schedulerFreezePublish}
      onRunSchedulerCommand={actions.onRunSchedulerCommand}
      runtimeWorkerNeedsRecovery={workspaceState.runtimeWorkerNeedsRecovery}
      runtimeWorkerRestartPending={workspaceState.runtimeWorkerRestartPending}
      runtimeWorkerRestoreHint={workspaceState.runtimeWorkerRestoreHint}
      onRestartRuntimeWorker={actions.onRestartRuntimeWorker}
      runtimeWorkerStatus={workspaceState.runtimeWorkerStatus}
      snapshotExecutionHealth={workspaceState.snapshotExecutionHealth}
      onTriggerDesktopNotificationTest={actions.onTriggerDesktopNotificationTest}
      workspaceMutationPending={workspaceState.workspaceMutationPending}
      onSyncWorkspacePreferences={actions.onSyncWorkspacePreferences}
      onRestoreDefaultWorkspace={actions.onRestoreDefaultWorkspace}
      selectedStrategy={workspaceState.selectedStrategy}
      settingsMutationPending={settingsState.settingsMutationPending}
      settingsQueryLoading={settingsState.settingsQueryLoading}
      settingsDraftDirty={settingsState.settingsDraftDirty}
      settingsDraft={settingsState.settingsDraft}
      setSettingsDraft={actions.setSettingsDraft}
      onToggleSettingsNotificationChannel={actions.onToggleSettingsNotificationChannel}
      settings={settingsState.settings}
      notificationQuietHoursActive={settingsState.notificationQuietHoursActive}
      bybitPrivateStatus={settingsState.bybitPrivateStatus}
      openClawStatus={settingsState.openClawStatus}
      onOpenLocalPath={actions.onOpenLocalPath}
      onSaveSettings={actions.onSaveSettings}
      onRestoreSettingsDraft={actions.onRestoreSettingsDraft}
      bybitPublicStatus={settingsState.bybitPublicStatus}
      bybitPublicVisibleDiagnostics={settingsState.bybitPublicVisibleDiagnostics}
      grafanaStatus={settingsState.grafanaStatus}
      grafanaMetricsUrl={settingsState.grafanaMetricsUrl}
    />
  )
}

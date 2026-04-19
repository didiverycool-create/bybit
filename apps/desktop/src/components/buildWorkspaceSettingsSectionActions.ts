import type { BuildWorkspaceSectionActionsResult } from './buildWorkspaceSectionActions'
import type { BuildWorkspaceSectionOpsConsumerArgs } from './buildWorkspaceSectionActionConsumerGroups'

type BuildWorkspaceSettingsSectionActionsArgs = Pick<
  BuildWorkspaceSectionOpsConsumerArgs,
  'workspaceControlActions' | 'settingsPersistenceActions' | 'setters'
>

export type BuildWorkspaceSettingsSectionActionsResult = Pick<
  BuildWorkspaceSectionActionsResult,
  'settingsWorkspaceActions'
>

export function buildWorkspaceSettingsSectionActions({
  workspaceControlActions,
  settingsPersistenceActions,
  setters,
}: BuildWorkspaceSettingsSectionActionsArgs): BuildWorkspaceSettingsSectionActionsResult {
  return {
    settingsWorkspaceActions: {
      onSelectMode: setters.setSelectedMode,
      onSelectLayoutPreset: setters.setLayoutPreset,
      onRunSchedulerCommand: (command, reason, jobId) => {
        void workspaceControlActions.runSchedulerCommand(command, reason, jobId)
      },
      onRestartRuntimeWorker: () => {
        void workspaceControlActions.restartStrategyRuntimeWorker()
      },
      onTriggerDesktopNotificationTest: () => {
        void workspaceControlActions.triggerDesktopNotificationTest()
      },
      onSyncWorkspacePreferences: () => {
        void settingsPersistenceActions.syncWorkspacePreferences()
      },
      onRestoreDefaultWorkspace: settingsPersistenceActions.restoreDefaultWorkspace,
      setSettingsDraft: setters.setSettingsDraft,
      onToggleSettingsNotificationChannel: workspaceControlActions.toggleSettingsNotificationChannel,
      onOpenLocalPath: settingsPersistenceActions.onOpenLocalPath,
      onSaveSettings: () => {
        void workspaceControlActions.saveSettings()
      },
      onRestoreSettingsDraft: workspaceControlActions.restoreSettingsDraft,
    },
  }
}

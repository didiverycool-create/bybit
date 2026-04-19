import type { Dispatch, SetStateAction } from 'react'

import type {
  BybitPrivateStatus,
  OpenClawStatus,
  SettingsPayload,
  StrategySummary,
} from '../../types'
import type { SettingsDraft, SettingsNotificationChannel } from '../../utils/app-helpers'

export type OpenLocalPathOptions = {
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

export type ConnectionConfigPanelFormSectionProps = {
  settingsMutationPending: boolean
  settingsQueryLoading: boolean
  settingsDraft: SettingsDraft
  setSettingsDraft: Dispatch<SetStateAction<SettingsDraft>>
}

export type ConnectionConfigPanelNotificationSectionProps = {
  settingsMutationPending: boolean
  settingsQueryLoading: boolean
  settingsDraft: SettingsDraft
  setSettingsDraft: Dispatch<SetStateAction<SettingsDraft>>
  onToggleSettingsNotificationChannel: (value: SettingsNotificationChannel) => void
  settings?: SettingsPayload | null
  notificationQuietHoursActive: boolean
}

export type ConnectionConfigPanelPrivateStatusSectionProps = {
  settingsDraft: SettingsDraft
  bybitPrivateStatus?: BybitPrivateStatus | null
  onOpenLocalPath: (path?: string | null, options?: OpenLocalPathOptions) => void | Promise<void>
}

export type ConnectionConfigPanelOpenClawStatusSectionProps = {
  settings?: SettingsPayload | null
  openClawStatus?: OpenClawStatus | null
  onOpenLocalPath: (path?: string | null, options?: OpenLocalPathOptions) => void | Promise<void>
}

export type ConnectionConfigPanelActionSectionProps = {
  serviceAvailable: boolean
  settingsMutationPending: boolean
  settingsQueryLoading: boolean
  settingsDraftDirty: boolean
  onSaveSettings: () => void
  onRestoreSettingsDraft: () => void
}

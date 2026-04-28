import type {
  AiLiveSnapshot,
  ControlSnapshot,
  ExecutionEvent,
  ExecutionPreview,
  RuntimeWorkerStatus,
  SettingsPayload,
  StrategyRuntimeSnapshot,
  WatchlistInstrument,
} from '../types'
import {
  settingsDraftEqualsSettings,
  type SettingsDraft,
} from '../utils/app-helpers'
import { buildRuntimeAndSettingsSelectionState } from './buildRuntimeAndSettingsSelectionState'
import { buildRuntimeAndSettingsRuntimeState } from './buildRuntimeAndSettingsRuntimeState'

export type BuildRuntimeAndSettingsDerivedStateArgs = {
  runtimeWorkerStatusData: RuntimeWorkerStatus | undefined
  watchlist: WatchlistInstrument[]
  selectedSymbol: string
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null | undefined
  selectedModeStrategyPreview: ExecutionPreview | null | undefined
  settings: SettingsPayload | null | undefined
  settingsDraft: SettingsDraft
  snapshot: ControlSnapshot | null | undefined
  aiLiveData: AiLiveSnapshot | undefined
  auditEvents: ExecutionEvent[]
}

export function buildRuntimeAndSettingsDerivedState({
  settings,
  settingsDraft,
  ...selectionAndRuntimeStateArgs
}: BuildRuntimeAndSettingsDerivedStateArgs) {
  const selectionState = buildRuntimeAndSettingsSelectionState(
    selectionAndRuntimeStateArgs,
  )
  const runtimeState = buildRuntimeAndSettingsRuntimeState(
    selectionAndRuntimeStateArgs,
  )
  const settingsDraftDirty = settings ? !settingsDraftEqualsSettings(settingsDraft, settings) : false
  const desktopNotificationsEnabled = settings?.notification_channels.includes('desktop') ?? true

  return {
    ...selectionState,
    settingsDraftDirty,
    desktopNotificationsEnabled,
    ...runtimeState,
  }
}

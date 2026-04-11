import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

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
  buildSettingsDraft,
  settingsDraftEqualsSettings,
  type SettingsDraft,
} from '../utils/app-helpers'

type UseRuntimeAndSettingsModelArgs = {
  runtimeWorkerStatusData: RuntimeWorkerStatus | undefined
  watchlist: WatchlistInstrument[]
  selectedSymbol: string
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null | undefined
  selectedModeStrategyPreview: ExecutionPreview | null | undefined
  settings: SettingsPayload | null | undefined
  settingsDraft: SettingsDraft
  setSettingsDraft: Dispatch<SetStateAction<SettingsDraft>>
  lastLoadedSettingsSignatureRef: MutableRefObject<string | null>
  snapshot: ControlSnapshot | null | undefined
  aiLiveData: AiLiveSnapshot | undefined
  auditEvents: ExecutionEvent[]
}

export function useRuntimeAndSettingsModel({
  runtimeWorkerStatusData,
  watchlist,
  selectedSymbol,
  selectedStrategyRuntime,
  selectedModeStrategyPreview,
  settings,
  settingsDraft,
  setSettingsDraft,
  lastLoadedSettingsSignatureRef,
  snapshot,
  aiLiveData,
  auditEvents,
}: UseRuntimeAndSettingsModelArgs) {
  const runtimeWorkerStatus = runtimeWorkerStatusData
  const watchlistAlertSignature = watchlist
    .map((item) => `${item.symbol}:${item.alert_enabled ? '1' : '0'}:${item.alert_threshold_pct}`)
    .join('|')
  const selectedWatchItem = watchlist.find((item) => item.symbol === selectedSymbol)
  const selectedStrategyRuntimePreview = selectedStrategyRuntime
    ? selectedModeStrategyPreview ?? {
        action: selectedStrategyRuntime.next_action,
        allowed: false,
        blocked_reason:
          selectedStrategyRuntime.runtime_status === 'paused'
            ? '策略当前处于暂停状态，只有恢复运行后才会继续评估执行。'
            : '当前正在等待该模式下的策略执行预检，请稍后再试。',
        notional: null,
        current_position_side: null,
        current_position_size: null,
        projected_position_side: null,
        projected_position_size: null,
        available_balance_before: null,
        available_balance_after: null,
        estimated_realized_pnl: null,
        warnings: selectedStrategyRuntime.note ? [selectedStrategyRuntime.note] : [],
      }
    : null
  const settingsDraftDirty = settings ? !settingsDraftEqualsSettings(settingsDraft, settings) : false

  useEffect(() => {
    if (!settings) {
      return
    }
    const nextDraft = buildSettingsDraft(settings)
    const nextSignature = JSON.stringify(nextDraft)
    if (lastLoadedSettingsSignatureRef.current === nextSignature) {
      return
    }
    setSettingsDraft(nextDraft)
    lastLoadedSettingsSignatureRef.current = nextSignature
  }, [lastLoadedSettingsSignatureRef, setSettingsDraft, settings])

  const snapshotExecutionHealth = snapshot?.execution_health
  const desktopNotificationsEnabled = settings?.notification_channels.includes('desktop') ?? true
  const runtimeWorkerNeedsRecovery = runtimeWorkerStatus
    ? runtimeWorkerStatus.issue ||
      runtimeWorkerStatus.stale ||
      runtimeWorkerStatus.stopped ||
      !runtimeWorkerStatus.running
    : Boolean(
        snapshotExecutionHealth?.runtime_worker_issue ||
          snapshotExecutionHealth?.runtime_worker_stale ||
          snapshotExecutionHealth?.runtime_worker_stopped ||
          (snapshotExecutionHealth && !snapshotExecutionHealth.runtime_worker_running),
      )
  const runtimeWorkerRestoreHint =
    runtimeWorkerStatus?.recommended_action ??
    '当前策略运行线程异常、停滞或未运行，恢复后后台自动执行链会重新接管。'
  const aiActivityFeed =
    aiLiveData?.activity_feed ??
    auditEvents
      .filter((event) => event.source === 'openclaw' || event.source === 'desktop')
      .slice(0, 5)

  return {
    runtimeWorkerStatus,
    watchlistAlertSignature,
    selectedWatchItem,
    selectedStrategyRuntimePreview,
    settingsDraftDirty,
    snapshotExecutionHealth,
    desktopNotificationsEnabled,
    runtimeWorkerNeedsRecovery,
    runtimeWorkerRestoreHint,
    aiActivityFeed,
  }
}

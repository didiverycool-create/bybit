import type {
  AiLiveSnapshot,
  ControlSnapshot,
  ExecutionEvent,
  RuntimeWorkerStatus,
} from '../types'

export type BuildRuntimeAndSettingsRuntimeStateArgs = {
  runtimeWorkerStatusData: RuntimeWorkerStatus | undefined
  snapshot: ControlSnapshot | null | undefined
  aiLiveData: AiLiveSnapshot | undefined
  auditEvents: ExecutionEvent[]
}

export function buildRuntimeAndSettingsRuntimeState({
  runtimeWorkerStatusData,
  snapshot,
  aiLiveData,
  auditEvents,
}: BuildRuntimeAndSettingsRuntimeStateArgs) {
  const runtimeWorkerStatus = runtimeWorkerStatusData
  const snapshotExecutionHealth = snapshot?.execution_health
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
    snapshotExecutionHealth,
    runtimeWorkerNeedsRecovery,
    runtimeWorkerRestoreHint,
    aiActivityFeed,
  }
}

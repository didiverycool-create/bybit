import type {
  BybitPublicStatus,
  BybitPublicSymbolDiagnostic,
  ExecutionEvent,
  LatestSchedulerCommand,
  SettingsPayload,
} from '../types'
import {
  isNotificationQuietHoursActive,
  schedulerCommandEventMeta,
  schedulerCommandSnapshotMeta,
} from '../utils/app-helpers'

type BuildControlDataQueryDerivedStateArgs = {
  healthOk: boolean
  settings?: SettingsPayload | null
  metricsPreviewText?: string | null
  snapshotLatestSchedulerCommand?: LatestSchedulerCommand | null
  schedulerLatestSchedulerCommand?: LatestSchedulerCommand | null
  opsLiveLatestSchedulerCommand?: LatestSchedulerCommand | null
  auditEvents: ExecutionEvent[]
  bybitPublicStatus?: BybitPublicStatus | null
}

type LatestSchedulerCommandMeta = NonNullable<ReturnType<typeof schedulerCommandSnapshotMeta>>

type ControlDataQueryDerivedState = {
  serviceAvailable: boolean
  latestSchedulerCommand: LatestSchedulerCommandMeta | null
  metricsPreviewLines: string[]
  notificationQuietHoursActive: boolean
  bybitPublicIssueDiagnostics: BybitPublicSymbolDiagnostic[]
  bybitPublicVisibleDiagnostics: BybitPublicSymbolDiagnostic[]
}

function buildMetricsPreviewLines(metricsPreviewText?: string | null) {
  return String(metricsPreviewText ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .slice(0, 10)
}

function buildBybitPublicDiagnostics(bybitPublicStatus?: BybitPublicStatus | null) {
  const watchedSymbolDiagnostics = bybitPublicStatus?.watched_symbol_diagnostics ?? []
  const issueDiagnostics = watchedSymbolDiagnostics.filter((item) => item.issue)
  const visibleDiagnostics = (
    issueDiagnostics.length ? issueDiagnostics : watchedSymbolDiagnostics.slice(0, 4)
  ).slice(0, 4)
  return {
    bybitPublicIssueDiagnostics: issueDiagnostics,
    bybitPublicVisibleDiagnostics: visibleDiagnostics,
  }
}

export function buildControlDataQueryDerivedState({
  healthOk,
  settings,
  metricsPreviewText,
  snapshotLatestSchedulerCommand,
  schedulerLatestSchedulerCommand,
  opsLiveLatestSchedulerCommand,
  auditEvents,
  bybitPublicStatus,
}: BuildControlDataQueryDerivedStateArgs): ControlDataQueryDerivedState {
  const latestSchedulerCommand =
    schedulerCommandSnapshotMeta(
      schedulerLatestSchedulerCommand ??
        opsLiveLatestSchedulerCommand ??
        snapshotLatestSchedulerCommand ??
        null,
    ) ??
    schedulerCommandEventMeta(
      auditEvents.find((event) => event.event_type === 'scheduler.command') ?? null,
    )

  return {
    serviceAvailable: Boolean(healthOk),
    latestSchedulerCommand,
    metricsPreviewLines: buildMetricsPreviewLines(metricsPreviewText),
    notificationQuietHoursActive: isNotificationQuietHoursActive(settings),
    ...buildBybitPublicDiagnostics(bybitPublicStatus),
  }
}

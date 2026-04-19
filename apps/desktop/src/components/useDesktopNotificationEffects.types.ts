import type { MutableRefObject } from 'react'

import type { AgentJob, AlertRecord, ExecutionEvent, SchedulerState } from '../types'

export type NotificationBootstrapState = {
  alerts: boolean
  jobs: boolean
  scheduler: boolean
  ops: boolean
}

export type DesktopNotificationDispatcher = (
  payload: {
    title?: string
    body?: string
    urgency?: 'normal' | 'critical'
    silent?: boolean
  },
) => Promise<unknown>

export type UseDesktopNotificationTrackedFeedEffectArgs<TItem> = {
  desktopNotificationsEnabled: boolean
  bootstrapReady: boolean
  items: TItem[]
}

export type NotificationBootstrapRef = MutableRefObject<NotificationBootstrapState>
export type SeenAlertNotificationIdsRef = MutableRefObject<Set<string>>
export type SeenAgentJobStatusRef = MutableRefObject<Map<string, string>>
export type SeenOpsNotificationIdsRef = MutableRefObject<Set<string>>
export type LastSchedulerStatusRef = MutableRefObject<string | null>

export type DesktopNotificationAlertsEffectsArgs = {
  desktopNotificationsEnabled: boolean
  alertsNotificationBootstrapReady: boolean
  alerts: AlertRecord[]
  notificationBootstrapRef: NotificationBootstrapRef
  seenAlertNotificationIdsRef: SeenAlertNotificationIdsRef
  dispatchDesktopNotification: DesktopNotificationDispatcher
}

export type DesktopNotificationJobsEffectsArgs = {
  desktopNotificationsEnabled: boolean
  jobsNotificationBootstrapReady: boolean
  schedulerJobs: AgentJob[]
  notificationBootstrapRef: NotificationBootstrapRef
  seenAgentJobStatusRef: SeenAgentJobStatusRef
  dispatchDesktopNotification: DesktopNotificationDispatcher
}

export type DesktopNotificationSchedulerEffectsArgs = {
  desktopNotificationsEnabled: boolean
  schedulerState?: SchedulerState | null
  notificationBootstrapRef: NotificationBootstrapRef
  lastSchedulerStatusRef: LastSchedulerStatusRef
  dispatchDesktopNotification: DesktopNotificationDispatcher
}

export type DesktopNotificationOpsEffectsArgs = {
  desktopNotificationsEnabled: boolean
  opsNotificationBootstrapReady: boolean
  auditEvents: ExecutionEvent[]
  notificationBootstrapRef: NotificationBootstrapRef
  seenOpsNotificationIdsRef: SeenOpsNotificationIdsRef
  dispatchDesktopNotification: DesktopNotificationDispatcher
}

export type UseDesktopNotificationEffectsArgs = {
  desktopNotificationsEnabled: boolean
  alertsNotificationBootstrapReady: boolean
  jobsNotificationBootstrapReady: boolean
  opsNotificationBootstrapReady: boolean
  alerts: AlertRecord[]
  schedulerJobs: AgentJob[]
  schedulerState?: SchedulerState | null
  auditEvents: ExecutionEvent[]
  notificationBootstrapRef: NotificationBootstrapRef
  seenAlertNotificationIdsRef: SeenAlertNotificationIdsRef
  seenAgentJobStatusRef: SeenAgentJobStatusRef
  seenOpsNotificationIdsRef: SeenOpsNotificationIdsRef
  lastSchedulerStatusRef: LastSchedulerStatusRef
  dispatchDesktopNotification: DesktopNotificationDispatcher
}

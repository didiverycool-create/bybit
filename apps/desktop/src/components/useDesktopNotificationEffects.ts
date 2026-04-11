import { useEffect } from 'react'
import type { MutableRefObject } from 'react'

import type {
  AgentJob,
  AlertRecord,
  ExecutionEvent,
  SchedulerState,
} from '../types'
import {
  buildAgentJobNotification,
  buildAlertNotification,
  buildOpsEventNotification,
  schedulerLabel,
} from '../utils/app-helpers'

type NotificationBootstrapState = {
  alerts: boolean
  jobs: boolean
  scheduler: boolean
  ops: boolean
}

type UseDesktopNotificationEffectsArgs = {
  desktopNotificationsEnabled: boolean
  alertsNotificationBootstrapReady: boolean
  jobsNotificationBootstrapReady: boolean
  opsNotificationBootstrapReady: boolean
  alerts: AlertRecord[]
  schedulerJobs: AgentJob[]
  schedulerState?: SchedulerState | null
  auditEvents: ExecutionEvent[]
  notificationBootstrapRef: MutableRefObject<NotificationBootstrapState>
  seenAlertNotificationIdsRef: MutableRefObject<Set<string>>
  seenAgentJobStatusRef: MutableRefObject<Map<string, string>>
  seenOpsNotificationIdsRef: MutableRefObject<Set<string>>
  lastSchedulerStatusRef: MutableRefObject<string | null>
  dispatchDesktopNotification: (
    payload: {
      title?: string
      body?: string
      urgency?: 'normal' | 'critical'
      silent?: boolean
    },
  ) => Promise<unknown>
}

export function useDesktopNotificationEffects({
  desktopNotificationsEnabled,
  alertsNotificationBootstrapReady,
  jobsNotificationBootstrapReady,
  opsNotificationBootstrapReady,
  alerts,
  schedulerJobs,
  schedulerState,
  auditEvents,
  notificationBootstrapRef,
  seenAlertNotificationIdsRef,
  seenAgentJobStatusRef,
  seenOpsNotificationIdsRef,
  lastSchedulerStatusRef,
  dispatchDesktopNotification,
}: UseDesktopNotificationEffectsArgs) {
  useEffect(() => {
    if (!desktopNotificationsEnabled || !alertsNotificationBootstrapReady) {
      return
    }

    const importantAlerts = alerts.filter(
      (alert) => !alert.acknowledged && (alert.severity === 'P0' || alert.severity === 'P1'),
    )

    if (!notificationBootstrapRef.current.alerts) {
      importantAlerts.forEach((alert) => {
        seenAlertNotificationIdsRef.current.add(alert.id)
      })
      notificationBootstrapRef.current.alerts = true
      return
    }

    importantAlerts.forEach((alert) => {
      if (seenAlertNotificationIdsRef.current.has(alert.id)) {
        return
      }
      seenAlertNotificationIdsRef.current.add(alert.id)
      void dispatchDesktopNotification(buildAlertNotification(alert))
    })
  }, [
    alerts,
    alertsNotificationBootstrapReady,
    desktopNotificationsEnabled,
    dispatchDesktopNotification,
    notificationBootstrapRef,
    seenAlertNotificationIdsRef,
  ])

  useEffect(() => {
    if (!desktopNotificationsEnabled || !jobsNotificationBootstrapReady) {
      return
    }

    if (!notificationBootstrapRef.current.jobs) {
      const statusMap = seenAgentJobStatusRef.current
      schedulerJobs.forEach((job) => {
        statusMap.set(job.id, job.status)
      })
      notificationBootstrapRef.current.jobs = true
      return
    }

    const statusMap = seenAgentJobStatusRef.current
    schedulerJobs.forEach((job) => {
      const previousStatus = statusMap.get(job.id)
      statusMap.set(job.id, job.status)

      if (previousStatus === job.status) {
        return
      }

      if (job.status === 'failed' || job.status === 'cancelled') {
        void dispatchDesktopNotification(
          buildAgentJobNotification({
            job_type: job.job_type,
            status: job.status,
            result_summary: job.result_summary,
          }),
        )
      }
    })
  }, [
    desktopNotificationsEnabled,
    dispatchDesktopNotification,
    jobsNotificationBootstrapReady,
    notificationBootstrapRef,
    schedulerJobs,
    seenAgentJobStatusRef,
  ])

  useEffect(() => {
    if (!desktopNotificationsEnabled) {
      return
    }

    const nextStatus = schedulerState?.status
    if (!nextStatus) {
      return
    }

    if (!notificationBootstrapRef.current.scheduler) {
      lastSchedulerStatusRef.current = nextStatus
      notificationBootstrapRef.current.scheduler = true
      return
    }

    const previousStatus = lastSchedulerStatusRef.current
    lastSchedulerStatusRef.current = nextStatus

    if (previousStatus === nextStatus) {
      return
    }

    if (nextStatus === 'degraded' || nextStatus === 'manual_override') {
      void dispatchDesktopNotification({
        title: `AI 调度${nextStatus === 'degraded' ? '降级' : '进入人工接管'}`,
        body: `当前状态：${schedulerLabel(nextStatus)} · 队列 ${schedulerState.queue_depth} 个，请进入 AI 调度页查看。`,
        urgency: nextStatus === 'degraded' ? 'critical' : 'normal',
      })
    }
  }, [
    desktopNotificationsEnabled,
    dispatchDesktopNotification,
    lastSchedulerStatusRef,
    notificationBootstrapRef,
    schedulerState,
  ])

  useEffect(() => {
    if (!desktopNotificationsEnabled || !opsNotificationBootstrapReady) {
      return
    }

    const interestingEvents = auditEvents.filter((event) =>
      [
        'exchange_order.created',
        'exchange_order.replaced',
        'exchange_order.cancelled',
        'exchange_order.cancelled_all',
        'exchange_position.close_submitted',
        'exchange_position.close_all_submitted',
        'strategy.exchange_order.submitted',
        'strategy.paper_trade.executed_manual',
        'paper_order.filled',
        'paper_order.cancelled_all',
        'manual_trade.positions_closed_all',
      ].includes(event.event_type),
    )

    if (!notificationBootstrapRef.current.ops) {
      interestingEvents.forEach((event) => {
        seenOpsNotificationIdsRef.current.add(event.id)
      })
      notificationBootstrapRef.current.ops = true
      return
    }

    interestingEvents.forEach((event) => {
      if (seenOpsNotificationIdsRef.current.has(event.id)) {
        return
      }
      seenOpsNotificationIdsRef.current.add(event.id)
      void dispatchDesktopNotification(buildOpsEventNotification(event))
    })
  }, [
    auditEvents,
    desktopNotificationsEnabled,
    dispatchDesktopNotification,
    notificationBootstrapRef,
    opsNotificationBootstrapReady,
    seenOpsNotificationIdsRef,
  ])
}

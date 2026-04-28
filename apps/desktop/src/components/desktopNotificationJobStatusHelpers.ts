import type { AgentJob } from '../types'
import {
  buildAgentJobNotification,
  type DesktopNotificationPayload,
} from '../utils/app-helpers'

export function buildInitialSeenAgentJobStatuses(schedulerJobs: AgentJob[]) {
  const nextStatuses = new Map<string, string>()
  schedulerJobs.forEach((job) => {
    nextStatuses.set(job.id, job.status)
  })
  return nextStatuses
}

export function resolveAgentJobStatusNotifications(
  schedulerJobs: AgentJob[],
  previousStatuses: ReadonlyMap<string, string>,
): {
  nextStatuses: Map<string, string>
  notifications: DesktopNotificationPayload[]
} {
  const nextStatuses = new Map(previousStatuses)
  const notifications: DesktopNotificationPayload[] = []

  schedulerJobs.forEach((job) => {
    const previousStatus = nextStatuses.get(job.id)
    nextStatuses.set(job.id, job.status)

    if (previousStatus === job.status) {
      return
    }

    if (job.status === 'failed' || job.status === 'cancelled') {
      notifications.push(
        buildAgentJobNotification({
          job_type: job.job_type,
          status: job.status,
          result_summary: job.result_summary,
        }),
      )
    }
  })

  return {
    nextStatuses,
    notifications,
  }
}

import type { SchedulerState } from '../types'
import {
  schedulerLabel,
  type DesktopNotificationPayload,
} from '../utils/app-helpers'

export function resolveSchedulerStatusNotification(
  previousStatus: string | null,
  schedulerState?: SchedulerState | null,
): DesktopNotificationPayload | null {
  const nextStatus = schedulerState?.status
  if (!nextStatus || previousStatus === nextStatus) {
    return null
  }

  if (nextStatus !== 'degraded' && nextStatus !== 'manual_override') {
    return null
  }

  return {
    title: `AI 调度${nextStatus === 'degraded' ? '降级' : '进入人工接管'}`,
    body: `当前状态：${schedulerLabel(nextStatus)} · 队列 ${schedulerState.queue_depth} 个，请进入 AI 调度页查看。`,
    urgency: nextStatus === 'degraded' ? 'critical' : 'normal',
  }
}

import { useMutation } from '@tanstack/react-query'

import { api } from '../api'
import { resolveErrorMessage, schedulerCommandFeedbackDetail } from '../utils/app-helpers'

type ActionTone = 'success' | 'warning' | 'error'

type UseWorkspaceSchedulerRuntimeActionsArgs = {
  refreshControlData: () => Promise<void>
  showFeedback: (tone: ActionTone, title: string, detail: string) => void
}

export function useWorkspaceSchedulerRuntimeActions({
  refreshControlData,
  showFeedback,
}: UseWorkspaceSchedulerRuntimeActionsArgs) {
  const schedulerMutation = useMutation({
    mutationFn: api.sendSchedulerCommand,
    onSuccess: refreshControlData,
  })

  const restartRuntimeWorkerMutation = useMutation({
    mutationFn: api.restartStrategyRuntimeWorker,
    onSuccess: refreshControlData,
  })

  const runSchedulerCommand = async (
    command: 'pause' | 'resume' | 'cancel_job' | 'cancel_all' | 'freeze_publish' | 'enter_manual_override',
    reason: string,
    jobId?: string,
  ) => {
    try {
      const result = await schedulerMutation.mutateAsync({
        command,
        job_id: jobId,
        requested_by: 'desktop_operator',
        reason,
      })
      const detail =
        command === 'freeze_publish'
          ? result.freeze_publish
            ? '自动发布已冻结，新的 AI 发布提案会停留在控制端。'
            : '自动发布冻结已解除。'
          : schedulerCommandFeedbackDetail(result, reason)
      showFeedback('success', 'AI 调度命令已发送', detail)
    } catch (error) {
      showFeedback('error', 'AI 调度命令失败', resolveErrorMessage(error))
    }
  }

  const restartStrategyRuntimeWorker = async () => {
    try {
      const result = await restartRuntimeWorkerMutation.mutateAsync()
      showFeedback('success', '运行线程已恢复', result.message)
    } catch (error) {
      showFeedback('error', '恢复运行线程失败', resolveErrorMessage(error))
    }
  }

  return {
    schedulerMutationPending: schedulerMutation.isPending,
    restartRuntimeWorkerPending: restartRuntimeWorkerMutation.isPending,
    runSchedulerCommand,
    restartStrategyRuntimeWorker,
  }
}

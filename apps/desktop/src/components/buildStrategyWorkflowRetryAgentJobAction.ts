import { getAgentJobRetryCount, resolveErrorMessage } from '../utils/app-helpers'

import type {
  StrategyWorkflowRetryAgentJobActionContext,
  StrategyWorkflowRetryAgentJobOptions,
} from './useStrategyWorkflowExecutionActions.types'

export function buildStrategyWorkflowRetryAgentJobAction({
  showFeedback,
  openAiSchedulerJob,
  retryAgentJobMutation,
}: StrategyWorkflowRetryAgentJobActionContext) {
  return async function retryAgentJob(
    jobId: string,
    options?: StrategyWorkflowRetryAgentJobOptions,
  ) {
    try {
      const job = await retryAgentJobMutation.mutateAsync(jobId)
      const retryCount = getAgentJobRetryCount(job)
      if (options?.focusJob) {
        openAiSchedulerJob(job.id)
      }
      showFeedback(
        'success',
        'AI 任务已重新排队',
        retryCount > 0 ? `已创建第 ${retryCount} 次重试任务。` : '失败任务已重新加入调度队列。',
      )
      return job
    } catch (error) {
      showFeedback('error', 'AI 任务重试失败', resolveErrorMessage(error))
      return null
    }
  }
}

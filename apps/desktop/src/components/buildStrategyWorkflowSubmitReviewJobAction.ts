import { resolveErrorMessage } from '../utils/app-helpers'

import type { StrategyWorkflowSubmitReviewJobActionContext } from './useStrategyWorkflowExecutionActions.types'

export function buildStrategyWorkflowSubmitReviewJobAction({
  selectedMode,
  watchlist,
  showFeedback,
  agentJobMutation,
}: StrategyWorkflowSubmitReviewJobActionContext) {
  return async function submitReviewJob() {
    try {
      await agentJobMutation.mutateAsync({
        job_type: 'generate_daily_review',
        context: {
          focus_symbols: watchlist.slice(0, 3).map((item) => item.symbol),
          mode: selectedMode,
        },
        allowed_actions: ['review', 'summarize', 'backtest_request', 'change_request'],
        timeout: 180,
        idempotency_key: `review-${Date.now()}`,
        writeback_target: 'ai_review',
      })
      showFeedback('success', 'AI 复盘任务已排队', 'OpenClaw 会按当前关注品种生成新的复盘文档。')
    } catch (error) {
      showFeedback('error', 'AI 复盘任务创建失败', resolveErrorMessage(error))
    }
  }
}

import { useMutation } from '@tanstack/react-query'

import { aiWorkflowApi } from '../apiAiWorkflow'
import { strategyApi } from '../apiStrategy'
import { resolveErrorMessage } from '../utils/app-helpers'

import type { UseStrategyWorkflowActionsArgs } from './strategyWorkflowActionShared'

type UseStrategyWorkflowTrackingActionsArgs = Pick<
  UseStrategyWorkflowActionsArgs,
  | 'refreshControlData'
  | 'selectedMode'
  | 'selectedStrategy'
  | 'strategyTrackingKind'
  | 'strategyTrackingSummary'
  | 'strategyTrackingDetail'
  | 'strategyTrackingRequestKey'
  | 'setStrategyTrackingPanelOpen'
  | 'setStrategyActivityPanelOpen'
  | 'resetStrategyTrackingDraft'
  | 'showFeedback'
>

export function useStrategyWorkflowTrackingActions({
  refreshControlData,
  selectedMode,
  selectedStrategy,
  strategyTrackingKind,
  strategyTrackingSummary,
  strategyTrackingDetail,
  strategyTrackingRequestKey,
  setStrategyTrackingPanelOpen,
  setStrategyActivityPanelOpen,
  resetStrategyTrackingDraft,
  showFeedback,
}: UseStrategyWorkflowTrackingActionsArgs) {
  const changeRequestMutation = useMutation({
    mutationFn: aiWorkflowApi.createChangeRequest,
    onSuccess: refreshControlData,
  })

  const strategyTrackingMutation = useMutation({
    mutationFn: ({
      strategyId,
      payload,
    }: {
      strategyId: string
      payload: {
        review_kind: 'issue' | 'change'
        summary: string
        detail?: string
        requested_by?: string
        request_key?: string
      }
    }) => strategyApi.createStrategyTrackingReview(strategyId, payload),
    onSuccess: refreshControlData,
  })

  const submitStrategyTrackingReview = async () => {
    if (!selectedStrategy) {
      return
    }
    if (!strategyTrackingSummary.trim()) {
      showFeedback('warning', '跟踪摘要不能为空', '请先填写这次策略跟踪的摘要，再创建 AI 跟踪任务。')
      return
    }

    try {
      const job = await strategyTrackingMutation.mutateAsync({
        strategyId: selectedStrategy.id,
        payload: {
          review_kind: strategyTrackingKind,
          summary: strategyTrackingSummary.trim(),
          detail: strategyTrackingDetail.trim() || undefined,
          requested_by: 'desktop_operator',
          request_key: strategyTrackingRequestKey,
        },
      })
      setStrategyTrackingPanelOpen(false)
      setStrategyActivityPanelOpen(true)
      resetStrategyTrackingDraft(strategyTrackingKind)
      showFeedback(
        'success',
        strategyTrackingKind === 'issue' ? '问题跟踪已排队' : '变更跟踪已排队',
        `${selectedStrategy.name} 已创建 ${job.job_type === 'review_strategy_issue' ? '问题' : '变更'} AI 跟踪任务，稍后会写回策略活动与 AI 复盘。`,
      )
    } catch (error) {
      showFeedback('error', '策略跟踪任务创建失败', resolveErrorMessage(error))
    }
  }

  const submitStrategyRequest = async (
    type: string,
    summary: string,
    payload: Record<string, unknown>,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal',
  ) => {
    try {
      const result = await changeRequestMutation.mutateAsync({
        type,
        payload,
        requested_by: 'desktop_operator',
        target_mode: selectedMode,
        priority,
        summary,
      })
      showFeedback(
        'success',
        result.status === 'applied' ? '变更已落实' : 'ChangeRequest 已创建',
        result.status === 'applied' ? `${summary} 已由本地编排链路落实。` : `${summary} 已进入执行队列。`,
      )
    } catch (error) {
      showFeedback('error', 'ChangeRequest 创建失败', resolveErrorMessage(error))
    }
  }

  return {
    changeRequestMutationPending: changeRequestMutation.isPending,
    strategyTrackingMutationPending: strategyTrackingMutation.isPending,
    submitStrategyTrackingReview,
    submitStrategyRequest,
  }
}

import type { Dispatch, SetStateAction } from 'react'
import { useMutation } from '@tanstack/react-query'

import { api } from '../api'
import type {
  BacktestRun,
  ChangeRequest,
  ExecutionPreview,
  Mode,
  ReviewDocument,
  SchedulerState,
  StrategyProposal,
  StrategySummary,
  StrategyRuntimeSnapshot,
  WatchlistInstrument,
} from '../types'
import {
  backtestDecisionReadinessMeta,
  getAgentJobRetryCount,
  getChangeRequestLinkedBacktestId,
  getChangeRequestLinkedBacktestRecommendation,
  getChangeRequestStrategyId,
  proposalAcceptBlockedReason,
  resolveErrorMessage,
} from '../utils/app-helpers'

type ActionTone = 'success' | 'warning' | 'error'

type UseStrategyWorkflowActionsArgs = {
  refreshControlData: () => Promise<void>
  selectedMode: Mode
  selectedStrategy: StrategySummary | null | undefined
  selectedStrategyRuntimePreview: ExecutionPreview | null | undefined
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null | undefined
  watchlist: WatchlistInstrument[]
  strategies: StrategySummary[]
  backtests: BacktestRun[]
  reviewCatalog: ReviewDocument[]
  schedulerState: SchedulerState | null | undefined
  backtestRangeDraft: string
  backtestTimeframeDraft: string
  strategyTrackingKind: 'issue' | 'change'
  strategyTrackingSummary: string
  strategyTrackingDetail: string
  strategyTrackingRequestKey: string
  findProposalById: (proposalId: string) => StrategyProposal | null
  setSelectedStrategyId: Dispatch<SetStateAction<string | null>>
  setBacktestRangeDraft: Dispatch<SetStateAction<string>>
  setBacktestTimeframeDraft: Dispatch<SetStateAction<string>>
  setSelectedBacktestId: Dispatch<SetStateAction<string | null>>
  setSelectedProposalId: Dispatch<SetStateAction<string | null>>
  setStrategyTrackingPanelOpen: Dispatch<SetStateAction<boolean>>
  setStrategyActivityPanelOpen: Dispatch<SetStateAction<boolean>>
  resetStrategyTrackingDraft: (kind?: 'issue' | 'change', nextSummary?: string, nextDetail?: string) => void
  showFeedback: (tone: ActionTone, title: string, detail: string) => void
  openAiSchedulerJob: (jobId: string) => void
  openBacktestDetail: (backtestId: string, strategyId?: string | null) => void
  openChangeRequest: (changeRequestId: string, strategyId?: string | null) => void
}

export function useStrategyWorkflowActions({
  refreshControlData,
  selectedMode,
  selectedStrategy,
  selectedStrategyRuntimePreview,
  selectedStrategyRuntime,
  watchlist,
  strategies,
  backtests,
  reviewCatalog,
  schedulerState,
  backtestRangeDraft,
  backtestTimeframeDraft,
  strategyTrackingKind,
  strategyTrackingSummary,
  strategyTrackingDetail,
  strategyTrackingRequestKey,
  findProposalById,
  setSelectedStrategyId,
  setBacktestRangeDraft,
  setBacktestTimeframeDraft,
  setSelectedBacktestId,
  setSelectedProposalId,
  setStrategyTrackingPanelOpen,
  setStrategyActivityPanelOpen,
  resetStrategyTrackingDraft,
  showFeedback,
  openAiSchedulerJob,
  openBacktestDetail,
  openChangeRequest,
}: UseStrategyWorkflowActionsArgs) {
  const changeRequestMutation = useMutation({
    mutationFn: api.createChangeRequest,
    onSuccess: refreshControlData,
  })

  const backtestMutation = useMutation({
    mutationFn: api.createBacktest,
    onSuccess: refreshControlData,
  })

  const executeStrategySignalMutation = useMutation({
    mutationFn: ({ strategyId, note, mode }: { strategyId: string; note?: string; mode?: 'paper' | 'demo' | 'live' }) =>
      api.executeStrategySignal(strategyId, { requested_by: 'desktop_operator', note, mode }),
    onSuccess: refreshControlData,
  })

  const agentJobMutation = useMutation({
    mutationFn: api.createAgentJob,
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
    }) => api.createStrategyTrackingReview(strategyId, payload),
    onSuccess: refreshControlData,
  })

  const retryAgentJobMutation = useMutation({
    mutationFn: (jobId: string) => api.retryAgentJob(jobId, 'desktop_operator'),
    onSuccess: refreshControlData,
  })

  const proposalMutation = useMutation({
    mutationFn: ({ proposalId, action }: { proposalId: string; action: 'accept' | 'reject' }) =>
      api.applyStrategyProposalAction(proposalId, action),
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

  const submitBacktest = async () => {
    if (!selectedStrategy) {
      return
    }
    try {
      await backtestMutation.mutateAsync({
        strategy_id: selectedStrategy.id,
        data_range: backtestRangeDraft,
        timeframe: backtestTimeframeDraft,
      })
      showFeedback(
        'success',
        '回测任务已完成',
        `${selectedStrategy.name} 已按 ${backtestTimeframeDraft} / ${backtestRangeDraft} 写回新的回测结果。`,
      )
    } catch (error) {
      showFeedback('error', '回测发起失败', resolveErrorMessage(error))
    }
  }

  const rerunBacktestFromRecommendation = async (backtest?: BacktestRun | null) => {
    if (!backtest) {
      return
    }
    const decisionMeta = backtestDecisionReadinessMeta(backtest)
    const recommendedRange = decisionMeta?.recommendedRange
    const recommendedTimeframe = decisionMeta?.recommendedTimeframe
    if (!recommendedRange || !recommendedTimeframe) {
      showFeedback('warning', '当前没有可执行建议', '这条回测结果目前没有结构化的建议重跑参数。')
      return
    }

    const nextStrategy = strategies.find((item) => item.id === backtest.strategy_id)
    const strategyName = nextStrategy?.name ?? backtest.strategy_name
    const linkedReview =
      reviewCatalog
        .filter((review) => review.backtest_id === backtest.id)
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0] ?? null
    setSelectedStrategyId(backtest.strategy_id)
    setBacktestRangeDraft(recommendedRange)
    setBacktestTimeframeDraft(recommendedTimeframe)

    try {
      const rerunBacktest = await backtestMutation.mutateAsync({
        strategy_id: backtest.strategy_id,
        data_range: recommendedRange,
        timeframe: recommendedTimeframe,
        source_change_request_id: backtest.source_change_request_id ?? null,
        source_backtest_id: backtest.id,
        source_review_id: linkedReview?.id ?? null,
        trigger_reason: 'decision_rerun',
      })
      setSelectedBacktestId(rerunBacktest.id)
      showFeedback(
        'success',
        '已按建议重跑回测',
        `${strategyName} 已按 ${recommendedTimeframe} / ${recommendedRange} 重新生成回测结果。`,
      )
    } catch (error) {
      showFeedback('error', '按建议重跑失败', resolveErrorMessage(error))
    }
  }

  const rerunBacktestFromReview = async (review?: ReviewDocument | null) => {
    if (!review?.strategy_id) {
      return
    }
    const recommendedRange =
      typeof review.decision_recommended_data_range === 'string' && review.decision_recommended_data_range.trim()
        ? review.decision_recommended_data_range.trim()
        : null
    const recommendedTimeframe =
      typeof review.decision_recommended_timeframe === 'string' && review.decision_recommended_timeframe.trim()
        ? review.decision_recommended_timeframe.trim()
        : null
    if (!recommendedRange || !recommendedTimeframe) {
      showFeedback('warning', '当前没有可执行建议', '这条 AI 复盘结果目前没有结构化的建议重跑参数。')
      return
    }

    const nextStrategy = strategies.find((item) => item.id === review.strategy_id)
    const strategyName = nextStrategy?.name ?? review.strategy_id
    setSelectedStrategyId(review.strategy_id)
    setBacktestRangeDraft(recommendedRange)
    setBacktestTimeframeDraft(recommendedTimeframe)

    try {
      const rerunBacktest = await backtestMutation.mutateAsync({
        strategy_id: review.strategy_id,
        data_range: recommendedRange,
        timeframe: recommendedTimeframe,
        source_change_request_id: review.source_change_request_id ?? null,
        source_backtest_id: review.backtest_id ?? null,
        source_review_id: review.id,
        trigger_reason: 'review_decision_rerun',
      })
      setSelectedBacktestId(rerunBacktest.id)
      showFeedback(
        'success',
        '已按复盘建议重跑回测',
        `${strategyName} 已按 ${recommendedTimeframe} / ${recommendedRange} 重新生成回测结果。`,
      )
    } catch (error) {
      showFeedback('error', '按复盘建议重跑失败', resolveErrorMessage(error))
    }
  }

  const rerunBacktestFromChangeRequest = async (request?: ChangeRequest | null) => {
    if (!request) {
      return
    }
    const strategyId = getChangeRequestStrategyId(request, selectedStrategy?.id ?? null)
    const linkedBacktestId = getChangeRequestLinkedBacktestId(request)
    const linkedBacktest = linkedBacktestId ? backtests.find((item) => item.id === linkedBacktestId) ?? null : null
    const rerunRecommendation = getChangeRequestLinkedBacktestRecommendation(request, linkedBacktest)
    const recommendedRange = rerunRecommendation?.recommendedRange ?? null
    const recommendedTimeframe = rerunRecommendation?.recommendedTimeframe ?? null
    if (!strategyId || !linkedBacktestId || !recommendedRange || !recommendedTimeframe) {
      showFeedback('warning', '当前没有可执行建议', '这条变更当前还没有可直接执行的结构化重跑参数。')
      return
    }

    const nextStrategy = strategies.find((item) => item.id === strategyId)
    const strategyName = nextStrategy?.name ?? strategyId
    setSelectedStrategyId(strategyId)
    setBacktestRangeDraft(recommendedRange)
    setBacktestTimeframeDraft(recommendedTimeframe)

    try {
      const rerunBacktest = await backtestMutation.mutateAsync({
        strategy_id: strategyId,
        data_range: recommendedRange,
        timeframe: recommendedTimeframe,
        source_change_request_id: request.id,
        source_backtest_id: linkedBacktestId,
        source_review_id: request.linked_review_id ?? request.source_review_id ?? null,
        source_proposal_id: request.source_proposal_id ?? null,
        trigger_reason: 'decision_rerun',
      })
      setSelectedBacktestId(rerunBacktest.id)
      showFeedback(
        'success',
        '已按变更卡片建议重跑回测',
        `${strategyName} 已按 ${recommendedTimeframe} / ${recommendedRange} 重新生成回测结果。`,
      )
    } catch (error) {
      showFeedback('error', '按变更卡片建议重跑失败', resolveErrorMessage(error))
    }
  }

  const executeSelectedStrategySignal = async () => {
    if (!selectedStrategy || !selectedStrategyRuntimePreview) {
      return
    }
    if (!selectedStrategyRuntimePreview.allowed) {
      showFeedback(
        'warning',
        '当前策略信号不可执行',
        selectedStrategyRuntimePreview.recommended_action
          ? `${selectedStrategyRuntimePreview.blocked_reason ?? '当前策略执行预估未通过。'} 建议 ${selectedStrategyRuntimePreview.recommended_action}`
          : selectedStrategyRuntimePreview.blocked_reason ?? '当前策略执行预估未通过。',
      )
      return
    }

    try {
      const result = await executeStrategySignalMutation.mutateAsync({
        strategyId: selectedStrategy.id,
        note:
          selectedStrategyRuntime?.next_action ??
          `${selectedStrategy.name} 按当前策略信号提交${selectedMode === 'paper' ? '纸面执行' : '真实委托'}`,
        mode: selectedMode,
      })
      if (result.kind === 'paper_trade' && result.trade) {
        showFeedback(
          'success',
          '策略纸面信号已执行',
          `${result.trade.symbol} 已按当前策略运行态写入一笔 ${result.trade.side === 'buy' ? '买入' : '卖出'} 纸面成交。`,
        )
        return
      }
      if (result.kind === 'exchange_order' && result.order) {
        showFeedback(
          'success',
          '策略真实委托已提交',
          `${result.order.symbol} 已按当前策略信号向 Bybit 提交一笔 ${result.order.side === 'buy' ? '买入' : '卖出'} 限价委托。`,
        )
        return
      }
      showFeedback('success', '策略执行已提交', result.message)
    } catch (error) {
      showFeedback(
        'error',
        selectedMode === 'paper' ? '策略纸面信号执行失败' : '策略真实委托提交失败',
        resolveErrorMessage(error),
      )
    }
  }

  const submitReviewJob = async () => {
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

  const retryAgentJob = async (jobId: string, options?: { focusJob?: boolean }) => {
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

  const handleProposalAction = async (proposalId: string, action: 'accept' | 'reject') => {
    const proposal = findProposalById(proposalId)
    const blockedReason =
      action === 'accept' && proposal ? proposalAcceptBlockedReason(proposal.proposal_type, schedulerState) : null
    if (blockedReason) {
      showFeedback('warning', '当前不能接受该提案', blockedReason)
      return
    }
    try {
      const result = await proposalMutation.mutateAsync({ proposalId, action })
      if (action === 'accept') {
        setSelectedProposalId(result.proposal.id)
        if (result.created_backtest) {
          openBacktestDetail(result.created_backtest.id, result.created_backtest.strategy_id)
        }
        if (result.created_change_request && result.created_change_request.status !== 'applied') {
          openChangeRequest(
            result.created_change_request.id,
            getChangeRequestStrategyId(result.created_change_request, result.proposal.strategy_id),
          )
        }
      }
      const detail =
        action === 'accept'
          ? result.created_backtest
            ? `${result.proposal.title} 已转成回测任务并写回结果，当前已自动定位到新回测。`
            : result.created_change_request
              ? result.created_change_request.status === 'applied'
                ? `${result.proposal.title} 已转成 ChangeRequest 并完成落实。`
                : result.created_change_request.manual_followup_required
                  ? `${result.proposal.title} 已转成待处理 ChangeRequest，当前需人工跟进并已定位到对应变更。`
                  : `${result.proposal.title} 已转成 ChangeRequest，当前已定位到待落实变更。`
              : `${result.proposal.title} 已标记为接受。`
          : `${result.proposal.title} 已被拒绝，不会继续进入执行链路。`
      showFeedback('success', action === 'accept' ? 'AI 提案已接受' : 'AI 提案已拒绝', detail)
    } catch (error) {
      showFeedback('error', '提案动作失败', resolveErrorMessage(error))
    }
  }

  return {
    changeRequestMutationPending: changeRequestMutation.isPending,
    backtestMutationPending: backtestMutation.isPending,
    executeStrategySignalMutationPending: executeStrategySignalMutation.isPending,
    agentJobMutationPending: agentJobMutation.isPending,
    strategyTrackingMutationPending: strategyTrackingMutation.isPending,
    retryAgentJobMutationPending: retryAgentJobMutation.isPending,
    proposalMutationPending: proposalMutation.isPending,
    submitStrategyTrackingReview,
    submitStrategyRequest,
    submitBacktest,
    rerunBacktestFromRecommendation,
    rerunBacktestFromReview,
    rerunBacktestFromChangeRequest,
    executeSelectedStrategySignal,
    submitReviewJob,
    retryAgentJob,
    handleProposalAction,
  }
}

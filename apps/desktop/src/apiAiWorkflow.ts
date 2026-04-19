import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  SchedulerCommandResult,
  SchedulerCommandType,
  StrategyProposalActionResult,
} from './types'
import { apiFallbacks } from './apiFallbacks'
import { fetchJson, postJson } from './apiHttp'
import { normalizeReviewDocument } from './strategyActivitySnapshotNormalization'

function buildReviewQueryString(options?: {
  strategyId?: string | null
  backtestId?: string | null
  periods?: string[]
}) {
  const query = new URLSearchParams()
  if (options?.strategyId) {
    query.set('strategy_id', options.strategyId)
  }
  if (options?.backtestId) {
    query.set('backtest_id', options.backtestId)
  }
  if (options?.periods?.length) {
    query.set('period', options.periods.join(','))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

function filterFallbackReviews(
  reviews: ReviewDocument[],
  options?: {
    strategyId?: string | null
    backtestId?: string | null
    periods?: string[]
  },
) {
  let next = [...reviews]

  if (options?.strategyId) {
    next = next.filter(
      (review) =>
        review.strategy_id === options.strategyId ||
        review.proposals.some((proposal) => proposal.strategy_id === options.strategyId),
    )
  }

  if (options?.periods?.length) {
    const allowed = new Set(options.periods)
    next = next.filter((review) => allowed.has(review.period))
  }

  if (options?.backtestId) {
    next = next.filter((review) => review.backtest_id === options.backtestId)
  }

  return next
}

export const aiWorkflowApi = {
  getBacktests: () => fetchJson('/api/backtests', apiFallbacks.backtests),
  getChangeRequests: () => fetchJson('/api/change-requests', apiFallbacks.scheduler.change_requests),
  getScheduler: () => fetchJson('/api/ai/scheduler', apiFallbacks.scheduler),
  getAiLiveSnapshot: () => fetchJson('/api/ai/live', apiFallbacks.aiLive),
  getReviews: async (options?: {
    strategyId?: string | null
    backtestId?: string | null
    periods?: string[]
  }) =>
    (
      await fetchJson(
        `/api/ai/reviews${buildReviewQueryString(options)}`,
        filterFallbackReviews(apiFallbacks.reviews, options),
      )
    ).map((review) => normalizeReviewDocument(review) ?? review),
  createChangeRequest: (payload: {
    type: string
    payload: Record<string, unknown>
    requested_by?: string
    target_mode?: 'paper' | 'demo' | 'live'
    priority?: 'low' | 'normal' | 'high' | 'critical'
    summary: string
  }) => postJson<ChangeRequest>('/api/change-requests', payload),
  createBacktest: (payload: {
    strategy_id: string
    data_range: string
    timeframe: string
    source_change_request_id?: string | null
    source_backtest_id?: string | null
    source_review_id?: string | null
    source_proposal_id?: string | null
    trigger_reason?: string | null
  }) => postJson<BacktestRun>('/api/backtests', payload),
  sendSchedulerCommand: (payload: {
    command: SchedulerCommandType
    job_id?: string
    requested_by?: string
    reason?: string
  }) => postJson<SchedulerCommandResult>('/api/ai/scheduler/commands', payload),
  createAgentJob: (payload: {
    job_type: string
    context: Record<string, unknown>
    allowed_actions?: string[]
    timeout?: number
    idempotency_key: string
    writeback_target?: string
  }) => postJson<AgentJob>('/api/ai/jobs', payload),
  retryAgentJob: (jobId: string, requested_by = 'desktop_operator') =>
    postJson<AgentJob>(`/api/ai/jobs/${encodeURIComponent(jobId)}/retry`, {
      requested_by,
    }),
  applyStrategyProposalAction: (proposalId: string, action: 'accept' | 'reject') =>
    postJson<StrategyProposalActionResult>(
      `/api/ai/proposals/${proposalId}/action`,
      {
        action,
        requested_by: 'desktop_operator',
      },
    ),
}

import type { BacktestRun, ChangeRequest, StrategySummary } from '../../types'
import {
  changeRequestStatusLabel,
  changeRequestTriggerReasonLabel,
  formatTime,
  getChangeRequestLinkedBacktestDecisionMeta,
  getChangeRequestLinkedBacktestId,
  getChangeRequestLinkedBacktestRecommendation,
  getChangeRequestLinkedBacktestSampleMeta,
  getChangeRequestLinkedBacktestWindowMeta,
  getChangeRequestManualFollowupDetail,
  getChangeRequestSourceBacktestId,
  getChangeRequestSourceProposalId,
  getChangeRequestSourceReviewId,
  getChangeRequestStrategyId,
  jobStatusLabel,
  jobStatusToneClass,
  reviewPeriodChipClass,
  reviewPeriodLabel,
} from '../../utils/app-helpers'

export type ChangeRequestListItemProps = {
  request: ChangeRequest
  index: number
  selectedStrategy: StrategySummary
  backtests: BacktestRun[]
  selectedChangeRequestId: string | null
  serviceAvailable: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string, options?: { focusJob?: boolean }) => void
  onRerunBacktestFromChangeRequest: (request: ChangeRequest) => void
}

export default function ChangeRequestListItem({
  request,
  index,
  selectedStrategy,
  backtests,
  selectedChangeRequestId,
  serviceAvailable,
  backtestMutationPending,
  retryAgentJobMutationPending,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onRetryAgentJob,
  onRerunBacktestFromChangeRequest,
}: ChangeRequestListItemProps) {
  const requestStrategyId = getChangeRequestStrategyId(request, selectedStrategy.id)
  const linkedBacktestId = getChangeRequestLinkedBacktestId(request)
  const linkedBacktest = linkedBacktestId ? backtests.find((item) => item.id === linkedBacktestId) ?? null : null
  const manualFollowupDetail = getChangeRequestManualFollowupDetail(request)
  const linkedBacktestSampleMeta = getChangeRequestLinkedBacktestSampleMeta(request, linkedBacktest)
  const linkedBacktestDecisionMeta = getChangeRequestLinkedBacktestDecisionMeta(request)
  const linkedBacktestWindowMeta = getChangeRequestLinkedBacktestWindowMeta(request, linkedBacktest)
  const linkedBacktestRerunRecommendation = getChangeRequestLinkedBacktestRecommendation(request, linkedBacktest)
  const sourceBacktestId = getChangeRequestSourceBacktestId(request)
  const sourceReviewId = getChangeRequestSourceReviewId(request)
  const sourceProposalId = getChangeRequestSourceProposalId(request)

  return (
    <div
      className={`job-row job-row--fade ${selectedChangeRequestId === request.id ? 'job-row--active' : ''}`}
      style={{ animationDelay: `${index * 28}ms` }}
    >
      <div className="console-row__main">
        <strong>{request.summary}</strong>
        <p>{request.type} · {request.requested_by} · {changeRequestTriggerReasonLabel(request.trigger_reason)}</p>
        {request.follow_up_job_type && (
          <p>
            跟踪任务 {request.follow_up_job_type}
            {request.follow_up_job_status ? (
              <>
                {' · '}
                <span className={jobStatusToneClass(request.follow_up_job_status)}>
                  {jobStatusLabel(request.follow_up_job_status)}
                </span>
              </>
            ) : null}
            {request.linked_review_title ? ` · 结果 ${request.linked_review_title}` : ''}
            {!request.linked_review_title && request.follow_up_result_summary
              ? ` · ${request.follow_up_result_summary}`
              : ''}
          </p>
        )}
        {linkedBacktestId && (
          <p>
            已生成回测 {linkedBacktestId}
            {request.linked_backtest_timeframe ? ` · ${request.linked_backtest_timeframe}` : ''}
            {request.linked_backtest_data_range ? ` · ${request.linked_backtest_data_range}` : ''}
          </p>
        )}
        {manualFollowupDetail && <p>需人工跟进 · {manualFollowupDetail}</p>}
        {linkedBacktestSampleMeta && request.linked_backtest_sample_quality !== 'sufficient' && (
          <p>样本质量 {linkedBacktestSampleMeta.label} · {linkedBacktestSampleMeta.description}</p>
        )}
        {linkedBacktestDecisionMeta && (
          <p>
            结论门禁 {linkedBacktestDecisionMeta.label} · {linkedBacktestDecisionMeta.description}
            {linkedBacktestDecisionMeta.nextAction ? ` · 建议 ${linkedBacktestDecisionMeta.nextAction}` : ''}
          </p>
        )}
        {linkedBacktestWindowMeta?.attention && (
          <p>
            样本窗口 {linkedBacktestWindowMeta.label} · {linkedBacktestWindowMeta.description}
            {linkedBacktestWindowMeta.nextAction ? ` · 建议 ${linkedBacktestWindowMeta.nextAction}` : ''}
          </p>
        )}
        {linkedBacktestWindowMeta?.detail &&
          linkedBacktestWindowMeta.detail !== linkedBacktestWindowMeta.description && (
            <p>{linkedBacktestWindowMeta.detail}</p>
          )}
      </div>
      <div className="job-meta">
        <span className="console-tag">{changeRequestStatusLabel(request.status)}</span>
        {request.manual_followup_required && (
          <span className="console-tag console-tag--warn">需人工跟进</span>
        )}
        {linkedBacktestSampleMeta && request.linked_backtest_sample_quality !== 'sufficient' && (
          <span className={linkedBacktestSampleMeta.chipClass}>{linkedBacktestSampleMeta.label}</span>
        )}
        {linkedBacktestDecisionMeta && (
          <span className={linkedBacktestDecisionMeta.chipClass}>{linkedBacktestDecisionMeta.label}</span>
        )}
        {!linkedBacktestDecisionMeta && linkedBacktestWindowMeta?.attention && (
          <span className={linkedBacktestWindowMeta.chipClass}>{linkedBacktestWindowMeta.label}</span>
        )}
        {request.linked_review_period && (
          <span className={reviewPeriodChipClass(request.linked_review_period)}>
            {reviewPeriodLabel(request.linked_review_period)}
          </span>
        )}
        {selectedChangeRequestId === request.id && (
          <span className="console-tag console-tag--warn">当前定位</span>
        )}
        <small>{formatTime(request.updated_at)}</small>
      </div>
      <div className="toggle-card__actions">
        <button
          type="button"
          className="ghost-button"
          onClick={() => onOpenChangeRequest(request.id, requestStrategyId)}
        >
          查看变更
        </button>
        {linkedBacktestId && requestStrategyId && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => onOpenBacktestDetail(linkedBacktestId, requestStrategyId)}
          >
            打开回测
          </button>
        )}
        {linkedBacktestDecisionMeta?.recommendedRange &&
          linkedBacktestDecisionMeta?.recommendedTimeframe && (
            <button
              type="button"
              className="ghost-button"
              disabled={!serviceAvailable || backtestMutationPending}
              onClick={() => {
                void onRerunBacktestFromChangeRequest(request)
              }}
            >
              按建议重跑
            </button>
          )}
        {!linkedBacktestDecisionMeta?.recommendedRange &&
          linkedBacktestRerunRecommendation?.recommendedRange &&
          linkedBacktestRerunRecommendation?.recommendedTimeframe && (
            <button
              type="button"
              className="ghost-button"
              disabled={!serviceAvailable || backtestMutationPending}
              onClick={() => {
                void onRerunBacktestFromChangeRequest(request)
              }}
            >
              按建议重跑
            </button>
          )}
        {request.follow_up_job_id && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => onOpenAiSchedulerJob(request.follow_up_job_id)}
          >
            打开任务
          </button>
        )}
        {request.linked_review_id && requestStrategyId && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => onOpenReviewInspector(request.linked_review_id, requestStrategyId)}
          >
            查看结果
          </button>
        )}
        {request.follow_up_job_id &&
          (request.follow_up_job_status === 'failed' || request.follow_up_job_status === 'cancelled') && (
            <button
              type="button"
              className="ghost-button"
              disabled={!serviceAvailable || retryAgentJobMutationPending}
              onClick={() => {
                void onRetryAgentJob(request.follow_up_job_id, { focusJob: true })
              }}
            >
              重试跟踪
            </button>
          )}
        {sourceBacktestId && requestStrategyId && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => onOpenBacktestDetail(sourceBacktestId, requestStrategyId)}
          >
            来源回测
          </button>
        )}
        {sourceReviewId && requestStrategyId && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => onOpenSourceReview(sourceReviewId, requestStrategyId)}
          >
            来源复盘
          </button>
        )}
        {sourceProposalId && requestStrategyId && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => onOpenStrategyProposal(sourceProposalId, requestStrategyId)}
          >
            来源提案
          </button>
        )}
      </div>
    </div>
  )
}

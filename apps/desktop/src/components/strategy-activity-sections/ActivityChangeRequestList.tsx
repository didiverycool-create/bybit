import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyProposal,
} from '../../types'
import {
  changeRequestStatusLabel,
  changeRequestTriggerReasonLabel,
  formatDateTime,
  getChangeRequestLinkedBacktestDecisionMeta,
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

type ChangeRequestLinkedState = {
  linkedBacktest: BacktestRun | null
  linkedReview: ReviewDocument | null
  linkedJob: AgentJob | null
  sourceBacktest: BacktestRun | null
  sourceReview: ReviewDocument | null
  sourceProposal: StrategyProposal | null
}

export type ActivityChangeRequestListProps = {
  strategyId: string
  focusedChangeRequestSupplemented: boolean
  strategyActivityLatestChangeRequestSupplemented: boolean
  strategyActivityLatestActionableChangeRequestSupplemented: boolean
  strategyActivityChangeRequests: ChangeRequest[]
  activityLatestChangeRequest: ChangeRequest | null
  activityLatestActionableChangeRequest: ChangeRequest | null
  selectedChangeRequestId: string | null
  serviceAvailable: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  getStrategyActivityChangeRequestLinkedState: (request?: ChangeRequest | null) => ChangeRequestLinkedState
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId: string) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string) => void
  onRerunBacktestFromChangeRequest: (request: ChangeRequest) => void
}

export default function ActivityChangeRequestList({
  strategyId,
  focusedChangeRequestSupplemented,
  strategyActivityLatestChangeRequestSupplemented,
  strategyActivityLatestActionableChangeRequestSupplemented,
  strategyActivityChangeRequests,
  activityLatestChangeRequest,
  activityLatestActionableChangeRequest,
  selectedChangeRequestId,
  serviceAvailable,
  backtestMutationPending,
  retryAgentJobMutationPending,
  getStrategyActivityChangeRequestLinkedState,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenReviewInspector,
  onOpenAiSchedulerJob,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onRetryAgentJob,
  onRerunBacktestFromChangeRequest,
}: ActivityChangeRequestListProps) {
  return (
    <>
      <span className="section-label" data-strategy-activity-section-label="change-requests">
        待落实变更
      </span>
      {focusedChangeRequestSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="focused_change_request_hint">
          当前定位的变更不在最近活动返回的最近变更内，面板已临时把它补进当前视图，便于直接继续排障和处理。
        </p>
      )}
      {strategyActivityLatestChangeRequestSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="latest_change_request_supplemented_hint">
          顶部最近变更不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿当前最新变更处理。
        </p>
      )}
      {strategyActivityLatestActionableChangeRequestSupplemented && (
        <p className="panel-note" data-strategy-activity-note-key="actionable_change_request_supplemented_hint">
          顶部当前可处理变更不在最近活动返回范围内，面板已临时把它补进当前视图，便于继续沿这条仍可重试或重跑的变更处理。
        </p>
      )}
      <div
        className="trade-list trade-list--dense"
        data-strategy-activity-section="change-requests"
        data-strategy-activity-action-group="change-requests"
      >
        {strategyActivityChangeRequests.map((request) => {
          const requestStrategyId = getChangeRequestStrategyId(request, strategyId)
          const linkedState = getStrategyActivityChangeRequestLinkedState(request)
          const linkedBacktest = linkedState.linkedBacktest
          const linkedBacktestId =
            linkedBacktest?.id ??
            (typeof request.linked_backtest_id === 'string' && request.linked_backtest_id.trim()
              ? request.linked_backtest_id.trim()
              : null)
          const linkedReview = linkedState.linkedReview
          const linkedJob = linkedState.linkedJob
          const linkedBacktestSampleMeta = getChangeRequestLinkedBacktestSampleMeta(request, linkedBacktest)
          const linkedBacktestDecisionMeta = getChangeRequestLinkedBacktestDecisionMeta(request)
          const linkedBacktestWindowMeta = getChangeRequestLinkedBacktestWindowMeta(request, linkedBacktest)
          const linkedBacktestRerunRecommendation = getChangeRequestLinkedBacktestRecommendation(
            request,
            linkedBacktest,
          )
          const sourceBacktestId = getChangeRequestSourceBacktestId(request)
          const sourceReviewId = getChangeRequestSourceReviewId(request)
          const sourceProposalId = getChangeRequestSourceProposalId(request)
          const sourceBacktest = linkedState.sourceBacktest
          const sourceReview = linkedState.sourceReview
          const sourceProposal = linkedState.sourceProposal
          const resolvedSourceBacktestId = sourceBacktest?.id ?? sourceBacktestId
          const resolvedSourceReviewId = sourceReview?.id ?? sourceReviewId
          const resolvedSourceProposalId = sourceProposal?.id ?? sourceProposalId
          const sourceBacktestStrategyId = sourceBacktest?.strategy_id ?? requestStrategyId
          const sourceReviewStrategyId = sourceReview?.strategy_id ?? requestStrategyId
          const sourceProposalStrategyId = sourceProposal?.strategy_id ?? requestStrategyId
          const manualFollowupDetail = getChangeRequestManualFollowupDetail(request)
          return (
            <div key={request.id} className="trade-row trade-row--fade" data-strategy-activity-row-id={request.id}>
              <div className="console-row__main">
                <strong>{request.summary}</strong>
                <p>
                  {request.type} · {request.requested_by} · {changeRequestTriggerReasonLabel(request.trigger_reason)}
                </p>
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
                {!linkedBacktestDecisionMeta && linkedBacktestWindowMeta?.attention && (
                  <p>
                    样本窗口 {linkedBacktestWindowMeta.label} · {linkedBacktestWindowMeta.description}
                    {linkedBacktestWindowMeta.nextAction ? ` · 建议 ${linkedBacktestWindowMeta.nextAction}` : ''}
                  </p>
                )}
              </div>
              <div className="trade-meta">
                <span className="console-tag">{changeRequestStatusLabel(request.status)}</span>
                {activityLatestChangeRequest?.id === request.id && (
                  <span className="console-tag console-tag--warn">当前最新</span>
                )}
                {activityLatestActionableChangeRequest?.id === request.id && (
                  <span className="console-tag console-tag--warn">当前可处理</span>
                )}
                {request.manual_followup_required && (
                  <span className="console-tag console-tag--warn">需人工跟进</span>
                )}
                {selectedChangeRequestId === request.id && (
                  <span className="console-tag console-tag--warn">当前定位</span>
                )}
                {request.linked_review_period && (
                  <span className={reviewPeriodChipClass(request.linked_review_period)}>
                    {reviewPeriodLabel(request.linked_review_period)}
                  </span>
                )}
                {linkedBacktestDecisionMeta && (
                  <span className={linkedBacktestDecisionMeta.chipClass}>{linkedBacktestDecisionMeta.label}</span>
                )}
                {!linkedBacktestDecisionMeta && linkedBacktestWindowMeta?.attention && (
                  <span className={linkedBacktestWindowMeta.chipClass}>{linkedBacktestWindowMeta.label}</span>
                )}
                <button
                  type="button"
                  className="micro-action"
                  onClick={() => onOpenChangeRequest(request.id, requestStrategyId)}
                >
                  查看变更
                </button>
                <small>{formatDateTime(request.updated_at)}</small>
              </div>
              <div className="toggle-card__actions">
                {linkedBacktestId && requestStrategyId && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => onOpenBacktestDetail(linkedBacktestId, requestStrategyId)}
                  >
                    打开回测
                  </button>
                )}
                {(linkedBacktestDecisionMeta?.recommendedRange && linkedBacktestDecisionMeta?.recommendedTimeframe) ||
                (linkedBacktestRerunRecommendation?.recommendedRange &&
                  linkedBacktestRerunRecommendation?.recommendedTimeframe) ? (
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={!serviceAvailable || backtestMutationPending}
                    onClick={() => onRerunBacktestFromChangeRequest(request)}
                  >
                    按建议重跑
                  </button>
                ) : null}
                {(request.follow_up_job_id || linkedJob?.id) && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      const jobId = request.follow_up_job_id ?? linkedJob?.id
                      if (!jobId) return
                      onOpenAiSchedulerJob(jobId)
                    }}
                  >
                    打开任务
                  </button>
                )}
                {(request.linked_review_id || linkedReview?.id) && requestStrategyId && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      const reviewId = request.linked_review_id ?? linkedReview?.id
                      if (!reviewId) return
                      onOpenReviewInspector(reviewId, requestStrategyId)
                    }}
                  >
                    查看结果
                  </button>
                )}
                {(request.follow_up_job_id || linkedJob?.id) &&
                  (request.follow_up_job_status === 'failed' ||
                    request.follow_up_job_status === 'cancelled') && (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={!serviceAvailable || retryAgentJobMutationPending}
                      onClick={() => {
                        const jobId = request.follow_up_job_id ?? linkedJob?.id
                        if (!jobId) return
                        onRetryAgentJob(jobId)
                      }}
                    >
                      重试跟踪
                    </button>
                  )}
                {resolvedSourceBacktestId && sourceBacktestStrategyId && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => onOpenBacktestDetail(resolvedSourceBacktestId, sourceBacktestStrategyId)}
                  >
                    来源回测
                  </button>
                )}
                {resolvedSourceReviewId && sourceReviewStrategyId && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => onOpenSourceReview(resolvedSourceReviewId, sourceReviewStrategyId)}
                  >
                    来源复盘
                  </button>
                )}
                {resolvedSourceProposalId && sourceProposalStrategyId && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => onOpenStrategyProposal(resolvedSourceProposalId, sourceProposalStrategyId)}
                  >
                    来源提案
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {!strategyActivityChangeRequests.length && (
          <div className="empty-state empty-state--inline">当前没有最近待落实的变更。</div>
        )}
      </div>
    </>
  )
}

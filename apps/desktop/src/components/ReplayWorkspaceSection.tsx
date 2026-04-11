import { Bot, Sparkles } from 'lucide-react'

import type { AgentJob, BacktestRun, ChangeRequest, ReviewDocument, StrategyProposal, StrategySummary } from '../types'
import {
  getAgentJobStrategyId,
  getChangeRequestStrategyId,
  isStrategyTrackingReview,
  jobStatusLabel,
  proposalAcceptBlockedReason,
  proposalManualFollowupMeta,
  proposalOutcomeDetails,
  proposalStatusLabel,
  proposalTypeLabel,
  reviewPeriodChipClass,
  reviewPeriodLabel,
  strategyAgentJobSummary,
  formatTime,
} from '../utils/app-helpers'

type ReplayFocusReviewDecisionMeta = {
  label: string
  description: string
  recommendedRange?: string | null
  recommendedTimeframe?: string | null
  nextAction?: string | null
  chipClass?: string
} | null

type ReplayFocusReviewLineageMeta = {
  label: string
  detail: string
} | null

type ReplayProposalFeedItem = {
  reviewId: string
  reviewTitle: string
  reviewPeriod: string
  proposal: StrategyProposal
}

type ReplayWorkspaceSectionProps = {
  selectedStrategy: StrategySummary | null
  replayFocusReview: ReviewDocument | null
  replayFocusReviewDecisionMeta: ReplayFocusReviewDecisionMeta
  replayFocusReviewLineageMeta: ReplayFocusReviewLineageMeta
  hasLatestTrackingReview: boolean
  replayTrackingScope: 'all' | 'selected'
  onSetReplayTrackingScope: (scope: 'all' | 'selected') => void
  serviceAvailable: boolean
  agentJobMutationPending: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  proposalMutationPending: boolean
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  selectedBacktestId: string | null
  focusedReviewId: string | null
  aiSchedulerFocusedJobId: string | null
  filteredReplayTrackingReviews: ReviewDocument[]
  filteredReplayTrackingJobs: AgentJob[]
  strategyNameMap: Map<string, string>
  replayProposalFeed: ReplayProposalFeedItem[]
  proposalBacktestMap: Map<string, BacktestRun>
  proposalReviewMap: Map<string, ReviewDocument>
  proposalChangeRequestMap: Map<string, ChangeRequest>
  proposalAgentJobMap: Map<string, AgentJob>
  schedulerState?: { status?: string; freeze_publish?: boolean } | null
  onSubmitReviewJob: () => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onOpenStrategyActivity: (strategyId?: string | null) => void
  onRerunBacktestFromReview: (review: ReviewDocument) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onRetryAgentJob: (jobId: string, focusJob?: boolean) => void
  onHandleProposalAction: (proposalId: string, action: 'accept' | 'reject') => void
}

export default function ReplayWorkspaceSection({
  selectedStrategy,
  replayFocusReview,
  replayFocusReviewDecisionMeta,
  replayFocusReviewLineageMeta,
  hasLatestTrackingReview,
  replayTrackingScope,
  onSetReplayTrackingScope,
  serviceAvailable,
  agentJobMutationPending,
  backtestMutationPending,
  retryAgentJobMutationPending,
  proposalMutationPending,
  selectedProposalId,
  selectedChangeRequestId,
  selectedBacktestId,
  focusedReviewId,
  aiSchedulerFocusedJobId,
  filteredReplayTrackingReviews,
  filteredReplayTrackingJobs,
  strategyNameMap,
  replayProposalFeed,
  proposalBacktestMap,
  proposalReviewMap,
  proposalChangeRequestMap,
  proposalAgentJobMap,
  schedulerState,
  onSubmitReviewJob,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenAiSchedulerJob,
  onOpenStrategyActivity,
  onRerunBacktestFromReview,
  onOpenReviewInspector,
  onOpenReplayReview,
  onRetryAgentJob,
  onHandleProposalAction,
}: ReplayWorkspaceSectionProps) {
  const proposalFocusLabels = (
    proposal: StrategyProposal,
    linkedChangeRequest?: ChangeRequest | null,
    linkedBacktest?: BacktestRun | null,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ): string[] => {
    const labels: string[] = []
    if (selectedProposalId === proposal.id) {
      labels.push('当前提案')
    }
    if (linkedChangeRequest && selectedChangeRequestId === linkedChangeRequest.id) {
      labels.push('当前变更')
    }
    if (linkedBacktest && selectedBacktestId === linkedBacktest.id) {
      labels.push('当前回测')
    }
    if (linkedReview && focusedReviewId && focusedReviewId === linkedReview.id) {
      labels.push('当前复盘')
    }
    if (linkedJob && aiSchedulerFocusedJobId === linkedJob.id) {
      labels.push('当前任务')
    }
    return labels
  }

  return (
    <section className="two-column replay-layout section-entrance">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">AI 复盘</span>
            <h3>{replayFocusReview && isStrategyTrackingReview(replayFocusReview.period) ? '策略跟踪结果' : '每日总结与策略提案'}</h3>
          </div>
          <button
            type="button"
            className="ghost-button"
            disabled={!serviceAvailable || agentJobMutationPending}
            onClick={onSubmitReviewJob}
          >
            生成复盘
          </button>
        </div>
        {replayFocusReview ? (
          <div className="replay-focus">
            <div className="replay-focus__summary">
              <div className="chip-row">
                <span className={reviewPeriodChipClass(replayFocusReview.period)}>
                  {reviewPeriodLabel(replayFocusReview.period)}
                </span>
                {replayFocusReviewDecisionMeta && replayFocusReviewDecisionMeta.label !== '可继续判断' && (
                  <span className={replayFocusReviewDecisionMeta.chipClass}>{replayFocusReviewDecisionMeta.label}</span>
                )}
              </div>
              <strong>{replayFocusReview.title}</strong>
              <p>{replayFocusReview.summary}</p>
              {replayFocusReviewDecisionMeta && (
                <p className="panel-note">
                  结论门禁: {replayFocusReviewDecisionMeta.description}
                  {replayFocusReviewDecisionMeta.nextAction ? ` · 建议 ${replayFocusReviewDecisionMeta.nextAction}` : ''}
                </p>
              )}
              {(replayFocusReview.source_job_type || replayFocusReview.source_job_status) && (
                <p className="panel-note">
                  {replayFocusReview.source_job_type ? `来源任务 · ${replayFocusReview.source_job_type}` : '来源任务'}
                  {replayFocusReview.source_job_status ? ` · ${jobStatusLabel(replayFocusReview.source_job_status)}` : ''}
                </p>
              )}
              {replayFocusReviewLineageMeta && (
                <p className="panel-note">来源链路: {replayFocusReviewLineageMeta.detail}</p>
              )}
              <div className="inline-actions inline-actions--tight">
                {replayFocusReview.source_change_request_id && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenChangeRequest(replayFocusReview.source_change_request_id, replayFocusReview.strategy_id)}
                  >
                    打开来源变更
                  </button>
                )}
                {replayFocusReview.source_backtest_id && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenBacktestDetail(replayFocusReview.source_backtest_id, replayFocusReview.strategy_id)}
                  >
                    打开来源回测
                  </button>
                )}
                {replayFocusReview.source_review_id && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenSourceReview(replayFocusReview.source_review_id, replayFocusReview.strategy_id)}
                  >
                    打开来源复盘
                  </button>
                )}
                {replayFocusReview.source_proposal_id && replayFocusReview.strategy_id && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenStrategyProposal(replayFocusReview.source_proposal_id, replayFocusReview.strategy_id)}
                  >
                    打开来源提案
                  </button>
                )}
                {replayFocusReview.source_job_id && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenAiSchedulerJob(replayFocusReview.source_job_id)}
                  >
                    打开任务
                  </button>
                )}
                {replayFocusReview.strategy_id && (
                  <button
                    type="button"
                    className="micro-action"
                    onClick={() => onOpenStrategyActivity(replayFocusReview.strategy_id)}
                  >
                    打开策略
                  </button>
                )}
                {replayFocusReview.strategy_id &&
                  replayFocusReviewDecisionMeta?.recommendedRange &&
                  replayFocusReviewDecisionMeta?.recommendedTimeframe && (
                    <button
                      type="button"
                      className="micro-action"
                      disabled={!serviceAvailable || backtestMutationPending}
                      onClick={() => onRerunBacktestFromReview(replayFocusReview)}
                    >
                      按建议重跑
                    </button>
                  )}
              </div>
            </div>
            <div className="replay-focus__signals">
              <div>
                <span>亮点</span>
                <ul className="replay-bullet-list">
                  {replayFocusReview.highlights.slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span>风险</span>
                <ul className="replay-bullet-list replay-bullet-list--warn">
                  {replayFocusReview.risks.slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            当前还没有{replayTrackingScope === 'selected' && selectedStrategy ? '该策略的' : ''}日报或回测复盘
            {hasLatestTrackingReview ? '，但已经生成策略跟踪记录。' : ''}
          </div>
        )}
        <div className="replay-tracking-section">
          <div className="panel-head panel-head--compact">
            <div>
              <span className="section-label">策略跟踪</span>
              <h3>问题与变更的后续追踪</h3>
            </div>
            <span className="chip chip--muted">{filteredReplayTrackingReviews.length} 条</span>
          </div>
          <div className="chip-row">
            <button
              type="button"
              className={`pill pill--compact ${replayTrackingScope === 'all' ? 'active' : ''}`}
              onClick={() => onSetReplayTrackingScope('all')}
            >
              全部策略
            </button>
            {selectedStrategy && (
              <button
                type="button"
                className={`pill pill--compact ${replayTrackingScope === 'selected' ? 'active' : ''}`}
                onClick={() => onSetReplayTrackingScope('selected')}
              >
                当前策略
              </button>
            )}
          </div>
          <div className="job-list">
            {filteredReplayTrackingReviews.slice(0, 6).map((review, index) => (
              <div key={review.id} className="job-row job-row--fade" style={{ animationDelay: `${index * 22}ms` }}>
                <div className="console-row__main">
                  <strong>
                    <Sparkles size={13} />
                    {review.title}
                  </strong>
                  <p>
                    {replayTrackingScope === 'all' && review.strategy_id
                      ? `${strategyNameMap.get(review.strategy_id) ?? review.strategy_id} · ${review.summary}`
                      : review.summary}
                  </p>
                </div>
                <div className="job-meta">
                  <span className={reviewPeriodChipClass(review.period)}>{reviewPeriodLabel(review.period)}</span>
                  {review.source_job_id && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => onOpenAiSchedulerJob(review.source_job_id)}
                    >
                      打开任务
                    </button>
                  )}
                  {review.strategy_id && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => onOpenReviewInspector(review.id, review.strategy_id)}
                    >
                      查看结果
                    </button>
                  )}
                  {review.strategy_id && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => onOpenStrategyActivity(review.strategy_id)}
                    >
                      打开策略
                    </button>
                  )}
                  <small>{formatTime(review.created_at)}</small>
                </div>
              </div>
            ))}
            {!filteredReplayTrackingReviews.length && (
              <div className="empty-state empty-state--inline">当前还没有策略问题或变更跟踪记录</div>
            )}
          </div>
          <div className="panel-head panel-head--compact">
            <div>
              <span className="section-label">跟踪任务</span>
              <h3>最近排队或执行过的 AI 跟踪任务</h3>
            </div>
            <span className="chip chip--muted">{filteredReplayTrackingJobs.length} 条</span>
          </div>
          <div className="job-list">
            {filteredReplayTrackingJobs.slice(0, 6).map((job, index) => (
              <div key={job.id} className="job-row job-row--fade" style={{ animationDelay: `${index * 22}ms` }}>
                <div className="console-row__main">
                  <strong>
                    <Bot size={13} />
                    {strategyAgentJobSummary(job)}
                  </strong>
                  <p>
                    {(() => {
                      const strategyId = getAgentJobStrategyId(job)
                      const strategyPrefix =
                        replayTrackingScope === 'all' && strategyId ? `${strategyNameMap.get(strategyId) ?? strategyId} · ` : ''
                      return `${strategyPrefix}${job.result_summary || `${job.writeback_target} · ${jobStatusLabel(job.status)}`}`
                    })()}
                  </p>
                </div>
                <div className="job-meta">
                  <span className="console-tag">{jobStatusLabel(job.status)}</span>
                  {job.linked_review_period && (
                    <span className={reviewPeriodChipClass(job.linked_review_period)}>
                      {reviewPeriodLabel(job.linked_review_period)}
                    </span>
                  )}
                  {job.linked_review_id && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => onOpenReviewInspector(job.linked_review_id, getAgentJobStrategyId(job))}
                    >
                      查看结果
                    </button>
                  )}
                  {getAgentJobStrategyId(job) && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => onOpenStrategyActivity(getAgentJobStrategyId(job))}
                    >
                      打开策略
                    </button>
                  )}
                  {(job.status === 'failed' || job.status === 'cancelled') && (
                    <button
                      type="button"
                      className="micro-action"
                      disabled={!serviceAvailable || retryAgentJobMutationPending}
                      onClick={() => onRetryAgentJob(job.id)}
                    >
                      重试
                    </button>
                  )}
                  <small>{formatTime(job.updated_at || job.created_at)}</small>
                </div>
              </div>
            ))}
            {!filteredReplayTrackingJobs.length && (
              <div className="empty-state empty-state--inline">当前还没有策略跟踪任务</div>
            )}
          </div>
        </div>
      </article>

      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">提案流</span>
            <h3>按时间查看待处理策略建议</h3>
          </div>
          <span className="chip chip--muted">{replayProposalFeed.length} 条</span>
        </div>
        <div className="job-list">
          {replayProposalFeed.map((item, index) => {
            const linkedBacktest = proposalBacktestMap.get(item.proposal.id) ?? null
            const linkedReview = proposalReviewMap.get(item.proposal.id) ?? null
            const linkedChangeRequest = proposalChangeRequestMap.get(item.proposal.id) ?? null
            const linkedJob = proposalAgentJobMap.get(item.proposal.id) ?? null
            const proposalStrategyId = getChangeRequestStrategyId(linkedChangeRequest, item.proposal.strategy_id)
            const manualFollowupMeta = proposalManualFollowupMeta(item.proposal, linkedChangeRequest)
            const outcomeDetails = proposalOutcomeDetails(
              item.proposal,
              linkedChangeRequest,
              linkedBacktest,
              linkedReview,
              linkedJob,
            )
            const focusLabels = proposalFocusLabels(
              item.proposal,
              linkedChangeRequest,
              linkedBacktest,
              linkedReview,
              linkedJob,
            )
            const blockedReason = proposalAcceptBlockedReason(item.proposal.proposal_type, schedulerState)
            return (
              <div
                key={item.proposal.id}
                className={`job-row job-row--fade ${focusLabels.length ? 'job-row--active' : ''}`}
                style={{ animationDelay: `${index * 26}ms` }}
              >
                <div className="console-row__main">
                  <strong>
                    <Sparkles size={13} />
                    {item.proposal.title}
                  </strong>
                  <p>
                    {item.reviewTitle} · {proposalTypeLabel(item.proposal.proposal_type)} · {item.proposal.expected_impact}
                  </p>
                  {outcomeDetails.map((detail, detailIndex) => (
                    <p key={`${item.proposal.id}-replay-outcome-${detailIndex}`}>{detail}</p>
                  ))}
                </div>
                <div className="job-meta">
                  <span className="console-tag">{proposalStatusLabel(item.proposal.status)}</span>
                  {manualFollowupMeta && (
                    <span className="console-tag console-tag--warn">{manualFollowupMeta.label}</span>
                  )}
                  {focusLabels.map((label) => (
                    <span key={`${item.proposal.id}-${label}`} className="console-tag console-tag--warn">
                      {label}
                    </span>
                  ))}
                  {linkedChangeRequest && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() =>
                        onOpenChangeRequest(
                          linkedChangeRequest.id,
                          getChangeRequestStrategyId(linkedChangeRequest, item.proposal.strategy_id),
                        )
                      }
                    >
                      生成变更
                    </button>
                  )}
                  {linkedBacktest && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => onOpenBacktestDetail(linkedBacktest.id, item.proposal.strategy_id)}
                    >
                      生成回测
                    </button>
                  )}
                  {linkedReview && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => onOpenReplayReview(linkedReview.id, item.proposal.strategy_id, 'selected')}
                    >
                      生成复盘
                    </button>
                  )}
                  {linkedChangeRequest?.follow_up_job_id && (
                    <button
                      type="button"
                      className="micro-action"
                      onClick={() => onOpenAiSchedulerJob(linkedChangeRequest.follow_up_job_id)}
                    >
                      打开任务
                    </button>
                  )}
                  {linkedChangeRequest?.linked_review_id &&
                    proposalStrategyId &&
                    (!linkedReview || linkedReview.id !== linkedChangeRequest.linked_review_id) && (
                      <button
                        type="button"
                        className="micro-action"
                        onClick={() => onOpenReviewInspector(linkedChangeRequest.linked_review_id, proposalStrategyId)}
                      >
                        查看结果
                      </button>
                    )}
                  {linkedChangeRequest?.follow_up_job_id &&
                    (linkedChangeRequest.follow_up_job_status === 'failed' ||
                      linkedChangeRequest.follow_up_job_status === 'cancelled') && (
                      <button
                        type="button"
                        className="micro-action"
                        disabled={!serviceAvailable || retryAgentJobMutationPending}
                        onClick={() => onRetryAgentJob(linkedChangeRequest.follow_up_job_id!, true)}
                      >
                        重试跟踪
                      </button>
                    )}
                  {linkedJob &&
                    (!linkedChangeRequest?.follow_up_job_id || linkedChangeRequest.follow_up_job_id !== linkedJob.id) && (
                      <button
                        type="button"
                        className="micro-action"
                        onClick={() => onOpenAiSchedulerJob(linkedJob.id)}
                      >
                        打开任务
                      </button>
                    )}
                  {linkedJob?.linked_review_id &&
                    proposalStrategyId &&
                    (!linkedReview || linkedReview.id !== linkedJob.linked_review_id) && (
                      <button
                        type="button"
                        className="micro-action"
                        onClick={() => onOpenReviewInspector(linkedJob.linked_review_id, proposalStrategyId)}
                      >
                        查看结果
                      </button>
                    )}
                  {linkedJob &&
                    (!linkedChangeRequest?.follow_up_job_id || linkedChangeRequest.follow_up_job_id !== linkedJob.id) &&
                    (linkedJob.status === 'failed' || linkedJob.status === 'cancelled') && (
                      <button
                        type="button"
                        className="micro-action"
                        disabled={!serviceAvailable || retryAgentJobMutationPending}
                        onClick={() => onRetryAgentJob(linkedJob.id, true)}
                      >
                        重试跟踪
                      </button>
                    )}
                  <small>{formatTime(item.proposal.created_at)}</small>
                  {(item.proposal.status === 'pending' || item.proposal.status === 'testing') && (
                    <div className="inline-actions">
                      <button
                        type="button"
                        className="ghost-button ghost-button--inline"
                        title={blockedReason ?? manualFollowupMeta?.detail ?? '接受当前提案'}
                        disabled={!serviceAvailable || proposalMutationPending || Boolean(blockedReason)}
                        onClick={() => onHandleProposalAction(item.proposal.id, 'accept')}
                      >
                        接受
                      </button>
                      <button
                        type="button"
                        className="ghost-button ghost-button--inline"
                        disabled={!serviceAvailable || proposalMutationPending}
                        onClick={() => onHandleProposalAction(item.proposal.id, 'reject')}
                      >
                        拒绝
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {!replayProposalFeed.length && <div className="empty-state empty-state--inline">当前没有可处理的提案</div>}
        </div>
      </article>
    </section>
  )
}

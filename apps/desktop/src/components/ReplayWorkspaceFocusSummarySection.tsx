import type { ReviewDocument } from '../types'
import { jobStatusLabel, reviewPeriodChipClass, reviewPeriodLabel } from '../utils/app-helpers'
import type { ReplayFocusReviewDecisionMeta, ReplayFocusReviewLineageMeta } from './replayWorkspaceFocusSectionTypes'

type ReplayWorkspaceFocusSummarySectionProps = {
  replayFocusReview: ReviewDocument
  replayFocusReviewDecisionMeta: ReplayFocusReviewDecisionMeta
  replayFocusReviewLineageMeta: ReplayFocusReviewLineageMeta
  serviceAvailable: boolean
  backtestMutationPending: boolean
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onOpenStrategyActivity: (strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onRerunBacktestFromReview: (review: ReviewDocument) => void
}

export default function ReplayWorkspaceFocusSummarySection({
  replayFocusReview,
  replayFocusReviewDecisionMeta,
  replayFocusReviewLineageMeta,
  serviceAvailable,
  backtestMutationPending,
  onOpenAiSchedulerJob,
  onOpenStrategyActivity,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onRerunBacktestFromReview,
}: ReplayWorkspaceFocusSummarySectionProps) {
  return (
    <div className="replay-focus__summary">
      <div className="chip-row">
        <span className={reviewPeriodChipClass(replayFocusReview.period)}>{reviewPeriodLabel(replayFocusReview.period)}</span>
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
      {replayFocusReviewLineageMeta && <p className="panel-note">来源链路: {replayFocusReviewLineageMeta.detail}</p>}
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
          <button type="button" className="micro-action" onClick={() => onOpenAiSchedulerJob(replayFocusReview.source_job_id)}>
            打开任务
          </button>
        )}
        {replayFocusReview.strategy_id && (
          <button type="button" className="micro-action" onClick={() => onOpenStrategyActivity(replayFocusReview.strategy_id)}>
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
  )
}

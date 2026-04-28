import { X } from 'lucide-react'

import type { ReviewDocument } from '../../types'
import { formatDateTime, jobStatusLabel, reviewPeriodLabel } from '../../utils/app-helpers'

type ReviewInspectorHeaderProps = {
  review: ReviewDocument | null
  strategyId: string | null
  strategyLabel: string | null
  onClose: () => void
  onOpenReplay: () => void
  onOpenStrategy: (strategyId: string) => void
  onOpenChangeRequest: (changeRequestId: string, strategyId: string) => void
  onOpenBacktest: (backtestId: string, strategyId: string) => void
  onOpenSourceReview: (reviewId: string, strategyId: string) => void
  onOpenProposal: (proposalId: string, strategyId: string) => void
  onOpenJob: (jobId: string) => void
}

export default function ReviewInspectorHeader({
  review,
  strategyId,
  strategyLabel,
  onClose,
  onOpenReplay,
  onOpenStrategy,
  onOpenChangeRequest,
  onOpenBacktest,
  onOpenSourceReview,
  onOpenProposal,
  onOpenJob,
}: ReviewInspectorHeaderProps) {
  return (
    <div className="floating-panel__head">
      <div>
        <span className="section-label">复盘结果</span>
        <h3>{review?.title ?? '结果暂不可用'}</h3>
        {review && (
          <p className="panel-note">
            {reviewPeriodLabel(review.period)}
            {strategyLabel ? ` · ${strategyLabel}` : ''}
            {review.source_job_type ? ` · 任务 ${review.source_job_type}` : ''}
            {review.source_job_status ? ` · ${jobStatusLabel(review.source_job_status)}` : ''}
            {` · ${formatDateTime(review.created_at)}`}
          </p>
        )}
      </div>
      <div className="inline-actions inline-actions--tight">
        {review && (
          <button type="button" className="micro-action" onClick={onOpenReplay}>
            打开复盘页
          </button>
        )}
        {strategyId && (
          <button type="button" className="micro-action" onClick={() => onOpenStrategy(strategyId)}>
            打开策略
          </button>
        )}
        {review?.source_change_request_id && strategyId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenChangeRequest(review.source_change_request_id!, strategyId)}
          >
            打开来源变更
          </button>
        )}
        {review?.source_backtest_id && strategyId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenBacktest(review.source_backtest_id!, strategyId)}
          >
            打开来源回测
          </button>
        )}
        {review?.source_review_id && strategyId && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenSourceReview(review.source_review_id!, strategyId)}
          >
            打开来源复盘
          </button>
        )}
        {review?.source_proposal_id && review?.strategy_id && (
          <button
            type="button"
            className="micro-action"
            onClick={() => onOpenProposal(review.source_proposal_id!, review.strategy_id!)}
          >
            打开来源提案
          </button>
        )}
        {review?.source_job_id && (
          <button type="button" className="micro-action" onClick={() => onOpenJob(review.source_job_id!)}>
            打开任务
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          title="关闭复盘结果详情窗口"
          aria-label="关闭复盘结果详情窗口"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

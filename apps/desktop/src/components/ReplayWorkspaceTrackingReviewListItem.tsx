import { Sparkles } from 'lucide-react'

import type { ReviewDocument } from '../types'
import { formatTime, reviewPeriodChipClass, reviewPeriodLabel } from '../utils/app-helpers'

type ReplayWorkspaceTrackingReviewListItemProps = {
  review: ReviewDocument
  index: number
  replayTrackingScope: 'all' | 'selected'
  strategyNameMap: Map<string, string>
  onOpenAiSchedulerJob: (jobId?: string | null) => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyActivity: (strategyId?: string | null) => void
}

export default function ReplayWorkspaceTrackingReviewListItem({
  review,
  index,
  replayTrackingScope,
  strategyNameMap,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onOpenStrategyActivity,
}: ReplayWorkspaceTrackingReviewListItemProps) {
  return (
    <div className="job-row job-row--fade" style={{ animationDelay: `${index * 22}ms` }}>
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
          <button type="button" className="micro-action" onClick={() => onOpenAiSchedulerJob(review.source_job_id)}>
            打开任务
          </button>
        )}
        {review.strategy_id && (
          <button type="button" className="micro-action" onClick={() => onOpenReviewInspector(review.id, review.strategy_id)}>
            查看结果
          </button>
        )}
        {review.strategy_id && (
          <button type="button" className="micro-action" onClick={() => onOpenStrategyActivity(review.strategy_id)}>
            打开策略
          </button>
        )}
        <small>{formatTime(review.created_at)}</small>
      </div>
    </div>
  )
}

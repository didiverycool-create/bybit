import { jobStatusToneClass } from '../../utils/app-helpers'
import type { LatestBacktestPanelProps } from './LatestBacktestPanel.types'

export default function LatestBacktestPanelReviewJobSection({
  latestStrategyBacktestReview,
  latestStrategyBacktestReviewJobMeta,
  latestStrategyBacktestReviewJob,
  serviceAvailable,
  backtestMutationPending,
  onOpenAiSchedulerJob,
  onRetryAgentJob,
}: Pick<
  LatestBacktestPanelProps,
  | 'latestStrategyBacktest'
  | 'latestStrategyBacktestReview'
  | 'latestStrategyBacktestReviewJobMeta'
  | 'latestStrategyBacktestReviewJob'
  | 'serviceAvailable'
  | 'backtestMutationPending'
  | 'onOpenAiSchedulerJob'
  | 'onRetryAgentJob'
>) {
  if (
    !latestStrategyBacktestReviewJobMeta ||
    !latestStrategyBacktestReviewJob ||
    (latestStrategyBacktestReviewJob.status === 'completed' && latestStrategyBacktestReview)
  ) {
    return null
  }

  return (
    <div className="stack-row">
      <strong>复盘任务</strong>
      <span>
        <span className={jobStatusToneClass(latestStrategyBacktestReviewJob.status)}>
          {latestStrategyBacktestReviewJobMeta.label}
        </span>
        {' · '}
        {latestStrategyBacktestReviewJobMeta.detail}{' '}
        <button
          type="button"
          className="ghost-button ghost-button--inline"
          onClick={() => onOpenAiSchedulerJob(latestStrategyBacktestReviewJob.id)}
        >
          打开任务
        </button>
        {latestStrategyBacktestReviewJobMeta.canRetry && (
          <button
            type="button"
            className="ghost-button ghost-button--inline"
            disabled={!serviceAvailable || backtestMutationPending}
            onClick={() => {
              void onRetryAgentJob(latestStrategyBacktestReviewJob.id)
            }}
          >
            重试
          </button>
        )}
      </span>
    </div>
  )
}

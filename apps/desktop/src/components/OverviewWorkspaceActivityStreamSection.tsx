import OverviewWorkspaceActivityStreamEventRow from './OverviewWorkspaceActivityStreamEventRow'
import OverviewWorkspaceActivityStreamQueuedRequestRow from './OverviewWorkspaceActivityStreamQueuedRequestRow'
import OverviewWorkspaceActivityStreamSchedulerJobRow from './OverviewWorkspaceActivityStreamSchedulerJobRow'
import type { OverviewWorkspaceActivityStreamSectionProps } from './OverviewWorkspaceActivityStreamSection.types'

export default function OverviewWorkspaceActivityStreamSection({
  schedulerJobs,
  overviewAiEvents,
  overviewQueuedRequests,
  onOpenReviewInspector,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenStrategyActivity,
  onOpenAiSchedulerJob,
}: OverviewWorkspaceActivityStreamSectionProps) {
  const totalCount = overviewAiEvents.length + overviewQueuedRequests.length + (schedulerJobs.length ? 1 : 0)

  return (
    <div className="terminal-dock">
      <div className="terminal-dock__panel">
        <div className="console-panel console-panel--stream">
          <div className="terminal-block__head terminal-block__head--compact">
            <div>
              <span className="section-label">AI 实时日志</span>
              <h3>当前动作流</h3>
            </div>
            <span className="chip chip--muted">{totalCount} 条</span>
          </div>
          <div className="console-list">
            {schedulerJobs.slice(0, 1).map((job) => (
              <OverviewWorkspaceActivityStreamSchedulerJobRow
                key={job.id}
                job={job}
                onOpenReviewInspector={onOpenReviewInspector}
                onOpenBacktestDetail={onOpenBacktestDetail}
                onOpenSourceReview={onOpenSourceReview}
                onOpenStrategyProposal={onOpenStrategyProposal}
                onOpenStrategyActivity={onOpenStrategyActivity}
              />
            ))}
            {overviewAiEvents.map((event, index) => (
              <OverviewWorkspaceActivityStreamEventRow
                key={event.id}
                event={event}
                index={index}
                onOpenReviewInspector={onOpenReviewInspector}
                onOpenBacktestDetail={onOpenBacktestDetail}
                onOpenSourceReview={onOpenSourceReview}
                onOpenStrategyProposal={onOpenStrategyProposal}
                onOpenStrategyActivity={onOpenStrategyActivity}
                onOpenAiSchedulerJob={onOpenAiSchedulerJob}
              />
            ))}
            {overviewQueuedRequests.map((item, index) => (
              <OverviewWorkspaceActivityStreamQueuedRequestRow key={item.id} item={item} index={overviewAiEvents.length + index} />
            ))}
            {!schedulerJobs.length && !overviewAiEvents.length && !overviewQueuedRequests.length && (
              <div className="empty-state empty-state--inline">当前没有 AI 调度或待落实动作。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

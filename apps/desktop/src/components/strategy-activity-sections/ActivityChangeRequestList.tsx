import type { ActivityChangeRequestListProps } from './ActivityChangeRequestList.types'
import ActivityChangeRequestListItem from './ActivityChangeRequestListItem'

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
  const activityLatestChangeRequestId = activityLatestChangeRequest?.id ?? null
  const activityLatestActionableChangeRequestId = activityLatestActionableChangeRequest?.id ?? null

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
        {strategyActivityChangeRequests.map((request) => (
          <ActivityChangeRequestListItem
            key={request.id}
            strategyId={strategyId}
            request={request}
            activityLatestChangeRequestId={activityLatestChangeRequestId}
            activityLatestActionableChangeRequestId={activityLatestActionableChangeRequestId}
            selectedChangeRequestId={selectedChangeRequestId}
            serviceAvailable={serviceAvailable}
            backtestMutationPending={backtestMutationPending}
            retryAgentJobMutationPending={retryAgentJobMutationPending}
            linkedState={getStrategyActivityChangeRequestLinkedState(request)}
            onOpenChangeRequest={onOpenChangeRequest}
            onOpenBacktestDetail={onOpenBacktestDetail}
            onOpenReviewInspector={onOpenReviewInspector}
            onOpenAiSchedulerJob={onOpenAiSchedulerJob}
            onOpenSourceReview={onOpenSourceReview}
            onOpenStrategyProposal={onOpenStrategyProposal}
            onRetryAgentJob={onRetryAgentJob}
            onRerunBacktestFromChangeRequest={onRerunBacktestFromChangeRequest}
          />
        ))}
        {!strategyActivityChangeRequests.length && (
          <div className="empty-state empty-state--inline">当前没有最近待落实的变更。</div>
        )}
      </div>
    </>
  )
}

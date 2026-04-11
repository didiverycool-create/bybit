import { X } from 'lucide-react'

import StrategyActivityDecisionSections, {
  type StrategyActivityDecisionSectionsProps,
} from './StrategyActivityDecisionSections'
import StrategyActivityOpsSection, {
  type StrategyActivityOpsSectionProps,
} from './StrategyActivityOpsSection'
import StrategyActivityReviewAndJobsSection, {
  type StrategyActivityReviewAndJobsSectionProps,
} from './StrategyActivityReviewAndJobsSection'
import StrategyActivityTopDecisionActionsSection, {
  type StrategyActivityTopDecisionActionsSectionProps,
} from './StrategyActivityTopDecisionActionsSection'
import StrategyActivityTopOpsSection, {
  type StrategyActivityTopOpsSectionProps,
} from './StrategyActivityTopOpsSection'

export type StrategyActivityFloatingPanelProps = {
  strategyName: string
  strategyHeadlineText: string
  queryEnabled: boolean
  queryStatus: string
  queryFetchStatus: string
  queryStrategyId: string | null
  queryErrorMessage: string
  queryLoading: boolean
  activityAvailable: boolean
  trackingDisabled: boolean
  onTrack: () => void
  onClose: () => void
  topOpsProps?: StrategyActivityTopOpsSectionProps
  topDecisionActionsProps?: StrategyActivityTopDecisionActionsSectionProps
  decisionSectionsProps?: StrategyActivityDecisionSectionsProps
  reviewAndJobsProps?: StrategyActivityReviewAndJobsSectionProps
  opsSectionProps?: StrategyActivityOpsSectionProps
}

export default function StrategyActivityFloatingPanel({
  strategyName,
  strategyHeadlineText,
  queryEnabled,
  queryStatus,
  queryFetchStatus,
  queryStrategyId,
  queryErrorMessage,
  queryLoading,
  activityAvailable,
  trackingDisabled,
  onTrack,
  onClose,
  topOpsProps,
  topDecisionActionsProps,
  decisionSectionsProps,
  reviewAndJobsProps,
  opsSectionProps,
}: StrategyActivityFloatingPanelProps) {
  return (
    <div className="floating-panel-backdrop" onClick={onClose}>
      <aside
        className="floating-panel floating-panel--wide"
        role="dialog"
        aria-modal="true"
        aria-label="策略最近活动窗口"
        data-strategy-activity-panel="1"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="floating-panel__head">
          <div>
            <span className="section-label">策略最近活动</span>
            <h3>{strategyName}</h3>
            <p className="panel-note" data-strategy-activity-note-key="strategy_headline">
              {strategyHeadlineText}
            </p>
          </div>
          <div className="inline-actions inline-actions--tight">
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-head-action="track"
              disabled={trackingDisabled}
              onClick={onTrack}
            >
              发起跟踪
            </button>
            <button
              type="button"
              className="icon-button"
              title="关闭策略最近活动窗口"
              aria-label="关闭策略最近活动窗口"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div
          className="floating-panel__body"
          data-strategy-activity-body="1"
          data-strategy-activity-query-enabled={queryEnabled ? '1' : '0'}
          data-strategy-activity-query-status={queryStatus}
          data-strategy-activity-fetch-status={queryFetchStatus}
          data-strategy-activity-strategy-id={queryStrategyId ?? ''}
          data-strategy-activity-strategy-name={strategyName}
          data-strategy-activity-query-error={queryErrorMessage}
        >
          {queryLoading && !activityAvailable && (
            <div className="empty-state empty-state--inline">正在拉取当前策略最近活动...</div>
          )}
          {!queryLoading && !activityAvailable && (
            <div className="empty-state empty-state--inline">当前策略最近活动暂不可用。</div>
          )}
          {activityAvailable &&
            topOpsProps &&
            topDecisionActionsProps &&
            decisionSectionsProps &&
            reviewAndJobsProps &&
            opsSectionProps && (
            <div className="floating-panel__grid" data-strategy-activity-content="1">
              <div>
                <StrategyActivityTopOpsSection {...topOpsProps} />
                <StrategyActivityTopDecisionActionsSection {...topDecisionActionsProps} />
                <StrategyActivityDecisionSections {...decisionSectionsProps} />
                <StrategyActivityReviewAndJobsSection {...reviewAndJobsProps} />
                <StrategyActivityOpsSection {...opsSectionProps} />
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

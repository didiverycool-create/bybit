import type {
  StrategyActivityTopOpsNoteItem,
  StrategyActivityTopOpsNotesProps,
} from './strategyActivityTopOpsTypes'

export default function StrategyActivityTopOpsNotes({
  latestActivitySummaryText,
  latestOpsSummaryText,
  latestActiveOrderHintText,
  pendingAlertHintText,
  actionableProposalHintText,
  actionableChangeRequestHintText,
  retryableTrackingJobHintText,
  latestHistoricalOrderHintText,
  actionableBacktestHintText,
  actionablePrimaryReviewHintText,
}: StrategyActivityTopOpsNotesProps) {
  const noteItems: StrategyActivityTopOpsNoteItem[] = [
    {
      key: 'latest_activity_summary',
      renderAs: 'div',
      text: latestActivitySummaryText,
    },
    { key: 'latest_ops_summary', renderAs: 'p', text: latestOpsSummaryText },
    {
      key: 'latest_active_order_hint',
      renderAs: 'p',
      text: latestActiveOrderHintText,
    },
    { key: 'pending_alert_hint', renderAs: 'p', text: pendingAlertHintText },
    {
      key: 'actionable_proposal_hint',
      renderAs: 'p',
      text: actionableProposalHintText,
    },
    {
      key: 'actionable_change_request_hint',
      renderAs: 'p',
      text: actionableChangeRequestHintText,
    },
    {
      key: 'retryable_tracking_job_hint',
      renderAs: 'p',
      text: retryableTrackingJobHintText,
    },
    {
      key: 'latest_historical_order_hint',
      renderAs: 'p',
      text: latestHistoricalOrderHintText,
    },
    {
      key: 'actionable_backtest_hint',
      renderAs: 'p',
      text: actionableBacktestHintText,
    },
    {
      key: 'actionable_primary_review_hint',
      renderAs: 'p',
      text: actionablePrimaryReviewHintText,
    },
  ]

  return (
    <>
      {noteItems.map((item) => {
        if (!item.text) {
          return null
        }
        if (item.renderAs === 'div') {
          return (
            <div key={item.key} className="panel-note" data-strategy-activity-note-key={item.key}>
              {item.text}
            </div>
          )
        }
        return (
          <p key={item.key} className="panel-note" data-strategy-activity-note-key={item.key}>
            {item.text}
          </p>
        )
      })}
    </>
  )
}

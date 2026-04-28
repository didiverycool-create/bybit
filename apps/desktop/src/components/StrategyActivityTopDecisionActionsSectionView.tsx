import {
  TopActionableDecisionActions,
  TopRecentFocusActions,
} from './strategy-activity-sections'
import type { StrategyActivityTopDecisionActionsSectionModel } from './buildStrategyActivityTopDecisionActionsSectionModel'

export default function StrategyActivityTopDecisionActionsSectionView({
  latestProposalChangeSummaryText,
  topRecentFocusActionsProps,
  topActionableDecisionActionsProps,
}: StrategyActivityTopDecisionActionsSectionModel) {
  return (
    <>
      {latestProposalChangeSummaryText && (
        <p className="panel-note" data-strategy-activity-note-key="latest_proposal_change_summary">
          {latestProposalChangeSummaryText}
        </p>
      )}

      <TopRecentFocusActions {...topRecentFocusActionsProps} />
      <TopActionableDecisionActions {...topActionableDecisionActionsProps} />
    </>
  )
}


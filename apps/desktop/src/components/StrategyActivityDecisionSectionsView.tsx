import ActivityBacktestList from './strategy-activity-sections/ActivityBacktestList'
import ActivityChangeRequestList from './strategy-activity-sections/ActivityChangeRequestList'
import ActivityProposalList from './strategy-activity-sections/ActivityProposalList'
import type { StrategyActivityDecisionSectionsViewProps } from './StrategyActivityDecisionSections.types'

export default function StrategyActivityDecisionSectionsView({
  proposalListProps,
  changeRequestListProps,
  backtestListProps,
}: StrategyActivityDecisionSectionsViewProps) {
  return (
    <>
      <ActivityProposalList {...proposalListProps} />
      <ActivityChangeRequestList {...changeRequestListProps} />
      <ActivityBacktestList {...backtestListProps} />
    </>
  )
}

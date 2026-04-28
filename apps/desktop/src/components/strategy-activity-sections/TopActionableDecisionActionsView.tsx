import TopActionableDecisionActionsActionableSection from './TopActionableDecisionActionsActionableSection'
import TopActionableDecisionActionsProposalChangeSection from './TopActionableDecisionActionsProposalChangeSection'
import type { TopActionableDecisionActionsProps } from './TopActionableDecisionActions.types'

export default function TopActionableDecisionActionsView(props: TopActionableDecisionActionsProps) {
  return (
    <>
      <TopActionableDecisionActionsProposalChangeSection {...props} />
      <TopActionableDecisionActionsActionableSection {...props} />
    </>
  )
}

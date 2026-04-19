import { Sparkles } from 'lucide-react'

import type { ReplayWorkspaceProposalFeedListItemProps } from './replayWorkspaceProposalFeedListItemTypes'
import {
  proposalOutcomeDetails,
  proposalTypeLabel,
} from '../utils/app-helpers'

type ReplayWorkspaceProposalFeedListItemBodySectionProps = Pick<
  ReplayWorkspaceProposalFeedListItemProps,
  'item' | 'linkedBacktest' | 'linkedReview' | 'linkedChangeRequest' | 'linkedJob'
>

export default function ReplayWorkspaceProposalFeedListItemBodySection({
  item,
  linkedBacktest,
  linkedReview,
  linkedChangeRequest,
  linkedJob,
}: ReplayWorkspaceProposalFeedListItemBodySectionProps) {
  const outcomeDetails = proposalOutcomeDetails(item.proposal, linkedChangeRequest, linkedBacktest, linkedReview, linkedJob)

  return (
    <div className="console-row__main">
      <strong>
        <Sparkles size={13} />
        {item.proposal.title}
      </strong>
      <p>
        {item.reviewTitle} · {proposalTypeLabel(item.proposal.proposal_type)} · {item.proposal.expected_impact}
      </p>
      {outcomeDetails.map((detail, detailIndex) => (
        <p key={`${item.proposal.id}-replay-outcome-${detailIndex}`}>{detail}</p>
      ))}
    </div>
  )
}


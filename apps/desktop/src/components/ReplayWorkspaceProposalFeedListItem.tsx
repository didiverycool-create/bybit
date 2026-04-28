import ReplayWorkspaceProposalFeedListItemBodySection from './ReplayWorkspaceProposalFeedListItemBodySection'
import ReplayWorkspaceProposalFeedListItemMetaSection from './ReplayWorkspaceProposalFeedListItemMetaSection'
import type { ReplayWorkspaceProposalFeedListItemProps } from './replayWorkspaceProposalFeedListItemTypes'

export default function ReplayWorkspaceProposalFeedListItem({ index, ...props }: ReplayWorkspaceProposalFeedListItemProps) {
  return (
    <div className={`job-row job-row--fade ${props.selectedProposalId === props.item.proposal.id ? 'job-row--active' : ''}`} style={{ animationDelay: `${index * 26}ms` }}>
      <ReplayWorkspaceProposalFeedListItemBodySection
        item={props.item}
        linkedBacktest={props.linkedBacktest}
        linkedReview={props.linkedReview}
        linkedChangeRequest={props.linkedChangeRequest}
        linkedJob={props.linkedJob}
      />
      <ReplayWorkspaceProposalFeedListItemMetaSection {...props} />
    </div>
  )
}

import type { ComponentProps } from 'react'

import ReplayWorkspaceSection from './ReplayWorkspaceSection'

type ReplayWorkspaceSectionProps = ComponentProps<typeof ReplayWorkspaceSection>

type ReplayWorkspaceContainerProps = {
  focusState: {
    selectedStrategy: ReplayWorkspaceSectionProps['selectedStrategy']
    replayFocusReview: ReplayWorkspaceSectionProps['replayFocusReview']
    replayFocusReviewDecisionMeta: ReplayWorkspaceSectionProps['replayFocusReviewDecisionMeta']
    replayFocusReviewLineageMeta: ReplayWorkspaceSectionProps['replayFocusReviewLineageMeta']
    hasLatestTrackingReview: ReplayWorkspaceSectionProps['hasLatestTrackingReview']
    replayTrackingScope: ReplayWorkspaceSectionProps['replayTrackingScope']
    selectedProposalId: ReplayWorkspaceSectionProps['selectedProposalId']
    selectedChangeRequestId: ReplayWorkspaceSectionProps['selectedChangeRequestId']
    selectedBacktestId: ReplayWorkspaceSectionProps['selectedBacktestId']
    focusedReviewId: ReplayWorkspaceSectionProps['focusedReviewId']
    aiSchedulerFocusedJobId: ReplayWorkspaceSectionProps['aiSchedulerFocusedJobId']
  }
  replayState: {
    filteredReplayTrackingReviews: ReplayWorkspaceSectionProps['filteredReplayTrackingReviews']
    filteredReplayTrackingJobs: ReplayWorkspaceSectionProps['filteredReplayTrackingJobs']
    strategyNameMap: ReplayWorkspaceSectionProps['strategyNameMap']
    replayProposalFeed: ReplayWorkspaceSectionProps['replayProposalFeed']
    proposalBacktestMap: ReplayWorkspaceSectionProps['proposalBacktestMap']
    proposalReviewMap: ReplayWorkspaceSectionProps['proposalReviewMap']
    proposalChangeRequestMap: ReplayWorkspaceSectionProps['proposalChangeRequestMap']
    proposalAgentJobMap: ReplayWorkspaceSectionProps['proposalAgentJobMap']
    schedulerState: ReplayWorkspaceSectionProps['schedulerState']
  }
  serviceState: {
    serviceAvailable: ReplayWorkspaceSectionProps['serviceAvailable']
    agentJobMutationPending: ReplayWorkspaceSectionProps['agentJobMutationPending']
    backtestMutationPending: ReplayWorkspaceSectionProps['backtestMutationPending']
    retryAgentJobMutationPending: ReplayWorkspaceSectionProps['retryAgentJobMutationPending']
    proposalMutationPending: ReplayWorkspaceSectionProps['proposalMutationPending']
  }
  actions: Pick<
    ReplayWorkspaceSectionProps,
    | 'onSetReplayTrackingScope'
    | 'onSubmitReviewJob'
    | 'onOpenChangeRequest'
    | 'onOpenBacktestDetail'
    | 'onOpenSourceReview'
    | 'onOpenStrategyProposal'
    | 'onOpenAiSchedulerJob'
    | 'onOpenStrategyActivity'
    | 'onRerunBacktestFromReview'
    | 'onOpenReviewInspector'
    | 'onOpenReplayReview'
    | 'onRetryAgentJob'
    | 'onHandleProposalAction'
  >
}

export default function ReplayWorkspaceContainer({
  focusState,
  replayState,
  serviceState,
  actions,
}: ReplayWorkspaceContainerProps) {
  return (
    <ReplayWorkspaceSection
      selectedStrategy={focusState.selectedStrategy}
      replayFocusReview={focusState.replayFocusReview}
      replayFocusReviewDecisionMeta={focusState.replayFocusReviewDecisionMeta}
      replayFocusReviewLineageMeta={focusState.replayFocusReviewLineageMeta}
      hasLatestTrackingReview={focusState.hasLatestTrackingReview}
      replayTrackingScope={focusState.replayTrackingScope}
      onSetReplayTrackingScope={actions.onSetReplayTrackingScope}
      serviceAvailable={serviceState.serviceAvailable}
      agentJobMutationPending={serviceState.agentJobMutationPending}
      backtestMutationPending={serviceState.backtestMutationPending}
      retryAgentJobMutationPending={serviceState.retryAgentJobMutationPending}
      proposalMutationPending={serviceState.proposalMutationPending}
      selectedProposalId={focusState.selectedProposalId}
      selectedChangeRequestId={focusState.selectedChangeRequestId}
      selectedBacktestId={focusState.selectedBacktestId}
      focusedReviewId={focusState.focusedReviewId}
      aiSchedulerFocusedJobId={focusState.aiSchedulerFocusedJobId}
      filteredReplayTrackingReviews={replayState.filteredReplayTrackingReviews}
      filteredReplayTrackingJobs={replayState.filteredReplayTrackingJobs}
      strategyNameMap={replayState.strategyNameMap}
      replayProposalFeed={replayState.replayProposalFeed}
      proposalBacktestMap={replayState.proposalBacktestMap}
      proposalReviewMap={replayState.proposalReviewMap}
      proposalChangeRequestMap={replayState.proposalChangeRequestMap}
      proposalAgentJobMap={replayState.proposalAgentJobMap}
      schedulerState={replayState.schedulerState}
      onSubmitReviewJob={actions.onSubmitReviewJob}
      onOpenChangeRequest={actions.onOpenChangeRequest}
      onOpenBacktestDetail={actions.onOpenBacktestDetail}
      onOpenSourceReview={actions.onOpenSourceReview}
      onOpenStrategyProposal={actions.onOpenStrategyProposal}
      onOpenAiSchedulerJob={actions.onOpenAiSchedulerJob}
      onOpenStrategyActivity={actions.onOpenStrategyActivity}
      onRerunBacktestFromReview={actions.onRerunBacktestFromReview}
      onOpenReviewInspector={actions.onOpenReviewInspector}
      onOpenReplayReview={actions.onOpenReplayReview}
      onRetryAgentJob={actions.onRetryAgentJob}
      onHandleProposalAction={actions.onHandleProposalAction}
    />
  )
}

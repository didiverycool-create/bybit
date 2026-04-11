import type { ComponentProps } from 'react'

import BacktestWorkspaceSection from './BacktestWorkspaceSection'

type BacktestWorkspaceSectionProps = ComponentProps<typeof BacktestWorkspaceSection>

type BacktestWorkspaceContainerProps = {
  selectionState: {
    selectedStrategy: BacktestWorkspaceSectionProps['selectedStrategy']
    strategies: BacktestWorkspaceSectionProps['strategies']
    backtestFilter: BacktestWorkspaceSectionProps['backtestFilter']
    selectedProposalId: BacktestWorkspaceSectionProps['selectedProposalId']
  }
  draftState: {
    backtestTimeframeDraft: BacktestWorkspaceSectionProps['backtestTimeframeDraft']
    backtestTimeframeOptions: BacktestWorkspaceSectionProps['backtestTimeframeOptions']
    backtestRangeDraft: BacktestWorkspaceSectionProps['backtestRangeDraft']
    backtestRangeOptions: BacktestWorkspaceSectionProps['backtestRangeOptions']
  }
  workspaceState: {
    backtestsForWorkspace: BacktestWorkspaceSectionProps['backtestsForWorkspace']
    latestWorkspaceBacktest: BacktestWorkspaceSectionProps['latestWorkspaceBacktest']
    latestWorkspaceBacktestDecisionMeta: BacktestWorkspaceSectionProps['latestWorkspaceBacktestDecisionMeta']
    latestWorkspaceBacktestWindowMeta: BacktestWorkspaceSectionProps['latestWorkspaceBacktestWindowMeta']
    latestWorkspaceBacktestSampleMeta: BacktestWorkspaceSectionProps['latestWorkspaceBacktestSampleMeta']
    openStrategyProposalsCount: BacktestWorkspaceSectionProps['openStrategyProposalsCount']
    selectedBacktest: BacktestWorkspaceSectionProps['selectedBacktest']
    selectedBacktestSampleMeta: BacktestWorkspaceSectionProps['selectedBacktestSampleMeta']
    selectedBacktestWindowMeta: BacktestWorkspaceSectionProps['selectedBacktestWindowMeta']
    selectedBacktestDecisionMeta: BacktestWorkspaceSectionProps['selectedBacktestDecisionMeta']
    selectedBacktestLineageMeta: BacktestWorkspaceSectionProps['selectedBacktestLineageMeta']
    selectedBacktestReview: BacktestWorkspaceSectionProps['selectedBacktestReview']
    selectedBacktestReviewJob: BacktestWorkspaceSectionProps['selectedBacktestReviewJob']
    selectedBacktestReviewJobMeta: BacktestWorkspaceSectionProps['selectedBacktestReviewJobMeta']
    selectedBacktestProposals: BacktestWorkspaceSectionProps['selectedBacktestProposals']
    proposalBacktestMap: BacktestWorkspaceSectionProps['proposalBacktestMap']
    proposalReviewMap: BacktestWorkspaceSectionProps['proposalReviewMap']
    proposalChangeRequestMap: BacktestWorkspaceSectionProps['proposalChangeRequestMap']
    proposalAgentJobMap: BacktestWorkspaceSectionProps['proposalAgentJobMap']
    schedulerState: BacktestWorkspaceSectionProps['schedulerState']
    backtestParameterComparison: BacktestWorkspaceSectionProps['backtestParameterComparison']
  }
  serviceState: {
    serviceAvailable: BacktestWorkspaceSectionProps['serviceAvailable']
    backtestMutationPending: BacktestWorkspaceSectionProps['backtestMutationPending']
    proposalMutationPending: BacktestWorkspaceSectionProps['proposalMutationPending']
    retryAgentJobMutationPending: BacktestWorkspaceSectionProps['retryAgentJobMutationPending']
  }
  actions: Pick<
    BacktestWorkspaceSectionProps,
    | 'onSelectBacktestFilter'
    | 'onSelectBacktestTimeframeDraft'
    | 'onSelectBacktestRangeDraft'
    | 'onSelectStrategyId'
    | 'onSubmitBacktest'
    | 'onOpenStrategySection'
    | 'onSelectBacktestId'
    | 'onOpenChangeRequest'
    | 'onOpenBacktestDetail'
    | 'onOpenSourceReview'
    | 'onOpenStrategyProposal'
    | 'onOpenAiSchedulerJob'
    | 'onOpenReplayReview'
    | 'onOpenReviewInspector'
    | 'onRetryAgentJob'
    | 'onHandleProposalAction'
    | 'onRerunBacktestFromRecommendation'
    | 'onRerunBacktestFromReview'
  >
}

export default function BacktestWorkspaceContainer({
  selectionState,
  draftState,
  workspaceState,
  serviceState,
  actions,
}: BacktestWorkspaceContainerProps) {
  return (
    <BacktestWorkspaceSection
      selectedStrategy={selectionState.selectedStrategy}
      strategies={selectionState.strategies}
      backtestFilter={selectionState.backtestFilter}
      onSelectBacktestFilter={actions.onSelectBacktestFilter}
      backtestsForWorkspace={workspaceState.backtestsForWorkspace}
      latestWorkspaceBacktest={workspaceState.latestWorkspaceBacktest}
      latestWorkspaceBacktestDecisionMeta={workspaceState.latestWorkspaceBacktestDecisionMeta}
      latestWorkspaceBacktestWindowMeta={workspaceState.latestWorkspaceBacktestWindowMeta}
      latestWorkspaceBacktestSampleMeta={workspaceState.latestWorkspaceBacktestSampleMeta}
      openStrategyProposalsCount={workspaceState.openStrategyProposalsCount}
      backtestTimeframeDraft={draftState.backtestTimeframeDraft}
      onSelectBacktestTimeframeDraft={actions.onSelectBacktestTimeframeDraft}
      backtestTimeframeOptions={draftState.backtestTimeframeOptions}
      backtestRangeDraft={draftState.backtestRangeDraft}
      onSelectBacktestRangeDraft={actions.onSelectBacktestRangeDraft}
      backtestRangeOptions={draftState.backtestRangeOptions}
      onSelectStrategyId={actions.onSelectStrategyId}
      serviceAvailable={serviceState.serviceAvailable}
      backtestMutationPending={serviceState.backtestMutationPending}
      onSubmitBacktest={actions.onSubmitBacktest}
      onOpenStrategySection={actions.onOpenStrategySection}
      selectedBacktest={workspaceState.selectedBacktest}
      onSelectBacktestId={actions.onSelectBacktestId}
      selectedBacktestSampleMeta={workspaceState.selectedBacktestSampleMeta}
      selectedBacktestWindowMeta={workspaceState.selectedBacktestWindowMeta}
      selectedBacktestDecisionMeta={workspaceState.selectedBacktestDecisionMeta}
      selectedBacktestLineageMeta={workspaceState.selectedBacktestLineageMeta}
      selectedBacktestReview={workspaceState.selectedBacktestReview}
      selectedBacktestReviewJob={workspaceState.selectedBacktestReviewJob}
      selectedBacktestReviewJobMeta={workspaceState.selectedBacktestReviewJobMeta}
      selectedBacktestProposals={workspaceState.selectedBacktestProposals}
      proposalBacktestMap={workspaceState.proposalBacktestMap}
      proposalReviewMap={workspaceState.proposalReviewMap}
      proposalChangeRequestMap={workspaceState.proposalChangeRequestMap}
      proposalAgentJobMap={workspaceState.proposalAgentJobMap}
      schedulerState={workspaceState.schedulerState}
      selectedProposalId={selectionState.selectedProposalId}
      proposalMutationPending={serviceState.proposalMutationPending}
      retryAgentJobMutationPending={serviceState.retryAgentJobMutationPending}
      backtestParameterComparison={workspaceState.backtestParameterComparison}
      onOpenChangeRequest={actions.onOpenChangeRequest}
      onOpenBacktestDetail={actions.onOpenBacktestDetail}
      onOpenSourceReview={actions.onOpenSourceReview}
      onOpenStrategyProposal={actions.onOpenStrategyProposal}
      onOpenAiSchedulerJob={actions.onOpenAiSchedulerJob}
      onOpenReplayReview={actions.onOpenReplayReview}
      onOpenReviewInspector={actions.onOpenReviewInspector}
      onRetryAgentJob={actions.onRetryAgentJob}
      onHandleProposalAction={actions.onHandleProposalAction}
      onRerunBacktestFromRecommendation={actions.onRerunBacktestFromRecommendation}
      onRerunBacktestFromReview={actions.onRerunBacktestFromReview}
    />
  )
}

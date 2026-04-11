import type { ComponentProps } from 'react'

import SchedulerWorkspaceSection from './SchedulerWorkspaceSection'

type SchedulerWorkspaceSectionProps = ComponentProps<typeof SchedulerWorkspaceSection>

type SchedulerWorkspaceContainerProps = {
  viewState: {
    activeSectionKey: SchedulerWorkspaceSectionProps['activeSectionKey']
    schedulerState: SchedulerWorkspaceSectionProps['schedulerState']
    schedulerJobs: SchedulerWorkspaceSectionProps['schedulerJobs']
    aiActivityFeed: SchedulerWorkspaceSectionProps['aiActivityFeed']
    aiSchedulerFocusedJobId: SchedulerWorkspaceSectionProps['aiSchedulerFocusedJobId']
    openClawStatus: SchedulerWorkspaceSectionProps['openClawStatus']
    latestSchedulerCommandBanner: SchedulerWorkspaceSectionProps['latestSchedulerCommandBanner']
  }
  serviceState: {
    serviceAvailable: SchedulerWorkspaceSectionProps['serviceAvailable']
    schedulerMutationPending: SchedulerWorkspaceSectionProps['schedulerMutationPending']
    agentJobMutationPending: SchedulerWorkspaceSectionProps['agentJobMutationPending']
    retryAgentJobPending: SchedulerWorkspaceSectionProps['retryAgentJobPending']
  }
  actions: Pick<
    SchedulerWorkspaceSectionProps,
    | 'onRunSchedulerCommand'
    | 'onOpenSchedulerControls'
    | 'onOpenGrafanaPreview'
    | 'onSubmitReviewJob'
    | 'onOpenReviewInspector'
    | 'onOpenChangeRequest'
    | 'onOpenBacktestDetail'
    | 'onOpenSourceReview'
    | 'onOpenStrategyProposal'
    | 'onOpenStrategyActivity'
    | 'onRetryAgentJob'
    | 'onOpenAiSchedulerJob'
  >
}

export default function SchedulerWorkspaceContainer({
  viewState,
  serviceState,
  actions,
}: SchedulerWorkspaceContainerProps) {
  return (
    <SchedulerWorkspaceSection
      activeSectionKey={viewState.activeSectionKey}
      schedulerState={viewState.schedulerState}
      serviceAvailable={serviceState.serviceAvailable}
      schedulerMutationPending={serviceState.schedulerMutationPending}
      agentJobMutationPending={serviceState.agentJobMutationPending}
      retryAgentJobPending={serviceState.retryAgentJobPending}
      schedulerJobs={viewState.schedulerJobs}
      aiActivityFeed={viewState.aiActivityFeed}
      aiSchedulerFocusedJobId={viewState.aiSchedulerFocusedJobId}
      openClawStatus={viewState.openClawStatus}
      latestSchedulerCommandBanner={viewState.latestSchedulerCommandBanner}
      onRunSchedulerCommand={actions.onRunSchedulerCommand}
      onOpenSchedulerControls={actions.onOpenSchedulerControls}
      onOpenGrafanaPreview={actions.onOpenGrafanaPreview}
      onSubmitReviewJob={actions.onSubmitReviewJob}
      onOpenReviewInspector={actions.onOpenReviewInspector}
      onOpenChangeRequest={actions.onOpenChangeRequest}
      onOpenBacktestDetail={actions.onOpenBacktestDetail}
      onOpenSourceReview={actions.onOpenSourceReview}
      onOpenStrategyProposal={actions.onOpenStrategyProposal}
      onOpenStrategyActivity={actions.onOpenStrategyActivity}
      onRetryAgentJob={actions.onRetryAgentJob}
      onOpenAiSchedulerJob={actions.onOpenAiSchedulerJob}
    />
  )
}

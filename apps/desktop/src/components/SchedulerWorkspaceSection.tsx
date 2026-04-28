import type { ReactNode } from 'react'

import type { AgentJob, ExecutionEvent, OpenClawStatus, SchedulerCommandType, SchedulerState } from '../types'
import {
  SchedulerWorkspaceActivityPanel,
  SchedulerWorkspaceOverviewPanel,
} from './scheduler-workspace'

type SchedulerCommandBanner = {
  tone: 'warning' | 'success'
  commandLabel: string
  summary: string
  impactDetail?: string | null
  occurredAt: string
  actions: ReactNode
} | null

type SchedulerWorkspaceSectionProps = {
  activeSectionKey: string
  schedulerState?: SchedulerState | null
  serviceAvailable: boolean
  schedulerMutationPending: boolean
  agentJobMutationPending: boolean
  retryAgentJobPending: boolean
  schedulerJobs: AgentJob[]
  aiActivityFeed: ExecutionEvent[]
  aiSchedulerFocusedJobId?: string | null
  openClawStatus?: OpenClawStatus | null
  latestSchedulerCommandBanner: SchedulerCommandBanner
  onRunSchedulerCommand: (command: SchedulerCommandType, reason: string, jobId?: string) => void
  onOpenSchedulerControls: () => void
  onOpenGrafanaPreview: () => void
  onSubmitReviewJob: () => void
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenStrategyActivity: (strategyId?: string | null) => void
  onRetryAgentJob: (jobId: string) => void
  onOpenAiSchedulerJob: (jobId: string) => void
}

export default function SchedulerWorkspaceSection({
  activeSectionKey,
  schedulerState,
  serviceAvailable,
  schedulerMutationPending,
  agentJobMutationPending,
  retryAgentJobPending,
  schedulerJobs,
  aiActivityFeed,
  aiSchedulerFocusedJobId,
  openClawStatus,
  latestSchedulerCommandBanner,
  onRunSchedulerCommand,
  onOpenSchedulerControls,
  onOpenGrafanaPreview,
  onSubmitReviewJob,
  onOpenReviewInspector,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenStrategyActivity,
  onRetryAgentJob,
  onOpenAiSchedulerJob,
}: SchedulerWorkspaceSectionProps) {
  return (
    <section key={activeSectionKey} className="section-grid section-entrance">
      <SchedulerWorkspaceOverviewPanel
        schedulerState={schedulerState}
        serviceAvailable={serviceAvailable}
        schedulerMutationPending={schedulerMutationPending}
        openClawStatus={openClawStatus}
        latestSchedulerCommandBanner={latestSchedulerCommandBanner}
        onRunSchedulerCommand={onRunSchedulerCommand}
        onOpenSchedulerControls={onOpenSchedulerControls}
        onOpenGrafanaPreview={onOpenGrafanaPreview}
      />
      <SchedulerWorkspaceActivityPanel
        schedulerJobs={schedulerJobs}
        aiActivityFeed={aiActivityFeed}
        aiSchedulerFocusedJobId={aiSchedulerFocusedJobId}
        serviceAvailable={serviceAvailable}
        retryAgentJobPending={retryAgentJobPending}
        agentJobMutationPending={agentJobMutationPending}
        onSubmitReviewJob={onSubmitReviewJob}
        onOpenReviewInspector={onOpenReviewInspector}
        onOpenChangeRequest={onOpenChangeRequest}
        onOpenBacktestDetail={onOpenBacktestDetail}
        onOpenSourceReview={onOpenSourceReview}
        onOpenStrategyProposal={onOpenStrategyProposal}
        onOpenStrategyActivity={onOpenStrategyActivity}
        onRetryAgentJob={onRetryAgentJob}
        onOpenAiSchedulerJob={onOpenAiSchedulerJob}
      />
    </section>
  )
}

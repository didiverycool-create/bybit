import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppWorkspaceModelsArgsInput } from './buildAppWorkspaceModelsArgs'

export type BuildSchedulerWorkspaceSurfaceArgsInput = {
  source: BuildAppPresentationModelsArgs
}

export function buildSchedulerWorkspaceSurfaceArgs({
  source,
}: BuildSchedulerWorkspaceSurfaceArgsInput): BuildAppWorkspaceModelsArgsInput['schedulerWorkspace'] {
  const {
    activeSection,
    scheduler,
    aiActivityFeed,
    aiSchedulerFocusedJobId,
    openClawStatus,
    latestSchedulerCommandBanner,
    serviceAvailable,
    workspaceControlActions,
    strategyWorkflowActions,
  } = source

  return {
    viewState: {
      activeSectionKey: activeSection,
      schedulerState: source.snapshot?.scheduler,
      schedulerJobs: scheduler?.jobs ?? [],
      aiActivityFeed,
      aiSchedulerFocusedJobId,
      openClawStatus,
      latestSchedulerCommandBanner,
    },
    serviceState: {
      serviceAvailable,
      schedulerMutationPending: workspaceControlActions.schedulerMutationPending,
      agentJobMutationPending: strategyWorkflowActions.agentJobMutationPending,
      retryAgentJobPending: strategyWorkflowActions.retryAgentJobMutationPending,
    },
  }
}

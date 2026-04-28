import { useCallback } from 'react'

import { createStrategyTrackingRequestKey } from './useAppWorkspaceBootstrapState'
import { useStrategyWorkflowActions } from './useStrategyWorkflowActions'
import { useWorkspaceControlActions } from './useWorkspaceControlActions'
import { useWorkspaceNavigation } from './useWorkspaceNavigation'

type UseWorkspaceNavigationArgs = Parameters<typeof useWorkspaceNavigation>[0]
type UseStrategyWorkflowActionsArgs = Parameters<typeof useStrategyWorkflowActions>[0]
type UseWorkspaceControlActionsArgs = Parameters<typeof useWorkspaceControlActions>[0]

type UseAppInteractionModelsArgs = {
  navigationArgs: UseWorkspaceNavigationArgs
  strategyWorkflowArgs: Omit<
    UseStrategyWorkflowActionsArgs,
    'resetStrategyTrackingDraft' | 'openAiSchedulerJob' | 'openBacktestDetail' | 'openChangeRequest'
  > & {
    setStrategyTrackingKind: (value: 'issue' | 'change') => void
      setStrategyTrackingSummary: (value: string) => void
      setStrategyTrackingDetail: (value: string) => void
      setStrategyTrackingRequestKey: (value: string) => void
  }
  workspaceControlArgs: Omit<UseWorkspaceControlActionsArgs, 'submitStrategyRequest'>
}

export function useAppInteractionModels({
  navigationArgs,
  strategyWorkflowArgs,
  workspaceControlArgs,
}: UseAppInteractionModelsArgs) {
  const workspaceNavigation = useWorkspaceNavigation(navigationArgs)
  const {
    setStrategyTrackingDetail,
    setStrategyTrackingKind,
    setStrategyTrackingRequestKey,
    setStrategyTrackingSummary,
  } = strategyWorkflowArgs

  const resetStrategyTrackingDraft = useCallback(
    (kind: 'issue' | 'change' = 'issue', nextSummary = '', nextDetail = '') => {
      setStrategyTrackingKind(kind)
      setStrategyTrackingSummary(nextSummary)
      setStrategyTrackingDetail(nextDetail)
      setStrategyTrackingRequestKey(createStrategyTrackingRequestKey())
    },
    [
      setStrategyTrackingDetail,
      setStrategyTrackingKind,
      setStrategyTrackingRequestKey,
      setStrategyTrackingSummary,
    ],
  )

  const strategyWorkflowActions = useStrategyWorkflowActions({
    ...strategyWorkflowArgs,
    resetStrategyTrackingDraft,
    openAiSchedulerJob: workspaceNavigation.openAiSchedulerJob,
    openBacktestDetail: workspaceNavigation.openBacktestDetail,
    openChangeRequest: workspaceNavigation.openChangeRequest,
  })

  const workspaceControlActions = useWorkspaceControlActions({
    ...workspaceControlArgs,
    submitStrategyRequest: strategyWorkflowActions.submitStrategyRequest,
  })

  return {
    workspaceNavigation,
    resetStrategyTrackingDraft,
    strategyWorkflowActions,
    workspaceControlActions,
  }
}

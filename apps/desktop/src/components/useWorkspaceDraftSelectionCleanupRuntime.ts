import { useEffect } from 'react'

import { shouldResetEditingOrderState } from './shouldResetEditingOrderState'
import type { UseWorkspaceDraftSelectionCleanupArgs } from './useWorkspaceDraftSelectionCleanup.types'

type UseWorkspaceDraftSelectionCleanupRuntimeArgs = Pick<
  UseWorkspaceDraftSelectionCleanupArgs,
  | 'aiSchedulerFocusedJobId'
  | 'schedulerLoaded'
  | 'schedulerJobs'
  | 'setAiSchedulerFocusedJobId'
  | 'selectedChangeRequestId'
  | 'changeRequestsLoaded'
  | 'changeRequests'
  | 'setSelectedChangeRequestId'
  | 'editingOrderId'
  | 'editingOrder'
  | 'setEditingOrderId'
  | 'setManualTradePanelOpen'
>

export function useWorkspaceDraftSelectionCleanupRuntime({
  aiSchedulerFocusedJobId,
  schedulerLoaded,
  schedulerJobs,
  setAiSchedulerFocusedJobId,
  selectedChangeRequestId,
  changeRequestsLoaded,
  changeRequests,
  setSelectedChangeRequestId,
  editingOrderId,
  editingOrder,
  setEditingOrderId,
  setManualTradePanelOpen,
}: UseWorkspaceDraftSelectionCleanupRuntimeArgs) {
  useEffect(() => {
    if (!aiSchedulerFocusedJobId || !schedulerLoaded) {
      return
    }
    if (schedulerJobs.some((job) => job.id === aiSchedulerFocusedJobId)) {
      return
    }
    setAiSchedulerFocusedJobId(null)
  }, [aiSchedulerFocusedJobId, schedulerJobs, schedulerLoaded, setAiSchedulerFocusedJobId])

  useEffect(() => {
    if (!selectedChangeRequestId || !changeRequestsLoaded) {
      return
    }
    if (changeRequests.some((request) => request.id === selectedChangeRequestId)) {
      return
    }
    setSelectedChangeRequestId(null)
  }, [changeRequests, changeRequestsLoaded, selectedChangeRequestId, setSelectedChangeRequestId])

  useEffect(() => {
    if (shouldResetEditingOrderState({ editingOrderId, editingOrder })) {
      setEditingOrderId(null)
      setManualTradePanelOpen(false)
    }
  }, [editingOrder, editingOrderId, setEditingOrderId, setManualTradePanelOpen])
}

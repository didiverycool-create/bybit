import { useMutation } from '@tanstack/react-query'

import { aiWorkflowApi } from '../apiAiWorkflow'
import { strategyApi } from '../apiStrategy'

import type { UseStrategyWorkflowExecutionActionsArgs } from './useStrategyWorkflowExecutionActions.types'

type UseStrategyWorkflowExecutionMutationsArgs = Pick<
  UseStrategyWorkflowExecutionActionsArgs,
  'refreshControlData'
>

export function useStrategyWorkflowExecutionMutations({
  refreshControlData,
}: UseStrategyWorkflowExecutionMutationsArgs) {
  const executeStrategySignalMutation = useMutation({
    mutationFn: ({ strategyId, note, mode }: { strategyId: string; note?: string; mode?: 'paper' | 'demo' | 'live' }) =>
      strategyApi.executeStrategySignal(strategyId, { requested_by: 'desktop_operator', note, mode }),
    onSuccess: refreshControlData,
  })

  const agentJobMutation = useMutation({
    mutationFn: aiWorkflowApi.createAgentJob,
    onSuccess: refreshControlData,
  })

  const retryAgentJobMutation = useMutation({
    mutationFn: (jobId: string) => aiWorkflowApi.retryAgentJob(jobId, 'desktop_operator'),
    onSuccess: refreshControlData,
  })

  const proposalMutation = useMutation({
    mutationFn: ({ proposalId, action }: { proposalId: string; action: 'accept' | 'reject' }) =>
      aiWorkflowApi.applyStrategyProposalAction(proposalId, action),
    onSuccess: refreshControlData,
  })

  return {
    executeStrategySignalMutation,
    agentJobMutation,
    retryAgentJobMutation,
    proposalMutation,
  }
}

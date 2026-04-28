import type {
  AgentJob,
  StrategyExecutionResult,
  StrategyProposalActionResult,
} from '../types'

import type { UseStrategyWorkflowActionsArgs } from './strategyWorkflowActionShared'

export type UseStrategyWorkflowExecutionActionsArgs = Pick<
  UseStrategyWorkflowActionsArgs,
  | 'refreshControlData'
  | 'selectedMode'
  | 'selectedStrategy'
  | 'selectedStrategyRuntimePreview'
  | 'selectedStrategyRuntime'
  | 'watchlist'
  | 'schedulerState'
  | 'findProposalById'
  | 'setSelectedProposalId'
  | 'showFeedback'
  | 'openAiSchedulerJob'
  | 'openBacktestDetail'
  | 'openChangeRequest'
>

export type StrategyWorkflowExecuteSignalMutationLike = {
  isPending: boolean
  mutateAsync: (input: {
    strategyId: string
    note?: string
    mode?: 'paper' | 'demo' | 'live'
  }) => Promise<StrategyExecutionResult>
}

export type StrategyWorkflowAgentJobMutationLike = {
  isPending: boolean
  mutateAsync: (input: {
    job_type: string
    context: Record<string, unknown>
    allowed_actions?: string[]
    timeout?: number
    idempotency_key: string
    writeback_target?: string
  }) => Promise<AgentJob>
}

export type StrategyWorkflowRetryAgentJobMutationLike = {
  isPending: boolean
  mutateAsync: (jobId: string) => Promise<AgentJob>
}

export type StrategyWorkflowProposalMutationLike = {
  isPending: boolean
  mutateAsync: (input: {
    proposalId: string
    action: 'accept' | 'reject'
  }) => Promise<StrategyProposalActionResult>
}

export type StrategyWorkflowExecutionActionContext = {
  selectedMode: UseStrategyWorkflowExecutionActionsArgs['selectedMode']
  selectedStrategy: UseStrategyWorkflowExecutionActionsArgs['selectedStrategy']
  selectedStrategyRuntimePreview: UseStrategyWorkflowExecutionActionsArgs['selectedStrategyRuntimePreview']
  selectedStrategyRuntime: UseStrategyWorkflowExecutionActionsArgs['selectedStrategyRuntime']
  watchlist: UseStrategyWorkflowExecutionActionsArgs['watchlist']
  schedulerState: UseStrategyWorkflowExecutionActionsArgs['schedulerState']
  findProposalById: UseStrategyWorkflowExecutionActionsArgs['findProposalById']
  setSelectedProposalId: UseStrategyWorkflowExecutionActionsArgs['setSelectedProposalId']
  showFeedback: UseStrategyWorkflowExecutionActionsArgs['showFeedback']
  openAiSchedulerJob: UseStrategyWorkflowExecutionActionsArgs['openAiSchedulerJob']
  openBacktestDetail: UseStrategyWorkflowExecutionActionsArgs['openBacktestDetail']
  openChangeRequest: UseStrategyWorkflowExecutionActionsArgs['openChangeRequest']
  executeStrategySignalMutation: StrategyWorkflowExecuteSignalMutationLike
  agentJobMutation: StrategyWorkflowAgentJobMutationLike
  retryAgentJobMutation: StrategyWorkflowRetryAgentJobMutationLike
  proposalMutation: StrategyWorkflowProposalMutationLike
}

export type StrategyWorkflowExecuteSignalActionContext = Pick<
  StrategyWorkflowExecutionActionContext,
  | 'selectedMode'
  | 'selectedStrategy'
  | 'selectedStrategyRuntimePreview'
  | 'selectedStrategyRuntime'
  | 'showFeedback'
  | 'executeStrategySignalMutation'
>

export type StrategyWorkflowSubmitReviewJobActionContext = Pick<
  StrategyWorkflowExecutionActionContext,
  | 'selectedMode'
  | 'watchlist'
  | 'showFeedback'
  | 'agentJobMutation'
>

export type StrategyWorkflowRetryAgentJobActionContext = Pick<
  StrategyWorkflowExecutionActionContext,
  | 'showFeedback'
  | 'openAiSchedulerJob'
  | 'retryAgentJobMutation'
>

export type StrategyWorkflowRetryAgentJobOptions = {
  focusJob?: boolean
}

export type StrategyWorkflowProposalActionContext = Pick<
  StrategyWorkflowExecutionActionContext,
  | 'schedulerState'
  | 'findProposalById'
  | 'setSelectedProposalId'
  | 'showFeedback'
  | 'openBacktestDetail'
  | 'openChangeRequest'
  | 'proposalMutation'
>

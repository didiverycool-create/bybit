import type { BacktestRun, ReviewDocument, StrategySummary } from '../types'

import type { UseStrategyWorkflowActionsArgs } from './strategyWorkflowActionShared'

export type UseStrategyWorkflowBacktestActionsArgs = Pick<
  UseStrategyWorkflowActionsArgs,
  | 'refreshControlData'
  | 'selectedStrategy'
  | 'strategies'
  | 'backtests'
  | 'reviewCatalog'
  | 'backtestRangeDraft'
  | 'backtestTimeframeDraft'
  | 'setSelectedStrategyId'
  | 'setBacktestRangeDraft'
  | 'setBacktestTimeframeDraft'
  | 'setSelectedBacktestId'
  | 'showFeedback'
>

export type StrategyWorkflowBacktestMutationLike = {
  isPending: boolean
  mutateAsync: (input: {
    strategy_id: string
    data_range: string
    timeframe: string
    source_change_request_id?: string | null
    source_backtest_id?: string | null
    source_review_id?: string | null
    source_proposal_id?: string | null
    trigger_reason?: 'decision_rerun' | 'review_decision_rerun'
  }) => Promise<BacktestRun>
}

export type StrategyWorkflowBacktestActionTone = 'success' | 'warning' | 'error'

export type StrategyWorkflowBacktestActionContext = {
  backtestMutation: StrategyWorkflowBacktestMutationLike
  selectedStrategy: UseStrategyWorkflowBacktestActionsArgs['selectedStrategy']
  strategies: StrategySummary[]
  backtests: UseStrategyWorkflowBacktestActionsArgs['backtests']
  reviewCatalog: ReviewDocument[]
  backtestRangeDraft: string
  backtestTimeframeDraft: string
  setSelectedStrategyId: UseStrategyWorkflowBacktestActionsArgs['setSelectedStrategyId']
  setBacktestRangeDraft: UseStrategyWorkflowBacktestActionsArgs['setBacktestRangeDraft']
  setBacktestTimeframeDraft: UseStrategyWorkflowBacktestActionsArgs['setBacktestTimeframeDraft']
  setSelectedBacktestId: UseStrategyWorkflowBacktestActionsArgs['setSelectedBacktestId']
  showFeedback: UseStrategyWorkflowBacktestActionsArgs['showFeedback']
}

export type StrategyWorkflowBacktestSubmitActionContext = Pick<
  StrategyWorkflowBacktestActionContext,
  | 'backtestMutation'
  | 'selectedStrategy'
  | 'backtestRangeDraft'
  | 'backtestTimeframeDraft'
  | 'showFeedback'
>

export type StrategyWorkflowBacktestRecommendationActionContext = Pick<
  StrategyWorkflowBacktestActionContext,
  | 'backtestMutation'
  | 'selectedStrategy'
  | 'strategies'
  | 'backtests'
  | 'reviewCatalog'
  | 'setSelectedStrategyId'
  | 'setBacktestRangeDraft'
  | 'setBacktestTimeframeDraft'
  | 'setSelectedBacktestId'
  | 'showFeedback'
>

export type StrategyWorkflowBacktestReviewActionContext = Pick<
  StrategyWorkflowBacktestActionContext,
  | 'backtestMutation'
  | 'strategies'
  | 'setSelectedStrategyId'
  | 'setBacktestRangeDraft'
  | 'setBacktestTimeframeDraft'
  | 'setSelectedBacktestId'
  | 'showFeedback'
>

export type StrategyWorkflowBacktestChangeRequestActionContext = Pick<
  StrategyWorkflowBacktestActionContext,
  | 'backtestMutation'
  | 'selectedStrategy'
  | 'strategies'
  | 'backtests'
  | 'setSelectedStrategyId'
  | 'setBacktestRangeDraft'
  | 'setBacktestTimeframeDraft'
  | 'setSelectedBacktestId'
  | 'showFeedback'
>

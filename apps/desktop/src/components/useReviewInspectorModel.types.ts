import type { ComponentProps } from 'react'

import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  SchedulerState,
  StrategyProposal,
} from '../types'
import type ReviewInspectorPanel from './ReviewInspectorPanel'

export type ReviewInspectorState = Pick<
  ComponentProps<typeof ReviewInspectorPanel>,
  | 'review'
  | 'strategyId'
  | 'strategyLabel'
  | 'lineageMeta'
  | 'decisionMeta'
  | 'proposalItems'
>

export type ProposalFocusLabels = (
  proposal: StrategyProposal,
  linkedChangeRequest?: ChangeRequest | null,
  linkedBacktest?: BacktestRun | null,
  linkedReview?: ReviewDocument | null,
  linkedJob?: AgentJob | null,
) => string[]

export type UseReviewInspectorModelArgs = {
  reviewCatalog: ReviewDocument[]
  strategyActivityReviewRecords: ReviewDocument[]
  reviewInspectorReviewId: string | null
  reviewInspectorStrategyId: string | null
  strategyNameMap: Map<string, string>
  proposalBacktestMap: Map<string, BacktestRun>
  proposalReviewMap: Map<string, ReviewDocument>
  proposalChangeRequestMap: Map<string, ChangeRequest>
  proposalAgentJobMap: Map<string, AgentJob>
  proposalFocusLabels: ProposalFocusLabels
  latestActionableProposalId: string | null
  schedulerState?: SchedulerState | null
}

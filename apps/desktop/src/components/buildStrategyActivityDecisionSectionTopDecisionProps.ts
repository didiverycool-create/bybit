import type { StrategyActivityTopDecisionActionsSectionProps } from './StrategyActivityTopDecisionActionsSection'
import { buildStrategyActivityTopDecisionActionsProps } from './buildStrategyActivityTopDecisionActionsProps'
import type {
  StrategyActivityDecisionActions,
  StrategyActivityDecisionServiceState,
  StrategyActivityDecisionSummaryState,
  StrategyActivityDecisionTopState,
} from './buildStrategyActivityDecisionSectionTypes'

type BuildStrategyActivityDecisionSectionTopDecisionPropsArgs = {
  strategyId: string
  summaryState: StrategyActivityDecisionSummaryState
  topDecisionState: StrategyActivityDecisionTopState
  serviceState: StrategyActivityDecisionServiceState
  actions: StrategyActivityDecisionActions
}

export function buildStrategyActivityDecisionSectionTopDecisionProps({
  strategyId,
  summaryState,
  topDecisionState,
  serviceState,
  actions,
}: BuildStrategyActivityDecisionSectionTopDecisionPropsArgs): StrategyActivityTopDecisionActionsSectionProps {
  return buildStrategyActivityTopDecisionActionsProps({
    strategyId,
    summaryState,
    topDecisionState,
    serviceState,
    actions,
  })
}

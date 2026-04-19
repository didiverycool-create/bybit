import type { StrategyActivityTopDecisionActionsSectionProps } from './StrategyActivityTopDecisionActionsSection.types'
import { buildStrategyActivityTopDecisionActionsSectionAssembler } from './buildStrategyActivityTopDecisionActionsSectionAssembler'
import { buildStrategyActivityTopDecisionActionsSectionState } from './buildStrategyActivityTopDecisionActionsSectionState'
import type { StrategyActivityTopRecentFocusActionsProps } from './strategy-activity-sections/strategyActivityTopRecentFocusActionsTypes'
import type { TopActionableDecisionActionsProps } from './strategy-activity-sections/TopActionableDecisionActions'

export type StrategyActivityTopDecisionActionsSectionModel = {
  latestProposalChangeSummaryText: string | null
  topRecentFocusActionsProps: StrategyActivityTopRecentFocusActionsProps
  topActionableDecisionActionsProps: TopActionableDecisionActionsProps
}

export function buildStrategyActivityTopDecisionActionsSectionModel(
  props: StrategyActivityTopDecisionActionsSectionProps,
): StrategyActivityTopDecisionActionsSectionModel {
  const state = buildStrategyActivityTopDecisionActionsSectionState(props)
  return buildStrategyActivityTopDecisionActionsSectionAssembler(props, state)
}

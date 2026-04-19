import type { StrategyActivityTopDecisionActionsSectionProps } from './StrategyActivityTopDecisionActionsSection.types'
import {
  buildStrategyActivityTopDecisionActionsSectionLinkState,
  type StrategyActivityTopDecisionActionsSectionLinkState,
} from './buildStrategyActivityTopDecisionActionsSectionLinks'
import {
  buildStrategyActivityTopDecisionActionsSectionVisibilityState,
  type StrategyActivityTopDecisionActionsSectionVisibilityState,
} from './buildStrategyActivityTopDecisionActionsSectionVisibility'

export type StrategyActivityTopDecisionActionsSectionState =
  StrategyActivityTopDecisionActionsSectionLinkState &
  StrategyActivityTopDecisionActionsSectionVisibilityState

export function buildStrategyActivityTopDecisionActionsSectionState({
  ...props
}: StrategyActivityTopDecisionActionsSectionProps): StrategyActivityTopDecisionActionsSectionState {
  const linkState = buildStrategyActivityTopDecisionActionsSectionLinkState(props)
  return {
    ...linkState,
    ...buildStrategyActivityTopDecisionActionsSectionVisibilityState(props, linkState),
  }
}

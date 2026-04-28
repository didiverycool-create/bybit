import type { StrategyActivityFloatingPanelProps as StrategyActivityFloatingPanelComponentProps } from './StrategyActivityFloatingPanel'
import type { StrategyActivitySnapshotViewModel } from './strategyActivitySelectors'
import type {
  StrategyActivityDecisionActions,
  StrategyActivityDecisionSelectors,
  StrategyActivityDecisionServiceState,
  StrategyActivityDecisionState,
  StrategyActivityDecisionSummaryState,
  StrategyActivityDecisionTopState,
  StrategyActivityReviewAndJobsState,
} from './buildStrategyActivityDecisionSectionProps'
import type {
  StrategyActivityOpsActions,
  StrategyActivityOpsServiceState,
  StrategyActivityOpsState,
  StrategyActivityOpsSummaryState,
  StrategyActivityTopOpsState,
} from './buildStrategyActivityOpsSectionProps'
import {
  buildStrategyActivityFloatingPanelDecisionSectionProps,
} from './buildStrategyActivityFloatingPanelDecisionSectionProps'
import {
  buildStrategyActivityFloatingPanelOpsSectionProps,
} from './buildStrategyActivityFloatingPanelOpsSectionProps'

export type StrategyActivityFloatingPanelSectionProps = {
  topOpsProps?: StrategyActivityFloatingPanelComponentProps['topOpsProps']
  topDecisionActionsProps?: StrategyActivityFloatingPanelComponentProps['topDecisionActionsProps']
  decisionSectionsProps?: StrategyActivityFloatingPanelComponentProps['decisionSectionsProps']
  reviewAndJobsProps?: StrategyActivityFloatingPanelComponentProps['reviewAndJobsProps']
  opsSectionProps?: StrategyActivityFloatingPanelComponentProps['opsSectionProps']
}

export type StrategyActivityFloatingPanelDerivedState = StrategyActivityOpsSummaryState &
  StrategyActivityTopOpsState &
  StrategyActivityDecisionSummaryState &
  StrategyActivityDecisionTopState

export type StrategyActivityFloatingPanelCollectionState = StrategyActivityOpsState &
  StrategyActivityDecisionState &
  StrategyActivityReviewAndJobsState

export type StrategyActivityFloatingPanelServiceState = StrategyActivityOpsServiceState &
  StrategyActivityDecisionServiceState

export type StrategyActivityFloatingPanelActions = StrategyActivityOpsActions &
  StrategyActivityDecisionActions

export type BuildStrategyActivityFloatingPanelSectionPropsArgs = {
  strategyActivitySnapshotModel: StrategyActivitySnapshotViewModel
  derivedState: StrategyActivityFloatingPanelDerivedState
  collectionState: StrategyActivityFloatingPanelCollectionState
  serviceState: StrategyActivityFloatingPanelServiceState
  actions: StrategyActivityFloatingPanelActions
  selectors: StrategyActivityDecisionSelectors
}

export function buildStrategyActivityFloatingPanelSectionProps(
  args: BuildStrategyActivityFloatingPanelSectionPropsArgs,
): StrategyActivityFloatingPanelSectionProps {
  const opsSectionProps = buildStrategyActivityFloatingPanelOpsSectionProps(args)
  const decisionSectionProps = buildStrategyActivityFloatingPanelDecisionSectionProps(args)

  return {
    ...opsSectionProps,
    ...decisionSectionProps,
  }
}

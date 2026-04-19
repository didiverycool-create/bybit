import type { ComponentProps } from 'react'

import { withDraftPresetOption } from '../utils/app-helpers'
import type BacktestWorkspaceContainer from './BacktestWorkspaceContainer'

type BacktestWorkspaceContainerProps = ComponentProps<typeof BacktestWorkspaceContainer>
type BacktestWorkspaceDraftState = BacktestWorkspaceContainerProps['draftState']
type BacktestWorkspaceState = BacktestWorkspaceContainerProps['workspaceState']

type BacktestPresetOption = {
  value: string
  label: string
}

export type BuildBacktestWorkspaceDerivedStateArgs = {
  selectedStrategy: BacktestWorkspaceContainerProps['selectionState']['selectedStrategy']
  selectedBacktest: BacktestWorkspaceState['selectedBacktest']
  backtestsForWorkspace: BacktestWorkspaceState['backtestsForWorkspace']
  backtestRangeDraft: BacktestWorkspaceDraftState['backtestRangeDraft']
  backtestTimeframeDraft: BacktestWorkspaceDraftState['backtestTimeframeDraft']
  backtestRangePresets: readonly BacktestPresetOption[]
  backtestTimeframePresets: readonly BacktestPresetOption[]
  latestWorkspaceBacktest: BacktestWorkspaceState['latestWorkspaceBacktest']
  latestWorkspaceBacktestDecisionMeta: BacktestWorkspaceState['latestWorkspaceBacktestDecisionMeta']
  latestWorkspaceBacktestWindowMeta: BacktestWorkspaceState['latestWorkspaceBacktestWindowMeta']
  latestWorkspaceBacktestSampleMeta: BacktestWorkspaceState['latestWorkspaceBacktestSampleMeta']
  openStrategyProposalsCount: BacktestWorkspaceState['openStrategyProposalsCount']
  selectedBacktestSampleMeta: BacktestWorkspaceState['selectedBacktestSampleMeta']
  selectedBacktestWindowMeta: BacktestWorkspaceState['selectedBacktestWindowMeta']
  selectedBacktestDecisionMeta: BacktestWorkspaceState['selectedBacktestDecisionMeta']
  selectedBacktestLineageMeta: BacktestWorkspaceState['selectedBacktestLineageMeta']
  selectedBacktestReview: BacktestWorkspaceState['selectedBacktestReview']
  selectedBacktestReviewJob: BacktestWorkspaceState['selectedBacktestReviewJob']
  selectedBacktestReviewJobMeta: BacktestWorkspaceState['selectedBacktestReviewJobMeta']
  selectedBacktestProposals: BacktestWorkspaceState['selectedBacktestProposals']
  proposalBacktestMap: BacktestWorkspaceState['proposalBacktestMap']
  proposalReviewMap: BacktestWorkspaceState['proposalReviewMap']
  proposalChangeRequestMap: BacktestWorkspaceState['proposalChangeRequestMap']
  proposalAgentJobMap: BacktestWorkspaceState['proposalAgentJobMap']
  schedulerState: BacktestWorkspaceState['schedulerState']
}

export type BuildBacktestWorkspaceDerivedStateResult = {
  draftState: BacktestWorkspaceDraftState
  workspaceState: BacktestWorkspaceState
}

export function buildBacktestWorkspaceDerivedState({
  selectedStrategy,
  selectedBacktest,
  backtestsForWorkspace,
  backtestRangeDraft,
  backtestTimeframeDraft,
  backtestRangePresets,
  backtestTimeframePresets,
  latestWorkspaceBacktest,
  latestWorkspaceBacktestDecisionMeta,
  latestWorkspaceBacktestWindowMeta,
  latestWorkspaceBacktestSampleMeta,
  openStrategyProposalsCount,
  selectedBacktestSampleMeta,
  selectedBacktestWindowMeta,
  selectedBacktestDecisionMeta,
  selectedBacktestLineageMeta,
  selectedBacktestReview,
  selectedBacktestReviewJob,
  selectedBacktestReviewJobMeta,
  selectedBacktestProposals,
  proposalBacktestMap,
  proposalReviewMap,
  proposalChangeRequestMap,
  proposalAgentJobMap,
  schedulerState,
}: BuildBacktestWorkspaceDerivedStateArgs): BuildBacktestWorkspaceDerivedStateResult {
  const draftState: BacktestWorkspaceDraftState = {
    backtestTimeframeDraft,
    backtestTimeframeOptions: withDraftPresetOption(
      backtestTimeframePresets,
      backtestTimeframeDraft,
      '当前周期',
    ),
    backtestRangeDraft,
    backtestRangeOptions: withDraftPresetOption(
      backtestRangePresets,
      backtestRangeDraft,
      '当前区间',
    ),
  }

  const backtestParameterComparison = selectedBacktest
    ? Array.from(
        new Set([
          ...Object.keys(selectedBacktest.parameter_snapshot),
          ...(selectedStrategy?.parameters ?? []).map((parameter) => parameter.key),
        ]),
      ).map((key) => {
        const strategyParameter = selectedStrategy?.parameters.find((parameter) => parameter.key === key)
        const backtestValue = selectedBacktest.parameter_snapshot[key]
        const currentValue = strategyParameter?.value
        return {
          key,
          label: strategyParameter?.label ?? key,
          backtestValue: backtestValue == null ? '--' : String(backtestValue),
          currentValue: currentValue == null ? '--' : String(currentValue),
          changed:
            backtestValue != null &&
            currentValue != null &&
            String(backtestValue) !== String(currentValue),
        }
      })
    : []

  const workspaceState: BacktestWorkspaceState = {
    backtestsForWorkspace,
    latestWorkspaceBacktest,
    latestWorkspaceBacktestDecisionMeta,
    latestWorkspaceBacktestWindowMeta,
    latestWorkspaceBacktestSampleMeta,
    openStrategyProposalsCount,
    selectedBacktest,
    selectedBacktestSampleMeta,
    selectedBacktestWindowMeta,
    selectedBacktestDecisionMeta,
    selectedBacktestLineageMeta,
    selectedBacktestReview,
    selectedBacktestReviewJob,
    selectedBacktestReviewJobMeta,
    selectedBacktestProposals,
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
    schedulerState,
    backtestParameterComparison,
  }

  return {
    draftState,
    workspaceState,
  }
}

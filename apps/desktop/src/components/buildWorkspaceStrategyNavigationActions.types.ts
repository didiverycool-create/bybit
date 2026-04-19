import type { UseWorkspaceNavigationArgs } from './workspaceNavigationShared'

export type BuildWorkspaceStrategyNavigationActionsArgs = Pick<
  UseWorkspaceNavigationArgs,
  | 'strategies'
  | 'selectedStrategy'
  | 'selectedStrategyId'
  | 'strategyEditorDraftStrategyId'
  | 'parameterDrafts'
  | 'reviewCatalog'
  | 'strategyActivityReviewRecords'
  | 'setParameterDrafts'
  | 'setRiskBudgetDraft'
  | 'setStrategyEditorDraftStrategyId'
  | 'setActiveSection'
  | 'setSelectedStrategyId'
  | 'setSelectedSymbol'
  | 'setStrategyActivityPanelOpen'
  | 'setStrategyTrackingPanelOpen'
  | 'setStrategyEditorOpen'
  | 'setReplayTrackingScope'
  | 'setReplayFocusedReviewId'
>

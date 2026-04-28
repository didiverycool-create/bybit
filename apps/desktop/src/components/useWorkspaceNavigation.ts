import type { SectionKey } from '../types'

import { buildWorkspaceDetailNavigationActions } from './buildWorkspaceDetailNavigationActions'
import { buildWorkspaceSectionNavigationActions } from './buildWorkspaceSectionNavigationActions'
import { buildWorkspaceStrategyNavigationActions } from './buildWorkspaceStrategyNavigationActions'
import type { UseWorkspaceNavigationArgs } from './workspaceNavigationShared'

export type { ScopeFilter, UseWorkspaceNavigationArgs } from './workspaceNavigationShared'

export function useWorkspaceNavigation({
  setActiveSection,
  setReviewInspectorOpen,
  setReviewInspectorReviewId,
  setReviewInspectorStrategyId,
  ...args
}: UseWorkspaceNavigationArgs) {
  const closeReviewInspector = () => {
    setReviewInspectorOpen(false)
    setReviewInspectorReviewId(null)
    setReviewInspectorStrategyId(null)
  }

  const openSection = (section: SectionKey) => {
    setActiveSection(section)
  }

  const strategyNavigationActions = buildWorkspaceStrategyNavigationActions({
    ...args,
    setActiveSection,
  })
  const detailNavigationActions = buildWorkspaceDetailNavigationActions({
    ...args,
    setActiveSection,
    closeReviewInspector,
    openReplayReview: strategyNavigationActions.openReplayReview,
  })
  const sectionNavigationActions = buildWorkspaceSectionNavigationActions({
    ...args,
    openSection,
  })

  return {
    closeReviewInspector,
    openSection,
    ...strategyNavigationActions,
    ...detailNavigationActions,
    ...sectionNavigationActions,
  }
}

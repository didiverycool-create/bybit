import { startTransition } from 'react'

import { getReviewFocusStrategyId } from '../utils/app-helpers'

import {
  findWorkspaceReviewRecord,
  getStrategyPrimarySymbol,
  type ScopeFilter,
} from './workspaceNavigationShared'
import type { BuildWorkspaceStrategyNavigationActionsArgs } from './buildWorkspaceStrategyNavigationActions.types'

export function buildWorkspaceStrategyReplayNavigationActions({
  strategies,
  selectedStrategy,
  selectedStrategyId,
  reviewCatalog,
  strategyActivityReviewRecords,
  setActiveSection,
  setSelectedStrategyId,
  setSelectedSymbol,
  setStrategyActivityPanelOpen,
  setStrategyTrackingPanelOpen,
  setStrategyEditorOpen,
  setReplayTrackingScope,
  setReplayFocusedReviewId,
}: BuildWorkspaceStrategyNavigationActionsArgs) {
  const openStrategyActivity = (strategyId?: string | null) => {
    if (!strategyId) {
      return
    }
    const nextSymbol = getStrategyPrimarySymbol(strategies, strategyId)
    startTransition(() => {
      setActiveSection('strategy')
      setSelectedStrategyId(strategyId)
      if (nextSymbol) {
        setSelectedSymbol(nextSymbol)
      }
      setStrategyEditorOpen(false)
      setStrategyTrackingPanelOpen(false)
      setStrategyActivityPanelOpen(true)
    })
  }

  const openStrategyReplay = (strategyId?: string | null) => {
    if (!strategyId) {
      return
    }
    startTransition(() => {
      setActiveSection('replay')
      setSelectedStrategyId(strategyId)
      setReplayTrackingScope('selected')
      setReplayFocusedReviewId(null)
    })
  }

  const openReplayReview = (
    reviewId?: string | null,
    strategyId?: string | null,
    scope: ScopeFilter = 'all',
  ) => {
    if (!reviewId && !strategyId) {
      return
    }
    const linkedReview = findWorkspaceReviewRecord(reviewCatalog, strategyActivityReviewRecords, reviewId)
    const nextStrategyId =
      strategyId ?? getReviewFocusStrategyId(linkedReview, selectedStrategy?.id ?? selectedStrategyId)
    const nextSymbol = getStrategyPrimarySymbol(strategies, nextStrategyId)
    startTransition(() => {
      setActiveSection('replay')
      if (nextStrategyId) {
        setSelectedStrategyId(nextStrategyId)
      }
      if (nextSymbol) {
        setSelectedSymbol(nextSymbol)
      }
      setReplayTrackingScope(scope)
      setReplayFocusedReviewId(reviewId ?? null)
    })
  }

  return {
    openStrategyActivity,
    openStrategyReplay,
    openReplayReview,
  }
}

import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { ReviewDocument, StrategySummary } from '../types'
import { useWorkspaceFocusSyncEffect } from './useWorkspaceFocusSyncEffect'
import { syncWorkspaceFocusFromReview } from './workspaceFocusSyncHelpers'

type WorkspaceFocusSelectionArgs = {
  strategies: StrategySummary[]
  selectedStrategyCurrentId: string | null
  selectedStrategyId: string | null
  selectedSymbol: string
  setSelectedStrategyId: Dispatch<SetStateAction<string | null>>
  setSelectedSymbol: Dispatch<SetStateAction<string>>
}

export type WorkspaceFocusReviewSyncArgs = WorkspaceFocusSelectionArgs & {
  activeSection: string
  replayFocusedReviewId: string | null
  reviewCatalog: ReviewDocument[]
}

export function useWorkspaceReviewFocusSync({
  activeSection,
  replayFocusedReviewId,
  reviewCatalog,
  strategies,
  selectedStrategyCurrentId,
  selectedStrategyId,
  selectedSymbol,
  setSelectedStrategyId,
  setSelectedSymbol,
}: WorkspaceFocusReviewSyncArgs) {
  const dependencies = useMemo(
    () => [
      replayFocusedReviewId,
      reviewCatalog,
      selectedStrategyCurrentId,
      selectedStrategyId,
      selectedSymbol,
      setSelectedStrategyId,
      setSelectedSymbol,
      strategies,
    ],
    [
      replayFocusedReviewId,
      reviewCatalog,
      selectedStrategyCurrentId,
      selectedStrategyId,
      selectedSymbol,
      setSelectedStrategyId,
      setSelectedSymbol,
      strategies,
    ],
  )

  useWorkspaceFocusSyncEffect({
    enabled: activeSection === 'replay' && Boolean(replayFocusedReviewId),
    dependencies,
    sync: () => {
      if (!replayFocusedReviewId) {
        return
      }
      syncWorkspaceFocusFromReview({
        reviewCatalog,
        replayFocusedReviewId,
        strategies,
        selectedStrategyCurrentId,
        selectedStrategyId,
        selectedSymbol,
        setSelectedStrategyId,
        setSelectedSymbol,
      })
    },
  })
}

import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { ReviewDocument, StrategySummary } from '../types'
import { useWorkspaceFocusSyncEffect } from './useWorkspaceFocusSyncEffect'
import { syncWorkspaceInspectorFocus } from './workspaceFocusSyncHelpers'

type WorkspaceFocusSelectionArgs = {
  strategies: StrategySummary[]
  selectedStrategyCurrentId: string | null
  selectedStrategyId: string | null
  selectedSymbol: string
  setSelectedStrategyId: Dispatch<SetStateAction<string | null>>
  setSelectedSymbol: Dispatch<SetStateAction<string>>
}

type WorkspaceFocusInspectorSelectionArgs = WorkspaceFocusSelectionArgs & {
  setReviewInspectorStrategyId: Dispatch<SetStateAction<string | null>>
}

export type WorkspaceFocusInspectorSyncArgs = WorkspaceFocusInspectorSelectionArgs & {
  reviewCatalog: ReviewDocument[]
  reviewInspectorOpen: boolean
  reviewInspectorReviewId: string | null
  reviewInspectorStrategyId: string | null
}

export function useWorkspaceInspectorFocusSync({
  reviewCatalog,
  reviewInspectorOpen,
  reviewInspectorReviewId,
  reviewInspectorStrategyId,
  strategies,
  selectedStrategyCurrentId,
  selectedStrategyId,
  selectedSymbol,
  setReviewInspectorStrategyId,
  setSelectedStrategyId,
  setSelectedSymbol,
}: WorkspaceFocusInspectorSyncArgs) {
  const dependencies = useMemo(
    () => [
      reviewCatalog,
      reviewInspectorOpen,
      reviewInspectorReviewId,
      reviewInspectorStrategyId,
      selectedStrategyCurrentId,
      selectedStrategyId,
      selectedSymbol,
      setReviewInspectorStrategyId,
      setSelectedStrategyId,
      setSelectedSymbol,
      strategies,
    ],
    [
      reviewCatalog,
      reviewInspectorOpen,
      reviewInspectorReviewId,
      reviewInspectorStrategyId,
      selectedStrategyCurrentId,
      selectedStrategyId,
      selectedSymbol,
      setReviewInspectorStrategyId,
      setSelectedStrategyId,
      setSelectedSymbol,
      strategies,
    ],
  )

  useWorkspaceFocusSyncEffect({
    enabled: reviewInspectorOpen && Boolean(reviewInspectorReviewId),
    dependencies,
    sync: () => {
      if (!reviewInspectorReviewId) {
        return
      }
      syncWorkspaceInspectorFocus({
        reviewCatalog,
        reviewInspectorOpen,
        reviewInspectorReviewId,
        reviewInspectorStrategyId,
        strategies,
        selectedStrategyCurrentId,
        selectedStrategyId,
        selectedSymbol,
        setReviewInspectorStrategyId,
        setSelectedStrategyId,
        setSelectedSymbol,
      })
    },
  })
}

import { buildReviewInspectorState } from './buildReviewInspectorState'
import type { ReviewInspectorState, UseReviewInspectorModelArgs } from './useReviewInspectorModel.types'

export type {
  ProposalFocusLabels,
  ReviewInspectorState,
  UseReviewInspectorModelArgs,
} from './useReviewInspectorModel.types'

export function useReviewInspectorModel({
  ...args
}: UseReviewInspectorModelArgs): ReviewInspectorState {
  return buildReviewInspectorState(args)
}

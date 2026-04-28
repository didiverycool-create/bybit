import type { ReviewDocument, StrategyActivitySnapshot } from './types'

export function normalizeReviewDocument(review?: ReviewDocument | null): ReviewDocument | null {
  if (!review) return null
  return {
    ...review,
    highlights: Array.isArray(review.highlights)
      ? review.highlights.filter((item): item is string => typeof item === 'string')
      : [],
    risks: Array.isArray(review.risks)
      ? review.risks.filter((item): item is string => typeof item === 'string')
      : [],
    proposals: Array.isArray(review.proposals) ? review.proposals : [],
  }
}

type StrategyActivityDecisionRecordSection = NonNullable<
  StrategyActivitySnapshot['decision_context']
>[keyof NonNullable<StrategyActivitySnapshot['decision_context']>]
type StrategyActivitySectionRecordSection = NonNullable<
  StrategyActivitySnapshot['activity_sections']
>[keyof NonNullable<StrategyActivitySnapshot['activity_sections']>]

type StrategyActivityReviewRecordSource =
  | StrategyActivityDecisionRecordSection
  | StrategyActivitySectionRecordSection

export function normalizeStrategyActivityReviewRecordFields<
  T extends Record<string, unknown>,
  K extends keyof T,
>(value: T | null | undefined, fields: readonly K[]): T | null {
  if (!value) return null

  const next = { ...value } as T
  for (const field of fields) {
    next[field] = normalizeReviewDocument(
      value[field] as StrategyActivityReviewRecordSource,
    ) as T[K]
  }
  return next
}

export function normalizeStrategyActivityDecisionContext(
  decisionContext?: StrategyActivitySnapshot['decision_context'],
): StrategyActivitySnapshot['decision_context'] {
  if (!decisionContext) return null
  return {
    ...decisionContext,
    proposal: normalizeStrategyActivityReviewRecordFields(decisionContext.proposal, [
      'latest_review_record',
      'actionable_review_record',
    ]),
    change_request: normalizeStrategyActivityReviewRecordFields(decisionContext.change_request, [
      'latest_review_record',
      'latest_source_review_record',
      'actionable_review_record',
      'actionable_source_review_record',
    ]),
    backtest: normalizeStrategyActivityReviewRecordFields(decisionContext.backtest, [
      'latest_review_record',
      'actionable_review_record',
    ]),
    review: normalizeStrategyActivityReviewRecordFields(decisionContext.review, [
      'latest_primary_record',
      'latest_actionable_primary_record',
    ]),
    tracking: normalizeStrategyActivityReviewRecordFields(decisionContext.tracking, [
      'latest_review_record',
    ]),
  }
}

export function normalizeStrategyActivitySections(
  activitySections?: StrategyActivitySnapshot['activity_sections'],
): StrategyActivitySnapshot['activity_sections'] {
  if (!activitySections) return null
  return {
    ...activitySections,
    proposal: normalizeStrategyActivityReviewRecordFields(activitySections.proposal, [
      'latest_review_record',
      'latest_actionable_review_record',
    ]),
    change_request: normalizeStrategyActivityReviewRecordFields(activitySections.change_request, [
      'latest_review_record',
      'latest_source_review_record',
      'latest_actionable_review_record',
      'latest_actionable_source_review_record',
    ]),
    backtest: normalizeStrategyActivityReviewRecordFields(activitySections.backtest, [
      'latest_review_record',
      'latest_actionable_review_record',
    ]),
    review: normalizeStrategyActivityReviewRecordFields(activitySections.review, [
      'latest_primary_record',
      'latest_actionable_primary_record',
      'latest_tracking_record',
    ]),
    tracking: normalizeStrategyActivityReviewRecordFields(activitySections.tracking, [
      'latest_review_record',
    ]),
  }
}

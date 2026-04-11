import type { ReviewDocument } from '../../types'
import type { ReviewInspectorDecisionMeta, ReviewInspectorLineageMeta } from './types'

type ReviewInspectorSummarySectionProps = {
  review: ReviewDocument
  lineageMeta: ReviewInspectorLineageMeta
  decisionMeta: ReviewInspectorDecisionMeta
  serviceAvailable: boolean
  backtestPending: boolean
  onRerunBacktest: (review: ReviewDocument) => void
}

export default function ReviewInspectorSummarySection({
  review,
  lineageMeta,
  decisionMeta,
  serviceAvailable,
  backtestPending,
  onRerunBacktest,
}: ReviewInspectorSummarySectionProps) {
  return (
    <div className="review-inspector">
      <div className="review-inspector__summary">
        <p>{review.summary}</p>
        {decisionMeta && (
          <p className="panel-note">
            结论门禁: {decisionMeta.description}
            {decisionMeta.nextAction ? ` · 建议 ${decisionMeta.nextAction}` : ''}
          </p>
        )}
        {lineageMeta && <p className="panel-note">来源链路: {lineageMeta.detail}</p>}
        {review.strategy_id && decisionMeta?.recommendedRange && decisionMeta?.recommendedTimeframe && (
          <div className="inline-actions inline-actions--tight">
            <button
              type="button"
              className="micro-action"
              data-strategy-activity-top-action-key="latest_audit_job"
              disabled={!serviceAvailable || backtestPending}
              onClick={() => onRerunBacktest(review)}
            >
              按建议重跑
            </button>
          </div>
        )}
      </div>
      <div className="review-inspector__grid">
        <div className="review-inspector__section">
          <span className="section-label">亮点</span>
          <ul className="replay-bullet-list">
            {review.highlights.length ? (
              review.highlights.slice(0, 6).map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>当前没有额外亮点摘要。</li>
            )}
          </ul>
        </div>
        <div className="review-inspector__section">
          <span className="section-label">风险</span>
          <ul className="replay-bullet-list replay-bullet-list--warn">
            {review.risks.length ? (
              review.risks.slice(0, 6).map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>当前没有额外风险摘要。</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

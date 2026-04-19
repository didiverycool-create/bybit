import type { ReviewDocument, StrategyRuntimeSnapshot } from '../types'
import {
  strategyCurrentPositionLabel,
  strategyPositionAlignmentLabel,
  strategyRuntimeGuardLabel,
} from '../utils/app-helpers'
import type { BacktestDecisionMeta, ReviewLineageMeta } from './strategyCurrentPanelTypes'

export type StrategyCurrentPanelNotesSectionProps = {
  selectedStrategyId: string
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null
  selectedStrategyReview: ReviewDocument | null
  selectedStrategyReviewDecisionMeta: BacktestDecisionMeta
  selectedStrategyReviewLineageMeta: ReviewLineageMeta
  hasParameterDraftChanges: boolean
  parameterDraftChangeCount: number
  riskBudgetChanged: boolean
  serviceAvailable: boolean
  backtestMutationPending: boolean
  onOpenReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: 'all' | 'selected') => void
  onOpenChangeRequest: (changeRequestId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onRerunBacktestFromReview: (review: ReviewDocument) => void | Promise<void>
}

export default function StrategyCurrentPanelNotesSection({
  selectedStrategyId,
  selectedStrategyRuntime,
  selectedStrategyReview,
  selectedStrategyReviewDecisionMeta,
  selectedStrategyReviewLineageMeta,
  hasParameterDraftChanges,
  parameterDraftChangeCount,
  riskBudgetChanged,
  serviceAvailable,
  backtestMutationPending,
  onOpenReplayReview,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onRerunBacktestFromReview,
}: StrategyCurrentPanelNotesSectionProps) {
  return (
    <>
      {(hasParameterDraftChanges || riskBudgetChanged) && (
        <p className="panel-note">
          当前有未提交修改: 参数 {parameterDraftChangeCount} 项，风险预算 {riskBudgetChanged ? '已修改' : '未修改'}。
        </p>
      )}

      {selectedStrategyRuntime && (
        <p className="panel-note">
          运行态:{' '}
          {strategyRuntimeGuardLabel(selectedStrategyRuntime)
            ? `${strategyRuntimeGuardLabel(selectedStrategyRuntime)} · ${selectedStrategyRuntime.note}`
            : selectedStrategyRuntime.note}{' '}
          · 仓位 {strategyPositionAlignmentLabel(selectedStrategyRuntime)}
          {selectedStrategyRuntime.position_alignment_detail
            ? ` (${selectedStrategyRuntime.position_alignment_detail})`
            : ''}
          {strategyCurrentPositionLabel(selectedStrategyRuntime)
            ? ` · ${strategyCurrentPositionLabel(selectedStrategyRuntime)}`
            : ''}
          {' '}
          下一步 {selectedStrategyRuntime.next_action}
          {selectedStrategyRuntime.active_order
            ? ` · 关联委托 ${selectedStrategyRuntime.active_order.side === 'buy' ? '买入' : '卖出'} ${selectedStrategyRuntime.active_order.qty}@${selectedStrategyRuntime.active_order.price} (${selectedStrategyRuntime.active_order.status})`
            : selectedStrategyRuntime.active_order_count > 0
              ? ` · 当前关联委托 ${selectedStrategyRuntime.active_order_count} 笔`
              : ''}
        </p>
      )}

      {selectedStrategyReview && (
        <>
          <p className="panel-note">
            最近 AI 复盘: {selectedStrategyReview.summary}
            {selectedStrategyReviewDecisionMeta ? ` · 结论门禁 ${selectedStrategyReviewDecisionMeta.description}` : ''}
            {selectedStrategyReviewLineageMeta ? ` · ${selectedStrategyReviewLineageMeta.detail}` : ''}
          </p>
          <div className="inline-actions inline-actions--tight">
            <button
              type="button"
              className="micro-action"
              onClick={() => onOpenReplayReview(selectedStrategyReview.id, selectedStrategyId, 'selected')}
            >
              打开复盘
            </button>
            {selectedStrategyReview.source_change_request_id && (
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenChangeRequest(selectedStrategyReview.source_change_request_id, selectedStrategyId)}
              >
                来源变更
              </button>
            )}
            {selectedStrategyReview.source_backtest_id && (
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenBacktestDetail(selectedStrategyReview.source_backtest_id, selectedStrategyId)}
              >
                来源回测
              </button>
            )}
            {selectedStrategyReview.source_review_id && (
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenSourceReview(selectedStrategyReview.source_review_id, selectedStrategyId)}
              >
                来源复盘
              </button>
            )}
            {selectedStrategyReview.source_proposal_id && (
              <button
                type="button"
                className="micro-action"
                onClick={() => onOpenStrategyProposal(selectedStrategyReview.source_proposal_id, selectedStrategyId)}
              >
                来源提案
              </button>
            )}
            {selectedStrategyReviewDecisionMeta?.recommendedRange &&
              selectedStrategyReviewDecisionMeta?.recommendedTimeframe && (
                <button
                  type="button"
                  className="micro-action"
                  disabled={!serviceAvailable || backtestMutationPending}
                  onClick={() => {
                    void onRerunBacktestFromReview(selectedStrategyReview)
                  }}
                >
                  按建议重跑
                </button>
              )}
          </div>
        </>
      )}
    </>
  )
}

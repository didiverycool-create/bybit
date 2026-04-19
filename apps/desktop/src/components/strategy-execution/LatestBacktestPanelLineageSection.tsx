import type { LatestBacktestPanelProps } from './LatestBacktestPanel.types'

export default function LatestBacktestPanelLineageSection({
  latestStrategyBacktest,
  latestStrategyBacktestLineageMeta,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
}: Pick<
  LatestBacktestPanelProps,
  | 'latestStrategyBacktest'
  | 'latestStrategyBacktestLineageMeta'
  | 'onOpenChangeRequest'
  | 'onOpenBacktestDetail'
  | 'onOpenSourceReview'
  | 'onOpenStrategyProposal'
>) {
  if (!latestStrategyBacktestLineageMeta || !latestStrategyBacktest) {
    return null
  }

  return (
    <div className="stack-row">
      <strong>来源链路</strong>
      <span>
        {latestStrategyBacktestLineageMeta.detail}
        {latestStrategyBacktest.source_change_request_id && (
          <>
            {' '}
            <button
              type="button"
              className="ghost-button ghost-button--inline"
              onClick={() =>
                onOpenChangeRequest(
                  latestStrategyBacktest.source_change_request_id,
                  latestStrategyBacktest.strategy_id,
                )
              }
            >
              来源变更
            </button>
          </>
        )}
        {latestStrategyBacktest.source_backtest_id && (
          <>
            {' '}
            <button
              type="button"
              className="ghost-button ghost-button--inline"
              onClick={() =>
                onOpenBacktestDetail(latestStrategyBacktest.source_backtest_id, latestStrategyBacktest.strategy_id)
              }
            >
              来源回测
            </button>
          </>
        )}
        {latestStrategyBacktest.source_review_id && (
          <>
            {' '}
            <button
              type="button"
              className="ghost-button ghost-button--inline"
              onClick={() =>
                onOpenSourceReview(latestStrategyBacktest.source_review_id, latestStrategyBacktest.strategy_id)
              }
            >
              来源复盘
            </button>
          </>
        )}
        {latestStrategyBacktest.source_proposal_id && (
          <>
            {' '}
            <button
              type="button"
              className="ghost-button ghost-button--inline"
              onClick={() =>
                onOpenStrategyProposal(
                  latestStrategyBacktest.source_proposal_id,
                  latestStrategyBacktest.strategy_id,
                )
              }
            >
              来源提案
            </button>
          </>
        )}
      </span>
    </div>
  )
}

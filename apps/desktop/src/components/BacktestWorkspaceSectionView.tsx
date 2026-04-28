import {
  BacktestExperimentPanel,
  BacktestParameterPanel,
  BacktestProposalListItem,
  BacktestWorkspaceHeader,
} from './backtest-workspace'
import type { BacktestWorkspaceSectionViewProps } from './buildBacktestWorkspaceSectionViewProps'

export default function BacktestWorkspaceSectionView({
  selectedStrategy,
  strategies,
  backtestFilter,
  onSelectBacktestFilter,
  backtestsForWorkspace,
  latestWorkspaceBacktest,
  latestWorkspaceBacktestDecisionMeta,
  latestWorkspaceBacktestWindowMeta,
  latestWorkspaceBacktestSampleMeta,
  openStrategyProposalsCount,
  backtestTimeframeDraft,
  onSelectBacktestTimeframeDraft,
  backtestTimeframeOptions,
  backtestRangeDraft,
  onSelectBacktestRangeDraft,
  backtestRangeOptions,
  onSelectStrategyId,
  serviceAvailable,
  backtestMutationPending,
  onSubmitBacktest,
  onOpenStrategySection,
  selectedBacktest,
  onSelectBacktestId,
  selectedBacktestSampleMeta,
  selectedBacktestWindowMeta,
  selectedBacktestDecisionMeta,
  selectedBacktestLineageMeta,
  selectedBacktestReview,
  selectedBacktestReviewJob,
  selectedBacktestReviewJobMeta,
  selectedBacktestProposals,
  proposalBacktestMap,
  proposalReviewMap,
  proposalChangeRequestMap,
  proposalAgentJobMap,
  schedulerState,
  selectedProposalId,
  proposalMutationPending,
  retryAgentJobMutationPending,
  backtestParameterComparison,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenAiSchedulerJob,
  onOpenReplayReview,
  onOpenReviewInspector,
  onRetryAgentJob,
  onHandleProposalAction,
  onRerunBacktestFromRecommendation,
  onRerunBacktestFromReview,
}: BacktestWorkspaceSectionViewProps) {
  return (
    <section className="section-grid section-entrance">
      <BacktestWorkspaceHeader
        selectedStrategy={selectedStrategy}
        strategies={strategies}
        backtestFilter={backtestFilter}
        onSelectBacktestFilter={onSelectBacktestFilter}
        backtestsForWorkspace={backtestsForWorkspace}
        latestWorkspaceBacktest={latestWorkspaceBacktest}
        latestWorkspaceBacktestDecisionMeta={latestWorkspaceBacktestDecisionMeta}
        latestWorkspaceBacktestWindowMeta={latestWorkspaceBacktestWindowMeta}
        latestWorkspaceBacktestSampleMeta={latestWorkspaceBacktestSampleMeta}
        openStrategyProposalsCount={openStrategyProposalsCount}
        backtestTimeframeDraft={backtestTimeframeDraft}
        onSelectBacktestTimeframeDraft={onSelectBacktestTimeframeDraft}
        backtestTimeframeOptions={backtestTimeframeOptions}
        backtestRangeDraft={backtestRangeDraft}
        onSelectBacktestRangeDraft={onSelectBacktestRangeDraft}
        backtestRangeOptions={backtestRangeOptions}
        onSelectStrategyId={onSelectStrategyId}
        serviceAvailable={serviceAvailable}
        backtestMutationPending={backtestMutationPending}
        onSubmitBacktest={onSubmitBacktest}
        onOpenStrategySection={onOpenStrategySection}
        selectedBacktest={selectedBacktest}
        onSelectBacktestId={onSelectBacktestId}
      />

      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="section-label">回测详情</span>
            <h3>{selectedBacktest?.strategy_name ?? '等待选择回测结果'}</h3>
          </div>
          <div className="chip-row">
            {selectedBacktestSampleMeta && (
              <span className={selectedBacktestSampleMeta.chipClass}>{selectedBacktestSampleMeta.label}</span>
            )}
            {selectedBacktestWindowMeta?.attention && (
              <span className={selectedBacktestWindowMeta.chipClass}>{selectedBacktestWindowMeta.label}</span>
            )}
            {selectedBacktest && <span className="chip chip--warning">{selectedBacktest.timeframe}</span>}
          </div>
        </div>
        {selectedBacktest ? (
          <>
            <div className="status-strip">
              <div>
                <span>年化收益</span>
                <strong>{selectedBacktest.metrics.annual_return}</strong>
              </div>
              <div>
                <span>最大回撤</span>
                <strong>{selectedBacktest.metrics.max_drawdown}</strong>
              </div>
              <div>
                <span>净收益</span>
                <strong>{selectedBacktest.metrics.pnl}</strong>
              </div>
              <div>
                <span>成交数</span>
                <strong>{selectedBacktest.metrics.trades}</strong>
              </div>
            </div>
            <div className="composite-grid">
              <BacktestExperimentPanel
                selectedBacktest={selectedBacktest}
                selectedBacktestSampleMeta={selectedBacktestSampleMeta}
                selectedBacktestDecisionMeta={selectedBacktestDecisionMeta}
                selectedBacktestWindowMeta={selectedBacktestWindowMeta}
                selectedBacktestLineageMeta={selectedBacktestLineageMeta}
                selectedBacktestReview={selectedBacktestReview}
                selectedBacktestReviewJob={selectedBacktestReviewJob}
                selectedBacktestReviewJobMeta={selectedBacktestReviewJobMeta}
                serviceAvailable={serviceAvailable}
                backtestMutationPending={backtestMutationPending}
                retryAgentJobMutationPending={retryAgentJobMutationPending}
                onOpenChangeRequest={onOpenChangeRequest}
                onOpenBacktestDetail={onOpenBacktestDetail}
                onOpenSourceReview={onOpenSourceReview}
                onOpenStrategyProposal={onOpenStrategyProposal}
                onOpenAiSchedulerJob={onOpenAiSchedulerJob}
                onRetryAgentJob={onRetryAgentJob}
                onRerunBacktestFromRecommendation={onRerunBacktestFromRecommendation}
              />
              <BacktestParameterPanel backtestParameterComparison={backtestParameterComparison} />
            </div>
            <div className="console-panel backtest-linked-panel">
              <div className="panel-head panel-head--compact">
                <div>
                  <span className="section-label">关联 AI 上下文</span>
                  <h3>复盘摘要与待处理提案</h3>
                </div>
              </div>
              {selectedBacktestReview ? (
                <>
                  <p className="panel-note">{selectedBacktestReview.summary}</p>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        onOpenReplayReview(
                          selectedBacktestReview.id,
                          selectedBacktestReview.strategy_id ?? selectedBacktest.strategy_id,
                          'selected',
                        )
                      }
                    >
                      打开复盘结果
                    </button>
                    {selectedBacktestReview.source_job_id && (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => onOpenAiSchedulerJob(selectedBacktestReview.source_job_id)}
                      >
                        打开来源任务
                      </button>
                    )}
                    {selectedBacktestReview.decision_recommended_data_range &&
                      selectedBacktestReview.decision_recommended_timeframe && (
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={!serviceAvailable || backtestMutationPending}
                          onClick={() => onRerunBacktestFromReview(selectedBacktestReview)}
                        >
                          按复盘建议重跑
                        </button>
                      )}
                  </div>
                  <div className="job-list">
                    {selectedBacktestProposals.map((proposal) => (
                      <BacktestProposalListItem
                        key={proposal.id}
                        proposal={proposal}
                        linkedBacktest={proposalBacktestMap.get(proposal.id) ?? null}
                        linkedReview={proposalReviewMap.get(proposal.id) ?? null}
                        linkedChangeRequest={proposalChangeRequestMap.get(proposal.id) ?? null}
                        linkedJob={proposalAgentJobMap.get(proposal.id) ?? null}
                        selectedProposalId={selectedProposalId}
                        schedulerState={schedulerState}
                        serviceAvailable={serviceAvailable}
                        proposalMutationPending={proposalMutationPending}
                        retryAgentJobMutationPending={retryAgentJobMutationPending}
                        onOpenChangeRequest={onOpenChangeRequest}
                        onOpenBacktestDetail={onOpenBacktestDetail}
                        onOpenAiSchedulerJob={onOpenAiSchedulerJob}
                        onOpenReplayReview={onOpenReplayReview}
                        onOpenReviewInspector={onOpenReviewInspector}
                        onRetryAgentJob={onRetryAgentJob}
                        onHandleProposalAction={onHandleProposalAction}
                      />
                    ))}
                    {selectedBacktestProposals.length === 0 && (
                      <div className="empty-state empty-state--inline">当前这轮回测还没有待处理提案</div>
                    )}
                  </div>
                </>
              ) : selectedBacktestReviewJobMeta && selectedBacktestReviewJob ? (
                <>
                  <p className="panel-note">
                    当前这轮回测的 AI 复盘任务{selectedBacktestReviewJobMeta.label}。{selectedBacktestReviewJobMeta.detail}
                  </p>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => onOpenAiSchedulerJob(selectedBacktestReviewJob.id)}
                    >
                      打开 AI 任务
                    </button>
                    {selectedBacktestReviewJobMeta.canRetry && (
                      <button
                        type="button"
                        disabled={!serviceAvailable || retryAgentJobMutationPending}
                        onClick={() => onRetryAgentJob(selectedBacktestReviewJob.id)}
                      >
                        重试回测复盘
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state empty-state--inline">当前这轮回测还没有关联的 AI 复盘记录</div>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">暂无回测记录</div>
        )}
      </article>
    </section>
  )
}

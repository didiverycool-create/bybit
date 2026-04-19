import type { SelectedChangeRequestPanelViewProps } from './SelectedChangeRequestPanel.types'
import {
  changeRequestStatusLabel,
  changeRequestTriggerReasonLabel,
  jobStatusLabel,
  jobStatusToneClass,
} from '../../utils/app-helpers'

export default function SelectedChangeRequestPanelView({
  selectedStrategyChangeRequest,
  serviceAvailable,
  backtestMutationPending,
  retryAgentJobMutationPending,
  onOpenChangeRequest,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenAiSchedulerJob,
  onOpenReviewInspector,
  onRetryAgentJob,
  onRerunBacktestFromChangeRequest,
  strategyId,
  linkedBacktestId,
  manualFollowupDetail,
  sampleMeta,
  decisionMeta,
  windowMeta,
  rerunRecommendation,
  sourceBacktestId,
  sourceReviewId,
  sourceProposalId,
}: SelectedChangeRequestPanelViewProps) {
  return (
    <div className="console-panel">
      <div className="panel-head panel-head--compact">
        <div>
          <span className="section-label">当前定位变更</span>
          <h3>{selectedStrategyChangeRequest.summary}</h3>
        </div>
        <div className="chip-row">
          <span className="console-tag">{changeRequestStatusLabel(selectedStrategyChangeRequest.status)}</span>
          {selectedStrategyChangeRequest.manual_followup_required && (
            <span className="console-tag console-tag--warn">需人工跟进</span>
          )}
          {sampleMeta && selectedStrategyChangeRequest.linked_backtest_sample_quality !== 'sufficient' && (
            <span className={sampleMeta.chipClass}>{sampleMeta.label}</span>
          )}
          {decisionMeta && <span className={decisionMeta.chipClass}>{decisionMeta.label}</span>}
          {!decisionMeta && windowMeta?.attention && <span className={windowMeta.chipClass}>{windowMeta.label}</span>}
        </div>
      </div>
      <div className="stack-list">
        <div className="stack-row">
          <strong>触发来源</strong>
          <span>
            {selectedStrategyChangeRequest.type} · {selectedStrategyChangeRequest.requested_by} ·{' '}
            {changeRequestTriggerReasonLabel(selectedStrategyChangeRequest.trigger_reason)}
          </span>
        </div>
        {selectedStrategyChangeRequest.follow_up_job_type && (
          <div className="stack-row">
            <strong>跟踪任务</strong>
            <span>
              {selectedStrategyChangeRequest.follow_up_job_type}
              {selectedStrategyChangeRequest.follow_up_job_status ? (
                <>
                  {' · '}
                  <span className={jobStatusToneClass(selectedStrategyChangeRequest.follow_up_job_status)}>
                    {jobStatusLabel(selectedStrategyChangeRequest.follow_up_job_status)}
                  </span>
                </>
              ) : null}
              {selectedStrategyChangeRequest.linked_review_title
                ? ` · 结果 ${selectedStrategyChangeRequest.linked_review_title}`
                : selectedStrategyChangeRequest.follow_up_result_summary
                  ? ` · ${selectedStrategyChangeRequest.follow_up_result_summary}`
                  : ''}
            </span>
          </div>
        )}
        {linkedBacktestId && (
          <div className="stack-row">
            <strong>关联回测</strong>
            <span>
              {linkedBacktestId}
              {selectedStrategyChangeRequest.linked_backtest_timeframe
                ? ` · ${selectedStrategyChangeRequest.linked_backtest_timeframe}`
                : ''}
              {selectedStrategyChangeRequest.linked_backtest_data_range
                ? ` · ${selectedStrategyChangeRequest.linked_backtest_data_range}`
                : ''}
            </span>
          </div>
        )}
        {manualFollowupDetail && (
          <div className="stack-row">
            <strong>人工跟进</strong>
            <span>{manualFollowupDetail}</span>
          </div>
        )}
        {sampleMeta && selectedStrategyChangeRequest.linked_backtest_sample_quality !== 'sufficient' && (
          <div className="stack-row">
            <strong>样本质量</strong>
            <span>{sampleMeta.description}</span>
          </div>
        )}
        {decisionMeta && (
          <div className="stack-row">
            <strong>结论门禁</strong>
            <span>{decisionMeta.detail}</span>
          </div>
        )}
        {windowMeta && (
          <div className="stack-row">
            <strong>样本窗口</strong>
            <span>{windowMeta.detail}</span>
          </div>
        )}
        {decisionMeta?.nextAction && (
          <div className="stack-row">
            <strong>门禁建议</strong>
            <span>{decisionMeta.nextAction}</span>
          </div>
        )}
        {!decisionMeta?.nextAction && windowMeta?.nextAction && (
          <div className="stack-row">
            <strong>窗口建议</strong>
            <span>{windowMeta.nextAction}</span>
          </div>
        )}
      </div>
      <div className="toggle-card__actions">
        <button
          type="button"
          className="ghost-button"
          onClick={() => onOpenChangeRequest(selectedStrategyChangeRequest.id, strategyId)}
        >
          查看变更
        </button>
        {linkedBacktestId && strategyId && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => onOpenBacktestDetail(linkedBacktestId, strategyId)}
          >
            打开回测
          </button>
        )}
        {decisionMeta?.recommendedRange && decisionMeta?.recommendedTimeframe && (
          <button
            type="button"
            className="ghost-button"
            disabled={!serviceAvailable || backtestMutationPending}
            onClick={() => {
              void onRerunBacktestFromChangeRequest(selectedStrategyChangeRequest)
            }}
          >
            按建议重跑
          </button>
        )}
        {!decisionMeta?.recommendedRange &&
          rerunRecommendation?.recommendedRange &&
          rerunRecommendation?.recommendedTimeframe && (
            <button
              type="button"
              className="ghost-button"
              disabled={!serviceAvailable || backtestMutationPending}
              onClick={() => {
                void onRerunBacktestFromChangeRequest(selectedStrategyChangeRequest)
              }}
            >
              按建议重跑
            </button>
          )}
        {selectedStrategyChangeRequest.follow_up_job_id && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => onOpenAiSchedulerJob(selectedStrategyChangeRequest.follow_up_job_id)}
          >
            打开任务
          </button>
        )}
        {selectedStrategyChangeRequest.linked_review_id && strategyId && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => onOpenReviewInspector(selectedStrategyChangeRequest.linked_review_id, strategyId)}
          >
            查看结果
          </button>
        )}
        {selectedStrategyChangeRequest.follow_up_job_id &&
          (selectedStrategyChangeRequest.follow_up_job_status === 'failed' ||
            selectedStrategyChangeRequest.follow_up_job_status === 'cancelled') && (
            <button
              type="button"
              className="ghost-button"
              disabled={!serviceAvailable || retryAgentJobMutationPending}
              onClick={() => {
                void onRetryAgentJob(selectedStrategyChangeRequest.follow_up_job_id, {
                  focusJob: true,
                })
              }}
            >
              重试跟踪
            </button>
          )}
        {sourceBacktestId && strategyId && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => onOpenBacktestDetail(sourceBacktestId, strategyId)}
          >
            来源回测
          </button>
        )}
        {sourceReviewId && strategyId && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => onOpenSourceReview(sourceReviewId, strategyId)}
          >
            来源复盘
          </button>
        )}
        {sourceProposalId && strategyId && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => onOpenStrategyProposal(sourceProposalId, strategyId)}
          >
            来源提案
          </button>
        )}
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'

import type { UseStrategyWorkspaceActionsArgs } from './strategyWorkspaceActionsShared'

type SchedulerCommandNavigationArgs = Pick<
  UseStrategyWorkspaceActionsArgs,
  | 'latestSchedulerCommand'
  | 'openAiSchedulerJob'
  | 'openReviewInspector'
  | 'openBacktestDetail'
  | 'openChangeRequest'
  | 'openSourceReview'
  | 'openStrategyProposal'
  | 'openStrategyActivity'
>

export function renderLatestSchedulerCommandActions(
  {
    latestSchedulerCommand,
    openAiSchedulerJob,
    openReviewInspector,
    openBacktestDetail,
    openChangeRequest,
    openSourceReview,
    openStrategyProposal,
    openStrategyActivity,
  }: SchedulerCommandNavigationArgs,
  buttonClass = 'ghost-button ghost-button--inline',
): ReactNode {
  if (!latestSchedulerCommand) {
    return null
  }

  return (
    <div className="inline-actions inline-actions--tight">
      {latestSchedulerCommand.jobId && (
        <button type="button" className={buttonClass} onClick={() => openAiSchedulerJob(latestSchedulerCommand.jobId!)}>
          打开任务
        </button>
      )}
      {latestSchedulerCommand.linkedReviewId && latestSchedulerCommand.strategyId && (
        <button
          type="button"
          className={buttonClass}
          onClick={() => openReviewInspector(latestSchedulerCommand.linkedReviewId!, latestSchedulerCommand.strategyId)}
        >
          查看结果
        </button>
      )}
      {latestSchedulerCommand.backtestId && latestSchedulerCommand.strategyId && (
        <button
          type="button"
          className={buttonClass}
          onClick={() => openBacktestDetail(latestSchedulerCommand.backtestId!, latestSchedulerCommand.strategyId)}
        >
          打开回测
        </button>
      )}
      {latestSchedulerCommand.sourceChangeRequestId && latestSchedulerCommand.strategyId && (
        <button
          type="button"
          className={buttonClass}
          onClick={() => openChangeRequest(latestSchedulerCommand.sourceChangeRequestId!, latestSchedulerCommand.strategyId)}
        >
          来源变更
        </button>
      )}
      {latestSchedulerCommand.sourceBacktestId &&
        latestSchedulerCommand.strategyId &&
        latestSchedulerCommand.sourceBacktestId !== latestSchedulerCommand.backtestId && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => openBacktestDetail(latestSchedulerCommand.sourceBacktestId!, latestSchedulerCommand.strategyId)}
          >
            来源回测
          </button>
        )}
      {latestSchedulerCommand.sourceReviewId &&
        latestSchedulerCommand.strategyId &&
        latestSchedulerCommand.sourceReviewId !== latestSchedulerCommand.linkedReviewId && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => openSourceReview(latestSchedulerCommand.sourceReviewId!, latestSchedulerCommand.strategyId)}
          >
            来源复盘
          </button>
        )}
      {latestSchedulerCommand.sourceProposalId && latestSchedulerCommand.strategyId && (
        <button
          type="button"
          className={buttonClass}
          onClick={() => openStrategyProposal(latestSchedulerCommand.sourceProposalId!, latestSchedulerCommand.strategyId)}
        >
          来源提案
        </button>
      )}
      {latestSchedulerCommand.strategyId && (
        <button
          type="button"
          className={buttonClass}
          onClick={() => openStrategyActivity(latestSchedulerCommand.strategyId!)}
        >
          打开策略
        </button>
      )}
    </div>
  )
}

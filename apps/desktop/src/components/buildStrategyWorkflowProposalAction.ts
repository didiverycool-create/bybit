import {
  getChangeRequestStrategyId,
  proposalAcceptBlockedReason,
  resolveErrorMessage,
} from '../utils/app-helpers'

import type { StrategyWorkflowProposalActionContext } from './useStrategyWorkflowExecutionActions.types'

export function buildStrategyWorkflowProposalAction({
  schedulerState,
  findProposalById,
  setSelectedProposalId,
  showFeedback,
  openBacktestDetail,
  openChangeRequest,
  proposalMutation,
}: StrategyWorkflowProposalActionContext) {
  return async function handleProposalAction(proposalId: string, action: 'accept' | 'reject') {
    const proposal = findProposalById(proposalId)
    const blockedReason =
      action === 'accept' && proposal ? proposalAcceptBlockedReason(proposal.proposal_type, schedulerState) : null
    if (blockedReason) {
      showFeedback('warning', '当前不能接受该提案', blockedReason)
      return
    }
    try {
      const result = await proposalMutation.mutateAsync({ proposalId, action })
      if (action === 'accept') {
        setSelectedProposalId(result.proposal.id)
        if (result.created_backtest) {
          openBacktestDetail(result.created_backtest.id, result.created_backtest.strategy_id)
        }
        if (result.created_change_request && result.created_change_request.status !== 'applied') {
          openChangeRequest(
            result.created_change_request.id,
            getChangeRequestStrategyId(result.created_change_request, result.proposal.strategy_id),
          )
        }
      }
      const detail =
        action === 'accept'
          ? result.created_backtest
            ? `${result.proposal.title} 已转成回测任务并写回结果，当前已自动定位到新回测。`
            : result.created_change_request
              ? result.created_change_request.status === 'applied'
                ? `${result.proposal.title} 已转成 ChangeRequest 并完成落实。`
                : result.created_change_request.manual_followup_required
                  ? `${result.proposal.title} 已转成待处理 ChangeRequest，当前需人工跟进并已定位到对应变更。`
                  : `${result.proposal.title} 已转成 ChangeRequest，当前已定位到待落实变更。`
              : `${result.proposal.title} 已标记为接受。`
          : `${result.proposal.title} 已被拒绝，不会继续进入执行链路。`
      showFeedback('success', action === 'accept' ? 'AI 提案已接受' : 'AI 提案已拒绝', detail)
    } catch (error) {
      showFeedback('error', '提案动作失败', resolveErrorMessage(error))
    }
  }
}

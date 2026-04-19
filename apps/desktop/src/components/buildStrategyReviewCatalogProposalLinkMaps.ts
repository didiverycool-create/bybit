import type { AgentJob, BacktestRun, ChangeRequest, ReviewDocument, StrategyProposal } from '../types'
import { buildProposalLinkMaps } from '../utils/proposal-linkage'

export function buildStrategyReviewCatalogProposalLinkMaps({
  backtests,
  reviewCatalog,
  changeRequests,
  proposalCatalog,
  schedulerJobs,
  backtestReviewJobs,
}: {
  backtests: BacktestRun[]
  reviewCatalog: ReviewDocument[]
  changeRequests: ChangeRequest[]
  proposalCatalog: StrategyProposal[]
  schedulerJobs: AgentJob[]
  backtestReviewJobs: AgentJob[]
}) {
  return buildProposalLinkMaps({
    backtests,
    reviewCatalog,
    changeRequests,
    proposalCatalog,
    schedulerJobs,
    backtestReviewJobs,
  })
}

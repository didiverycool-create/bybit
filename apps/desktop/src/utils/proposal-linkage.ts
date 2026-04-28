import type { AgentJob, BacktestRun, ChangeRequest, ReviewDocument, StrategyProposal } from '../types'

import { getAgentJobBacktestId, getChangeRequestSourceProposalId } from './app-helpers'

type ProposalLinkMaps = {
  proposalBacktestMap: Map<string, BacktestRun>
  proposalReviewMap: Map<string, ReviewDocument>
  proposalChangeRequestMap: Map<string, ChangeRequest>
  proposalAgentJobMap: Map<string, AgentJob>
}

function normalizeProposalId(value?: string | null) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function buildProposalLinkMaps({
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
}): ProposalLinkMaps {
  const proposalBacktestMap = new Map<string, BacktestRun>()
  for (const backtest of backtests) {
    const proposalId = normalizeProposalId(backtest.source_proposal_id)
    if (!proposalId) {
      continue
    }
    const existing = proposalBacktestMap.get(proposalId)
    if (!existing || new Date(backtest.started_at).getTime() > new Date(existing.started_at).getTime()) {
      proposalBacktestMap.set(proposalId, backtest)
    }
  }

  const proposalReviewMap = new Map<string, ReviewDocument>()
  for (const review of reviewCatalog) {
    const proposalId = normalizeProposalId(review.source_proposal_id)
    if (!proposalId) {
      continue
    }
    const existing = proposalReviewMap.get(proposalId)
    if (!existing || new Date(review.created_at).getTime() > new Date(existing.created_at).getTime()) {
      proposalReviewMap.set(proposalId, review)
    }
  }

  const proposalChangeRequestMap = new Map<string, ChangeRequest>()
  for (const request of changeRequests) {
    const proposalId = getChangeRequestSourceProposalId(request)
    if (!proposalId) {
      continue
    }
    const existing = proposalChangeRequestMap.get(proposalId)
    if (!existing || new Date(request.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
      proposalChangeRequestMap.set(proposalId, request)
    }
  }

  const proposalAgentJobMap = new Map<string, AgentJob>()
  for (const proposal of proposalCatalog) {
    const linkedChangeRequest = proposalChangeRequestMap.get(proposal.id) ?? null
    const linkedReview = proposalReviewMap.get(proposal.id) ?? null
    const linkedBacktest = proposalBacktestMap.get(proposal.id) ?? null
    let linkedJob: AgentJob | null = null
    if (linkedChangeRequest?.follow_up_job_id) {
      linkedJob = schedulerJobs.find((job) => job.id === linkedChangeRequest.follow_up_job_id) ?? null
    }
    if (!linkedJob && linkedReview?.source_job_id) {
      linkedJob = schedulerJobs.find((job) => job.id === linkedReview.source_job_id) ?? null
    }
    if (!linkedJob && linkedBacktest) {
      linkedJob = backtestReviewJobs.find((job) => getAgentJobBacktestId(job) === linkedBacktest.id) ?? null
    }
    if (linkedJob) {
      proposalAgentJobMap.set(proposal.id, linkedJob)
    }
  }

  return {
    proposalBacktestMap,
    proposalReviewMap,
    proposalChangeRequestMap,
    proposalAgentJobMap,
  }
}

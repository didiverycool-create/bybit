import type { StrategyProposal } from '../types'

export type ReplayProposalFeedItem = {
  reviewId: string
  reviewTitle: string
  reviewPeriod: string
  proposal: StrategyProposal
}

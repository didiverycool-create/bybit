import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { MarketDetail } from '../types'
import { shouldPersistMatchedMarketDetail } from './marketWorkspaceSelectionHelpers'

type UseMarketWorkspaceLiveCachePersistenceArgs = {
  marketSelectionKey: string
  matchedMarketDetail: MarketDetail | null
  setStableMarketDetails: Dispatch<SetStateAction<Record<string, MarketDetail>>>
}

export function useMarketWorkspaceLiveCachePersistence({
  marketSelectionKey,
  matchedMarketDetail,
  setStableMarketDetails,
}: UseMarketWorkspaceLiveCachePersistenceArgs) {
  useEffect(() => {
    if (!matchedMarketDetail || matchedMarketDetail.candles.length === 0) {
      return
    }
    setStableMarketDetails((current) => {
      const existing = current[marketSelectionKey]
      if (!shouldPersistMatchedMarketDetail(existing, matchedMarketDetail)) {
        return current
      }
      return {
        ...current,
        [marketSelectionKey]: matchedMarketDetail,
      }
    })
  }, [marketSelectionKey, matchedMarketDetail, setStableMarketDetails])
}

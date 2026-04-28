import { useEffect } from 'react'

import { resolveManualOrderPriceFromMarketDetail } from './resolveManualOrderPriceFromMarketDetail'
import type { UseAppLifecycleEffectsArgs } from './useAppLifecycleEffects.types'

export function useAppLifecycleEffectsManualOrder({
  marketDetail,
  manualOrderSymbolRef,
  setManualOrder,
}: Pick<
  UseAppLifecycleEffectsArgs,
  'marketDetail' | 'manualOrderSymbolRef' | 'setManualOrder'
>) {
  useEffect(() => {
    const latestClose = marketDetail?.candles.at(-1)?.close
    const currentSymbol = marketDetail?.symbol
    if (!latestClose || !currentSymbol) {
      return
    }

    setManualOrder((current) => ({
      ...current,
      price: resolveManualOrderPriceFromMarketDetail({
        currentPrice: current.price,
        previousSymbol: manualOrderSymbolRef.current,
        marketDetail,
      }),
    }))
    manualOrderSymbolRef.current = currentSymbol
  }, [manualOrderSymbolRef, marketDetail, marketDetail?.symbol, marketDetail?.updated_at, marketDetail?.candles, setManualOrder])
}

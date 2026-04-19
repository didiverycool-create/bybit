import type { MarketDetail } from '../types'

type ResolveManualOrderPriceFromMarketDetailArgs = {
  currentPrice: string
  previousSymbol: string | null
  marketDetail: MarketDetail | null
}

export function resolveManualOrderPriceFromMarketDetail({
  currentPrice,
  previousSymbol,
  marketDetail,
}: ResolveManualOrderPriceFromMarketDetailArgs) {
  const latestClose = marketDetail?.candles.at(-1)?.close
  const currentSymbol = marketDetail?.symbol

  if (!latestClose || !currentSymbol) {
    return currentPrice
  }

  return previousSymbol !== currentSymbol || currentPrice === '0'
    ? latestClose.toFixed(2)
    : currentPrice
}

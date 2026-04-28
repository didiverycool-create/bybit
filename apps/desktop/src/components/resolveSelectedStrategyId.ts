type StrategyOption = {
  id: string
}

type ResolveSelectedStrategyIdArgs = {
  strategies: StrategyOption[] | undefined
  selectedStrategyId: string | null
}

export function resolveSelectedStrategyId({
  strategies,
  selectedStrategyId,
}: ResolveSelectedStrategyIdArgs) {
  const firstStrategyId = strategies?.[0]?.id ?? null

  if (!selectedStrategyId) {
    return firstStrategyId
  }

  if (!strategies?.length) {
    return selectedStrategyId
  }

  return strategies.some((item) => item.id === selectedStrategyId)
    ? selectedStrategyId
    : firstStrategyId
}

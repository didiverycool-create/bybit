import type { UseAppLifecycleEffectsArgs } from './useAppLifecycleEffects.types'
import { useAppLifecycleEffectsEditingOrder } from './useAppLifecycleEffectsEditingOrder'
import { useAppLifecycleEffectsManualOrder } from './useAppLifecycleEffectsManualOrder'
import { useAppLifecycleEffectsOverviewCards } from './useAppLifecycleEffectsOverviewCards'
import { useAppLifecycleEffectsSelectedStrategy } from './useAppLifecycleEffectsSelectedStrategy'
import { useAppLifecycleEffectsStrategyActivity } from './useAppLifecycleEffectsStrategyActivity'

export function useAppLifecycleEffects(args: UseAppLifecycleEffectsArgs) {
  useAppLifecycleEffectsOverviewCards(args)
  useAppLifecycleEffectsSelectedStrategy(args)
  useAppLifecycleEffectsManualOrder(args)
  useAppLifecycleEffectsStrategyActivity(args)
  useAppLifecycleEffectsEditingOrder(args)
}

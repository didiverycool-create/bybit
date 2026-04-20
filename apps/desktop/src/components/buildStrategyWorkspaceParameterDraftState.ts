import type {
  ConfidenceRegimeAdjustments,
  RegimeExposureMultipliers,
  StrategySummary,
  VolatilityRegimeThresholds,
} from '../types'
import { coerceParameterValue, normalizeDraftValue } from '../utils/app-helpers'

export type BuildStrategyWorkspaceParameterDraftStateArgs = {
  selectedStrategy: StrategySummary | null
  riskBudgetDraft: string
  parameterDrafts: Record<string, string>
}

type AdvancedPatchValue =
  | string
  | number
  | boolean
  | null
  | VolatilityRegimeThresholds
  | RegimeExposureMultipliers
  | ConfidenceRegimeAdjustments

export type BuildStrategyWorkspaceParameterDraftStateResult = {
  parameterDraftPatch: Record<string, AdvancedPatchValue>
  parameterDraftChangeCount: number
  hasParameterDraftChanges: boolean
  riskBudgetChanged: boolean
}

// Round 50 — advanced scalar fields whose empty-string draft means "clear the
// optional top-level field back to null". Everything else keeps the existing
// skip-on-empty semantics so an untouched input does not synthesize a patch.
const ADVANCED_CLEARABLE_KEYS = new Set<string>([
  'kernel',
  'trailing_stop_pct',
  'break_even_trigger_pct',
  'volatility_lookback',
  'volatility_target_pct',
  'confidence_parameter_drift_penalty',
  'roc_window',
  'ema_trend_window',
  'momentum_threshold_pct',
  'bollinger_window',
  'bollinger_std',
  'squeeze_bandwidth_pct',
  'rsi_window',
  'rsi_overbought',
  'rsi_oversold',
])

type NestedGroupDescriptor = {
  patchKey: 'volatility_regime_thresholds' | 'regime_exposure_multipliers' | 'confidence_regime_adjustments'
  members: Record<string, string>
  currentValue: (strategy: StrategySummary) => Record<string, number> | null | undefined
}

// Round 50 — flat draft keys the editor writes map into the 3 nested Pydantic
// models backend exposes. When any sibling is present we build the full nested
// object (siblings fall back to the strategy's current value when blank); when
// every sibling is blank we emit ``null`` to clear the override.
const ADVANCED_NESTED_GROUPS: readonly NestedGroupDescriptor[] = [
  {
    patchKey: 'volatility_regime_thresholds',
    members: {
      volatility_regime_low_pct: 'low_pct',
      volatility_regime_high_pct: 'high_pct',
    },
    currentValue: (strategy) => strategy.volatility_regime_thresholds ?? null,
  },
  {
    patchKey: 'regime_exposure_multipliers',
    members: {
      regime_exposure_low: 'low',
      regime_exposure_normal: 'normal',
      regime_exposure_high: 'high',
    },
    currentValue: (strategy) => strategy.regime_exposure_multipliers ?? null,
  },
  {
    patchKey: 'confidence_regime_adjustments',
    members: {
      confidence_regime_low: 'low',
      confidence_regime_normal: 'normal',
      confidence_regime_high: 'high',
    },
    currentValue: (strategy) => strategy.confidence_regime_adjustments ?? null,
  },
]

const ADVANCED_NESTED_FLAT_KEYS = new Set<string>(
  ADVANCED_NESTED_GROUPS.flatMap((group) => Object.keys(group.members)),
)

function coerceAdvancedDraftValue(raw: string): string | number | boolean {
  const trimmed = raw.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) {
    const numeric = Number(trimmed)
    if (Number.isFinite(numeric)) return numeric
  }
  return raw
}

function collectNestedGroupPatches(
  strategy: StrategySummary,
  parameterDrafts: Record<string, string>,
): Array<[string, Record<string, number> | null]> {
  const patches: Array<[string, Record<string, number> | null]> = []
  for (const group of ADVANCED_NESTED_GROUPS) {
    const memberEntries = Object.entries(group.members)
    const touched = memberEntries.filter(([flatKey]) => parameterDrafts[flatKey] !== undefined)
    if (touched.length === 0) continue

    const allBlank = touched.every(([flatKey]) => parameterDrafts[flatKey]?.trim() === '')
    if (allBlank) {
      patches.push([group.patchKey, null])
      continue
    }

    const current = group.currentValue(strategy)
    const assembled: Record<string, number> = {}
    let complete = true
    for (const [flatKey, subfield] of memberEntries) {
      const draft = parameterDrafts[flatKey]
      const trimmed = draft?.trim() ?? ''
      if (trimmed === '') {
        const fallback = current?.[subfield]
        if (typeof fallback === 'number' && Number.isFinite(fallback)) {
          assembled[subfield] = fallback
          continue
        }
        complete = false
        break
      }
      const numeric = Number(trimmed)
      if (!Number.isFinite(numeric)) {
        complete = false
        break
      }
      assembled[subfield] = numeric
    }
    if (complete) {
      patches.push([group.patchKey, assembled])
    }
  }
  return patches
}

export function buildStrategyWorkspaceParameterDraftState({
  selectedStrategy,
  riskBudgetDraft,
  parameterDrafts,
}: BuildStrategyWorkspaceParameterDraftStateArgs): BuildStrategyWorkspaceParameterDraftStateResult {
  const parameterKeys = new Set(selectedStrategy?.parameters.map((parameter) => parameter.key) ?? [])
  const parameterDraftPatch: Record<string, AdvancedPatchValue> = {}

  if (selectedStrategy) {
    for (const parameter of selectedStrategy.parameters) {
      const draftValue = parameterDrafts[parameter.key]
      const normalizedCurrent = normalizeDraftValue(parameter.value)
      if (draftValue == null || draftValue === normalizedCurrent) continue
      parameterDraftPatch[parameter.key] = coerceParameterValue(parameter.value, draftValue)
    }

    for (const [key, value] of Object.entries(parameterDrafts)) {
      if (parameterKeys.has(key) || ADVANCED_NESTED_FLAT_KEYS.has(key) || value == null) continue
      const trimmed = value.trim()
      if (trimmed === '') {
        if (ADVANCED_CLEARABLE_KEYS.has(key)) {
          parameterDraftPatch[key] = null
        }
        continue
      }
      parameterDraftPatch[key] = coerceAdvancedDraftValue(value)
    }

    for (const [patchKey, patchValue] of collectNestedGroupPatches(selectedStrategy, parameterDrafts)) {
      parameterDraftPatch[patchKey] = patchValue
    }
  }

  const parameterDraftChangeCount = Object.keys(parameterDraftPatch).length
  const hasParameterDraftChanges = parameterDraftChangeCount > 0
  const riskBudgetChanged = Boolean(
    selectedStrategy && riskBudgetDraft.trim() && riskBudgetDraft !== selectedStrategy.risk_budget,
  )

  return {
    parameterDraftPatch,
    parameterDraftChangeCount,
    hasParameterDraftChanges,
    riskBudgetChanged,
  }
}

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const cwd = new URL('..', import.meta.url)
const timeoutMs = 90_000
const successCleanupDelayMs = 500
const resultPath = process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_RESULT_PATH || '/tmp/bybit-smoke-strategy-activity-summary.json'
const rawLogPath = process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_LOG_PATH || '/tmp/bybit-smoke-strategy-activity.log'
const persistentDir = fileURLToPath(new URL('../../../.runtime/strategy-activity/', import.meta.url))
const persistentResultPath = process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_PERSISTENT_RESULT_PATH
  || path.join(persistentDir, 'latest-summary.json')
const persistentRawLogPath = process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_PERSISTENT_LOG_PATH
  || path.join(persistentDir, 'latest.log')
const persistentLatestSuccessResultPath = process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_LATEST_SUCCESS_RESULT_PATH
  || path.join(persistentDir, 'latest-success-summary.json')
const persistentLatestSuccessRawLogPath = process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_LATEST_SUCCESS_LOG_PATH
  || path.join(persistentDir, 'latest-success.log')
const persistentHistoryDir = process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_HISTORY_DIR
  || path.join(persistentDir, 'history')
const persistentReportPath = process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_REPORT_PATH
  || path.join(persistentDir, 'latest-report.md')
const persistentLatestSuccessReportPath = process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_LATEST_SUCCESS_REPORT_PATH
  || path.join(persistentDir, 'latest-success-report.md')
const persistentTrendReportPath = process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_TREND_REPORT_PATH
  || path.join(persistentDir, 'trend-report.md')
const persistentTrendSummaryPath = process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_TREND_SUMMARY_PATH
  || path.join(persistentDir, 'trend-summary.json')
const historyKeepCount = Number(process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_HISTORY_KEEP_COUNT || 20)
const significantElapsedDeltaMs = Number(process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_SIGNIFICANT_ELAPSED_DELTA_MS || 2000)
const attentionElapsedDeltaMs = Number(process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_ATTENTION_ELAPSED_DELTA_MS || 5000)
const regressionElapsedDeltaMs = Number(process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_REGRESSION_ELAPSED_DELTA_MS || 5000)
const contentGrowthRowBudgetMs = Number(process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_CONTENT_GROWTH_ROW_BUDGET_MS || 500)
const contentGrowthRecentActionBudgetMs = Number(process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_CONTENT_GROWTH_RECENT_ACTION_BUDGET_MS || 250)
const requiredActivitySections = [
  'proposals',
  'change-requests',
  'backtests',
  'tracking-reviews',
  'primary-reviews',
  'jobs',
  'alerts',
  'audit',
  'active-orders',
  'historical-orders',
  'trades',
]
const requiredTopActionGroups = [
  'recent',
  'audit',
  'latest-focus',
  'lineage',
  'proposal-change',
  'actionable',
]
const requiredPanelNoteEntryKeys = ['strategy_headline', 'latest_activity_summary', 'latest_ops_summary']
const topRecentSchemaFields = ['topRecentActionLabels', 'topRecentActionKeys']
const topActionSchemaFields = ['topActionLabelsByGroup', 'topActionKeysByGroup', 'topUnknownActionLabelsByGroup']
const panelNoteSchemaFields = ['panelNoteEntries', 'panelNoteEntryKeys', 'panelNoteTextsWithoutStructuredKeys']
const sectionActionSchemaFields = ['sectionActionLabelsBySection', 'sectionActionKeysBySection', 'sectionUnknownActionLabelsBySection']
const topActionVisibilitySchemaFields = ['topActionVisibleGroups']
const sectionActionVisibilitySchemaFields = ['sectionActionVisibleSections']
const sectionBadgeSchemaFields = ['sectionBadgeLabelsBySection', 'sectionBadgeKeysBySection', 'sectionUnknownBadgeLabelsBySection']
const sectionRowSchemaFields = ['sectionRowCounts', 'sectionEmptyStateVisibleSections']
const sectionRowTitleSchemaFields = ['sectionStructuredRowTitleCountsBySection', 'sectionRowTitlesBySection']
const sectionRowTitleBindingSchemaFields = ['sectionStructuredRowTitleBindingCountsBySection', 'sectionRowTitleBindingsBySection']
const sectionRowSummaryBindingSchemaFields = ['sectionStructuredRowSummaryBindingCountsBySection', 'sectionRowSummaryBindingsBySection']
const sectionRowActionBindingSchemaFields = ['sectionStructuredRowActionBindingCountsBySection', 'sectionRowActionBindingsBySection']
const sectionRowBadgeBindingSchemaFields = [
  'sectionStructuredRowBadgeBindingCountsBySection',
  'sectionRowBadgeLabelBindingsBySection',
  'sectionRowUnknownBadgeBindingsBySection',
  'sectionRowBadgeBindingsBySection',
]
const sectionRowSemanticBindingSchemaFields = [
  'sectionStructuredRowSemanticBindingCountsBySection',
  'sectionRowSemanticBindingsBySection',
]
const sectionRowIdentitySchemaFields = ['sectionStructuredRowIdCountsBySection', 'sectionRowIdsBySection', 'sectionDuplicateRowIdsBySection']

const child = spawn('pnpm', ['dev:repair'], {
  cwd,
  env: {
    ...process.env,
    BYBIT_SMOKE_STRATEGY_ACTIVITY: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let settled = false
let timeout = null
const rawLines = []

const writeFileSafely = (targetPath, content, description) => {
  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, content, 'utf8')
  } catch (error) {
    console.error(`[smoke:strategy-activity] 写入${description}失败: ${targetPath}`, error)
  }
}

const sanitizeTimestamp = (value) => String(value ?? '')
  .replaceAll(':', '-')
  .replaceAll('.', '-')

const isSuccessfulBaseline = (payload) => Boolean(payload?.ok) && payload?.readiness?.ok !== false

const isFailureSample = (payload) => payload?.ok === false || payload?.readiness?.ok === false

const buildArrayDelta = (latestValues, previousValues) => {
  const latest = Array.isArray(latestValues) ? latestValues.filter(Boolean) : []
  const previous = Array.isArray(previousValues) ? previousValues.filter(Boolean) : []
  const latestSet = new Set(latest)
  const previousSet = new Set(previous)
  return {
    added: latest.filter((value) => !previousSet.has(value)),
    removed: previous.filter((value) => !latestSet.has(value)),
  }
}

const arraysEqual = (leftValues, rightValues) => {
  const left = Array.isArray(leftValues) ? leftValues.filter(Boolean) : []
  const right = Array.isArray(rightValues) ? rightValues.filter(Boolean) : []
  if (left.length !== right.length) {
    return false
  }
  return left.every((value, index) => value === right[index])
}

const buildSectionOrderOnlyChangeList = (latestMap, previousMap) => {
  return requiredActivitySections.filter((section) => {
    const latestValues = Array.isArray(latestMap?.[section]) ? latestMap[section].filter(Boolean) : []
    const previousValues = Array.isArray(previousMap?.[section]) ? previousMap[section].filter(Boolean) : []
    if (latestValues.length <= 1 || previousValues.length <= 1) {
      return false
    }
    const delta = buildArrayDelta(latestValues, previousValues)
    if (delta.added.length || delta.removed.length) {
      return false
    }
    return !arraysEqual(latestValues, previousValues)
  })
}

const formatKeyList = (values) => {
  const normalized = Array.isArray(values) ? values.filter(Boolean) : []
  return normalized.length ? normalized.join(', ') : '无'
}

const hasOwnField = (value, key) => Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key))

const hasAnyOwnField = (value, keys) => keys.some((key) => hasOwnField(value, key))

const normalizeGroupedKeyMap = (groups, value) => {
  const source = value && typeof value === 'object' ? value : {}
  return Object.fromEntries(
    groups.map((group) => [
      group,
      Array.isArray(source[group]) ? source[group].filter(Boolean) : [],
    ]),
  )
}

const normalizeSectionKeyMap = (value) => {
  return normalizeGroupedKeyMap(requiredActivitySections, value)
}

const normalizeTopActionKeyMap = (value) => {
  return normalizeGroupedKeyMap(requiredTopActionGroups, value)
}

const sectionHasRows = (state, section) => Number(state?.sectionRowCounts?.[section] ?? 0) > 0

const parseSemanticBindingEntry = (entry) => {
  if (typeof entry !== 'string') {
    return null
  }
  const separatorIndex = entry.indexOf(' => ')
  if (separatorIndex <= 0) {
    return null
  }
  const rowId = entry.slice(0, separatorIndex).trim()
  const jsonText = entry.slice(separatorIndex + 4).trim()
  if (!rowId || !jsonText) {
    return null
  }
  try {
    const payload = JSON.parse(jsonText)
    if (!payload || typeof payload !== 'object') {
      return null
    }
    return { rowId, payload }
  } catch (_error) {
    return null
  }
}

const buildSectionSemanticUnknownBindingMap = (bindingsBySection, field) => {
  const source = normalizeSectionKeyMap(bindingsBySection)
  return Object.fromEntries(
    requiredActivitySections.map((section) => [
      section,
      source[section]
        .map((entry) => {
          const parsed = parseSemanticBindingEntry(entry)
          const values = Array.isArray(parsed?.payload?.[field]) ? parsed.payload[field].filter(Boolean) : []
          if (!parsed?.rowId || !values.length) {
            return null
          }
          return `${parsed.rowId} => ${values.join(', ')}`
        })
        .filter(Boolean),
    ]),
  )
}

const buildGroupedArrayDeltaMap = (groups, latestMap, previousMap) => {
  const latest = normalizeGroupedKeyMap(groups, latestMap)
  const previous = normalizeGroupedKeyMap(groups, previousMap)
  return Object.fromEntries(
    groups.map((group) => [
      group,
      buildArrayDelta(latest[group], previous[group]),
    ]),
  )
}

const buildSectionArrayDeltaMap = (latestMap, previousMap) => {
  return buildGroupedArrayDeltaMap(requiredActivitySections, latestMap, previousMap)
}

const buildTopActionArrayDeltaMap = (latestMap, previousMap) => {
  return buildGroupedArrayDeltaMap(requiredTopActionGroups, latestMap, previousMap)
}

const buildSectionCountDeltaMap = (latestMap, previousMap) => {
  const latest = latestMap && typeof latestMap === 'object' ? latestMap : {}
  const previous = previousMap && typeof previousMap === 'object' ? previousMap : {}
  return Object.fromEntries(
    requiredActivitySections.map((section) => [
      section,
      Number(latest[section] ?? 0) - Number(previous[section] ?? 0),
    ]),
  )
}

const formatGroupedKeyMap = (groups, value) => {
  const source = normalizeGroupedKeyMap(groups, value)
  return groups
    .map((group) => `- ${group}: ${formatKeyList(source[group])}`)
    .join('\n')
}

const formatSectionKeyMap = (value) => {
  return formatGroupedKeyMap(requiredActivitySections, value)
}

const formatSectionCountMap = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  return requiredActivitySections
    .map((section) => `- ${section}: ${Number(source[section] ?? 0)}`)
    .join('\n')
}

const formatSectionCountDeltaMap = (value) => {
  if (!value || typeof value !== 'object') {
    return '- 无'
  }
  const lines = requiredActivitySections
    .map((section) => {
      const delta = Number(value[section] ?? 0)
      if (delta === 0) {
        return null
      }
      return `- ${section}: ${delta >= 0 ? '+' : ''}${delta}`
    })
    .filter(Boolean)
  return lines.length ? lines.join('\n') : '- 无'
}

const formatTopActionKeyMap = (value) => {
  return formatGroupedKeyMap(requiredTopActionGroups, value)
}

const formatGroupedDeltaMap = (groups, value, changeType) => {
  if (!value || typeof value !== 'object') {
    return '- 无'
  }
  const lines = groups
    .map((group) => {
      const entry = value[group]
      const changes = Array.isArray(entry?.[changeType]) ? entry[changeType].filter(Boolean) : []
      if (!changes.length) {
        return null
      }
      return `- ${group}: ${changes.join(', ')}`
    })
    .filter(Boolean)
  return lines.length ? lines.join('\n') : '- 无'
}

const formatSectionDeltaMap = (value, changeType) => {
  return formatGroupedDeltaMap(requiredActivitySections, value, changeType)
}

const formatTopActionDeltaMap = (value, changeType) => {
  return formatGroupedDeltaMap(requiredTopActionGroups, value, changeType)
}

const buildNormalizedSummary = (payload) => {
  const state = payload?.readiness?.state ?? payload?.snapshot ?? {}
  const topRecentSchemaReady = hasAnyOwnField(state, topRecentSchemaFields)
  const topActionSchemaReady = hasAnyOwnField(state, topActionSchemaFields)
  const panelNoteSchemaReady = hasAnyOwnField(state, panelNoteSchemaFields)
  const sectionActionSchemaReady = hasAnyOwnField(state, sectionActionSchemaFields)
  const topActionVisibilitySchemaReady = hasAnyOwnField(state, topActionVisibilitySchemaFields)
  const sectionActionVisibilitySchemaReady = hasAnyOwnField(state, sectionActionVisibilitySchemaFields)
  const sectionBadgeSchemaReady = hasAnyOwnField(state, sectionBadgeSchemaFields)
  const sectionRowSchemaReady = hasAnyOwnField(state, sectionRowSchemaFields)
  const sectionRowTitleSchemaReady = hasAnyOwnField(state, sectionRowTitleSchemaFields)
  const sectionRowTitleBindingSchemaReady = hasAnyOwnField(state, sectionRowTitleBindingSchemaFields)
  const sectionRowSummaryBindingSchemaReady = hasAnyOwnField(state, sectionRowSummaryBindingSchemaFields)
  const sectionRowActionBindingSchemaReady = hasAnyOwnField(state, sectionRowActionBindingSchemaFields)
  const sectionRowBadgeBindingSchemaReady = hasAnyOwnField(state, sectionRowBadgeBindingSchemaFields)
  const sectionRowSemanticBindingSchemaReady = hasAnyOwnField(state, sectionRowSemanticBindingSchemaFields)
  const sectionRowIdentitySchemaReady = hasAnyOwnField(state, sectionRowIdentitySchemaFields)
  const topActionVisibleGroups = Array.isArray(state?.topActionVisibleGroups) ? state.topActionVisibleGroups.filter(Boolean) : []
  const sectionActionVisibleSections = Array.isArray(state?.sectionActionVisibleSections) ? state.sectionActionVisibleSections.filter(Boolean) : []
  const sectionEmptyStateVisibleSections = Array.isArray(state?.sectionEmptyStateVisibleSections)
    ? state.sectionEmptyStateVisibleSections.filter(Boolean)
    : []
  const sectionRowCounts = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(state?.sectionRowCounts?.[section] ?? 0)]),
  )
  const sectionStructuredRowIdCountsBySection = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(state?.sectionStructuredRowIdCountsBySection?.[section] ?? 0)]),
  )
  const sectionStructuredRowTitleCountsBySection = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(state?.sectionStructuredRowTitleCountsBySection?.[section] ?? 0)]),
  )
  const sectionStructuredRowTitleBindingCountsBySection = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(state?.sectionStructuredRowTitleBindingCountsBySection?.[section] ?? 0)]),
  )
  const sectionStructuredRowSummaryBindingCountsBySection = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(state?.sectionStructuredRowSummaryBindingCountsBySection?.[section] ?? 0)]),
  )
  const sectionStructuredRowActionBindingCountsBySection = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(state?.sectionStructuredRowActionBindingCountsBySection?.[section] ?? 0)]),
  )
  const sectionStructuredRowBadgeBindingCountsBySection = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(state?.sectionStructuredRowBadgeBindingCountsBySection?.[section] ?? 0)]),
  )
  const sectionStructuredRowSemanticBindingCountsBySection = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(state?.sectionStructuredRowSemanticBindingCountsBySection?.[section] ?? 0)]),
  )
  const sectionRowTitlesBySection = normalizeSectionKeyMap(state?.sectionRowTitlesBySection)
  const sectionRowTitleBindingsBySection = normalizeSectionKeyMap(state?.sectionRowTitleBindingsBySection)
  const sectionRowSummaryBindingsBySection = normalizeSectionKeyMap(state?.sectionRowSummaryBindingsBySection)
  const sectionRowActionBindingsBySection = normalizeSectionKeyMap(state?.sectionRowActionBindingsBySection)
  const sectionRowBadgeLabelBindingsBySection = normalizeSectionKeyMap(state?.sectionRowBadgeLabelBindingsBySection)
  const sectionRowUnknownBadgeBindingsBySection = normalizeSectionKeyMap(state?.sectionRowUnknownBadgeBindingsBySection)
  const sectionRowBadgeBindingsBySection = normalizeSectionKeyMap(state?.sectionRowBadgeBindingsBySection)
  const sectionRowSemanticBindingsBySection = normalizeSectionKeyMap(state?.sectionRowSemanticBindingsBySection)
  const sectionRowSemanticUnknownActionBindingsBySection = buildSectionSemanticUnknownBindingMap(
    sectionRowSemanticBindingsBySection,
    'unknownActions',
  )
  const sectionRowSemanticUnknownBadgeBindingsBySection = buildSectionSemanticUnknownBindingMap(
    sectionRowSemanticBindingsBySection,
    'unknownBadges',
  )
  const sectionRowIdsBySection = normalizeSectionKeyMap(state?.sectionRowIdsBySection)
  const sectionDuplicateRowIdsBySection = normalizeSectionKeyMap(state?.sectionDuplicateRowIdsBySection)
  const topRecentActionCount = Number(state?.topRecentActionCount ?? 0)
  const topRecentActionKeys = Array.isArray(state?.topRecentActionKeys) ? state.topRecentActionKeys.filter(Boolean) : []
  const panelNoteEntries = Array.isArray(state?.panelNoteEntries)
    ? state.panelNoteEntries.filter((entry) => entry?.key && entry?.text)
    : []
  const panelNoteEntryKeys = Array.isArray(state?.panelNoteEntryKeys)
    ? state.panelNoteEntryKeys.filter(Boolean)
    : panelNoteEntries.map((entry) => entry.key).filter(Boolean)
  const panelNoteTextsWithoutStructuredKeys = Array.isArray(state?.panelNoteTextsWithoutStructuredKeys)
    ? state.panelNoteTextsWithoutStructuredKeys.filter(Boolean)
    : []
  const topActionLabelsByGroup = normalizeTopActionKeyMap(state?.topActionLabelsByGroup)
  const topActionKeysByGroup = normalizeTopActionKeyMap(state?.topActionKeysByGroup)
  const topUnknownActionLabelsByGroup = normalizeTopActionKeyMap(state?.topUnknownActionLabelsByGroup)
  const topActionsMissingStructuredKeys = requiredTopActionGroups.filter((group) => {
    const labels = topActionLabelsByGroup[group]
    const keys = topActionKeysByGroup[group]
    const unknown = topUnknownActionLabelsByGroup[group]
    if (!labels.length) {
      return false
    }
    return keys.length === 0 || unknown.length > 0
  })
  const sectionActionLabelsBySection = normalizeSectionKeyMap(state?.sectionActionLabelsBySection)
  const sectionActionKeysBySection = normalizeSectionKeyMap(state?.sectionActionKeysBySection)
  const sectionUnknownActionLabelsBySection = normalizeSectionKeyMap(state?.sectionUnknownActionLabelsBySection)
  const sectionsMissingStructuredActionKeys = requiredActivitySections.filter((section) => {
    if (!sectionHasRows(state, section)) {
      return false
    }
    const labels = sectionActionLabelsBySection[section]
    const keys = sectionActionKeysBySection[section]
    const unknown = sectionUnknownActionLabelsBySection[section]
    if (!labels.length) {
      return false
    }
    return keys.length === 0 || unknown.length > 0
  })
  const sectionBadgeLabelsBySection = normalizeSectionKeyMap(state?.sectionBadgeLabelsBySection)
  const sectionBadgeKeysBySection = normalizeSectionKeyMap(state?.sectionBadgeKeysBySection)
  const sectionUnknownBadgeLabelsBySection = normalizeSectionKeyMap(state?.sectionUnknownBadgeLabelsBySection)
  const sectionsMissingStructuredBadgeKeys = requiredActivitySections.filter((section) => {
    if (!sectionHasRows(state, section)) {
      return false
    }
    const labels = sectionBadgeLabelsBySection[section]
    const keys = sectionBadgeKeysBySection[section]
    const unknown = sectionUnknownBadgeLabelsBySection[section]
    if (!labels.length) {
      return false
    }
    return keys.length === 0 || unknown.length > 0
  })
  const sectionsWithoutRowsOrEmptyState = requiredActivitySections.filter((section) => (
    sectionActionVisibleSections.includes(section)
    && sectionRowCounts[section] <= 0
    && !sectionEmptyStateVisibleSections.includes(section)
  ))
  const sectionsMissingStructuredRowIds = requiredActivitySections.filter((section) => {
    if (sectionRowCounts[section] <= 0) {
      return false
    }
    return sectionStructuredRowIdCountsBySection[section] < sectionRowCounts[section]
  })
  const sectionsMissingStructuredRowTitles = requiredActivitySections.filter((section) => {
    if (sectionRowCounts[section] <= 0) {
      return false
    }
    return sectionStructuredRowTitleCountsBySection[section] < sectionRowCounts[section]
  })
  const sectionsMissingStructuredRowTitleBindings = requiredActivitySections.filter((section) => {
    if (sectionRowCounts[section] <= 0) {
      return false
    }
    return sectionStructuredRowTitleBindingCountsBySection[section] < sectionRowCounts[section]
  })
  const sectionsMissingStructuredRowSummaryBindings = requiredActivitySections.filter((section) => {
    if (sectionRowCounts[section] <= 0) {
      return false
    }
    return sectionStructuredRowSummaryBindingCountsBySection[section] < sectionRowCounts[section]
  })
  const sectionsMissingStructuredRowActionBindings = requiredActivitySections.filter((section) => {
    if (sectionRowCounts[section] <= 0) {
      return false
    }
    return sectionStructuredRowActionBindingCountsBySection[section] < sectionRowCounts[section]
  })
  const sectionsMissingStructuredRowBadgeBindings = requiredActivitySections.filter((section) => {
    if (!sectionHasRows(state, section)) {
      return false
    }
    const badgeLabelBindings = sectionRowBadgeLabelBindingsBySection[section] ?? []
    if (!badgeLabelBindings.length) {
      return false
    }
    const unknownBadgeBindings = sectionRowUnknownBadgeBindingsBySection[section] ?? []
    return sectionStructuredRowBadgeBindingCountsBySection[section] < badgeLabelBindings.length || unknownBadgeBindings.length > 0
  })
  const sectionsMissingStructuredRowSemanticBindings = requiredActivitySections.filter((section) => {
    if (sectionRowCounts[section] <= 0) {
      return false
    }
    return sectionStructuredRowSemanticBindingCountsBySection[section] < sectionRowCounts[section]
  })
  const sectionsWithUnknownSemanticActions = requiredActivitySections.filter((section) => (
    (sectionRowSemanticUnknownActionBindingsBySection[section] ?? []).length > 0
  ))
  const sectionsWithUnknownSemanticBadges = requiredActivitySections.filter((section) => (
    (sectionRowSemanticUnknownBadgeBindingsBySection[section] ?? []).length > 0
  ))
  const sectionsWithDuplicateRowIds = requiredActivitySections.filter((section) => (
    (sectionDuplicateRowIdsBySection[section] ?? []).length > 0
  ))
  return {
    generatedAt: payload?.generatedAt ?? null,
    ok: Boolean(payload?.ok) && Boolean(payload?.readiness?.ok),
    elapsedMs: Number(payload?.readiness?.elapsedMs ?? 0),
    activeSection: state?.activeSection ?? null,
    selectedStrategyName: state?.selectedStrategyName ?? null,
    panelTitle: state?.panelTitle ?? null,
    queryStatus: state?.queryStatus ?? null,
    fetchStatus: state?.fetchStatus ?? null,
    queryStrategyId: state?.queryStrategyId ?? null,
    headTrackButton: Boolean(state?.headTrackButton),
    topRecentActionCount,
    noteCount: Number(state?.noteCount ?? 0),
    topRecentSchemaReady,
    topRecentActionLabels: Array.isArray(state?.topRecentActionLabels) ? state.topRecentActionLabels : [],
    topRecentActionKeys,
    topActionVisibilitySchemaReady,
    topActionVisibleGroups,
    topActionSchemaReady,
    topActionLabelsByGroup,
    topActionKeysByGroup,
    topUnknownActionLabelsByGroup,
    topActionsMissingStructuredKeys,
    panelNoteTexts: Array.isArray(state?.panelNoteTexts) ? state.panelNoteTexts : [],
    panelNoteEntries,
    panelNoteEntryKeys,
    panelNoteTextsWithoutStructuredKeys,
    panelNoteSchemaReady,
    missingRequiredPanelNoteEntryKeys: requiredPanelNoteEntryKeys.filter(
      (key) => !panelNoteEntryKeys.includes(key),
    ),
    panelNotesStructured: panelNoteTextsWithoutStructuredKeys.length === 0,
    topRecentActionsStructured: topRecentActionCount === 0 || topRecentActionKeys.length > 0,
    topActionsStructured: topActionsMissingStructuredKeys.length === 0,
    sectionActionVisibilitySchemaReady,
    sectionActionVisibleSections,
    sectionActionLabelsBySection,
    sectionActionKeysBySection,
    sectionUnknownActionLabelsBySection,
    sectionsMissingStructuredActionKeys,
    sectionActionSchemaReady,
    sectionActionsStructured: sectionsMissingStructuredActionKeys.length === 0,
    sectionBadgeSchemaReady,
    sectionBadgeLabelsBySection,
    sectionBadgeKeysBySection,
    sectionUnknownBadgeLabelsBySection,
    sectionsMissingStructuredBadgeKeys,
    sectionBadgesStructured: sectionsMissingStructuredBadgeKeys.length === 0,
    sectionRowSchemaReady,
    sectionRowCounts,
    sectionRowTitleSchemaReady,
    sectionStructuredRowTitleCountsBySection,
    sectionRowTitlesBySection,
    sectionsMissingStructuredRowTitles,
    sectionRowsTitled: sectionsMissingStructuredRowTitles.length === 0,
    sectionRowTitleBindingSchemaReady,
    sectionStructuredRowTitleBindingCountsBySection,
    sectionRowTitleBindingsBySection,
    sectionsMissingStructuredRowTitleBindings,
    sectionRowsTitleBound: sectionsMissingStructuredRowTitleBindings.length === 0,
    sectionRowSummaryBindingSchemaReady,
    sectionStructuredRowSummaryBindingCountsBySection,
    sectionRowSummaryBindingsBySection,
    sectionsMissingStructuredRowSummaryBindings,
    sectionRowsSummaryBound: sectionsMissingStructuredRowSummaryBindings.length === 0,
    sectionRowActionBindingSchemaReady,
    sectionStructuredRowActionBindingCountsBySection,
    sectionRowActionBindingsBySection,
    sectionsMissingStructuredRowActionBindings,
    sectionRowsActionBound: sectionsMissingStructuredRowActionBindings.length === 0,
    sectionRowBadgeBindingSchemaReady,
    sectionStructuredRowBadgeBindingCountsBySection,
    sectionRowBadgeLabelBindingsBySection,
    sectionRowUnknownBadgeBindingsBySection,
    sectionRowBadgeBindingsBySection,
    sectionsMissingStructuredRowBadgeBindings,
    sectionRowsBadgeBound: sectionsMissingStructuredRowBadgeBindings.length === 0,
    sectionRowSemanticBindingSchemaReady,
    sectionStructuredRowSemanticBindingCountsBySection,
    sectionRowSemanticBindingsBySection,
    sectionRowSemanticUnknownActionBindingsBySection,
    sectionRowSemanticUnknownBadgeBindingsBySection,
    sectionsMissingStructuredRowSemanticBindings,
    sectionsWithUnknownSemanticActions,
    sectionsWithUnknownSemanticBadges,
    sectionRowsSemanticBound: (
      sectionsMissingStructuredRowSemanticBindings.length === 0
      && sectionsWithUnknownSemanticActions.length === 0
      && sectionsWithUnknownSemanticBadges.length === 0
    ),
    sectionRowIdentitySchemaReady,
    sectionStructuredRowIdCountsBySection,
    sectionRowIdsBySection,
    sectionDuplicateRowIdsBySection,
    sectionsMissingStructuredRowIds,
    sectionRowsStructured: sectionsMissingStructuredRowIds.length === 0,
    sectionsWithDuplicateRowIds,
    sectionRowsDeduplicated: sectionsWithDuplicateRowIds.length === 0,
    sectionEmptyStateVisibleSections,
    sectionsWithoutRowsOrEmptyState,
    sectionCount: Object.values(state?.sections ?? {}).filter(Boolean).length,
    sections: state?.sections ?? {},
    labels: state?.labels ?? {},
    output: payload?.output ?? null,
  }
}

const archivePersistentResult = (payload, reportContent, rawLogContent) => {
  try {
    fs.mkdirSync(persistentHistoryDir, { recursive: true })
    const stamp = sanitizeTimestamp(payload?.generatedAt || new Date().toISOString())
    const summaryPath = path.join(persistentHistoryDir, `${stamp}.json`)
    const reportPath = path.join(persistentHistoryDir, `${stamp}.md`)
    const logPath = path.join(persistentHistoryDir, `${stamp}.log`)
    fs.writeFileSync(summaryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    fs.writeFileSync(reportPath, reportContent, 'utf8')
    fs.writeFileSync(logPath, rawLogContent, 'utf8')
    const summaryFiles = fs.readdirSync(persistentHistoryDir)
      .filter((file) => file.endsWith('.json'))
      .sort()
    const excessFiles = summaryFiles.slice(0, Math.max(0, summaryFiles.length - historyKeepCount))
    excessFiles.forEach((file) => {
      const stem = file.slice(0, -'.json'.length)
      fs.rmSync(path.join(persistentHistoryDir, `${stem}.json`), { force: true })
      fs.rmSync(path.join(persistentHistoryDir, `${stem}.md`), { force: true })
      fs.rmSync(path.join(persistentHistoryDir, `${stem}.log`), { force: true })
    })
  } catch (error) {
    console.error(`[smoke:strategy-activity] 写入历史结果失败: ${persistentHistoryDir}`, error)
  }
}

const readHistoryPayloads = () => {
  try {
    if (!fs.existsSync(persistentHistoryDir)) {
      return []
    }
    return fs.readdirSync(persistentHistoryDir)
      .filter((file) => file.endsWith('.json'))
      .sort()
      .reverse()
      .map((file) => {
        try {
          const raw = fs.readFileSync(path.join(persistentHistoryDir, file), 'utf8').trim()
          if (!raw) {
            return null
          }
          return JSON.parse(raw)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

const findLatestSuccessBaseline = (historyPayloads, latestPayload) => {
  const latestGeneratedAt = latestPayload?.generatedAt ?? null
  return historyPayloads.find((payload) => {
    if (!isSuccessfulBaseline(payload)) {
      return false
    }
    if (latestGeneratedAt && payload?.generatedAt === latestGeneratedAt) {
      return false
    }
    return true
  }) ?? null
}

const findLatestFailureSample = (historyPayloads, latestPayload) => {
  const latestGeneratedAt = latestPayload?.generatedAt ?? null
  return historyPayloads.find((payload) => {
    if (!isFailureSample(payload)) {
      return false
    }
    if (latestGeneratedAt && payload?.generatedAt === latestGeneratedAt) {
      return false
    }
    return true
  }) ?? null
}

const countConsecutiveSuccessfulRuns = (historyPayloads) => {
  let count = 0
  for (const payload of historyPayloads) {
    if (!isSuccessfulBaseline(payload)) {
      break
    }
    count += 1
  }
  return count
}

const buildDeltaSummary = (latestPayload, previousPayload) => {
  if (!latestPayload || !previousPayload) {
    return null
  }
  const latest = buildNormalizedSummary(latestPayload)
  const previous = buildNormalizedSummary(previousPayload)
  return {
    elapsedMs: latest.elapsedMs - previous.elapsedMs,
    sectionCount: latest.sectionCount - previous.sectionCount,
    topRecentActionCount: latest.topRecentActionCount - previous.topRecentActionCount,
    noteCount: latest.noteCount - previous.noteCount,
    queryStatusChanged: latest.queryStatus !== previous.queryStatus,
    fetchStatusChanged: latest.fetchStatus !== previous.fetchStatus,
  }
}

const buildElapsedThresholdWithContentGrowth = (baseThreshold, latest, baseline) => {
  const addedRows = latest && baseline && latest.sectionRowSchemaReady && baseline.sectionRowSchemaReady
    ? requiredActivitySections.reduce(
        (sum, section) => sum + Math.max(0, Number(latest.sectionRowCounts?.[section] ?? 0) - Number(baseline.sectionRowCounts?.[section] ?? 0)),
        0,
      )
    : 0
  const addedRecentActions = latest && baseline
    ? Math.max(0, Number(latest.topRecentActionCount ?? 0) - Number(baseline.topRecentActionCount ?? 0))
    : 0
  return {
    baseElapsedDeltaMs: baseThreshold,
    contentGrowthRowBudgetMs,
    contentGrowthRecentActionBudgetMs,
    addedRows,
    addedRecentActions,
    effectiveElapsedDeltaMs:
      baseThreshold
      + addedRows * contentGrowthRowBudgetMs
      + addedRecentActions * contentGrowthRecentActionBudgetMs,
  }
}

const buildAttentionSummary = (latestPayload, successBaselinePayload) => {
  if (!latestPayload) {
    return {
      status: 'unavailable',
      reasons: [],
      deltaFromLatestSuccessBaseline: null,
    }
  }
  const latest = buildNormalizedSummary(latestPayload)
  const reasons = []

  if (!latest.ok) {
    reasons.push('最新 smoke 未通过')
  }
  if (latest.queryStatus !== 'success') {
    reasons.push(`queryStatus=${latest.queryStatus ?? 'n/a'}`)
  }
  if (latest.sectionCount < 6) {
    reasons.push(`区块就绪不足 ${latest.sectionCount}/6`)
  }
  if (!latest.headTrackButton) {
    reasons.push('头部跟踪按钮缺失')
  }
  if (latest.topRecentActionCount <= 0) {
    reasons.push('顶部 recent 动作缺失')
  }
  if (!latest.topRecentActionsStructured) {
    reasons.push('顶部 recent 动作缺少结构化 key')
  }
  if (!latest.topActionsStructured) {
    reasons.push(`顶部动作缺少结构化 key ${latest.topActionsMissingStructuredKeys.join(', ')}`)
  }
  if (latest.missingRequiredPanelNoteEntryKeys.length) {
    reasons.push(`关键面板提示缺失 ${latest.missingRequiredPanelNoteEntryKeys.join(', ')}`)
  }
  if (!latest.panelNotesStructured) {
    reasons.push(`面板提示存在未结构化项 ${latest.panelNoteTextsWithoutStructuredKeys.join(' / ')}`)
  }
  if (!latest.sectionActionsStructured) {
    reasons.push(`区块动作缺少结构化 key ${latest.sectionsMissingStructuredActionKeys.join(', ')}`)
  }
  if (!latest.sectionBadgesStructured) {
    reasons.push(`区块标签缺少结构化 key ${latest.sectionsMissingStructuredBadgeKeys.join(', ')}`)
  }
  if (!latest.sectionRowsStructured) {
    reasons.push(`区块记录缺少结构化对象 ID ${latest.sectionsMissingStructuredRowIds.join(', ')}`)
  }
  if (!latest.sectionRowsTitled) {
    reasons.push(`区块记录缺少主标题 ${latest.sectionsMissingStructuredRowTitles.join(', ')}`)
  }
  if (!latest.sectionRowsTitleBound) {
    reasons.push(`区块记录缺少对象标题绑定 ${latest.sectionsMissingStructuredRowTitleBindings.join(', ')}`)
  }
  if (!latest.sectionRowsSummaryBound) {
    reasons.push(`区块记录缺少对象摘要绑定 ${latest.sectionsMissingStructuredRowSummaryBindings.join(', ')}`)
  }
  if (!latest.sectionRowsActionBound) {
    reasons.push(`区块记录缺少对象动作绑定 ${latest.sectionsMissingStructuredRowActionBindings.join(', ')}`)
  }
  if (!latest.sectionRowsBadgeBound) {
    reasons.push(`区块记录缺少对象标签绑定 ${latest.sectionsMissingStructuredRowBadgeBindings.join(', ')}`)
  }
  if (!latest.sectionRowsSemanticBound) {
    if (latest.sectionsMissingStructuredRowSemanticBindings.length) {
      reasons.push(`区块记录缺少行级语义指纹 ${latest.sectionsMissingStructuredRowSemanticBindings.join(', ')}`)
    }
    if (latest.sectionsWithUnknownSemanticActions.length) {
      reasons.push(`区块行级语义指纹存在未映射动作 ${latest.sectionsWithUnknownSemanticActions.join(', ')}`)
    }
    if (latest.sectionsWithUnknownSemanticBadges.length) {
      reasons.push(`区块行级语义指纹存在未映射标签 ${latest.sectionsWithUnknownSemanticBadges.join(', ')}`)
    }
  }
  if (!latest.sectionRowsDeduplicated) {
    reasons.push(`区块记录出现重复对象 ID ${latest.sectionsWithDuplicateRowIds.join(', ')}`)
  }
  if (latest.sectionsWithoutRowsOrEmptyState.length) {
    reasons.push(`区块已渲染但既无记录也无空态 ${latest.sectionsWithoutRowsOrEmptyState.join(', ')}`)
  }

  let deltaFromLatestSuccessBaseline = null
  let elapsedThresholds = null
  if (successBaselinePayload) {
    deltaFromLatestSuccessBaseline = buildDeltaSummary(latestPayload, successBaselinePayload)
    elapsedThresholds = buildElapsedThresholdWithContentGrowth(attentionElapsedDeltaMs, latest, buildNormalizedSummary(successBaselinePayload))
    if (deltaFromLatestSuccessBaseline && deltaFromLatestSuccessBaseline.elapsedMs >= elapsedThresholds.effectiveElapsedDeltaMs) {
      reasons.push(`elapsed 相对成功基线增加 ${deltaFromLatestSuccessBaseline.elapsedMs}ms`)
    }
    if (deltaFromLatestSuccessBaseline && deltaFromLatestSuccessBaseline.sectionCount < 0) {
      reasons.push(`sectionCount 相对成功基线下降 ${Math.abs(deltaFromLatestSuccessBaseline.sectionCount)}`)
    }
  }

  return {
    status: reasons.length ? 'attention' : 'stable',
    reasons,
    deltaFromLatestSuccessBaseline,
    thresholds: elapsedThresholds,
  }
}

const buildRegressionSummary = (latestPayload, successBaselinePayload) => {
  if (!latestPayload || !successBaselinePayload) {
    return {
      checked: false,
      ok: true,
      thresholds: {
        elapsedDeltaMs: regressionElapsedDeltaMs,
      },
      reasons: [],
      deltaFromLatestSuccessBaseline: null,
    }
  }

  const latest = buildNormalizedSummary(latestPayload)
  const baseline = buildNormalizedSummary(successBaselinePayload)
  const delta = buildDeltaSummary(latestPayload, successBaselinePayload)
  const elapsedThresholds = buildElapsedThresholdWithContentGrowth(regressionElapsedDeltaMs, latest, baseline)
  const reasons = []

  if (!latest.ok) {
    reasons.push('最新 smoke 未通过')
  }
  if (delta && delta.elapsedMs >= elapsedThresholds.effectiveElapsedDeltaMs) {
    reasons.push(`elapsed 相对成功基线增加 ${delta.elapsedMs}ms`)
  }
  if (delta && delta.sectionCount < 0) {
    reasons.push(`sectionCount 相对成功基线下降 ${Math.abs(delta.sectionCount)}`)
  }
  if (latest.topRecentActionCount <= 0 && baseline.topRecentActionCount > 0) {
    reasons.push('顶部 recent 动作相对成功基线已全部缺失')
  }
  if (baseline.topRecentSchemaReady && baseline.topRecentActionKeys.length > 0 && !latest.topRecentActionsStructured) {
    reasons.push('顶部 recent 动作相对成功基线丢失结构化 key')
  }
  const topActionsMissingStructuredKeys = requiredTopActionGroups.filter((group) => {
    if (!baseline.topActionSchemaReady) {
      return false
    }
    const baselineKeys = baseline.topActionKeysByGroup[group] ?? []
    if (!baselineKeys.length) {
      return false
    }
    const latestKeys = latest.topActionKeysByGroup[group] ?? []
    const latestUnknown = latest.topUnknownActionLabelsByGroup[group] ?? []
    return latestKeys.length === 0 || latestUnknown.length > 0
  })
  if (topActionsMissingStructuredKeys.length) {
    reasons.push(`顶部动作相对成功基线缺失结构化 key ${topActionsMissingStructuredKeys.join(', ')}`)
  }
  const missingRequiredPanelNoteEntryKeys = requiredPanelNoteEntryKeys.filter(
    (key) => baseline.panelNoteSchemaReady && baseline.panelNoteEntryKeys.includes(key) && !latest.panelNoteEntryKeys.includes(key),
  )
  if (missingRequiredPanelNoteEntryKeys.length) {
    reasons.push(`关键面板提示相对成功基线缺失 ${missingRequiredPanelNoteEntryKeys.join(', ')}`)
  }
  const panelNoteTextsWithoutStructuredKeysAdded =
    baseline.panelNoteSchemaReady && latest.panelNoteSchemaReady
      ? buildArrayDelta(latest.panelNoteTextsWithoutStructuredKeys, baseline.panelNoteTextsWithoutStructuredKeys).added
      : []
  if (panelNoteTextsWithoutStructuredKeysAdded.length) {
    reasons.push(`面板提示相对成功基线出现未结构化项 ${panelNoteTextsWithoutStructuredKeysAdded.join(' / ')}`)
  }
  const sectionsMissingStructuredActionKeys = requiredActivitySections.filter((section) => {
    if (!baseline.sectionActionSchemaReady) {
      return false
    }
    if (!sectionHasRows(latest, section)) {
      return false
    }
    const baselineKeys = baseline.sectionActionKeysBySection[section] ?? []
    if (!baselineKeys.length) {
      return false
    }
    const latestKeys = latest.sectionActionKeysBySection[section] ?? []
    const latestUnknown = latest.sectionUnknownActionLabelsBySection[section] ?? []
    return latestKeys.length === 0 || latestUnknown.length > 0
  })
  if (sectionsMissingStructuredActionKeys.length) {
    reasons.push(`区块动作相对成功基线缺失结构化 key ${sectionsMissingStructuredActionKeys.join(', ')}`)
  }
  const sectionsMissingStructuredBadgeKeys = requiredActivitySections.filter((section) => {
    if (!baseline.sectionBadgeSchemaReady) {
      return false
    }
    if (!sectionHasRows(latest, section)) {
      return false
    }
    const baselineKeys = baseline.sectionBadgeKeysBySection[section] ?? []
    if (!baselineKeys.length) {
      return false
    }
    const latestKeys = latest.sectionBadgeKeysBySection[section] ?? []
    const latestUnknown = latest.sectionUnknownBadgeLabelsBySection[section] ?? []
    return latestKeys.length === 0 || latestUnknown.length > 0
  })
  if (sectionsMissingStructuredBadgeKeys.length) {
    reasons.push(`区块标签相对成功基线缺失结构化 key ${sectionsMissingStructuredBadgeKeys.join(', ')}`)
  }
  const sectionsMissingStructuredRowIds = requiredActivitySections.filter((section) => {
    if (!baseline.sectionRowIdentitySchemaReady) {
      return false
    }
    if (!sectionHasRows(latest, section)) {
      return false
    }
    const baselineRowIds = baseline.sectionRowIdsBySection[section] ?? []
    if (!baselineRowIds.length) {
      return false
    }
    const latestRowIds = latest.sectionRowIdsBySection[section] ?? []
    return latestRowIds.length === 0 || latestRowIds.length < Math.min(latest.sectionRowCounts[section] ?? 0, baselineRowIds.length)
  })
  if (sectionsMissingStructuredRowIds.length) {
    reasons.push(`区块记录相对成功基线缺失结构化对象 ID ${sectionsMissingStructuredRowIds.join(', ')}`)
  }
  const sectionsMissingStructuredRowTitles = requiredActivitySections.filter((section) => {
    if (!baseline.sectionRowTitleSchemaReady) {
      return false
    }
    if (!sectionHasRows(latest, section)) {
      return false
    }
    const baselineTitles = baseline.sectionRowTitlesBySection[section] ?? []
    if (!baselineTitles.length) {
      return false
    }
    return (latest.sectionStructuredRowTitleCountsBySection[section] ?? 0) < Math.min(latest.sectionRowCounts[section] ?? 0, baselineTitles.length)
  })
  if (sectionsMissingStructuredRowTitles.length) {
    reasons.push(`区块记录相对成功基线缺少主标题 ${sectionsMissingStructuredRowTitles.join(', ')}`)
  }
  const sectionsMissingStructuredRowTitleBindings = requiredActivitySections.filter((section) => {
    if (!baseline.sectionRowTitleBindingSchemaReady) {
      return false
    }
    if (!sectionHasRows(latest, section)) {
      return false
    }
    const baselineBindings = baseline.sectionRowTitleBindingsBySection[section] ?? []
    if (!baselineBindings.length) {
      return false
    }
    return (latest.sectionStructuredRowTitleBindingCountsBySection[section] ?? 0) < Math.min(latest.sectionRowCounts[section] ?? 0, baselineBindings.length)
  })
  if (sectionsMissingStructuredRowTitleBindings.length) {
    reasons.push(`区块记录相对成功基线缺少对象标题绑定 ${sectionsMissingStructuredRowTitleBindings.join(', ')}`)
  }
  const sectionsMissingStructuredRowSummaryBindings = requiredActivitySections.filter((section) => {
    if (!baseline.sectionRowSummaryBindingSchemaReady) {
      return false
    }
    if (!sectionHasRows(latest, section)) {
      return false
    }
    const baselineSummaries = baseline.sectionRowSummaryBindingsBySection[section] ?? []
    if (!baselineSummaries.length) {
      return false
    }
    return (latest.sectionStructuredRowSummaryBindingCountsBySection[section] ?? 0) < Math.min(latest.sectionRowCounts[section] ?? 0, baselineSummaries.length)
  })
  if (sectionsMissingStructuredRowSummaryBindings.length) {
    reasons.push(`区块记录相对成功基线缺少对象摘要绑定 ${sectionsMissingStructuredRowSummaryBindings.join(', ')}`)
  }
  const sectionsMissingStructuredRowActionBindings = requiredActivitySections.filter((section) => {
    if (!baseline.sectionRowActionBindingSchemaReady) {
      return false
    }
    if (!sectionHasRows(latest, section)) {
      return false
    }
    const baselineActions = baseline.sectionRowActionBindingsBySection[section] ?? []
    if (!baselineActions.length) {
      return false
    }
    return (latest.sectionStructuredRowActionBindingCountsBySection[section] ?? 0) < Math.min(latest.sectionRowCounts[section] ?? 0, baselineActions.length)
  })
  if (sectionsMissingStructuredRowActionBindings.length) {
    reasons.push(`区块记录相对成功基线缺少对象动作绑定 ${sectionsMissingStructuredRowActionBindings.join(', ')}`)
  }
  const sectionsMissingStructuredRowBadgeBindings = requiredActivitySections.filter((section) => {
    if (!baseline.sectionRowBadgeBindingSchemaReady) {
      return false
    }
    if (!sectionHasRows(latest, section)) {
      return false
    }
    const baselineBadgeBindings = baseline.sectionRowBadgeLabelBindingsBySection[section] ?? []
    if (!baselineBadgeBindings.length) {
      return false
    }
    const latestBadgeBindings = latest.sectionRowBadgeLabelBindingsBySection[section] ?? []
    const latestUnknownBadgeBindings = latest.sectionRowUnknownBadgeBindingsBySection[section] ?? []
    return (
      (latest.sectionStructuredRowBadgeBindingCountsBySection[section] ?? 0)
        < Math.min(latestBadgeBindings.length, baselineBadgeBindings.length)
    ) || latestUnknownBadgeBindings.length > 0
  })
  if (sectionsMissingStructuredRowBadgeBindings.length) {
    reasons.push(`区块记录相对成功基线缺少对象标签绑定 ${sectionsMissingStructuredRowBadgeBindings.join(', ')}`)
  }
  const sectionsMissingStructuredRowSemanticBindings = requiredActivitySections.filter((section) => {
    if (!baseline.sectionRowSemanticBindingSchemaReady) {
      return false
    }
    if (!sectionHasRows(latest, section)) {
      return false
    }
    const baselineSemanticBindings = baseline.sectionRowSemanticBindingsBySection[section] ?? []
    if (!baselineSemanticBindings.length) {
      return false
    }
    return (
      latest.sectionStructuredRowSemanticBindingCountsBySection[section] ?? 0
    ) < Math.min(latest.sectionRowCounts[section] ?? 0, baselineSemanticBindings.length)
  })
  if (sectionsMissingStructuredRowSemanticBindings.length) {
    reasons.push(`区块记录相对成功基线缺少行级语义指纹 ${sectionsMissingStructuredRowSemanticBindings.join(', ')}`)
  }
  if (latest.sectionsWithUnknownSemanticActions.length) {
    reasons.push(`区块行级语义指纹相对成功基线出现未映射动作 ${latest.sectionsWithUnknownSemanticActions.join(', ')}`)
  }
  if (latest.sectionsWithUnknownSemanticBadges.length) {
    reasons.push(`区块行级语义指纹相对成功基线出现未映射标签 ${latest.sectionsWithUnknownSemanticBadges.join(', ')}`)
  }
  if (latest.sectionsWithDuplicateRowIds.length) {
    reasons.push(`区块记录出现重复对象 ID ${latest.sectionsWithDuplicateRowIds.join(', ')}`)
  }
  if (latest.sectionsWithoutRowsOrEmptyState.length) {
    reasons.push(`区块已渲染但既无记录也无空态 ${latest.sectionsWithoutRowsOrEmptyState.join(', ')}`)
  }
  if (delta?.queryStatusChanged) {
    reasons.push(`queryStatus 相对成功基线变化 ${baseline.queryStatus ?? 'n/a'} -> ${latest.queryStatus ?? 'n/a'}`)
  }
  if (delta?.fetchStatusChanged) {
    reasons.push(`fetchStatus 相对成功基线变化 ${baseline.fetchStatus ?? 'n/a'} -> ${latest.fetchStatus ?? 'n/a'}`)
  }

  return {
      checked: true,
      ok: reasons.length === 0,
      thresholds: elapsedThresholds,
      reasons,
      deltaFromLatestSuccessBaseline: delta,
    }
}

const buildTrendArtifacts = (historyPayloads) => {
  const recentPayloads = historyPayloads.slice(0, 10)
  const latestPayload = recentPayloads[0] ?? null
  const previousPayload = recentPayloads[1] ?? null
  const successBaselinePayload = findLatestSuccessBaseline(historyPayloads, latestPayload)
  const latestFailureSample = findLatestFailureSample(historyPayloads, latestPayload)
  const consecutiveStableRuns = countConsecutiveSuccessfulRuns(historyPayloads)
  const attention = buildAttentionSummary(latestPayload, successBaselinePayload)
  const regression = buildRegressionSummary(latestPayload, successBaselinePayload)

  const recent = recentPayloads.map((payload) => buildNormalizedSummary(payload))
  const latest = latestPayload ? buildNormalizedSummary(latestPayload) : null
  const previous = previousPayload ? buildNormalizedSummary(previousPayload) : null
  const latestSuccessBaseline = successBaselinePayload ? buildNormalizedSummary(successBaselinePayload) : null
  const previousDelta = buildDeltaSummary(latestPayload, previousPayload)
  const topActionVisibleGroupDeltaFromPrevious =
    latest && previous && latest.topActionVisibilitySchemaReady && previous.topActionVisibilitySchemaReady
      ? buildArrayDelta(latest.topActionVisibleGroups, previous.topActionVisibleGroups)
      : null
  const topRecentActionKeyDeltaFromPrevious =
    latest && previous && latest.topRecentSchemaReady && previous.topRecentSchemaReady
      ? buildArrayDelta(latest.topRecentActionKeys, previous.topRecentActionKeys)
      : null
  const topActionKeyDeltaFromPrevious =
    latest && previous && latest.topActionSchemaReady && previous.topActionSchemaReady
      ? buildTopActionArrayDeltaMap(latest.topActionKeysByGroup, previous.topActionKeysByGroup)
      : null
  const panelNoteEntryKeyDeltaFromPrevious =
    latest && previous && latest.panelNoteSchemaReady && previous.panelNoteSchemaReady
      ? buildArrayDelta(latest.panelNoteEntryKeys, previous.panelNoteEntryKeys)
      : null
  const panelNoteUnstructuredTextDeltaFromPrevious =
    latest && previous && latest.panelNoteSchemaReady && previous.panelNoteSchemaReady
      ? buildArrayDelta(latest.panelNoteTextsWithoutStructuredKeys, previous.panelNoteTextsWithoutStructuredKeys)
      : null
  const sectionActionVisibleSectionDeltaFromPrevious =
    latest && previous && latest.sectionActionVisibilitySchemaReady && previous.sectionActionVisibilitySchemaReady
      ? buildArrayDelta(latest.sectionActionVisibleSections, previous.sectionActionVisibleSections)
      : null
  const sectionActionKeyDeltaFromPrevious =
    latest && previous && latest.sectionActionSchemaReady && previous.sectionActionSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionActionKeysBySection, previous.sectionActionKeysBySection)
      : null
  const sectionBadgeKeyDeltaFromPrevious =
    latest && previous && latest.sectionBadgeSchemaReady && previous.sectionBadgeSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionBadgeKeysBySection, previous.sectionBadgeKeysBySection)
      : null
  const sectionRowCountDeltaFromPrevious =
    latest && previous && latest.sectionRowSchemaReady && previous.sectionRowSchemaReady
      ? buildSectionCountDeltaMap(latest.sectionRowCounts, previous.sectionRowCounts)
      : null
  const sectionRowTitleDeltaFromPrevious =
    latest && previous && latest.sectionRowTitleSchemaReady && previous.sectionRowTitleSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowTitlesBySection, previous.sectionRowTitlesBySection)
      : null
  const sectionRowTitleBindingDeltaFromPrevious =
    latest && previous && latest.sectionRowTitleBindingSchemaReady && previous.sectionRowTitleBindingSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowTitleBindingsBySection, previous.sectionRowTitleBindingsBySection)
      : null
  const sectionRowSummaryBindingDeltaFromPrevious =
    latest && previous && latest.sectionRowSummaryBindingSchemaReady && previous.sectionRowSummaryBindingSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowSummaryBindingsBySection, previous.sectionRowSummaryBindingsBySection)
      : null
  const sectionRowActionBindingDeltaFromPrevious =
    latest && previous && latest.sectionRowActionBindingSchemaReady && previous.sectionRowActionBindingSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowActionBindingsBySection, previous.sectionRowActionBindingsBySection)
      : null
  const sectionRowBadgeBindingDeltaFromPrevious =
    latest && previous && latest.sectionRowBadgeBindingSchemaReady && previous.sectionRowBadgeBindingSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowBadgeBindingsBySection, previous.sectionRowBadgeBindingsBySection)
      : null
  const sectionRowUnknownBadgeBindingDeltaFromPrevious =
    latest && previous && latest.sectionRowBadgeBindingSchemaReady && previous.sectionRowBadgeBindingSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowUnknownBadgeBindingsBySection, previous.sectionRowUnknownBadgeBindingsBySection)
      : null
  const sectionRowSemanticBindingDeltaFromPrevious =
    latest && previous && latest.sectionRowSemanticBindingSchemaReady && previous.sectionRowSemanticBindingSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowSemanticBindingsBySection, previous.sectionRowSemanticBindingsBySection)
      : null
  const sectionRowSemanticUnknownActionBindingDeltaFromPrevious =
    latest && previous && latest.sectionRowSemanticBindingSchemaReady && previous.sectionRowSemanticBindingSchemaReady
      ? buildSectionArrayDeltaMap(
        latest.sectionRowSemanticUnknownActionBindingsBySection,
        previous.sectionRowSemanticUnknownActionBindingsBySection,
      )
      : null
  const sectionRowSemanticUnknownBadgeBindingDeltaFromPrevious =
    latest && previous && latest.sectionRowSemanticBindingSchemaReady && previous.sectionRowSemanticBindingSchemaReady
      ? buildSectionArrayDeltaMap(
        latest.sectionRowSemanticUnknownBadgeBindingsBySection,
        previous.sectionRowSemanticUnknownBadgeBindingsBySection,
      )
      : null
  const sectionRowIdDeltaFromPrevious =
    latest && previous && latest.sectionRowIdentitySchemaReady && previous.sectionRowIdentitySchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowIdsBySection, previous.sectionRowIdsBySection)
      : null
  const sectionDuplicateRowIdDeltaFromPrevious =
    latest && previous && latest.sectionRowIdentitySchemaReady && previous.sectionRowIdentitySchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionDuplicateRowIdsBySection, previous.sectionDuplicateRowIdsBySection)
      : null
  const sectionEmptyStateVisibleSectionDeltaFromPrevious =
    latest && previous && latest.sectionRowSchemaReady && previous.sectionRowSchemaReady
      ? buildArrayDelta(latest.sectionEmptyStateVisibleSections, previous.sectionEmptyStateVisibleSections)
      : null
  const sectionRowOrderOnlyChangedFromPrevious =
    latest && previous && latest.sectionRowIdentitySchemaReady && previous.sectionRowIdentitySchemaReady
      ? buildSectionOrderOnlyChangeList(latest.sectionRowIdsBySection, previous.sectionRowIdsBySection)
      : []
  const topActionVisibleGroupDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.topActionVisibilitySchemaReady && latestSuccessBaseline.topActionVisibilitySchemaReady
      ? buildArrayDelta(latest.topActionVisibleGroups, latestSuccessBaseline.topActionVisibleGroups)
      : null
  const topRecentActionKeyDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.topRecentSchemaReady && latestSuccessBaseline.topRecentSchemaReady
      ? buildArrayDelta(latest.topRecentActionKeys, latestSuccessBaseline.topRecentActionKeys)
      : null
  const topActionKeyDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.topActionSchemaReady && latestSuccessBaseline.topActionSchemaReady
      ? buildTopActionArrayDeltaMap(latest.topActionKeysByGroup, latestSuccessBaseline.topActionKeysByGroup)
      : null
  const panelNoteEntryKeyDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.panelNoteSchemaReady && latestSuccessBaseline.panelNoteSchemaReady
      ? buildArrayDelta(latest.panelNoteEntryKeys, latestSuccessBaseline.panelNoteEntryKeys)
      : null
  const panelNoteUnstructuredTextDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.panelNoteSchemaReady && latestSuccessBaseline.panelNoteSchemaReady
      ? buildArrayDelta(latest.panelNoteTextsWithoutStructuredKeys, latestSuccessBaseline.panelNoteTextsWithoutStructuredKeys)
      : null
  const sectionActionVisibleSectionDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionActionVisibilitySchemaReady && latestSuccessBaseline.sectionActionVisibilitySchemaReady
      ? buildArrayDelta(latest.sectionActionVisibleSections, latestSuccessBaseline.sectionActionVisibleSections)
      : null
  const sectionActionKeyDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionActionSchemaReady && latestSuccessBaseline.sectionActionSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionActionKeysBySection, latestSuccessBaseline.sectionActionKeysBySection)
      : null
  const sectionBadgeKeyDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionBadgeSchemaReady && latestSuccessBaseline.sectionBadgeSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionBadgeKeysBySection, latestSuccessBaseline.sectionBadgeKeysBySection)
      : null
  const sectionRowCountDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionRowSchemaReady && latestSuccessBaseline.sectionRowSchemaReady
      ? buildSectionCountDeltaMap(latest.sectionRowCounts, latestSuccessBaseline.sectionRowCounts)
      : null
  const sectionRowTitleDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionRowTitleSchemaReady && latestSuccessBaseline.sectionRowTitleSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowTitlesBySection, latestSuccessBaseline.sectionRowTitlesBySection)
      : null
  const sectionRowTitleBindingDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionRowTitleBindingSchemaReady && latestSuccessBaseline.sectionRowTitleBindingSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowTitleBindingsBySection, latestSuccessBaseline.sectionRowTitleBindingsBySection)
      : null
  const sectionRowSummaryBindingDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionRowSummaryBindingSchemaReady && latestSuccessBaseline.sectionRowSummaryBindingSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowSummaryBindingsBySection, latestSuccessBaseline.sectionRowSummaryBindingsBySection)
      : null
  const sectionRowActionBindingDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionRowActionBindingSchemaReady && latestSuccessBaseline.sectionRowActionBindingSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowActionBindingsBySection, latestSuccessBaseline.sectionRowActionBindingsBySection)
      : null
  const sectionRowBadgeBindingDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionRowBadgeBindingSchemaReady && latestSuccessBaseline.sectionRowBadgeBindingSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowBadgeBindingsBySection, latestSuccessBaseline.sectionRowBadgeBindingsBySection)
      : null
  const sectionRowUnknownBadgeBindingDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionRowBadgeBindingSchemaReady && latestSuccessBaseline.sectionRowBadgeBindingSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowUnknownBadgeBindingsBySection, latestSuccessBaseline.sectionRowUnknownBadgeBindingsBySection)
      : null
  const sectionRowSemanticBindingDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionRowSemanticBindingSchemaReady && latestSuccessBaseline.sectionRowSemanticBindingSchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowSemanticBindingsBySection, latestSuccessBaseline.sectionRowSemanticBindingsBySection)
      : null
  const sectionRowSemanticUnknownActionBindingDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionRowSemanticBindingSchemaReady && latestSuccessBaseline.sectionRowSemanticBindingSchemaReady
      ? buildSectionArrayDeltaMap(
        latest.sectionRowSemanticUnknownActionBindingsBySection,
        latestSuccessBaseline.sectionRowSemanticUnknownActionBindingsBySection,
      )
      : null
  const sectionRowSemanticUnknownBadgeBindingDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionRowSemanticBindingSchemaReady && latestSuccessBaseline.sectionRowSemanticBindingSchemaReady
      ? buildSectionArrayDeltaMap(
        latest.sectionRowSemanticUnknownBadgeBindingsBySection,
        latestSuccessBaseline.sectionRowSemanticUnknownBadgeBindingsBySection,
      )
      : null
  const sectionRowIdDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionRowIdentitySchemaReady && latestSuccessBaseline.sectionRowIdentitySchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionRowIdsBySection, latestSuccessBaseline.sectionRowIdsBySection)
      : null
  const sectionDuplicateRowIdDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionRowIdentitySchemaReady && latestSuccessBaseline.sectionRowIdentitySchemaReady
      ? buildSectionArrayDeltaMap(latest.sectionDuplicateRowIdsBySection, latestSuccessBaseline.sectionDuplicateRowIdsBySection)
      : null
  const sectionEmptyStateVisibleSectionDeltaFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionRowSchemaReady && latestSuccessBaseline.sectionRowSchemaReady
      ? buildArrayDelta(latest.sectionEmptyStateVisibleSections, latestSuccessBaseline.sectionEmptyStateVisibleSections)
      : null
  const sectionRowOrderOnlyChangedFromLatestSuccessBaseline =
    latest && latestSuccessBaseline && latest.sectionRowIdentitySchemaReady && latestSuccessBaseline.sectionRowIdentitySchemaReady
      ? buildSectionOrderOnlyChangeList(latest.sectionRowIdsBySection, latestSuccessBaseline.sectionRowIdsBySection)
      : []

  const trendSummary = {
    generatedAt: latest?.generatedAt ?? null,
    significantElapsedDeltaMs,
    attentionElapsedDeltaMs,
    attentionStatus: attention.status,
    attentionReasons: attention.reasons,
    consecutiveStableRuns,
    recent,
    latestSuccessBaseline,
    deltaFromLatestSuccessBaseline: attention.deltaFromLatestSuccessBaseline,
    deltaFromPrevious: previousDelta,
    topActionVisibleGroupDeltaFromPrevious,
    topRecentActionKeyDeltaFromPrevious,
    topActionKeyDeltaFromPrevious,
    panelNoteEntryKeyDeltaFromPrevious,
    panelNoteUnstructuredTextDeltaFromPrevious,
    sectionActionVisibleSectionDeltaFromPrevious,
    sectionActionKeyDeltaFromPrevious,
    sectionBadgeKeyDeltaFromPrevious,
    sectionRowCountDeltaFromPrevious,
    sectionRowTitleDeltaFromPrevious,
    sectionRowTitleBindingDeltaFromPrevious,
    sectionRowSummaryBindingDeltaFromPrevious,
    sectionRowActionBindingDeltaFromPrevious,
    sectionRowBadgeBindingDeltaFromPrevious,
    sectionRowUnknownBadgeBindingDeltaFromPrevious,
    sectionRowSemanticBindingDeltaFromPrevious,
    sectionRowSemanticUnknownActionBindingDeltaFromPrevious,
    sectionRowSemanticUnknownBadgeBindingDeltaFromPrevious,
    sectionRowIdDeltaFromPrevious,
    sectionDuplicateRowIdDeltaFromPrevious,
    sectionEmptyStateVisibleSectionDeltaFromPrevious,
    sectionRowOrderOnlyChangedFromPrevious,
    topActionVisibleGroupDeltaFromLatestSuccessBaseline,
    topRecentActionKeyDeltaFromLatestSuccessBaseline,
    topActionKeyDeltaFromLatestSuccessBaseline,
    panelNoteEntryKeyDeltaFromLatestSuccessBaseline,
    panelNoteUnstructuredTextDeltaFromLatestSuccessBaseline,
    sectionActionVisibleSectionDeltaFromLatestSuccessBaseline,
    sectionActionKeyDeltaFromLatestSuccessBaseline,
    sectionBadgeKeyDeltaFromLatestSuccessBaseline,
    sectionRowCountDeltaFromLatestSuccessBaseline,
    sectionRowTitleDeltaFromLatestSuccessBaseline,
    sectionRowTitleBindingDeltaFromLatestSuccessBaseline,
    sectionRowSummaryBindingDeltaFromLatestSuccessBaseline,
    sectionRowActionBindingDeltaFromLatestSuccessBaseline,
    sectionRowBadgeBindingDeltaFromLatestSuccessBaseline,
    sectionRowUnknownBadgeBindingDeltaFromLatestSuccessBaseline,
    sectionRowSemanticBindingDeltaFromLatestSuccessBaseline,
    sectionRowSemanticUnknownActionBindingDeltaFromLatestSuccessBaseline,
    sectionRowSemanticUnknownBadgeBindingDeltaFromLatestSuccessBaseline,
    sectionRowIdDeltaFromLatestSuccessBaseline,
    sectionDuplicateRowIdDeltaFromLatestSuccessBaseline,
    sectionEmptyStateVisibleSectionDeltaFromLatestSuccessBaseline,
    sectionRowOrderOnlyChangedFromLatestSuccessBaseline,
    latestFailureSample: latestFailureSample ? buildNormalizedSummary(latestFailureSample) : null,
    regression,
  }

  const lines = [
    '# 策略活动 smoke 趋势',
    '',
    `- 历史样本数：${historyPayloads.length}`,
    `- 展示最近：${recent.length} 次`,
    `- 当前关注：${attention.status === 'attention' ? '需关注' : attention.status === 'stable' ? '稳定' : '不可用'}`,
    `- 成功基线：${latestSuccessBaseline?.generatedAt ?? 'n/a'}`,
    `- 距上次失败连续通过：${consecutiveStableRuns} 次`,
    '',
  ]

  if (attention.reasons.length) {
    lines.push('## 关注原因', '')
    attention.reasons.slice(0, 5).forEach((reason) => {
      lines.push(`- ${reason}`)
    })
    lines.push('')
  }

  if (trendSummary.latestFailureSample) {
    const failure = trendSummary.latestFailureSample
    lines.push('## 最近失败样本', '')
    lines.push(`- 时间：${failure.generatedAt ?? 'n/a'}`)
    lines.push(`- 面板耗时：${failure.elapsedMs}ms`)
    lines.push(`- 当前策略：${failure.selectedStrategyName ?? 'n/a'}`)
    lines.push(`- 区块就绪：${failure.sectionCount}/6`)
    lines.push(`- 查询状态：${failure.queryStatus ?? 'n/a'} / ${failure.fetchStatus ?? 'n/a'}`)
    lines.push('')
  }

  if (latest && previousDelta) {
    lines.push('## 最近两次对比', '')
    lines.push(`- 最新：${latest.generatedAt ?? 'n/a'}`)
    lines.push(`- 上次：${previous?.generatedAt ?? 'n/a'}`)
    lines.push(`- elapsed：${previous?.elapsedMs ?? 0}ms -> ${latest.elapsedMs}ms (${previousDelta.elapsedMs >= 0 ? '+' : ''}${previousDelta.elapsedMs}ms)`)
    lines.push(`- 区块就绪：${previous?.sectionCount ?? 0} -> ${latest.sectionCount} (${previousDelta.sectionCount >= 0 ? '+' : ''}${previousDelta.sectionCount})`)
    lines.push(`- topRecent：${previous?.topRecentActionCount ?? 0} -> ${latest.topRecentActionCount} (${previousDelta.topRecentActionCount >= 0 ? '+' : ''}${previousDelta.topRecentActionCount})`)
    lines.push(`- notes：${previous?.noteCount ?? 0} -> ${latest.noteCount} (${previousDelta.noteCount >= 0 ? '+' : ''}${previousDelta.noteCount})`)
    lines.push('')
  }

  if (latest) {
    lines.push('## 当前结构化状态', '')
    lines.push(`- 顶部 recent 结构化 key：${latest.topRecentActionsStructured ? 'ok' : 'missing'}`)
    lines.push(`- 顶部 recent key 列表：${formatKeyList(latest.topRecentActionKeys)}`)
    lines.push(`- 顶部动作结构化：${latest.topActionsStructured ? 'ok' : `missing (${latest.topActionsMissingStructuredKeys.join(', ')})`}`)
    lines.push(`- 顶部已渲染动作组：${formatKeyList(latest.topActionVisibleGroups)}`)
    lines.push('- 顶部动作 key：')
    lines.push(formatTopActionKeyMap(latest.topActionKeysByGroup))
    if (requiredTopActionGroups.some((group) => (latest.topUnknownActionLabelsByGroup[group] ?? []).length)) {
      lines.push('- 顶部未知动作标签：')
      lines.push(formatTopActionKeyMap(latest.topUnknownActionLabelsByGroup))
    }
    lines.push(`- 面板提示 key 列表：${formatKeyList(latest.panelNoteEntryKeys)}`)
    lines.push(
      `- 关键面板提示缺失：${latest.missingRequiredPanelNoteEntryKeys.length ? latest.missingRequiredPanelNoteEntryKeys.join(', ') : '无'}`,
    )
    lines.push(
      `- 面板提示结构化：${latest.panelNotesStructured ? 'ok' : `missing (${latest.panelNoteTextsWithoutStructuredKeys.join(' / ')})`}`,
    )
    lines.push(`- 区块动作结构化：${latest.sectionActionsStructured ? 'ok' : `missing (${latest.sectionsMissingStructuredActionKeys.join(', ')})`}`)
    lines.push(`- 已渲染动作区块：${formatKeyList(latest.sectionActionVisibleSections)}`)
    lines.push('- 区块动作 key：')
    lines.push(formatSectionKeyMap(latest.sectionActionKeysBySection))
    lines.push(`- 区块标签结构化：${latest.sectionBadgesStructured ? 'ok' : `missing (${latest.sectionsMissingStructuredBadgeKeys.join(', ')})`}`)
    lines.push(`- 区块记录主标题结构化：${latest.sectionRowsTitled ? 'ok' : `missing (${latest.sectionsMissingStructuredRowTitles.join(', ')})`}`)
    lines.push(`- 区块对象标题绑定结构化：${latest.sectionRowsTitleBound ? 'ok' : `missing (${latest.sectionsMissingStructuredRowTitleBindings.join(', ')})`}`)
    lines.push(`- 区块对象摘要绑定结构化：${latest.sectionRowsSummaryBound ? 'ok' : `missing (${latest.sectionsMissingStructuredRowSummaryBindings.join(', ')})`}`)
    lines.push(`- 区块对象动作绑定结构化：${latest.sectionRowsActionBound ? 'ok' : `missing (${latest.sectionsMissingStructuredRowActionBindings.join(', ')})`}`)
    lines.push(`- 区块对象标签绑定结构化：${latest.sectionRowsBadgeBound ? 'ok' : `missing (${latest.sectionsMissingStructuredRowBadgeBindings.join(', ')})`}`)
    lines.push(`- 区块行级语义指纹结构化：${
      latest.sectionRowsSemanticBound
        ? 'ok'
        : [
          latest.sectionsMissingStructuredRowSemanticBindings.length
            ? `missing (${latest.sectionsMissingStructuredRowSemanticBindings.join(', ')})`
            : null,
          latest.sectionsWithUnknownSemanticActions.length
            ? `unknown_actions (${latest.sectionsWithUnknownSemanticActions.join(', ')})`
            : null,
          latest.sectionsWithUnknownSemanticBadges.length
            ? `unknown_badges (${latest.sectionsWithUnknownSemanticBadges.join(', ')})`
            : null,
        ].filter(Boolean).join('；')
    }`)
    lines.push(`- 区块行级语义指纹未映射动作：${formatKeyList(latest.sectionsWithUnknownSemanticActions)}`)
    lines.push(`- 区块行级语义指纹未映射标签：${formatKeyList(latest.sectionsWithUnknownSemanticBadges)}`)
    lines.push(`- 区块记录对象结构化：${latest.sectionRowsStructured ? 'ok' : `missing (${latest.sectionsMissingStructuredRowIds.join(', ')})`}`)
    lines.push(`- 区块记录去重：${latest.sectionRowsDeduplicated ? 'ok' : `duplicated (${latest.sectionsWithDuplicateRowIds.join(', ')})`}`)
    lines.push(`- 区块记录数：`)
    lines.push(formatSectionCountMap(latest.sectionRowCounts))
    lines.push('- 区块主标题：')
    lines.push(formatSectionKeyMap(latest.sectionRowTitlesBySection))
    lines.push('- 区块对象标题绑定：')
    lines.push(formatSectionKeyMap(latest.sectionRowTitleBindingsBySection))
    lines.push('- 区块对象摘要绑定：')
    lines.push(formatSectionKeyMap(latest.sectionRowSummaryBindingsBySection))
    lines.push('- 区块对象动作绑定：')
    lines.push(formatSectionKeyMap(latest.sectionRowActionBindingsBySection))
    lines.push('- 区块对象标签绑定：')
    lines.push(formatSectionKeyMap(latest.sectionRowBadgeBindingsBySection))
    lines.push('- 区块行级语义指纹：')
    lines.push(formatSectionKeyMap(latest.sectionRowSemanticBindingsBySection))
    if (requiredActivitySections.some((section) => (latest.sectionRowSemanticUnknownActionBindingsBySection[section] ?? []).length)) {
      lines.push('- 区块行级语义指纹未映射动作：')
      lines.push(formatSectionKeyMap(latest.sectionRowSemanticUnknownActionBindingsBySection))
    }
    if (requiredActivitySections.some((section) => (latest.sectionRowSemanticUnknownBadgeBindingsBySection[section] ?? []).length)) {
      lines.push('- 区块行级语义指纹未映射标签：')
      lines.push(formatSectionKeyMap(latest.sectionRowSemanticUnknownBadgeBindingsBySection))
    }
    lines.push('- 区块对象 ID：')
    lines.push(formatSectionKeyMap(latest.sectionRowIdsBySection))
    lines.push('- 区块重复对象 ID：')
    lines.push(formatSectionKeyMap(latest.sectionDuplicateRowIdsBySection))
    lines.push(`- 空态区块：${formatKeyList(latest.sectionEmptyStateVisibleSections)}`)
    lines.push(`- 区块内容异常：${latest.sectionsWithoutRowsOrEmptyState.length ? latest.sectionsWithoutRowsOrEmptyState.join(', ') : '无'}`)
    lines.push('- 区块标签 key：')
    lines.push(formatSectionKeyMap(latest.sectionBadgeKeysBySection))
    if (requiredActivitySections.some((section) => (latest.sectionUnknownActionLabelsBySection[section] ?? []).length)) {
      lines.push('- 区块未知动作标签：')
      lines.push(formatSectionKeyMap(latest.sectionUnknownActionLabelsBySection))
    }
    if (requiredActivitySections.some((section) => (latest.sectionUnknownBadgeLabelsBySection[section] ?? []).length)) {
      lines.push('- 区块未知标签：')
      lines.push(formatSectionKeyMap(latest.sectionUnknownBadgeLabelsBySection))
    }
    if (requiredActivitySections.some((section) => (latest.sectionRowUnknownBadgeBindingsBySection[section] ?? []).length)) {
      lines.push('- 区块对象未知标签绑定：')
      lines.push(formatSectionKeyMap(latest.sectionRowUnknownBadgeBindingsBySection))
    }
    lines.push('')
  }

  if (
    topActionVisibleGroupDeltaFromPrevious
    || topRecentActionKeyDeltaFromPrevious
    || topActionKeyDeltaFromPrevious
    || panelNoteEntryKeyDeltaFromPrevious
    || panelNoteUnstructuredTextDeltaFromPrevious
    || sectionActionVisibleSectionDeltaFromPrevious
    || sectionActionKeyDeltaFromPrevious
    || sectionRowCountDeltaFromPrevious
    || sectionRowTitleDeltaFromPrevious
    || sectionRowTitleBindingDeltaFromPrevious
    || sectionRowSummaryBindingDeltaFromPrevious
    || sectionRowActionBindingDeltaFromPrevious
    || sectionRowBadgeBindingDeltaFromPrevious
    || sectionRowUnknownBadgeBindingDeltaFromPrevious
    || sectionRowSemanticBindingDeltaFromPrevious
    || sectionRowIdDeltaFromPrevious
    || sectionDuplicateRowIdDeltaFromPrevious
    || sectionEmptyStateVisibleSectionDeltaFromPrevious
  ) {
    lines.push('## 最近结构化变化', '')
    lines.push(`- 顶部动作组新增：${formatKeyList(topActionVisibleGroupDeltaFromPrevious?.added)}`)
    lines.push(`- 顶部动作组移除：${formatKeyList(topActionVisibleGroupDeltaFromPrevious?.removed)}`)
    lines.push(
      `- 顶部 recent key 新增：${formatKeyList(topRecentActionKeyDeltaFromPrevious?.added)}`,
    )
    lines.push(
      `- 顶部 recent key 移除：${formatKeyList(topRecentActionKeyDeltaFromPrevious?.removed)}`,
    )
    lines.push('- 顶部动作 key 新增：')
    lines.push(formatTopActionDeltaMap(topActionKeyDeltaFromPrevious, 'added'))
    lines.push('- 顶部动作 key 移除：')
    lines.push(formatTopActionDeltaMap(topActionKeyDeltaFromPrevious, 'removed'))
    lines.push(
      `- 面板提示 key 新增：${formatKeyList(panelNoteEntryKeyDeltaFromPrevious?.added)}`,
    )
    lines.push(
      `- 面板提示 key 移除：${formatKeyList(panelNoteEntryKeyDeltaFromPrevious?.removed)}`,
    )
    lines.push(
      `- 面板未结构化提示新增：${formatKeyList(panelNoteUnstructuredTextDeltaFromPrevious?.added)}`,
    )
    lines.push(
      `- 面板未结构化提示移除：${formatKeyList(panelNoteUnstructuredTextDeltaFromPrevious?.removed)}`,
    )
    lines.push(`- 动作区块新增：${formatKeyList(sectionActionVisibleSectionDeltaFromPrevious?.added)}`)
    lines.push(`- 动作区块移除：${formatKeyList(sectionActionVisibleSectionDeltaFromPrevious?.removed)}`)
    lines.push('- 区块动作 key 新增：')
    lines.push(formatSectionDeltaMap(sectionActionKeyDeltaFromPrevious, 'added'))
    lines.push('- 区块动作 key 移除：')
    lines.push(formatSectionDeltaMap(sectionActionKeyDeltaFromPrevious, 'removed'))
    lines.push('- 区块标签 key 新增：')
    lines.push(formatSectionDeltaMap(sectionBadgeKeyDeltaFromPrevious, 'added'))
    lines.push('- 区块标签 key 移除：')
    lines.push(formatSectionDeltaMap(sectionBadgeKeyDeltaFromPrevious, 'removed'))
    lines.push('- 区块记录数变化：')
    lines.push(formatSectionCountDeltaMap(sectionRowCountDeltaFromPrevious))
    lines.push('- 区块主标题新增：')
    lines.push(formatSectionDeltaMap(sectionRowTitleDeltaFromPrevious, 'added'))
    lines.push('- 区块主标题移除：')
    lines.push(formatSectionDeltaMap(sectionRowTitleDeltaFromPrevious, 'removed'))
    lines.push('- 区块对象标题绑定新增：')
    lines.push(formatSectionDeltaMap(sectionRowTitleBindingDeltaFromPrevious, 'added'))
    lines.push('- 区块对象标题绑定移除：')
    lines.push(formatSectionDeltaMap(sectionRowTitleBindingDeltaFromPrevious, 'removed'))
    lines.push('- 区块对象摘要绑定新增：')
    lines.push(formatSectionDeltaMap(sectionRowSummaryBindingDeltaFromPrevious, 'added'))
    lines.push('- 区块对象摘要绑定移除：')
    lines.push(formatSectionDeltaMap(sectionRowSummaryBindingDeltaFromPrevious, 'removed'))
    lines.push('- 区块对象动作绑定新增：')
    lines.push(formatSectionDeltaMap(sectionRowActionBindingDeltaFromPrevious, 'added'))
    lines.push('- 区块对象动作绑定移除：')
    lines.push(formatSectionDeltaMap(sectionRowActionBindingDeltaFromPrevious, 'removed'))
    lines.push('- 区块对象标签绑定新增：')
    lines.push(formatSectionDeltaMap(sectionRowBadgeBindingDeltaFromPrevious, 'added'))
    lines.push('- 区块对象标签绑定移除：')
    lines.push(formatSectionDeltaMap(sectionRowBadgeBindingDeltaFromPrevious, 'removed'))
    lines.push('- 区块对象未知标签绑定新增：')
    lines.push(formatSectionDeltaMap(sectionRowUnknownBadgeBindingDeltaFromPrevious, 'added'))
    lines.push('- 区块对象未知标签绑定移除：')
    lines.push(formatSectionDeltaMap(sectionRowUnknownBadgeBindingDeltaFromPrevious, 'removed'))
    lines.push('- 区块行级语义指纹新增：')
    lines.push(formatSectionDeltaMap(sectionRowSemanticBindingDeltaFromPrevious, 'added'))
    lines.push('- 区块行级语义指纹移除：')
    lines.push(formatSectionDeltaMap(sectionRowSemanticBindingDeltaFromPrevious, 'removed'))
    lines.push('- 区块行级语义指纹未映射动作新增：')
    lines.push(formatSectionDeltaMap(sectionRowSemanticUnknownActionBindingDeltaFromPrevious, 'added'))
    lines.push('- 区块行级语义指纹未映射动作移除：')
    lines.push(formatSectionDeltaMap(sectionRowSemanticUnknownActionBindingDeltaFromPrevious, 'removed'))
    lines.push('- 区块行级语义指纹未映射标签新增：')
    lines.push(formatSectionDeltaMap(sectionRowSemanticUnknownBadgeBindingDeltaFromPrevious, 'added'))
    lines.push('- 区块行级语义指纹未映射标签移除：')
    lines.push(formatSectionDeltaMap(sectionRowSemanticUnknownBadgeBindingDeltaFromPrevious, 'removed'))
    lines.push('- 区块对象 ID 新增：')
    lines.push(formatSectionDeltaMap(sectionRowIdDeltaFromPrevious, 'added'))
    lines.push('- 区块对象 ID 移除：')
    lines.push(formatSectionDeltaMap(sectionRowIdDeltaFromPrevious, 'removed'))
    lines.push('- 区块重复对象 ID 新增：')
    lines.push(formatSectionDeltaMap(sectionDuplicateRowIdDeltaFromPrevious, 'added'))
    lines.push('- 区块重复对象 ID 移除：')
    lines.push(formatSectionDeltaMap(sectionDuplicateRowIdDeltaFromPrevious, 'removed'))
    lines.push(`- 区块对象顺序变化：${formatKeyList(sectionRowOrderOnlyChangedFromPrevious)}`)
    lines.push(`- 空态区块新增：${formatKeyList(sectionEmptyStateVisibleSectionDeltaFromPrevious?.added)}`)
    lines.push(`- 空态区块移除：${formatKeyList(sectionEmptyStateVisibleSectionDeltaFromPrevious?.removed)}`)
    lines.push('')
  }

  if (
    topActionVisibleGroupDeltaFromLatestSuccessBaseline
    || topRecentActionKeyDeltaFromLatestSuccessBaseline
    || topActionKeyDeltaFromLatestSuccessBaseline
    || panelNoteEntryKeyDeltaFromLatestSuccessBaseline
    || panelNoteUnstructuredTextDeltaFromLatestSuccessBaseline
    || sectionActionVisibleSectionDeltaFromLatestSuccessBaseline
    || sectionActionKeyDeltaFromLatestSuccessBaseline
    || sectionRowCountDeltaFromLatestSuccessBaseline
    || sectionRowTitleDeltaFromLatestSuccessBaseline
    || sectionRowTitleBindingDeltaFromLatestSuccessBaseline
    || sectionRowSummaryBindingDeltaFromLatestSuccessBaseline
    || sectionRowActionBindingDeltaFromLatestSuccessBaseline
    || sectionRowBadgeBindingDeltaFromLatestSuccessBaseline
    || sectionRowUnknownBadgeBindingDeltaFromLatestSuccessBaseline
    || sectionRowSemanticBindingDeltaFromLatestSuccessBaseline
    || sectionRowIdDeltaFromLatestSuccessBaseline
    || sectionDuplicateRowIdDeltaFromLatestSuccessBaseline
    || sectionEmptyStateVisibleSectionDeltaFromLatestSuccessBaseline
  ) {
    lines.push('## 相对成功基线的结构化变化', '')
    lines.push(`- 顶部动作组新增：${formatKeyList(topActionVisibleGroupDeltaFromLatestSuccessBaseline?.added)}`)
    lines.push(`- 顶部动作组移除：${formatKeyList(topActionVisibleGroupDeltaFromLatestSuccessBaseline?.removed)}`)
    lines.push(
      `- 顶部 recent key 新增：${formatKeyList(topRecentActionKeyDeltaFromLatestSuccessBaseline?.added)}`,
    )
    lines.push(
      `- 顶部 recent key 移除：${formatKeyList(topRecentActionKeyDeltaFromLatestSuccessBaseline?.removed)}`,
    )
    lines.push('- 顶部动作 key 新增：')
    lines.push(formatTopActionDeltaMap(topActionKeyDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 顶部动作 key 移除：')
    lines.push(formatTopActionDeltaMap(topActionKeyDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push(
      `- 面板提示 key 新增：${formatKeyList(panelNoteEntryKeyDeltaFromLatestSuccessBaseline?.added)}`,
    )
    lines.push(
      `- 面板提示 key 移除：${formatKeyList(panelNoteEntryKeyDeltaFromLatestSuccessBaseline?.removed)}`,
    )
    lines.push(
      `- 面板未结构化提示新增：${formatKeyList(panelNoteUnstructuredTextDeltaFromLatestSuccessBaseline?.added)}`,
    )
    lines.push(
      `- 面板未结构化提示移除：${formatKeyList(panelNoteUnstructuredTextDeltaFromLatestSuccessBaseline?.removed)}`,
    )
    lines.push(`- 动作区块新增：${formatKeyList(sectionActionVisibleSectionDeltaFromLatestSuccessBaseline?.added)}`)
    lines.push(`- 动作区块移除：${formatKeyList(sectionActionVisibleSectionDeltaFromLatestSuccessBaseline?.removed)}`)
    lines.push('- 区块动作 key 新增：')
    lines.push(formatSectionDeltaMap(sectionActionKeyDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 区块动作 key 移除：')
    lines.push(formatSectionDeltaMap(sectionActionKeyDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push('- 区块标签 key 新增：')
    lines.push(formatSectionDeltaMap(sectionBadgeKeyDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 区块标签 key 移除：')
    lines.push(formatSectionDeltaMap(sectionBadgeKeyDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push('- 区块记录数变化：')
    lines.push(formatSectionCountDeltaMap(sectionRowCountDeltaFromLatestSuccessBaseline))
    lines.push('- 区块主标题新增：')
    lines.push(formatSectionDeltaMap(sectionRowTitleDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 区块主标题移除：')
    lines.push(formatSectionDeltaMap(sectionRowTitleDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push('- 区块对象标题绑定新增：')
    lines.push(formatSectionDeltaMap(sectionRowTitleBindingDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 区块对象标题绑定移除：')
    lines.push(formatSectionDeltaMap(sectionRowTitleBindingDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push('- 区块对象摘要绑定新增：')
    lines.push(formatSectionDeltaMap(sectionRowSummaryBindingDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 区块对象摘要绑定移除：')
    lines.push(formatSectionDeltaMap(sectionRowSummaryBindingDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push('- 区块对象动作绑定新增：')
    lines.push(formatSectionDeltaMap(sectionRowActionBindingDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 区块对象动作绑定移除：')
    lines.push(formatSectionDeltaMap(sectionRowActionBindingDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push('- 区块对象标签绑定新增：')
    lines.push(formatSectionDeltaMap(sectionRowBadgeBindingDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 区块对象标签绑定移除：')
    lines.push(formatSectionDeltaMap(sectionRowBadgeBindingDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push('- 区块对象未知标签绑定新增：')
    lines.push(formatSectionDeltaMap(sectionRowUnknownBadgeBindingDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 区块对象未知标签绑定移除：')
    lines.push(formatSectionDeltaMap(sectionRowUnknownBadgeBindingDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push('- 区块行级语义指纹新增：')
    lines.push(formatSectionDeltaMap(sectionRowSemanticBindingDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 区块行级语义指纹移除：')
    lines.push(formatSectionDeltaMap(sectionRowSemanticBindingDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push('- 区块行级语义指纹未映射动作新增：')
    lines.push(formatSectionDeltaMap(sectionRowSemanticUnknownActionBindingDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 区块行级语义指纹未映射动作移除：')
    lines.push(formatSectionDeltaMap(sectionRowSemanticUnknownActionBindingDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push('- 区块行级语义指纹未映射标签新增：')
    lines.push(formatSectionDeltaMap(sectionRowSemanticUnknownBadgeBindingDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 区块行级语义指纹未映射标签移除：')
    lines.push(formatSectionDeltaMap(sectionRowSemanticUnknownBadgeBindingDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push('- 区块对象 ID 新增：')
    lines.push(formatSectionDeltaMap(sectionRowIdDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 区块对象 ID 移除：')
    lines.push(formatSectionDeltaMap(sectionRowIdDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push('- 区块重复对象 ID 新增：')
    lines.push(formatSectionDeltaMap(sectionDuplicateRowIdDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 区块重复对象 ID 移除：')
    lines.push(formatSectionDeltaMap(sectionDuplicateRowIdDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push(`- 区块对象顺序变化：${formatKeyList(sectionRowOrderOnlyChangedFromLatestSuccessBaseline)}`)
    lines.push(`- 空态区块新增：${formatKeyList(sectionEmptyStateVisibleSectionDeltaFromLatestSuccessBaseline?.added)}`)
    lines.push(`- 空态区块移除：${formatKeyList(sectionEmptyStateVisibleSectionDeltaFromLatestSuccessBaseline?.removed)}`)
    lines.push('')
  }

  lines.push('| 时间 | 状态 | elapsed | strategy | sections | topRecent | notes | query |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  recent.forEach((entry) => {
    lines.push(
      `| ${entry.generatedAt ?? 'n/a'} | ${entry.ok ? '通过' : '失败'} | ${entry.elapsedMs}ms | ${entry.selectedStrategyName ?? 'n/a'} | ${entry.sectionCount}/6 | ${entry.topRecentActionCount} | ${entry.noteCount} | ${entry.queryStatus ?? 'n/a'} / ${entry.fetchStatus ?? 'n/a'} |`,
    )
  })

  lines.push('')
  return {
    trendSummary,
    trendReport: `${lines.join('\n')}\n`,
  }
}

const writeResult = (payload, reportContent) => {
  const content = `${JSON.stringify(payload, null, 2)}\n`
  writeFileSafely(resultPath, content, '结果')
  if (persistentResultPath !== resultPath) {
    writeFileSafely(persistentResultPath, content, '持久结果')
  }
  writeFileSafely(persistentReportPath, reportContent, '报告')
}

const writeRawLog = (content) => {
  writeFileSafely(rawLogPath, content, '原始日志')
  if (persistentRawLogPath !== rawLogPath) {
    writeFileSafely(persistentRawLogPath, content, '持久原始日志')
  }
}

const buildReport = (payload) => {
  const readiness = payload?.readiness ?? {}
  const state = readiness?.state ?? payload?.snapshot ?? {}
  const regression = payload?.regression ?? {}
  const sections = Object.entries(state?.sections ?? {})
    .map(([section, ok]) => `- ${section}: ${ok ? 'ok' : 'missing'}`)
    .join('\n')
  const labels = Object.entries(state?.labels ?? {})
    .map(([section, label]) => `- ${section}: ${label ?? 'n/a'}`)
    .join('\n')
  const lines = [
    '# 策略活动 smoke',
    '',
    `- 结果: ${payload?.ok ? '通过' : '失败'}`,
    `- 面板耗时: ${readiness?.elapsedMs ?? 0}ms`,
    `- 当前区块: ${state?.activeSection ?? 'n/a'}`,
    `- 当前策略: ${state?.selectedStrategyName ?? 'n/a'}`,
    `- 面板标题: ${state?.panelTitle ?? 'n/a'}`,
    `- 头部跟踪按钮: ${state?.headTrackButton ? 'ok' : 'missing'}`,
    `- 顶部 recent 动作数: ${state?.topRecentActionCount ?? 0}`,
    `- 顶部 recent 结构化 key: ${
      (state?.topRecentActionCount ?? 0) > 0
        ? ((Array.isArray(state?.topRecentActionKeys) ? state.topRecentActionKeys : []).length > 0 ? 'ok' : 'missing')
        : 'n/a'
    }`,
    `- 顶部动作结构化: ${
      Array.isArray(state?.topActionsMissingStructuredKeys) && state.topActionsMissingStructuredKeys.length
        ? `missing (${state.topActionsMissingStructuredKeys.join(', ')})`
        : 'ok'
    }`,
    `- 顶部已渲染动作组: ${formatKeyList(state?.topActionVisibleGroups)}`,
    `- 面板说明数: ${state?.noteCount ?? 0}`,
    `- 关键面板提示 key: ${
      (Array.isArray(state?.missingRequiredPanelNoteEntryKeys) ? state.missingRequiredPanelNoteEntryKeys : []).length
        ? `missing (${state.missingRequiredPanelNoteEntryKeys.join(', ')})`
        : 'ok'
    }`,
    `- 面板提示结构化: ${
      (Array.isArray(state?.panelNoteTextsWithoutStructuredKeys) ? state.panelNoteTextsWithoutStructuredKeys : []).length
        ? `missing (${state.panelNoteTextsWithoutStructuredKeys.join(' / ')})`
        : 'ok'
    }`,
    `- 区块动作结构化: ${
      Array.isArray(state?.sectionsMissingStructuredActionKeys) && state.sectionsMissingStructuredActionKeys.length
        ? `missing (${state.sectionsMissingStructuredActionKeys.join(', ')})`
        : 'ok'
    }`,
    `- 已渲染动作区块: ${formatKeyList(state?.sectionActionVisibleSections)}`,
    `- 区块标签结构化: ${
      Array.isArray(state?.sectionsMissingStructuredBadgeKeys) && state.sectionsMissingStructuredBadgeKeys.length
        ? `missing (${state.sectionsMissingStructuredBadgeKeys.join(', ')})`
        : 'ok'
    }`,
    `- 区块记录主标题结构化: ${
      Array.isArray(state?.sectionsMissingStructuredRowTitles) && state.sectionsMissingStructuredRowTitles.length
        ? `missing (${state.sectionsMissingStructuredRowTitles.join(', ')})`
        : 'ok'
    }`,
    `- 区块对象摘要绑定结构化: ${
      Array.isArray(state?.sectionsMissingStructuredRowSummaryBindings) && state.sectionsMissingStructuredRowSummaryBindings.length
        ? `missing (${state.sectionsMissingStructuredRowSummaryBindings.join(', ')})`
        : 'ok'
    }`,
    `- 区块对象动作绑定结构化: ${
      Array.isArray(state?.sectionsMissingStructuredRowActionBindings) && state.sectionsMissingStructuredRowActionBindings.length
        ? `missing (${state.sectionsMissingStructuredRowActionBindings.join(', ')})`
        : 'ok'
    }`,
    `- 区块对象标签绑定结构化: ${
      Array.isArray(state?.sectionsMissingStructuredRowBadgeBindings) && state.sectionsMissingStructuredRowBadgeBindings.length
        ? `missing (${state.sectionsMissingStructuredRowBadgeBindings.join(', ')})`
        : 'ok'
    }`,
    `- 区块行级语义指纹结构化: ${
      (
        (Array.isArray(state?.sectionsMissingStructuredRowSemanticBindings) && state.sectionsMissingStructuredRowSemanticBindings.length)
        || (Array.isArray(state?.sectionsWithUnknownSemanticActions) && state.sectionsWithUnknownSemanticActions.length)
        || (Array.isArray(state?.sectionsWithUnknownSemanticBadges) && state.sectionsWithUnknownSemanticBadges.length)
      )
        ? [
          Array.isArray(state?.sectionsMissingStructuredRowSemanticBindings) && state.sectionsMissingStructuredRowSemanticBindings.length
            ? `missing (${state.sectionsMissingStructuredRowSemanticBindings.join(', ')})`
            : null,
          Array.isArray(state?.sectionsWithUnknownSemanticActions) && state.sectionsWithUnknownSemanticActions.length
            ? `unknown_actions (${state.sectionsWithUnknownSemanticActions.join(', ')})`
            : null,
          Array.isArray(state?.sectionsWithUnknownSemanticBadges) && state.sectionsWithUnknownSemanticBadges.length
            ? `unknown_badges (${state.sectionsWithUnknownSemanticBadges.join(', ')})`
            : null,
        ].filter(Boolean).join('；')
        : 'ok'
    }`,
    `- 区块行级语义指纹未映射动作: ${
      Array.isArray(state?.sectionsWithUnknownSemanticActions) && state.sectionsWithUnknownSemanticActions.length
        ? state.sectionsWithUnknownSemanticActions.join(', ')
        : '无'
    }`,
    `- 区块行级语义指纹未映射标签: ${
      Array.isArray(state?.sectionsWithUnknownSemanticBadges) && state.sectionsWithUnknownSemanticBadges.length
        ? state.sectionsWithUnknownSemanticBadges.join(', ')
        : '无'
    }`,
    `- 区块对象标题绑定结构化: ${
      Array.isArray(state?.sectionsMissingStructuredRowTitleBindings) && state.sectionsMissingStructuredRowTitleBindings.length
        ? `missing (${state.sectionsMissingStructuredRowTitleBindings.join(', ')})`
        : 'ok'
    }`,
    `- 区块记录对象结构化: ${
      Array.isArray(state?.sectionsMissingStructuredRowIds) && state.sectionsMissingStructuredRowIds.length
        ? `missing (${state.sectionsMissingStructuredRowIds.join(', ')})`
        : 'ok'
    }`,
    `- 区块记录去重: ${
      Array.isArray(state?.sectionsWithDuplicateRowIds) && state.sectionsWithDuplicateRowIds.length
        ? `duplicated (${state.sectionsWithDuplicateRowIds.join(', ')})`
        : 'ok'
    }`,
    `- 区块内容异常: ${
      Array.isArray(state?.sectionsWithoutRowsOrEmptyState) && state.sectionsWithoutRowsOrEmptyState.length
        ? state.sectionsWithoutRowsOrEmptyState.join(', ')
        : '无'
    }`,
    '',
    '## 区块',
    sections || '- n/a',
    '',
    '## 标签',
    labels || '- n/a',
    '',
    `- 截图: ${payload?.output ?? 'n/a'}`,
  ]

  if (Array.isArray(state?.topRecentActionLabels) && state.topRecentActionLabels.length) {
    lines.push('', '## 顶部 Recent 动作', '')
    state.topRecentActionLabels.forEach((label, index) => {
      const key = Array.isArray(state?.topRecentActionKeys) ? state.topRecentActionKeys[index] : null
      lines.push(`- ${key ? `${key} · ` : ''}${label}`)
    })
  }

  if (state?.topActionKeysByGroup) {
    lines.push('', '## 顶部动作 Key', '')
    lines.push(formatTopActionKeyMap(state.topActionKeysByGroup))
  }

  if (state?.topUnknownActionLabelsByGroup && requiredTopActionGroups.some((group) => {
    const values = state.topUnknownActionLabelsByGroup?.[group]
    return Array.isArray(values) && values.length > 0
  })) {
    lines.push('', '## 顶部未知动作标签', '')
    lines.push(formatTopActionKeyMap(state.topUnknownActionLabelsByGroup))
  }

  if (Array.isArray(state?.panelNoteEntries) && state.panelNoteEntries.length) {
    lines.push('', '## 面板提示摘录', '')
    state.panelNoteEntries.slice(0, 8).forEach((entry) => {
      lines.push(`- ${entry?.key ? `${entry.key} · ` : ''}${entry?.text ?? ''}`)
    })
  } else if (Array.isArray(state?.panelNoteTexts) && state.panelNoteTexts.length) {
    lines.push('', '## 面板提示摘录', '')
    state.panelNoteTexts.slice(0, 8).forEach((note) => {
      lines.push(`- ${note}`)
    })
  }

  if (state?.sectionActionKeysBySection) {
    lines.push('', '## 区块动作 Key', '')
    lines.push(formatSectionKeyMap(state.sectionActionKeysBySection))
  }

  if (state?.sectionRowCounts) {
    lines.push('', '## 区块记录数', '')
    lines.push(formatSectionCountMap(state.sectionRowCounts))
    lines.push('', `- 空态区块: ${formatKeyList(state?.sectionEmptyStateVisibleSections)}`)
  }

  if (state?.sectionRowTitlesBySection) {
    lines.push('', '## 区块主标题', '')
    lines.push(formatSectionKeyMap(state.sectionRowTitlesBySection))
  }

  if (state?.sectionRowTitleBindingsBySection) {
    lines.push('', '## 区块对象标题绑定', '')
    lines.push(formatSectionKeyMap(state.sectionRowTitleBindingsBySection))
  }

  if (state?.sectionRowSummaryBindingsBySection) {
    lines.push('', '## 区块对象摘要绑定', '')
    lines.push(formatSectionKeyMap(state.sectionRowSummaryBindingsBySection))
  }

  if (state?.sectionRowActionBindingsBySection) {
    lines.push('', '## 区块对象动作绑定', '')
    lines.push(formatSectionKeyMap(state.sectionRowActionBindingsBySection))
  }

  if (state?.sectionRowSemanticBindingsBySection) {
    lines.push('', '## 区块行级语义指纹', '')
    lines.push(formatSectionKeyMap(state.sectionRowSemanticBindingsBySection))
  }
  if (state?.sectionRowSemanticUnknownActionBindingsBySection && requiredActivitySections.some((section) => {
    const values = state.sectionRowSemanticUnknownActionBindingsBySection?.[section]
    return Array.isArray(values) && values.length > 0
  })) {
    lines.push('', '## 区块行级语义指纹未映射动作', '')
    lines.push(formatSectionKeyMap(state.sectionRowSemanticUnknownActionBindingsBySection))
  }
  if (state?.sectionRowSemanticUnknownBadgeBindingsBySection && requiredActivitySections.some((section) => {
    const values = state.sectionRowSemanticUnknownBadgeBindingsBySection?.[section]
    return Array.isArray(values) && values.length > 0
  })) {
    lines.push('', '## 区块行级语义指纹未映射标签', '')
    lines.push(formatSectionKeyMap(state.sectionRowSemanticUnknownBadgeBindingsBySection))
  }

  if (state?.sectionRowIdsBySection) {
    lines.push('', '## 区块对象 ID', '')
    lines.push(formatSectionKeyMap(state.sectionRowIdsBySection))
  }

  if (state?.sectionDuplicateRowIdsBySection) {
    lines.push('', '## 区块重复对象 ID', '')
    lines.push(formatSectionKeyMap(state.sectionDuplicateRowIdsBySection))
  }

  if (state?.sectionBadgeKeysBySection) {
    lines.push('', '## 区块标签 Key', '')
    lines.push(formatSectionKeyMap(state.sectionBadgeKeysBySection))
  }

  if (state?.sectionUnknownActionLabelsBySection && requiredActivitySections.some((section) => {
    const values = state.sectionUnknownActionLabelsBySection?.[section]
    return Array.isArray(values) && values.length > 0
  })) {
    lines.push('', '## 区块未知动作标签', '')
    lines.push(formatSectionKeyMap(state.sectionUnknownActionLabelsBySection))
  }

  if (state?.sectionUnknownBadgeLabelsBySection && requiredActivitySections.some((section) => {
    const values = state.sectionUnknownBadgeLabelsBySection?.[section]
    return Array.isArray(values) && values.length > 0
  })) {
    lines.push('', '## 区块未知标签', '')
    lines.push(formatSectionKeyMap(state.sectionUnknownBadgeLabelsBySection))
  }

  if (regression?.checked) {
    lines.push('', '## 退化比较', '')
    lines.push(`- 结果: ${regression?.ok === false ? '失败' : '通过'}`)
    lines.push(
      `- 阈值: elapsed<=${regression?.thresholds?.baseElapsedDeltaMs ?? regression?.thresholds?.elapsedDeltaMs ?? 'n/a'}ms`
      + `${
        Number.isFinite(regression?.thresholds?.effectiveElapsedDeltaMs)
          ? `，当前有效阈值 ${regression.thresholds.effectiveElapsedDeltaMs}ms`
          : ''
      }`
      + `${
        Number.isFinite(regression?.thresholds?.addedRows) || Number.isFinite(regression?.thresholds?.addedRecentActions)
          ? `（新增记录 ${regression?.thresholds?.addedRows ?? 0}，新增 recent 动作 ${regression?.thresholds?.addedRecentActions ?? 0}）`
          : ''
      }`,
    )
    if (Array.isArray(regression?.reasons) && regression.reasons.length) {
      regression.reasons.slice(0, 5).forEach((reason) => {
        lines.push(`- ${reason}`)
      })
    }
  }

  return lines.join('\n')
}

const emitFailureContext = () => {
  const rawLogContent = `${rawLines.join('\n')}\n`
  writeRawLog(rawLogContent)
  const tail = rawLines.slice(-80)
  if (tail.length) {
    console.error('[smoke:strategy-activity] 最近日志片段:')
    console.error(tail.join('\n'))
  }
  console.error(`[smoke:strategy-activity] 原始日志已写入 ${rawLogPath}`)
}

const cleanup = (code) => {
  if (settled) {
    return
  }
  settled = true
  if (timeout) {
    clearTimeout(timeout)
  }
  child.kill('SIGINT')
  setTimeout(() => {
    process.exit(code)
  }, 250)
}

const cleanupAfterSuccess = () => {
  if (settled) {
    return
  }
  if (timeout) {
    clearTimeout(timeout)
  }
  setTimeout(() => {
    cleanup(0)
  }, successCleanupDelayMs)
}

const handleLine = (line) => {
  rawLines.push(line)
  const marker = '[renderer:smoke:strategy-activity:result] '
  const markerIndex = line.indexOf(marker)
  if (markerIndex === -1) {
    return
  }
  try {
    const payload = JSON.parse(line.slice(markerIndex + marker.length))
    const generatedAt = payload?.generatedAt || new Date().toISOString()
    const enrichedPayload = {
      generatedAt,
      ...payload,
    }
    if (enrichedPayload?.readiness?.state) {
      const normalizedState = buildNormalizedSummary(enrichedPayload)
      Object.assign(enrichedPayload.readiness.state, {
        topRecentActionKeys: normalizedState.topRecentActionKeys,
        topActionLabelsByGroup: normalizedState.topActionLabelsByGroup,
        topActionKeysByGroup: normalizedState.topActionKeysByGroup,
        topUnknownActionLabelsByGroup: normalizedState.topUnknownActionLabelsByGroup,
        topActionsMissingStructuredKeys: normalizedState.topActionsMissingStructuredKeys,
        topActionsStructured: normalizedState.topActionsStructured,
        panelNoteEntries: normalizedState.panelNoteEntries,
        panelNoteEntryKeys: normalizedState.panelNoteEntryKeys,
        panelNoteTextsWithoutStructuredKeys: normalizedState.panelNoteTextsWithoutStructuredKeys,
        missingRequiredPanelNoteEntryKeys: normalizedState.missingRequiredPanelNoteEntryKeys,
        panelNotesStructured: normalizedState.panelNotesStructured,
        topRecentActionsStructured: normalizedState.topRecentActionsStructured,
        sectionActionLabelsBySection: normalizedState.sectionActionLabelsBySection,
        sectionActionKeysBySection: normalizedState.sectionActionKeysBySection,
        sectionUnknownActionLabelsBySection: normalizedState.sectionUnknownActionLabelsBySection,
        sectionsMissingStructuredActionKeys: normalizedState.sectionsMissingStructuredActionKeys,
        sectionActionsStructured: normalizedState.sectionActionsStructured,
        sectionBadgeLabelsBySection: normalizedState.sectionBadgeLabelsBySection,
        sectionBadgeKeysBySection: normalizedState.sectionBadgeKeysBySection,
        sectionUnknownBadgeLabelsBySection: normalizedState.sectionUnknownBadgeLabelsBySection,
        sectionsMissingStructuredBadgeKeys: normalizedState.sectionsMissingStructuredBadgeKeys,
        sectionBadgesStructured: normalizedState.sectionBadgesStructured,
        sectionRowCounts: normalizedState.sectionRowCounts,
        sectionStructuredRowTitleCountsBySection: normalizedState.sectionStructuredRowTitleCountsBySection,
        sectionRowTitlesBySection: normalizedState.sectionRowTitlesBySection,
        sectionsMissingStructuredRowTitles: normalizedState.sectionsMissingStructuredRowTitles,
        sectionRowsTitled: normalizedState.sectionRowsTitled,
        sectionStructuredRowTitleBindingCountsBySection: normalizedState.sectionStructuredRowTitleBindingCountsBySection,
        sectionRowTitleBindingsBySection: normalizedState.sectionRowTitleBindingsBySection,
        sectionsMissingStructuredRowTitleBindings: normalizedState.sectionsMissingStructuredRowTitleBindings,
        sectionRowsTitleBound: normalizedState.sectionRowsTitleBound,
        sectionStructuredRowSummaryBindingCountsBySection: normalizedState.sectionStructuredRowSummaryBindingCountsBySection,
        sectionRowSummaryBindingsBySection: normalizedState.sectionRowSummaryBindingsBySection,
        sectionsMissingStructuredRowSummaryBindings: normalizedState.sectionsMissingStructuredRowSummaryBindings,
        sectionRowsSummaryBound: normalizedState.sectionRowsSummaryBound,
        sectionStructuredRowActionBindingCountsBySection: normalizedState.sectionStructuredRowActionBindingCountsBySection,
        sectionRowActionBindingsBySection: normalizedState.sectionRowActionBindingsBySection,
        sectionsMissingStructuredRowActionBindings: normalizedState.sectionsMissingStructuredRowActionBindings,
        sectionRowsActionBound: normalizedState.sectionRowsActionBound,
        sectionStructuredRowBadgeBindingCountsBySection: normalizedState.sectionStructuredRowBadgeBindingCountsBySection,
        sectionRowBadgeLabelBindingsBySection: normalizedState.sectionRowBadgeLabelBindingsBySection,
        sectionRowUnknownBadgeBindingsBySection: normalizedState.sectionRowUnknownBadgeBindingsBySection,
        sectionRowBadgeBindingsBySection: normalizedState.sectionRowBadgeBindingsBySection,
        sectionsMissingStructuredRowBadgeBindings: normalizedState.sectionsMissingStructuredRowBadgeBindings,
        sectionRowsBadgeBound: normalizedState.sectionRowsBadgeBound,
        sectionStructuredRowSemanticBindingCountsBySection: normalizedState.sectionStructuredRowSemanticBindingCountsBySection,
        sectionRowSemanticBindingsBySection: normalizedState.sectionRowSemanticBindingsBySection,
        sectionRowSemanticUnknownActionBindingsBySection: normalizedState.sectionRowSemanticUnknownActionBindingsBySection,
        sectionRowSemanticUnknownBadgeBindingsBySection: normalizedState.sectionRowSemanticUnknownBadgeBindingsBySection,
        sectionsMissingStructuredRowSemanticBindings: normalizedState.sectionsMissingStructuredRowSemanticBindings,
        sectionsWithUnknownSemanticActions: normalizedState.sectionsWithUnknownSemanticActions,
        sectionsWithUnknownSemanticBadges: normalizedState.sectionsWithUnknownSemanticBadges,
        sectionRowsSemanticBound: normalizedState.sectionRowsSemanticBound,
        sectionStructuredRowIdCountsBySection: normalizedState.sectionStructuredRowIdCountsBySection,
        sectionRowIdsBySection: normalizedState.sectionRowIdsBySection,
        sectionDuplicateRowIdsBySection: normalizedState.sectionDuplicateRowIdsBySection,
        sectionsMissingStructuredRowIds: normalizedState.sectionsMissingStructuredRowIds,
        sectionRowsStructured: normalizedState.sectionRowsStructured,
        sectionsWithDuplicateRowIds: normalizedState.sectionsWithDuplicateRowIds,
        sectionRowsDeduplicated: normalizedState.sectionRowsDeduplicated,
        sectionEmptyStateVisibleSections: normalizedState.sectionEmptyStateVisibleSections,
        sectionsWithoutRowsOrEmptyState: normalizedState.sectionsWithoutRowsOrEmptyState,
      })
    }
    const rawLogContent = `${rawLines.join('\n')}\n`
    const historyPayloads = [enrichedPayload, ...readHistoryPayloads()]
    const { trendSummary, trendReport } = buildTrendArtifacts(historyPayloads)
    enrichedPayload.regression = trendSummary.regression
    const reportContent = buildReport(enrichedPayload)
    writeResult(enrichedPayload, reportContent)
    writeRawLog(rawLogContent)
    writeFileSafely(persistentTrendSummaryPath, `${JSON.stringify(trendSummary, null, 2)}\n`, '趋势摘要')
    writeFileSafely(persistentTrendReportPath, trendReport, '趋势报告')
    archivePersistentResult(enrichedPayload, reportContent, rawLogContent)
    if (enrichedPayload?.ok && enrichedPayload?.readiness?.ok) {
      const successContent = `${JSON.stringify(enrichedPayload, null, 2)}\n`
      writeFileSafely(persistentLatestSuccessResultPath, successContent, '最近成功结果')
      writeFileSafely(persistentLatestSuccessReportPath, reportContent, '最近成功报告')
      writeFileSafely(persistentLatestSuccessRawLogPath, rawLogContent, '最近成功原始日志')
    }
    if (enrichedPayload?.ok && enrichedPayload?.readiness?.ok && enrichedPayload?.regression?.ok !== false) {
      const state = enrichedPayload?.readiness?.state ?? enrichedPayload?.snapshot ?? {}
      const sectionCount = Object.values(state?.sections ?? {}).filter(Boolean).length
      console.log(
        `[smoke:strategy-activity] 策略活动回归通过 elapsed=${enrichedPayload?.readiness?.elapsedMs ?? 0}ms sections=${sectionCount}/6 topRecent=${state?.topRecentActionCount ?? 0} notes=${state?.noteCount ?? 0}`,
      )
      console.log(
        `[smoke:strategy-activity] 结果文件已写入 ${resultPath}（已同步 ${persistentResultPath}）`,
      )
      console.log(
        `[smoke:strategy-activity] 原始日志已写入 ${rawLogPath}（已同步 ${persistentRawLogPath}）`,
      )
      console.log(
        `[smoke:strategy-activity] 最近成功基线已同步 ${persistentLatestSuccessResultPath}，历史目录 ${persistentHistoryDir}`,
      )
      cleanupAfterSuccess()
      return
    }
    console.error('[smoke:strategy-activity] 策略活动回归失败')
    console.error(JSON.stringify(enrichedPayload, null, 2))
    emitFailureContext()
    cleanup(1)
  } catch (error) {
    console.error('[smoke:strategy-activity] 解析结果失败', error)
    emitFailureContext()
    cleanup(1)
  }
}

readline.createInterface({ input: child.stdout }).on('line', handleLine)
readline.createInterface({ input: child.stderr }).on('line', handleLine)

child.on('exit', (code, signal) => {
  if (!settled) {
    console.error(`[smoke:strategy-activity] 桌面进程提前退出 code=${code} signal=${signal}`)
    emitFailureContext()
    cleanup(1)
  }
})

timeout = setTimeout(() => {
  console.error(`[smoke:strategy-activity] 超时未拿到回归结果（>${timeoutMs}ms）`)
  emitFailureContext()
  cleanup(1)
}, timeoutMs)

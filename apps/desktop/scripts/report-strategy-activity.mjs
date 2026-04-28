import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const runtimeDir = fileURLToPath(new URL('../../../.runtime/strategy-activity/', import.meta.url))
const latestSummaryPath = path.join(runtimeDir, 'latest-summary.json')
const latestSuccessSummaryPath = path.join(runtimeDir, 'latest-success-summary.json')
const latestReportPath = path.join(runtimeDir, 'latest-report.md')
const latestSuccessReportPath = path.join(runtimeDir, 'latest-success-report.md')
const trendReportPath = path.join(runtimeDir, 'trend-report.md')
const trendSummaryPath = path.join(runtimeDir, 'trend-summary.json')
const latestLogPath = path.join(runtimeDir, 'latest.log')
const latestSuccessLogPath = path.join(runtimeDir, 'latest-success.log')
const historyDir = path.join(runtimeDir, 'history')
const outputJson = process.argv.includes('--json')

const readFileOrNull = (targetPath) => {
  try {
    if (!fs.existsSync(targetPath)) {
      return null
    }
    const content = fs.readFileSync(targetPath, 'utf8').trim()
    return content || null
  } catch {
    return null
  }
}

const parseJsonOrNull = (content) => {
  if (!content) {
    return null
  }
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

const latestSummary = readFileOrNull(latestSummaryPath)
const latestSuccessSummary = readFileOrNull(latestSuccessSummaryPath)
const latestReport = readFileOrNull(latestReportPath)
const latestSuccessReport = readFileOrNull(latestSuccessReportPath)
const trendReport = readFileOrNull(trendReportPath)
const trendSummary = readFileOrNull(trendSummaryPath)
const latestLog = readFileOrNull(latestLogPath)
const latestSuccessLog = readFileOrNull(latestSuccessLogPath)
const parsedLatestSummary = parseJsonOrNull(latestSummary)
const parsedLatestSuccessSummary = parseJsonOrNull(latestSuccessSummary)
const parsedTrendSummary = parseJsonOrNull(trendSummary)
const state = parsedLatestSummary?.readiness?.state ?? parsedLatestSummary?.snapshot ?? {}
const requiredPanelNoteEntryKeys = ['strategy_headline', 'latest_activity_summary', 'latest_ops_summary']
const panelNoteEntries = Array.isArray(state?.panelNoteEntries)
  ? state.panelNoteEntries.filter((entry) => entry?.key && entry?.text)
  : []
const panelNoteEntryKeys = Array.isArray(state?.panelNoteEntryKeys)
  ? state.panelNoteEntryKeys.filter(Boolean)
  : panelNoteEntries.map((entry) => entry.key).filter(Boolean)
const panelNoteTextsWithoutStructuredKeys = Array.isArray(state?.panelNoteTextsWithoutStructuredKeys)
  ? state.panelNoteTextsWithoutStructuredKeys.filter(Boolean)
  : []
const topRecentActionKeys = Array.isArray(state?.topRecentActionKeys) ? state.topRecentActionKeys.filter(Boolean) : []
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
const normalizeGroupedKeyMap = (groups, value) => {
  const source = value && typeof value === 'object' ? value : {}
  return Object.fromEntries(
    groups.map((group) => [
      group,
      Array.isArray(source[group]) ? source[group].filter(Boolean) : [],
    ]),
  )
}
const normalizeSectionKeyMap = (value) => normalizeGroupedKeyMap(requiredActivitySections, value)
const normalizeTopActionKeyMap = (value) => normalizeGroupedKeyMap(requiredTopActionGroups, value)
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
  } catch {
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
const topActionLabelsByGroup = normalizeTopActionKeyMap(state?.topActionLabelsByGroup)
const topActionKeysByGroup = normalizeTopActionKeyMap(state?.topActionKeysByGroup)
const topUnknownActionLabelsByGroup = normalizeTopActionKeyMap(state?.topUnknownActionLabelsByGroup)
const topActionVisibleGroups = Array.isArray(state?.topActionVisibleGroups) ? state.topActionVisibleGroups.filter(Boolean) : []
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
const sectionActionVisibleSections = Array.isArray(state?.sectionActionVisibleSections) ? state.sectionActionVisibleSections.filter(Boolean) : []
const sectionEmptyStateVisibleSections = Array.isArray(state?.sectionEmptyStateVisibleSections)
  ? state.sectionEmptyStateVisibleSections.filter(Boolean)
  : []
const sectionRowCounts = Object.fromEntries(
  requiredActivitySections.map((section) => [section, Number(state?.sectionRowCounts?.[section] ?? 0)]),
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
const sectionRowSemanticUnknownActionBindingsBySection = buildSectionSemanticUnknownBindingMap(sectionRowSemanticBindingsBySection, 'unknownActions')
const sectionRowSemanticUnknownBadgeBindingsBySection = buildSectionSemanticUnknownBindingMap(sectionRowSemanticBindingsBySection, 'unknownBadges')
const sectionStructuredRowIdCountsBySection = Object.fromEntries(
  requiredActivitySections.map((section) => [section, Number(state?.sectionStructuredRowIdCountsBySection?.[section] ?? 0)]),
)
const sectionRowIdsBySection = normalizeSectionKeyMap(state?.sectionRowIdsBySection)
const sectionDuplicateRowIdsBySection = normalizeSectionKeyMap(state?.sectionDuplicateRowIdsBySection)
const sectionBadgeLabelsBySection = normalizeSectionKeyMap(state?.sectionBadgeLabelsBySection)
const sectionBadgeKeysBySection = normalizeSectionKeyMap(state?.sectionBadgeKeysBySection)
const sectionUnknownBadgeLabelsBySection = normalizeSectionKeyMap(state?.sectionUnknownBadgeLabelsBySection)
const sectionHasRows = (section) => sectionRowCounts[section] > 0
const sectionsMissingStructuredActionKeys = requiredActivitySections.filter((section) => {
  if (!sectionHasRows(section)) {
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
const sectionsMissingStructuredBadgeKeys = requiredActivitySections.filter((section) => {
  if (!sectionHasRows(section)) {
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
  const rowIds = sectionRowIdsBySection[section] ?? []
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
  if (!sectionHasRows(section)) {
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
const sectionsWithDuplicateRowIds = requiredActivitySections.filter((section) => {
  const duplicateIds = sectionDuplicateRowIdsBySection[section] ?? []
  return duplicateIds.length > 0
})

if (!latestSummary && !latestSuccessSummary && !latestReport && !latestSuccessReport && !trendReport && !trendSummary && !latestLog && !latestSuccessLog) {
  console.error('[report:strategy-activity] 未找到任何策略活动 smoke 报告，请先运行 pnpm smoke:strategy-activity')
  process.exit(1)
}

const currentStatus = {
  ok: Boolean(parsedLatestSummary?.ok),
  elapsedMs: Number(parsedLatestSummary?.readiness?.elapsedMs ?? 0),
  activeSection: state?.activeSection ?? null,
  selectedStrategyName: state?.selectedStrategyName ?? null,
  panelTitle: state?.panelTitle ?? null,
  queryStatus: state?.queryStatus ?? null,
  fetchStatus: state?.fetchStatus ?? null,
  queryStrategyId: state?.queryStrategyId ?? null,
  headTrackButton: Boolean(state?.headTrackButton),
  topRecentActionCount: Number(state?.topRecentActionCount ?? 0),
  noteCount: Number(state?.noteCount ?? 0),
  topRecentActionLabels: Array.isArray(state?.topRecentActionLabels) ? state.topRecentActionLabels : [],
  topRecentActionKeys,
  topActionVisibleGroups,
  topActionLabelsByGroup,
  topActionKeysByGroup,
  topUnknownActionLabelsByGroup,
  topActionsMissingStructuredKeys,
  panelNoteTexts: Array.isArray(state?.panelNoteTexts) ? state.panelNoteTexts : [],
  panelNoteEntries,
  panelNoteEntryKeys,
  panelNoteTextsWithoutStructuredKeys,
  missingRequiredPanelNoteEntryKeys: requiredPanelNoteEntryKeys.filter((key) => !panelNoteEntryKeys.includes(key)),
  panelNotesStructured: panelNoteTextsWithoutStructuredKeys.length === 0,
  topRecentActionsStructured: Number(state?.topRecentActionCount ?? 0) === 0 || topRecentActionKeys.length > 0,
  topActionsStructured: topActionsMissingStructuredKeys.length === 0,
  sectionActionVisibleSections,
  sectionActionLabelsBySection,
  sectionActionKeysBySection,
  sectionUnknownActionLabelsBySection,
  sectionsMissingStructuredActionKeys,
  sectionActionsStructured: sectionsMissingStructuredActionKeys.length === 0,
  sectionRowCounts,
  sectionStructuredRowTitleCountsBySection,
  sectionRowTitlesBySection,
  sectionsMissingStructuredRowTitles,
  sectionRowsTitled: sectionsMissingStructuredRowTitles.length === 0,
  sectionStructuredRowTitleBindingCountsBySection,
  sectionRowTitleBindingsBySection,
  sectionsMissingStructuredRowTitleBindings,
  sectionRowsTitleBound: sectionsMissingStructuredRowTitleBindings.length === 0,
  sectionStructuredRowSummaryBindingCountsBySection,
  sectionRowSummaryBindingsBySection,
  sectionsMissingStructuredRowSummaryBindings,
  sectionRowsSummaryBound: sectionsMissingStructuredRowSummaryBindings.length === 0,
  sectionStructuredRowActionBindingCountsBySection,
  sectionRowActionBindingsBySection,
  sectionsMissingStructuredRowActionBindings,
  sectionRowsActionBound: sectionsMissingStructuredRowActionBindings.length === 0,
  sectionStructuredRowBadgeBindingCountsBySection,
  sectionRowBadgeLabelBindingsBySection,
  sectionRowUnknownBadgeBindingsBySection,
  sectionRowBadgeBindingsBySection,
  sectionsMissingStructuredRowBadgeBindings,
  sectionRowsBadgeBound: sectionsMissingStructuredRowBadgeBindings.length === 0,
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
  sectionStructuredRowIdCountsBySection,
  sectionRowIdsBySection,
  sectionDuplicateRowIdsBySection,
  sectionsMissingStructuredRowIds,
  sectionRowsStructured: sectionsMissingStructuredRowIds.length === 0,
  sectionsWithDuplicateRowIds,
  sectionRowsDeduplicated: sectionsWithDuplicateRowIds.length === 0,
  sectionEmptyStateVisibleSections,
  sectionsWithoutRowsOrEmptyState,
  sectionBadgeLabelsBySection,
  sectionBadgeKeysBySection,
  sectionUnknownBadgeLabelsBySection,
  sectionsMissingStructuredBadgeKeys,
  sectionBadgesStructured: sectionsMissingStructuredBadgeKeys.length === 0,
  sectionCount: Object.values(state?.sections ?? {}).filter(Boolean).length,
  sections: state?.sections ?? {},
  labels: state?.labels ?? {},
  output: parsedLatestSummary?.output ?? null,
  latestSuccessGeneratedAt:
    parsedTrendSummary?.latestSuccessBaseline?.generatedAt
    ?? parsedLatestSuccessSummary?.generatedAt
    ?? null,
  attentionStatus: parsedTrendSummary?.attentionStatus ?? null,
  attentionReasons: Array.isArray(parsedTrendSummary?.attentionReasons) ? parsedTrendSummary.attentionReasons : [],
  consecutiveStableRuns: Number(parsedTrendSummary?.consecutiveStableRuns ?? 0),
  latestFailureGeneratedAt: parsedTrendSummary?.latestFailureSample?.generatedAt ?? null,
  deltaFromLatestSuccessBaseline: parsedTrendSummary?.deltaFromLatestSuccessBaseline ?? null,
  deltaFromPrevious: parsedTrendSummary?.deltaFromPrevious ?? null,
  topActionVisibleGroupDeltaFromPrevious: parsedTrendSummary?.topActionVisibleGroupDeltaFromPrevious ?? null,
  topRecentActionKeyDeltaFromPrevious: parsedTrendSummary?.topRecentActionKeyDeltaFromPrevious ?? null,
  topActionKeyDeltaFromPrevious: parsedTrendSummary?.topActionKeyDeltaFromPrevious ?? null,
  panelNoteEntryKeyDeltaFromPrevious: parsedTrendSummary?.panelNoteEntryKeyDeltaFromPrevious ?? null,
  panelNoteUnstructuredTextDeltaFromPrevious: parsedTrendSummary?.panelNoteUnstructuredTextDeltaFromPrevious ?? null,
  sectionActionVisibleSectionDeltaFromPrevious: parsedTrendSummary?.sectionActionVisibleSectionDeltaFromPrevious ?? null,
  sectionActionKeyDeltaFromPrevious: parsedTrendSummary?.sectionActionKeyDeltaFromPrevious ?? null,
  sectionBadgeKeyDeltaFromPrevious: parsedTrendSummary?.sectionBadgeKeyDeltaFromPrevious ?? null,
  sectionRowCountDeltaFromPrevious: parsedTrendSummary?.sectionRowCountDeltaFromPrevious ?? null,
  sectionRowTitleDeltaFromPrevious: parsedTrendSummary?.sectionRowTitleDeltaFromPrevious ?? null,
  sectionRowTitleBindingDeltaFromPrevious: parsedTrendSummary?.sectionRowTitleBindingDeltaFromPrevious ?? null,
  sectionRowSummaryBindingDeltaFromPrevious: parsedTrendSummary?.sectionRowSummaryBindingDeltaFromPrevious ?? null,
  sectionRowActionBindingDeltaFromPrevious: parsedTrendSummary?.sectionRowActionBindingDeltaFromPrevious ?? null,
  sectionRowBadgeBindingDeltaFromPrevious: parsedTrendSummary?.sectionRowBadgeBindingDeltaFromPrevious ?? null,
  sectionRowUnknownBadgeBindingDeltaFromPrevious: parsedTrendSummary?.sectionRowUnknownBadgeBindingDeltaFromPrevious ?? null,
  sectionRowSemanticBindingDeltaFromPrevious: parsedTrendSummary?.sectionRowSemanticBindingDeltaFromPrevious ?? null,
  sectionRowSemanticUnknownActionBindingDeltaFromPrevious:
    parsedTrendSummary?.sectionRowSemanticUnknownActionBindingDeltaFromPrevious ?? null,
  sectionRowSemanticUnknownBadgeBindingDeltaFromPrevious:
    parsedTrendSummary?.sectionRowSemanticUnknownBadgeBindingDeltaFromPrevious ?? null,
  sectionRowIdDeltaFromPrevious: parsedTrendSummary?.sectionRowIdDeltaFromPrevious ?? null,
  sectionDuplicateRowIdDeltaFromPrevious: parsedTrendSummary?.sectionDuplicateRowIdDeltaFromPrevious ?? null,
  sectionRowOrderOnlyChangedFromPrevious: parsedTrendSummary?.sectionRowOrderOnlyChangedFromPrevious ?? [],
  sectionEmptyStateVisibleSectionDeltaFromPrevious:
    parsedTrendSummary?.sectionEmptyStateVisibleSectionDeltaFromPrevious ?? null,
  topActionVisibleGroupDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.topActionVisibleGroupDeltaFromLatestSuccessBaseline ?? null,
  topRecentActionKeyDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.topRecentActionKeyDeltaFromLatestSuccessBaseline ?? null,
  topActionKeyDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.topActionKeyDeltaFromLatestSuccessBaseline ?? null,
  panelNoteEntryKeyDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.panelNoteEntryKeyDeltaFromLatestSuccessBaseline ?? null,
  panelNoteUnstructuredTextDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.panelNoteUnstructuredTextDeltaFromLatestSuccessBaseline ?? null,
  sectionActionVisibleSectionDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionActionVisibleSectionDeltaFromLatestSuccessBaseline ?? null,
  sectionActionKeyDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionActionKeyDeltaFromLatestSuccessBaseline ?? null,
  sectionBadgeKeyDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionBadgeKeyDeltaFromLatestSuccessBaseline ?? null,
  sectionRowCountDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowCountDeltaFromLatestSuccessBaseline ?? null,
  sectionRowTitleDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowTitleDeltaFromLatestSuccessBaseline ?? null,
  sectionRowTitleBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowTitleBindingDeltaFromLatestSuccessBaseline ?? null,
  sectionRowSummaryBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowSummaryBindingDeltaFromLatestSuccessBaseline ?? null,
  sectionRowActionBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowActionBindingDeltaFromLatestSuccessBaseline ?? null,
  sectionRowBadgeBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowBadgeBindingDeltaFromLatestSuccessBaseline ?? null,
  sectionRowUnknownBadgeBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowUnknownBadgeBindingDeltaFromLatestSuccessBaseline ?? null,
  sectionRowSemanticBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowSemanticBindingDeltaFromLatestSuccessBaseline ?? null,
  sectionRowSemanticUnknownActionBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowSemanticUnknownActionBindingDeltaFromLatestSuccessBaseline ?? null,
  sectionRowSemanticUnknownBadgeBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowSemanticUnknownBadgeBindingDeltaFromLatestSuccessBaseline ?? null,
  sectionRowIdDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowIdDeltaFromLatestSuccessBaseline ?? null,
  sectionDuplicateRowIdDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionDuplicateRowIdDeltaFromLatestSuccessBaseline ?? null,
  sectionRowOrderOnlyChangedFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowOrderOnlyChangedFromLatestSuccessBaseline ?? [],
  sectionEmptyStateVisibleSectionDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionEmptyStateVisibleSectionDeltaFromLatestSuccessBaseline ?? null,
  regressionChecked: Boolean(parsedLatestSummary?.regression?.checked),
  regressionOk: parsedLatestSummary?.regression?.ok !== false,
  regressionReasons: Array.isArray(parsedLatestSummary?.regression?.reasons) ? parsedLatestSummary.regression.reasons : [],
  regressionThresholds: parsedLatestSummary?.regression?.thresholds ?? null,
}

if (outputJson) {
  console.log(JSON.stringify({
    latestSummaryPath,
    latestSuccessSummaryPath,
    latestReportPath,
    latestSuccessReportPath,
    trendReportPath,
    trendSummaryPath,
    latestLogPath,
    latestSuccessLogPath,
    historyDir,
    latestSummary: parsedLatestSummary,
    latestSuccessSummary: parsedLatestSuccessSummary,
    latestReport,
    latestSuccessReport,
    trendReport,
    trendSummary: parsedTrendSummary,
    currentStatus,
  }, null, 2))
} else {
  if (latestReport) {
    console.log(latestReport)
  } else if (parsedLatestSummary) {
    console.log('# 策略活动 smoke')
    console.log('')
    console.log(`- 结果: ${currentStatus.ok ? '通过' : '失败'}`)
    console.log(`- 面板耗时: ${currentStatus.elapsedMs}ms`)
    console.log(`- 当前策略: ${currentStatus.selectedStrategyName ?? 'n/a'}`)
    console.log(`- 面板标题: ${currentStatus.panelTitle ?? 'n/a'}`)
    console.log(`- 查询状态: ${currentStatus.queryStatus ?? 'n/a'} / ${currentStatus.fetchStatus ?? 'n/a'}`)
    console.log(`- 顶部 recent 动作数: ${currentStatus.topRecentActionCount}`)
    console.log(`- 顶部 recent 结构化 key: ${currentStatus.topRecentActionsStructured ? 'ok' : 'missing'}`)
    console.log(`- 顶部动作结构化: ${currentStatus.topActionsStructured ? 'ok' : `missing (${currentStatus.topActionsMissingStructuredKeys.join(', ')})`}`)
    console.log(`- 面板说明数: ${currentStatus.noteCount}`)
    console.log(
      `- 关键面板提示 key: ${currentStatus.missingRequiredPanelNoteEntryKeys.length ? `missing (${currentStatus.missingRequiredPanelNoteEntryKeys.join(', ')})` : 'ok'}`,
    )
    console.log(
      `- 面板提示结构化: ${currentStatus.panelNotesStructured ? 'ok' : `missing (${currentStatus.panelNoteTextsWithoutStructuredKeys.join(' / ')})`}`,
    )
    console.log(
      `- 区块主标题结构化: ${currentStatus.sectionRowsTitled ? 'ok' : `missing (${currentStatus.sectionsMissingStructuredRowTitles.join(', ')})`}`,
    )
    console.log(
      `- 区块对象标题绑定结构化: ${currentStatus.sectionRowsTitleBound ? 'ok' : `missing (${currentStatus.sectionsMissingStructuredRowTitleBindings.join(', ')})`}`,
    )
    console.log(
      `- 区块对象摘要绑定结构化: ${currentStatus.sectionRowsSummaryBound ? 'ok' : `missing (${currentStatus.sectionsMissingStructuredRowSummaryBindings.join(', ')})`}`,
    )
    console.log(
      `- 区块对象动作绑定结构化: ${currentStatus.sectionRowsActionBound ? 'ok' : `missing (${currentStatus.sectionsMissingStructuredRowActionBindings.join(', ')})`}`,
    )
    console.log(
      `- 区块对象标签绑定结构化: ${currentStatus.sectionRowsBadgeBound ? 'ok' : `missing (${currentStatus.sectionsMissingStructuredRowBadgeBindings.join(', ')})`}`,
    )
    console.log(
      `- 区块行级语义指纹结构化: ${currentStatus.sectionRowsSemanticBound ? 'ok' : [
        currentStatus.sectionsMissingStructuredRowSemanticBindings.length
          ? `missing (${currentStatus.sectionsMissingStructuredRowSemanticBindings.join(', ')})`
          : null,
        currentStatus.sectionsWithUnknownSemanticActions.length
          ? `unknown_actions (${currentStatus.sectionsWithUnknownSemanticActions.join(', ')})`
          : null,
        currentStatus.sectionsWithUnknownSemanticBadges.length
          ? `unknown_badges (${currentStatus.sectionsWithUnknownSemanticBadges.join(', ')})`
          : null,
      ].filter(Boolean).join(', ')}`,
    )
    console.log(`- 区块行级语义指纹未映射动作: ${currentStatus.sectionsWithUnknownSemanticActions.length ? currentStatus.sectionsWithUnknownSemanticActions.join(', ') : '无'}`)
    console.log(`- 区块行级语义指纹未映射标签: ${currentStatus.sectionsWithUnknownSemanticBadges.length ? currentStatus.sectionsWithUnknownSemanticBadges.join(', ') : '无'}`)
    console.log(
      `- 区块对象 ID 结构化: ${currentStatus.sectionRowsStructured ? 'ok' : `missing (${currentStatus.sectionsMissingStructuredRowIds.join(', ')})`}`,
    )
    console.log(
      `- 区块记录去重: ${currentStatus.sectionRowsDeduplicated ? 'ok' : `duplicate (${currentStatus.sectionsWithDuplicateRowIds.join(', ')})`}`,
    )
  }
  if (latestSuccessReport && latestSuccessReport !== latestReport) {
    if (latestReport) {
      console.log('\n---\n')
    }
    console.log('# 最近成功基线')
    console.log('')
    console.log(latestSuccessReport)
  }
  if (trendReport) {
    if (latestReport || (latestSuccessReport && latestSuccessReport !== latestReport)) {
      console.log('\n---\n')
    }
    console.log(trendReport)
  }

  console.log(
    `\n[report:strategy-activity] ok=${currentStatus.ok ? 'yes' : 'no'} regression=${currentStatus.regressionChecked ? (currentStatus.regressionOk ? 'pass' : 'fail') : 'n/a'} attention=${currentStatus.attentionStatus ?? 'n/a'} elapsed=${currentStatus.elapsedMs}ms strategy=${currentStatus.selectedStrategyName ?? 'n/a'} sections=${currentStatus.sectionCount}/6 top_recent=${currentStatus.topRecentActionCount} notes=${currentStatus.noteCount} note_keys=${currentStatus.panelNotesStructured ? 'ok' : 'missing'} title_bindings=${currentStatus.sectionRowsTitleBound ? 'ok' : 'missing'} summary_bindings=${currentStatus.sectionRowsSummaryBound ? 'ok' : 'missing'} action_bindings=${currentStatus.sectionRowsActionBound ? 'ok' : 'missing'} badge_bindings=${currentStatus.sectionRowsBadgeBound ? 'ok' : 'missing'} semantic_bindings=${currentStatus.sectionRowsSemanticBound ? 'ok' : 'missing'} semantic_unknown_actions=${currentStatus.sectionsWithUnknownSemanticActions.length ? currentStatus.sectionsWithUnknownSemanticActions.join(',') : 'none'} semantic_unknown_badges=${currentStatus.sectionsWithUnknownSemanticBadges.length ? currentStatus.sectionsWithUnknownSemanticBadges.join(',') : 'none'} row_ids=${currentStatus.sectionRowsStructured ? 'ok' : 'missing'} dedup=${currentStatus.sectionRowsDeduplicated ? 'ok' : 'duplicate'} baseline=${currentStatus.latestSuccessGeneratedAt ?? 'n/a'} stable_runs=${currentStatus.consecutiveStableRuns ?? 0} latest_failure=${currentStatus.latestFailureGeneratedAt ?? 'n/a'}`,
  )
  console.log(`\n[report:strategy-activity] latest-summary=${latestSummaryPath}`)
  console.log(`[report:strategy-activity] latest-success-summary=${latestSuccessSummaryPath}`)
  console.log(`[report:strategy-activity] latest=${latestReportPath}`)
  console.log(`[report:strategy-activity] latest-success=${latestSuccessReportPath}`)
  console.log(`[report:strategy-activity] trend=${trendReportPath}`)
  console.log(`[report:strategy-activity] trend-summary=${trendSummaryPath}`)
  console.log(`[report:strategy-activity] latest-log=${latestLogPath}`)
  console.log(`[report:strategy-activity] latest-success-log=${latestSuccessLogPath}`)
  console.log(`[report:strategy-activity] history=${historyDir}`)
}

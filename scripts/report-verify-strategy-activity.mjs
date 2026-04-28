import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('../', import.meta.url))
const runtimeDir = path.join(rootDir, '.runtime/strategy-activity')
const historyDir = path.join(runtimeDir, 'verify-history')
const summaryPath = path.join(runtimeDir, 'latest-verify-summary.json')
const reportPath = path.join(runtimeDir, 'latest-verify-report.md')
const logPath = path.join(runtimeDir, 'latest-verify.log')
const latestSuccessSummaryPath = path.join(runtimeDir, 'latest-verify-success-summary.json')
const latestSuccessReportPath = path.join(runtimeDir, 'latest-verify-success-report.md')
const latestSuccessLogPath = path.join(runtimeDir, 'latest-verify-success.log')
const trendReportPath = path.join(runtimeDir, 'verify-trend-report.md')
const trendSummaryPath = path.join(runtimeDir, 'verify-trend-summary.json')
const outputJson = process.argv.includes('--json')
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

const report = readFileOrNull(reportPath)
const summaryContent = readFileOrNull(summaryPath)
const latestSuccessReport = readFileOrNull(latestSuccessReportPath)
const latestSuccessSummaryContent = readFileOrNull(latestSuccessSummaryPath)
const trendReport = readFileOrNull(trendReportPath)
const trendSummaryContent = readFileOrNull(trendSummaryPath)

if (!report && !summaryContent && !latestSuccessReport && !latestSuccessSummaryContent && !trendReport && !trendSummaryContent) {
  console.error('[report:verify-strategy-activity] 未找到任何 verify 结果，请先运行 pnpm verify:strategy-activity')
  process.exit(1)
}

let parsedSummary = null
if (summaryContent) {
  try {
    parsedSummary = JSON.parse(summaryContent)
  } catch {
    parsedSummary = null
  }
}

let parsedLatestSuccessSummary = null
if (latestSuccessSummaryContent) {
  try {
    parsedLatestSuccessSummary = JSON.parse(latestSuccessSummaryContent)
  } catch {
    parsedLatestSuccessSummary = null
  }
}

let parsedTrendSummary = null
if (trendSummaryContent) {
  try {
    parsedTrendSummary = JSON.parse(trendSummaryContent)
  } catch {
    parsedTrendSummary = null
  }
}

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

const baseCurrentStatus = parsedSummary?.currentStatus ?? {}
const topActionLabelsByGroup = normalizeTopActionKeyMap(baseCurrentStatus.topActionLabelsByGroup)
const topActionKeysByGroup = normalizeTopActionKeyMap(baseCurrentStatus.topActionKeysByGroup)
const topUnknownActionLabelsByGroup = normalizeTopActionKeyMap(baseCurrentStatus.topUnknownActionLabelsByGroup)
const topActionVisibleGroups = Array.isArray(baseCurrentStatus.topActionVisibleGroups) ? baseCurrentStatus.topActionVisibleGroups.filter(Boolean) : []
const topActionsMissingStructuredKeys = requiredTopActionGroups.filter((group) => {
  const labels = topActionLabelsByGroup[group]
  const keys = topActionKeysByGroup[group]
  const unknown = topUnknownActionLabelsByGroup[group]
  if (!labels.length) {
    return false
  }
  return keys.length === 0 || unknown.length > 0
})
const sectionActionLabelsBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionActionLabelsBySection)
const sectionActionKeysBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionActionKeysBySection)
const sectionUnknownActionLabelsBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionUnknownActionLabelsBySection)
const sectionActionVisibleSections = Array.isArray(baseCurrentStatus.sectionActionVisibleSections) ? baseCurrentStatus.sectionActionVisibleSections.filter(Boolean) : []
const sectionEmptyStateVisibleSections = Array.isArray(baseCurrentStatus.sectionEmptyStateVisibleSections)
  ? baseCurrentStatus.sectionEmptyStateVisibleSections.filter(Boolean)
  : []
const sectionRowCounts = Object.fromEntries(
  requiredActivitySections.map((section) => [section, Number(baseCurrentStatus.sectionRowCounts?.[section] ?? 0)]),
)
const sectionStructuredRowTitleCountsBySection = Object.fromEntries(
  requiredActivitySections.map((section) => [section, Number(baseCurrentStatus.sectionStructuredRowTitleCountsBySection?.[section] ?? 0)]),
)
const sectionStructuredRowTitleBindingCountsBySection = Object.fromEntries(
  requiredActivitySections.map((section) => [section, Number(baseCurrentStatus.sectionStructuredRowTitleBindingCountsBySection?.[section] ?? 0)]),
)
const sectionStructuredRowSummaryBindingCountsBySection = Object.fromEntries(
  requiredActivitySections.map((section) => [section, Number(baseCurrentStatus.sectionStructuredRowSummaryBindingCountsBySection?.[section] ?? 0)]),
)
const sectionStructuredRowActionBindingCountsBySection = Object.fromEntries(
  requiredActivitySections.map((section) => [section, Number(baseCurrentStatus.sectionStructuredRowActionBindingCountsBySection?.[section] ?? 0)]),
)
const sectionStructuredRowBadgeBindingCountsBySection = Object.fromEntries(
  requiredActivitySections.map((section) => [section, Number(baseCurrentStatus.sectionStructuredRowBadgeBindingCountsBySection?.[section] ?? 0)]),
)
const sectionStructuredRowSemanticBindingCountsBySection = Object.fromEntries(
  requiredActivitySections.map((section) => [section, Number(baseCurrentStatus.sectionStructuredRowSemanticBindingCountsBySection?.[section] ?? 0)]),
)
const panelNoteEntries = Array.isArray(baseCurrentStatus.panelNoteEntries)
  ? baseCurrentStatus.panelNoteEntries.filter((entry) => entry?.key && entry?.text)
  : []
const panelNoteEntryKeys = Array.isArray(baseCurrentStatus.panelNoteEntryKeys)
  ? baseCurrentStatus.panelNoteEntryKeys.filter(Boolean)
  : panelNoteEntries.map((entry) => entry.key).filter(Boolean)
const panelNoteTextsWithoutStructuredKeys = Array.isArray(baseCurrentStatus.panelNoteTextsWithoutStructuredKeys)
  ? baseCurrentStatus.panelNoteTextsWithoutStructuredKeys.filter(Boolean)
  : []
const sectionRowTitlesBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionRowTitlesBySection)
const sectionRowTitleBindingsBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionRowTitleBindingsBySection)
const sectionRowSummaryBindingsBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionRowSummaryBindingsBySection)
const sectionRowActionBindingsBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionRowActionBindingsBySection)
const sectionRowBadgeLabelBindingsBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionRowBadgeLabelBindingsBySection)
const sectionRowUnknownBadgeBindingsBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionRowUnknownBadgeBindingsBySection)
const sectionRowBadgeBindingsBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionRowBadgeBindingsBySection)
const sectionRowSemanticBindingsBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionRowSemanticBindingsBySection)
const sectionRowSemanticUnknownActionBindingsBySection = buildSectionSemanticUnknownBindingMap(sectionRowSemanticBindingsBySection, 'unknownActions')
const sectionRowSemanticUnknownBadgeBindingsBySection = buildSectionSemanticUnknownBindingMap(sectionRowSemanticBindingsBySection, 'unknownBadges')
const sectionStructuredRowIdCountsBySection = Object.fromEntries(
  requiredActivitySections.map((section) => [section, Number(baseCurrentStatus.sectionStructuredRowIdCountsBySection?.[section] ?? 0)]),
)
const sectionRowIdsBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionRowIdsBySection)
const sectionDuplicateRowIdsBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionDuplicateRowIdsBySection)
const sectionBadgeLabelsBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionBadgeLabelsBySection)
const sectionBadgeKeysBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionBadgeKeysBySection)
const sectionUnknownBadgeLabelsBySection = normalizeSectionKeyMap(baseCurrentStatus.sectionUnknownBadgeLabelsBySection)
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

const currentStatus = {
  ...baseCurrentStatus,
  topActionVisibleGroups,
  topActionLabelsByGroup,
  topActionKeysByGroup,
  topUnknownActionLabelsByGroup,
  topActionsMissingStructuredKeys,
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
  panelNoteEntries,
  panelNoteEntryKeys,
  panelNoteTextsWithoutStructuredKeys,
  missingRequiredPanelNoteEntryKeys: requiredPanelNoteEntryKeys.filter((key) => !panelNoteEntryKeys.includes(key)),
  panelNotesStructured: panelNoteTextsWithoutStructuredKeys.length === 0,
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
  latestVerifySuccessGeneratedAt: parsedTrendSummary?.latestSuccessBaseline?.generatedAt ?? parsedSummary?.currentStatus?.latestVerifySuccessGeneratedAt ?? null,
  consecutiveStableVerifyRuns: parsedTrendSummary?.consecutiveStableRuns ?? parsedSummary?.currentStatus?.consecutiveStableVerifyRuns ?? 0,
  latestVerifyFailureGeneratedAt: parsedTrendSummary?.latestFailureSample?.generatedAt ?? parsedSummary?.currentStatus?.latestVerifyFailureGeneratedAt ?? null,
  verifyAttentionStatus: parsedTrendSummary?.attentionStatus ?? parsedSummary?.currentStatus?.verifyAttentionStatus ?? null,
  verifyAttentionReasons: Array.isArray(parsedTrendSummary?.attentionReasons) ? parsedTrendSummary.attentionReasons : (Array.isArray(parsedSummary?.currentStatus?.verifyAttentionReasons) ? parsedSummary.currentStatus.verifyAttentionReasons : []),
  verifyRegressionChecked: Boolean(parsedTrendSummary?.regression?.checked ?? parsedSummary?.currentStatus?.verifyRegressionChecked),
  verifyRegressionOk: parsedTrendSummary?.regression?.checked ? parsedTrendSummary.regression.ok !== false : (parsedSummary?.currentStatus?.verifyRegressionChecked ? parsedSummary.currentStatus.verifyRegressionOk !== false : null),
  verifyRegressionReasons: Array.isArray(parsedTrendSummary?.regression?.reasons) ? parsedTrendSummary.regression.reasons : (Array.isArray(parsedSummary?.currentStatus?.verifyRegressionReasons) ? parsedSummary.currentStatus.verifyRegressionReasons : []),
  verifyRegressionThresholds: parsedTrendSummary?.regression?.thresholds ?? parsedSummary?.currentStatus?.verifyRegressionThresholds ?? null,
  topActionVisibleGroupDeltaFromPrevious: parsedTrendSummary?.topActionVisibleGroupDeltaFromPrevious ?? parsedSummary?.currentStatus?.topActionVisibleGroupDeltaFromPrevious ?? null,
  topRecentActionKeyDeltaFromPrevious: parsedTrendSummary?.topRecentActionKeyDeltaFromPrevious ?? parsedSummary?.currentStatus?.topRecentActionKeyDeltaFromPrevious ?? null,
  topActionKeyDeltaFromPrevious: parsedTrendSummary?.topActionKeyDeltaFromPrevious ?? parsedSummary?.currentStatus?.topActionKeyDeltaFromPrevious ?? null,
  panelNoteEntryKeyDeltaFromPrevious: parsedTrendSummary?.panelNoteEntryKeyDeltaFromPrevious ?? parsedSummary?.currentStatus?.panelNoteEntryKeyDeltaFromPrevious ?? null,
  panelNoteUnstructuredTextDeltaFromPrevious:
    parsedTrendSummary?.panelNoteUnstructuredTextDeltaFromPrevious
    ?? parsedSummary?.currentStatus?.panelNoteUnstructuredTextDeltaFromPrevious
    ?? null,
  sectionActionVisibleSectionDeltaFromPrevious: parsedTrendSummary?.sectionActionVisibleSectionDeltaFromPrevious ?? parsedSummary?.currentStatus?.sectionActionVisibleSectionDeltaFromPrevious ?? null,
  sectionActionKeyDeltaFromPrevious: parsedTrendSummary?.sectionActionKeyDeltaFromPrevious ?? parsedSummary?.currentStatus?.sectionActionKeyDeltaFromPrevious ?? null,
  sectionBadgeKeyDeltaFromPrevious: parsedTrendSummary?.sectionBadgeKeyDeltaFromPrevious ?? parsedSummary?.currentStatus?.sectionBadgeKeyDeltaFromPrevious ?? null,
  sectionRowCountDeltaFromPrevious:
    parsedTrendSummary?.sectionRowCountDeltaFromPrevious
    ?? parsedSummary?.currentStatus?.sectionRowCountDeltaFromPrevious
    ?? null,
  sectionRowTitleDeltaFromPrevious:
    parsedTrendSummary?.sectionRowTitleDeltaFromPrevious
    ?? parsedSummary?.currentStatus?.sectionRowTitleDeltaFromPrevious
    ?? null,
  sectionRowTitleBindingDeltaFromPrevious:
    parsedTrendSummary?.sectionRowTitleBindingDeltaFromPrevious
    ?? parsedSummary?.currentStatus?.sectionRowTitleBindingDeltaFromPrevious
    ?? null,
  sectionRowSummaryBindingDeltaFromPrevious:
    parsedTrendSummary?.sectionRowSummaryBindingDeltaFromPrevious
    ?? parsedSummary?.currentStatus?.sectionRowSummaryBindingDeltaFromPrevious
    ?? null,
  sectionRowActionBindingDeltaFromPrevious:
    parsedTrendSummary?.sectionRowActionBindingDeltaFromPrevious
    ?? parsedSummary?.currentStatus?.sectionRowActionBindingDeltaFromPrevious
    ?? null,
  sectionRowBadgeBindingDeltaFromPrevious:
    parsedTrendSummary?.sectionRowBadgeBindingDeltaFromPrevious
    ?? parsedSummary?.currentStatus?.sectionRowBadgeBindingDeltaFromPrevious
    ?? null,
  sectionRowUnknownBadgeBindingDeltaFromPrevious:
    parsedTrendSummary?.sectionRowUnknownBadgeBindingDeltaFromPrevious
    ?? parsedSummary?.currentStatus?.sectionRowUnknownBadgeBindingDeltaFromPrevious
    ?? null,
  sectionRowSemanticUnknownActionBindingDeltaFromPrevious:
    parsedTrendSummary?.sectionRowSemanticUnknownActionBindingDeltaFromPrevious
    ?? parsedSummary?.currentStatus?.sectionRowSemanticUnknownActionBindingDeltaFromPrevious
    ?? null,
  sectionRowSemanticUnknownBadgeBindingDeltaFromPrevious:
    parsedTrendSummary?.sectionRowSemanticUnknownBadgeBindingDeltaFromPrevious
    ?? parsedSummary?.currentStatus?.sectionRowSemanticUnknownBadgeBindingDeltaFromPrevious
    ?? null,
  sectionRowSemanticBindingDeltaFromPrevious:
    parsedTrendSummary?.sectionRowSemanticBindingDeltaFromPrevious
    ?? parsedSummary?.currentStatus?.sectionRowSemanticBindingDeltaFromPrevious
    ?? null,
  sectionRowIdDeltaFromPrevious:
    parsedTrendSummary?.sectionRowIdDeltaFromPrevious
    ?? parsedSummary?.currentStatus?.sectionRowIdDeltaFromPrevious
    ?? null,
  sectionDuplicateRowIdDeltaFromPrevious:
    parsedTrendSummary?.sectionDuplicateRowIdDeltaFromPrevious
    ?? parsedSummary?.currentStatus?.sectionDuplicateRowIdDeltaFromPrevious
    ?? null,
  sectionRowOrderOnlyChangedFromPrevious:
    parsedTrendSummary?.sectionRowOrderOnlyChangedFromPrevious
    ?? parsedSummary?.currentStatus?.sectionRowOrderOnlyChangedFromPrevious
    ?? [],
  sectionEmptyStateVisibleSectionDeltaFromPrevious:
    parsedTrendSummary?.sectionEmptyStateVisibleSectionDeltaFromPrevious
    ?? parsedSummary?.currentStatus?.sectionEmptyStateVisibleSectionDeltaFromPrevious
    ?? null,
  topActionVisibleGroupDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.topActionVisibleGroupDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.topActionVisibleGroupDeltaFromLatestSuccessBaseline
    ?? null,
  topRecentActionKeyDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.topRecentActionKeyDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.topRecentActionKeyDeltaFromLatestSuccessBaseline
    ?? null,
  topActionKeyDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.topActionKeyDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.topActionKeyDeltaFromLatestSuccessBaseline
    ?? null,
  panelNoteEntryKeyDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.panelNoteEntryKeyDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.panelNoteEntryKeyDeltaFromLatestSuccessBaseline
    ?? null,
  panelNoteUnstructuredTextDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.panelNoteUnstructuredTextDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.panelNoteUnstructuredTextDeltaFromLatestSuccessBaseline
    ?? null,
  sectionActionVisibleSectionDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionActionVisibleSectionDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionActionVisibleSectionDeltaFromLatestSuccessBaseline
    ?? null,
  sectionActionKeyDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionActionKeyDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionActionKeyDeltaFromLatestSuccessBaseline
    ?? null,
  sectionBadgeKeyDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionBadgeKeyDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionBadgeKeyDeltaFromLatestSuccessBaseline
    ?? null,
  sectionRowCountDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowCountDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionRowCountDeltaFromLatestSuccessBaseline
    ?? null,
  sectionRowTitleDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowTitleDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionRowTitleDeltaFromLatestSuccessBaseline
    ?? null,
  sectionRowTitleBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowTitleBindingDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionRowTitleBindingDeltaFromLatestSuccessBaseline
    ?? null,
  sectionRowSummaryBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowSummaryBindingDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionRowSummaryBindingDeltaFromLatestSuccessBaseline
    ?? null,
  sectionRowActionBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowActionBindingDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionRowActionBindingDeltaFromLatestSuccessBaseline
    ?? null,
  sectionRowBadgeBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowBadgeBindingDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionRowBadgeBindingDeltaFromLatestSuccessBaseline
    ?? null,
  sectionRowUnknownBadgeBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowUnknownBadgeBindingDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionRowUnknownBadgeBindingDeltaFromLatestSuccessBaseline
    ?? null,
  sectionRowSemanticUnknownActionBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowSemanticUnknownActionBindingDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionRowSemanticUnknownActionBindingDeltaFromLatestSuccessBaseline
    ?? null,
  sectionRowSemanticUnknownBadgeBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowSemanticUnknownBadgeBindingDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionRowSemanticUnknownBadgeBindingDeltaFromLatestSuccessBaseline
    ?? null,
  sectionRowSemanticBindingDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowSemanticBindingDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionRowSemanticBindingDeltaFromLatestSuccessBaseline
    ?? null,
  sectionRowIdDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowIdDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionRowIdDeltaFromLatestSuccessBaseline
    ?? null,
  sectionDuplicateRowIdDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionDuplicateRowIdDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionDuplicateRowIdDeltaFromLatestSuccessBaseline
    ?? null,
  sectionRowOrderOnlyChangedFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionRowOrderOnlyChangedFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionRowOrderOnlyChangedFromLatestSuccessBaseline
    ?? [],
  sectionEmptyStateVisibleSectionDeltaFromLatestSuccessBaseline:
    parsedTrendSummary?.sectionEmptyStateVisibleSectionDeltaFromLatestSuccessBaseline
    ?? parsedSummary?.currentStatus?.sectionEmptyStateVisibleSectionDeltaFromLatestSuccessBaseline
    ?? null,
}

if (outputJson) {
  console.log(JSON.stringify({
    summaryPath,
    reportPath,
    logPath,
    latestSuccessSummaryPath,
    latestSuccessReportPath,
    latestSuccessLogPath,
    trendReportPath,
    trendSummaryPath,
    historyDir,
    summary: parsedSummary,
    latestSuccessSummary: parsedLatestSuccessSummary,
    report,
    latestSuccessReport,
    trendReport,
    trendSummary: parsedTrendSummary,
    currentStatus,
  }, null, 2))
} else {
  if (report) {
    console.log(report)
  }
  if (latestSuccessReport && latestSuccessReport !== report) {
    if (report) {
      console.log('')
    }
    console.log(latestSuccessReport)
  }
  if (trendReport) {
    if (report || latestSuccessReport) {
      console.log('')
    }
    console.log(trendReport)
  }
  if (parsedSummary?.currentStatus) {
    const status = currentStatus
    console.log(
      `\n[report:verify-strategy-activity] strategy=${status.selectedStrategyName ?? 'n/a'} verify_regression=${status.verifyRegressionChecked ? (status.verifyRegressionOk ? 'pass' : 'fail') : 'n/a'} verify_attention=${status.verifyAttentionStatus ?? 'n/a'} smoke_regression=${status.regressionChecked ? (status.regressionOk ? 'pass' : 'fail') : 'n/a'} smoke_attention=${status.attentionStatus ?? 'n/a'} total=${status.totalElapsedMs ?? 0}ms elapsed=${status.elapsedMs ?? 0}ms sections=${status.sectionCount ?? 0}/6 top_recent=${status.topRecentActionCount ?? 0} notes=${status.noteCount ?? 0} note_keys=${status.panelNotesStructured ? 'ok' : 'missing'} title_bindings=${status.sectionRowsTitleBound ? 'ok' : 'missing'} summary_bindings=${status.sectionRowsSummaryBound ? 'ok' : 'missing'} action_bindings=${status.sectionRowsActionBound ? 'ok' : 'missing'} badge_bindings=${status.sectionRowsBadgeBound ? 'ok' : 'missing'} semantic_bindings=${status.sectionRowsSemanticBound ? 'ok' : 'missing'} semantic_unknown_actions=${status.sectionsWithUnknownSemanticActions.length ? status.sectionsWithUnknownSemanticActions.join(',') : 'none'} semantic_unknown_badges=${status.sectionsWithUnknownSemanticBadges.length ? status.sectionsWithUnknownSemanticBadges.join(',') : 'none'} row_ids=${status.sectionRowsStructured ? 'ok' : 'missing'} dedup=${status.sectionRowsDeduplicated ? 'ok' : 'duplicate'} baseline=${status.latestVerifySuccessGeneratedAt ?? 'n/a'} stable_runs=${status.consecutiveStableVerifyRuns ?? 0} latest_failure=${status.latestVerifyFailureGeneratedAt ?? 'n/a'}`,
    )
  }
  console.log(`\n[report:verify-strategy-activity] summary=${summaryPath}`)
  console.log(`[report:verify-strategy-activity] report=${reportPath}`)
  console.log(`[report:verify-strategy-activity] log=${logPath}`)
  console.log(`[report:verify-strategy-activity] latest-success-summary=${latestSuccessSummaryPath}`)
  console.log(`[report:verify-strategy-activity] latest-success=${latestSuccessReportPath}`)
  console.log(`[report:verify-strategy-activity] latest-success-log=${latestSuccessLogPath}`)
  console.log(`[report:verify-strategy-activity] trend=${trendReportPath}`)
  console.log(`[report:verify-strategy-activity] trend-summary=${trendSummaryPath}`)
  console.log(`[report:verify-strategy-activity] history=${historyDir}`)
}

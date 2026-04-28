import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('../', import.meta.url))
const runtimeDir = path.join(rootDir, '.runtime/strategy-activity')
const verifyHistoryDir = path.join(runtimeDir, 'verify-history')
const latestVerifySummaryPath = path.join(runtimeDir, 'latest-verify-summary.json')
const latestVerifyReportPath = path.join(runtimeDir, 'latest-verify-report.md')
const latestVerifyLogPath = path.join(runtimeDir, 'latest-verify.log')
const latestVerifySuccessSummaryPath = path.join(runtimeDir, 'latest-verify-success-summary.json')
const latestVerifySuccessReportPath = path.join(runtimeDir, 'latest-verify-success-report.md')
const latestVerifySuccessLogPath = path.join(runtimeDir, 'latest-verify-success.log')
const verifyTrendReportPath = path.join(runtimeDir, 'verify-trend-report.md')
const verifyTrendSummaryPath = path.join(runtimeDir, 'verify-trend-summary.json')
const tmpVerifyLogPath = path.join(os.tmpdir(), 'bybit-verify-strategy-activity.log')
const verifyAttentionPanelElapsedDeltaMs = Number(process.env.BYBIT_VERIFY_STRATEGY_ACTIVITY_ATTENTION_PANEL_ELAPSED_DELTA_MS || 5000)
const verifyRegressionPanelElapsedDeltaMs = Number(process.env.BYBIT_VERIFY_STRATEGY_ACTIVITY_REGRESSION_PANEL_ELAPSED_DELTA_MS || 5000)
const verifyAttentionDesktopElapsedDeltaMs = Number(process.env.BYBIT_VERIFY_STRATEGY_ACTIVITY_ATTENTION_DESKTOP_ELAPSED_DELTA_MS || 10000)
const verifyRegressionDesktopElapsedDeltaMs = Number(process.env.BYBIT_VERIFY_STRATEGY_ACTIVITY_REGRESSION_DESKTOP_ELAPSED_DELTA_MS || 15000)
const verifyContentGrowthRowBudgetMs = Number(process.env.BYBIT_VERIFY_STRATEGY_ACTIVITY_CONTENT_GROWTH_ROW_BUDGET_MS || 500)
const verifyContentGrowthRecentActionBudgetMs = Number(process.env.BYBIT_VERIFY_STRATEGY_ACTIVITY_CONTENT_GROWTH_RECENT_ACTION_BUDGET_MS || 250)
const spawnMaxBufferBytes = Number(process.env.BYBIT_VERIFY_SPAWN_MAX_BUFFER_BYTES || 50 * 1024 * 1024)
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

const sectionHasRows = (status, section) => Number(status?.sectionRowCounts?.[section] ?? 0) > 0

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

fs.mkdirSync(runtimeDir, { recursive: true })
fs.mkdirSync(verifyHistoryDir, { recursive: true })

const logChunks = []

const appendLog = (text = '') => {
  logChunks.push(text)
}

const runStep = (name, command, args) => {
  const startedAt = new Date()
  appendLog(`\n$ ${[command, ...args].join(' ')}\n`)
  const start = Date.now()
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: spawnMaxBufferBytes,
  })
  const elapsedMs = Date.now() - start
  const stdout = result.stdout || ''
  const stderr = result.stderr || ''
  if (stdout) {
    appendLog(stdout.endsWith('\n') ? stdout : `${stdout}\n`)
  }
  if (stderr) {
    appendLog(stderr.endsWith('\n') ? stderr : `${stderr}\n`)
  }
  const ok = result.status === 0
  appendLog(`[step:${name}] ok=${ok} exit=${result.status ?? 'null'} elapsedMs=${elapsedMs}\n`)
  return {
    name,
    command: [command, ...args].join(' '),
    ok,
    exitCode: result.status,
    signal: result.signal,
    elapsedMs,
    startedAt: startedAt.toISOString(),
    stdout,
    stderr,
  }
}

const parseJsonFromMixedOutput = (raw) => {
  const start = raw.indexOf('{')
  if (start === -1) {
    return null
  }
  try {
    return JSON.parse(raw.slice(start))
  } catch {
    return null
  }
}

const sumStepElapsedMs = (payload) => {
  const steps = Array.isArray(payload?.steps) ? payload.steps : []
  return steps.reduce((total, step) => total + Number(step?.elapsedMs ?? 0), 0)
}

const buildStepElapsedByName = (payload) => {
  const steps = Array.isArray(payload?.steps) ? payload.steps : []
  return Object.fromEntries(
    steps.map((step) => [
      String(step?.name ?? ''),
      Number(step?.elapsedMs ?? 0),
    ]),
  )
}

const buildNormalizedVerifySummary = (payload) => {
  const status = payload?.currentStatus ?? {}
  const topRecentSchemaReady = hasAnyOwnField(status, topRecentSchemaFields)
  const topActionSchemaReady = hasAnyOwnField(status, topActionSchemaFields)
  const panelNoteSchemaReady = hasAnyOwnField(status, panelNoteSchemaFields)
  const sectionActionSchemaReady = hasAnyOwnField(status, sectionActionSchemaFields)
  const topActionVisibilitySchemaReady = hasAnyOwnField(status, topActionVisibilitySchemaFields)
  const sectionActionVisibilitySchemaReady = hasAnyOwnField(status, sectionActionVisibilitySchemaFields)
  const sectionBadgeSchemaReady = hasAnyOwnField(status, sectionBadgeSchemaFields)
  const sectionRowSchemaReady = hasAnyOwnField(status, sectionRowSchemaFields)
  const sectionRowTitleSchemaReady = hasAnyOwnField(status, sectionRowTitleSchemaFields)
  const sectionRowTitleBindingSchemaReady = hasAnyOwnField(status, sectionRowTitleBindingSchemaFields)
  const sectionRowSummaryBindingSchemaReady = hasAnyOwnField(status, sectionRowSummaryBindingSchemaFields)
  const sectionRowActionBindingSchemaReady = hasAnyOwnField(status, sectionRowActionBindingSchemaFields)
  const sectionRowBadgeBindingSchemaReady = hasAnyOwnField(status, sectionRowBadgeBindingSchemaFields)
  const sectionRowSemanticBindingSchemaReady = hasAnyOwnField(status, sectionRowSemanticBindingSchemaFields)
  const sectionRowIdentitySchemaReady = hasAnyOwnField(status, sectionRowIdentitySchemaFields)
  const topActionVisibleGroups = Array.isArray(status?.topActionVisibleGroups) ? status.topActionVisibleGroups.filter(Boolean) : []
  const sectionActionVisibleSections = Array.isArray(status?.sectionActionVisibleSections) ? status.sectionActionVisibleSections.filter(Boolean) : []
  const sectionEmptyStateVisibleSections = Array.isArray(status?.sectionEmptyStateVisibleSections)
    ? status.sectionEmptyStateVisibleSections.filter(Boolean)
    : []
  const sectionRowCounts = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(status?.sectionRowCounts?.[section] ?? 0)]),
  )
  const sectionStructuredRowTitleCountsBySection = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(status?.sectionStructuredRowTitleCountsBySection?.[section] ?? 0)]),
  )
  const sectionStructuredRowTitleBindingCountsBySection = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(status?.sectionStructuredRowTitleBindingCountsBySection?.[section] ?? 0)]),
  )
  const sectionStructuredRowSummaryBindingCountsBySection = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(status?.sectionStructuredRowSummaryBindingCountsBySection?.[section] ?? 0)]),
  )
  const sectionStructuredRowActionBindingCountsBySection = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(status?.sectionStructuredRowActionBindingCountsBySection?.[section] ?? 0)]),
  )
  const sectionStructuredRowBadgeBindingCountsBySection = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(status?.sectionStructuredRowBadgeBindingCountsBySection?.[section] ?? 0)]),
  )
  const sectionStructuredRowSemanticBindingCountsBySection = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(status?.sectionStructuredRowSemanticBindingCountsBySection?.[section] ?? 0)]),
  )
  const sectionRowTitlesBySection = normalizeSectionKeyMap(status?.sectionRowTitlesBySection)
  const sectionRowTitleBindingsBySection = normalizeSectionKeyMap(status?.sectionRowTitleBindingsBySection)
  const sectionRowSummaryBindingsBySection = normalizeSectionKeyMap(status?.sectionRowSummaryBindingsBySection)
  const sectionRowActionBindingsBySection = normalizeSectionKeyMap(status?.sectionRowActionBindingsBySection)
  const sectionRowBadgeLabelBindingsBySection = normalizeSectionKeyMap(status?.sectionRowBadgeLabelBindingsBySection)
  const sectionRowUnknownBadgeBindingsBySection = normalizeSectionKeyMap(status?.sectionRowUnknownBadgeBindingsBySection)
  const sectionRowBadgeBindingsBySection = normalizeSectionKeyMap(status?.sectionRowBadgeBindingsBySection)
  const sectionRowSemanticBindingsBySection = normalizeSectionKeyMap(status?.sectionRowSemanticBindingsBySection)
  const sectionRowSemanticUnknownActionBindingsBySection = buildSectionSemanticUnknownBindingMap(
    sectionRowSemanticBindingsBySection,
    'unknownActions',
  )
  const sectionRowSemanticUnknownBadgeBindingsBySection = buildSectionSemanticUnknownBindingMap(
    sectionRowSemanticBindingsBySection,
    'unknownBadges',
  )
  const sectionStructuredRowIdCountsBySection = Object.fromEntries(
    requiredActivitySections.map((section) => [section, Number(status?.sectionStructuredRowIdCountsBySection?.[section] ?? 0)]),
  )
  const stepElapsedByName = buildStepElapsedByName(payload)
  const sectionRowIdsBySection = normalizeSectionKeyMap(status?.sectionRowIdsBySection)
  const sectionDuplicateRowIdsBySection = normalizeSectionKeyMap(status?.sectionDuplicateRowIdsBySection)
  const topRecentActionCount = Number(status?.topRecentActionCount ?? 0)
  const topRecentActionKeys = Array.isArray(status?.topRecentActionKeys) ? status.topRecentActionKeys.filter(Boolean) : []
  const panelNoteEntries = Array.isArray(status?.panelNoteEntries)
    ? status.panelNoteEntries.filter((entry) => entry?.key && entry?.text)
    : []
  const panelNoteEntryKeys = Array.isArray(status?.panelNoteEntryKeys)
    ? status.panelNoteEntryKeys.filter(Boolean)
    : panelNoteEntries.map((entry) => entry.key).filter(Boolean)
  const panelNoteTextsWithoutStructuredKeys = Array.isArray(status?.panelNoteTextsWithoutStructuredKeys)
    ? status.panelNoteTextsWithoutStructuredKeys.filter(Boolean)
    : []
  const topActionLabelsByGroup = normalizeTopActionKeyMap(status?.topActionLabelsByGroup)
  const topActionKeysByGroup = normalizeTopActionKeyMap(status?.topActionKeysByGroup)
  const topUnknownActionLabelsByGroup = normalizeTopActionKeyMap(status?.topUnknownActionLabelsByGroup)
  const topActionsMissingStructuredKeys = requiredTopActionGroups.filter((group) => {
    const labels = topActionLabelsByGroup[group]
    const keys = topActionKeysByGroup[group]
    const unknown = topUnknownActionLabelsByGroup[group]
    if (!labels.length) {
      return false
    }
    return keys.length === 0 || unknown.length > 0
  })
  const sectionActionLabelsBySection = normalizeSectionKeyMap(status?.sectionActionLabelsBySection)
  const sectionActionKeysBySection = normalizeSectionKeyMap(status?.sectionActionKeysBySection)
  const sectionUnknownActionLabelsBySection = normalizeSectionKeyMap(status?.sectionUnknownActionLabelsBySection)
  const sectionsMissingStructuredActionKeys = requiredActivitySections.filter((section) => {
    if (!sectionHasRows(status, section)) {
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
  const sectionBadgeLabelsBySection = normalizeSectionKeyMap(status?.sectionBadgeLabelsBySection)
  const sectionBadgeKeysBySection = normalizeSectionKeyMap(status?.sectionBadgeKeysBySection)
  const sectionUnknownBadgeLabelsBySection = normalizeSectionKeyMap(status?.sectionUnknownBadgeLabelsBySection)
  const sectionsMissingStructuredBadgeKeys = requiredActivitySections.filter((section) => {
    if (!sectionHasRows(status, section)) {
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
    if (!sectionHasRows(status, section)) {
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
    ok: Boolean(payload?.ok),
    totalElapsedMs: sumStepElapsedMs(payload),
    backendTestElapsedMs: Number(stepElapsedByName['backend-test-control-api'] ?? 0),
    desktopVerifyElapsedMs: Number(stepElapsedByName['desktop-verify-strategy-activity'] ?? 0),
    desktopReportElapsedMs: Number(stepElapsedByName['desktop-report-strategy-activity-json'] ?? 0),
    panelElapsedMs: Number(status?.elapsedMs ?? 0),
    selectedStrategyName: status?.selectedStrategyName ?? null,
    panelTitle: status?.panelTitle ?? null,
    activeSection: status?.activeSection ?? null,
    sectionCount: Number(status?.sectionCount ?? 0),
    topRecentActionCount,
    noteCount: Number(status?.noteCount ?? 0),
    topRecentSchemaReady,
    topRecentActionKeys,
    topActionVisibilitySchemaReady,
    topActionVisibleGroups,
    topActionSchemaReady,
    topActionLabelsByGroup,
    topActionKeysByGroup,
    topUnknownActionLabelsByGroup,
    topActionsMissingStructuredKeys,
    panelNoteEntries,
    panelNoteEntryKeys,
    panelNoteTextsWithoutStructuredKeys,
    panelNoteSchemaReady,
    missingRequiredPanelNoteEntryKeys: requiredPanelNoteEntryKeys.filter((key) => !panelNoteEntryKeys.includes(key)),
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
    queryStatus: status?.queryStatus ?? null,
    fetchStatus: status?.fetchStatus ?? null,
    headTrackButton: Boolean(status?.headTrackButton),
    stepCount: Array.isArray(payload?.steps) ? payload.steps.length : 0,
    stepElapsedByName,
    smokeRegressionChecked: Boolean(status?.regressionChecked),
    smokeRegressionOk: status?.regressionChecked ? status?.regressionOk !== false : null,
    smokeAttentionStatus: status?.attentionStatus ?? null,
  }
}

const isSuccessfulVerifyBaseline = (payload) => {
  const summary = buildNormalizedVerifySummary(payload)
  return summary.ok && summary.smokeRegressionOk !== false && summary.smokeAttentionStatus !== 'attention'
}

const isFailureVerifySample = (payload) => !payload?.ok

const readVerifyHistoryPayloads = () => {
  try {
    return fs
      .readdirSync(verifyHistoryDir)
      .filter((file) => file.endsWith('.json'))
      .sort()
      .reverse()
      .map((file) => {
        try {
          const raw = fs.readFileSync(path.join(verifyHistoryDir, file), 'utf8').trim()
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

const findLatestVerifySuccessBaseline = (historyPayloads, latestPayload) => {
  const latestGeneratedAt = latestPayload?.generatedAt ?? null
  return historyPayloads.find((payload) => {
    if (!isSuccessfulVerifyBaseline(payload)) {
      return false
    }
    if (latestGeneratedAt && payload?.generatedAt === latestGeneratedAt) {
      return false
    }
    return true
  }) ?? null
}

const findLatestVerifyFailureSample = (historyPayloads, latestPayload) => {
  const latestGeneratedAt = latestPayload?.generatedAt ?? null
  return historyPayloads.find((payload) => {
    if (!isFailureVerifySample(payload)) {
      return false
    }
    if (latestGeneratedAt && payload?.generatedAt === latestGeneratedAt) {
      return false
    }
    return true
  }) ?? null
}

const countConsecutiveStableVerifyRuns = (historyPayloads) => {
  let count = 0
  for (const payload of historyPayloads) {
    if (!isSuccessfulVerifyBaseline(payload)) {
      break
    }
    count += 1
  }
  return count
}

const buildVerifyDeltaSummary = (latestPayload, previousPayload) => {
  if (!latestPayload || !previousPayload) {
    return null
  }
  const latest = buildNormalizedVerifySummary(latestPayload)
  const previous = buildNormalizedVerifySummary(previousPayload)
  return {
    totalElapsedMs: latest.totalElapsedMs - previous.totalElapsedMs,
    backendTestElapsedMs: latest.backendTestElapsedMs - previous.backendTestElapsedMs,
    desktopVerifyElapsedMs: latest.desktopVerifyElapsedMs - previous.desktopVerifyElapsedMs,
    desktopReportElapsedMs: latest.desktopReportElapsedMs - previous.desktopReportElapsedMs,
    panelElapsedMs: latest.panelElapsedMs - previous.panelElapsedMs,
    sectionCount: latest.sectionCount - previous.sectionCount,
    topRecentActionCount: latest.topRecentActionCount - previous.topRecentActionCount,
    noteCount: latest.noteCount - previous.noteCount,
    queryStatusChanged: latest.queryStatus !== previous.queryStatus,
    fetchStatusChanged: latest.fetchStatus !== previous.fetchStatus,
  }
}

const buildVerifyPanelElapsedThresholdWithContentGrowth = (baseThreshold, latest, baseline) => {
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
    basePanelElapsedDeltaMs: baseThreshold,
    contentGrowthRowBudgetMs: verifyContentGrowthRowBudgetMs,
    contentGrowthRecentActionBudgetMs: verifyContentGrowthRecentActionBudgetMs,
    addedRows,
    addedRecentActions,
    effectivePanelElapsedDeltaMs:
      baseThreshold
      + addedRows * verifyContentGrowthRowBudgetMs
      + addedRecentActions * verifyContentGrowthRecentActionBudgetMs,
  }
}

const buildVerifyAttentionSummary = (latestPayload, successBaselinePayload) => {
  if (!latestPayload) {
    return {
      status: 'unavailable',
      reasons: [],
      deltaFromLatestSuccessBaseline: null,
    }
  }

  const latest = buildNormalizedVerifySummary(latestPayload)
  const reasons = []

  if (!latest.ok) {
    reasons.push('最近一次统一验证未通过')
  }
  if (latest.smokeRegressionOk === false) {
    reasons.push('策略活动 smoke 退化比较失败')
  }
  if (latest.smokeAttentionStatus === 'attention') {
    reasons.push('策略活动 smoke 当前为 attention')
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
  let panelElapsedThresholds = null
  if (successBaselinePayload) {
    deltaFromLatestSuccessBaseline = buildVerifyDeltaSummary(latestPayload, successBaselinePayload)
    panelElapsedThresholds = buildVerifyPanelElapsedThresholdWithContentGrowth(
      verifyAttentionPanelElapsedDeltaMs,
      latest,
      buildNormalizedVerifySummary(successBaselinePayload),
    )
    if (deltaFromLatestSuccessBaseline?.desktopVerifyElapsedMs >= verifyAttentionDesktopElapsedDeltaMs) {
      reasons.push(`桌面端验证链耗时相对成功基线增加 ${deltaFromLatestSuccessBaseline.desktopVerifyElapsedMs}ms`)
    }
    if (deltaFromLatestSuccessBaseline?.panelElapsedMs >= panelElapsedThresholds.effectivePanelElapsedDeltaMs) {
      reasons.push(`面板耗时相对成功基线增加 ${deltaFromLatestSuccessBaseline.panelElapsedMs}ms`)
    }
  }

  return {
    status: reasons.length ? 'attention' : 'stable',
    reasons,
    deltaFromLatestSuccessBaseline,
    thresholds: panelElapsedThresholds,
  }
}

const buildVerifyRegressionSummary = (latestPayload, successBaselinePayload) => {
  if (!latestPayload || !successBaselinePayload) {
    return {
      checked: false,
      ok: true,
      thresholds: {
        desktopElapsedDeltaMs: verifyRegressionDesktopElapsedDeltaMs,
        panelElapsedDeltaMs: verifyRegressionPanelElapsedDeltaMs,
      },
      reasons: [],
      deltaFromLatestSuccessBaseline: null,
    }
  }

  const latest = buildNormalizedVerifySummary(latestPayload)
  const baseline = buildNormalizedVerifySummary(successBaselinePayload)
  const delta = buildVerifyDeltaSummary(latestPayload, successBaselinePayload)
  const panelElapsedThresholds = buildVerifyPanelElapsedThresholdWithContentGrowth(
    verifyRegressionPanelElapsedDeltaMs,
    latest,
    baseline,
  )
  const reasons = []

  if (!latest.ok) {
    reasons.push('最近一次统一验证未通过')
  }
  if (latest.smokeRegressionOk === false) {
    reasons.push('策略活动 smoke 退化比较失败')
  }
  if (delta?.desktopVerifyElapsedMs >= verifyRegressionDesktopElapsedDeltaMs) {
    reasons.push(`桌面端验证链耗时相对成功基线增加 ${delta.desktopVerifyElapsedMs}ms`)
  }
  if (delta?.panelElapsedMs >= panelElapsedThresholds.effectivePanelElapsedDeltaMs) {
    reasons.push(`面板耗时相对成功基线增加 ${delta.panelElapsedMs}ms`)
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
    thresholds: {
      desktopElapsedDeltaMs: verifyRegressionDesktopElapsedDeltaMs,
      ...panelElapsedThresholds,
    },
    reasons,
    deltaFromLatestSuccessBaseline: delta,
  }
}

const buildVerifyTrendArtifacts = (historyPayloads) => {
  const recentPayloads = historyPayloads.slice(0, 10)
  const latestPayload = recentPayloads[0] ?? null
  const previousPayload = recentPayloads[1] ?? null
  const successBaselinePayload = findLatestVerifySuccessBaseline(historyPayloads, latestPayload)
  const latestFailureSample = findLatestVerifyFailureSample(historyPayloads, latestPayload)
  const consecutiveStableRuns = countConsecutiveStableVerifyRuns(historyPayloads)
  const attention = buildVerifyAttentionSummary(latestPayload, successBaselinePayload)
  const regression = buildVerifyRegressionSummary(latestPayload, successBaselinePayload)

  const recent = recentPayloads.map((payload) => buildNormalizedVerifySummary(payload))
  const latest = latestPayload ? buildNormalizedVerifySummary(latestPayload) : null
  const previous = previousPayload ? buildNormalizedVerifySummary(previousPayload) : null
  const latestSuccessBaseline = successBaselinePayload ? buildNormalizedVerifySummary(successBaselinePayload) : null
  const previousDelta = buildVerifyDeltaSummary(latestPayload, previousPayload)
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
    verifyAttentionDesktopElapsedDeltaMs,
    verifyAttentionPanelElapsedDeltaMs,
    verifyRegressionDesktopElapsedDeltaMs,
    verifyRegressionPanelElapsedDeltaMs,
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
    latestFailureSample: latestFailureSample ? buildNormalizedVerifySummary(latestFailureSample) : null,
    regression,
  }

  const lines = [
    '# 策略活动一键验证趋势',
    '',
    `- 历史样本数：${historyPayloads.length}`,
    `- 展示最近：${recent.length} 次`,
    `- 当前关注：${attention.status === 'attention' ? '需关注' : attention.status === 'stable' ? '稳定' : '不可用'}`,
    `- 成功基线：${latestSuccessBaseline?.generatedAt ?? 'n/a'}`,
    `- 距上次失败连续稳定：${consecutiveStableRuns} 次`,
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
    lines.push(`- 总耗时：${failure.totalElapsedMs}ms`)
    lines.push(`- 面板耗时：${failure.panelElapsedMs}ms`)
    lines.push(`- 当前策略：${failure.selectedStrategyName ?? 'n/a'}`)
    lines.push(`- 区块就绪：${failure.sectionCount}/6`)
    lines.push('')
  }

  if (latest && previousDelta) {
    lines.push('## 最近两次对比', '')
    lines.push(`- 最新：${latest.generatedAt ?? 'n/a'}`)
    lines.push(`- 上次：${previous?.generatedAt ?? 'n/a'}`)
    lines.push(`- 总耗时：${previous?.totalElapsedMs ?? 0}ms -> ${latest.totalElapsedMs}ms (${previousDelta.totalElapsedMs >= 0 ? '+' : ''}${previousDelta.totalElapsedMs}ms)`)
    lines.push(`- 面板耗时：${previous?.panelElapsedMs ?? 0}ms -> ${latest.panelElapsedMs}ms (${previousDelta.panelElapsedMs >= 0 ? '+' : ''}${previousDelta.panelElapsedMs}ms)`)
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
    lines.push('- 区块记录数：')
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
    lines.push(`- 顶部 recent key 新增：${formatKeyList(topRecentActionKeyDeltaFromPrevious?.added)}`)
    lines.push(`- 顶部 recent key 移除：${formatKeyList(topRecentActionKeyDeltaFromPrevious?.removed)}`)
    lines.push('- 顶部动作 key 新增：')
    lines.push(formatTopActionDeltaMap(topActionKeyDeltaFromPrevious, 'added'))
    lines.push('- 顶部动作 key 移除：')
    lines.push(formatTopActionDeltaMap(topActionKeyDeltaFromPrevious, 'removed'))
    lines.push(`- 面板提示 key 新增：${formatKeyList(panelNoteEntryKeyDeltaFromPrevious?.added)}`)
    lines.push(`- 面板提示 key 移除：${formatKeyList(panelNoteEntryKeyDeltaFromPrevious?.removed)}`)
    lines.push(`- 面板未结构化提示新增：${formatKeyList(panelNoteUnstructuredTextDeltaFromPrevious?.added)}`)
    lines.push(`- 面板未结构化提示移除：${formatKeyList(panelNoteUnstructuredTextDeltaFromPrevious?.removed)}`)
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
    lines.push(`- 顶部 recent key 新增：${formatKeyList(topRecentActionKeyDeltaFromLatestSuccessBaseline?.added)}`)
    lines.push(`- 顶部 recent key 移除：${formatKeyList(topRecentActionKeyDeltaFromLatestSuccessBaseline?.removed)}`)
    lines.push('- 顶部动作 key 新增：')
    lines.push(formatTopActionDeltaMap(topActionKeyDeltaFromLatestSuccessBaseline, 'added'))
    lines.push('- 顶部动作 key 移除：')
    lines.push(formatTopActionDeltaMap(topActionKeyDeltaFromLatestSuccessBaseline, 'removed'))
    lines.push(`- 面板提示 key 新增：${formatKeyList(panelNoteEntryKeyDeltaFromLatestSuccessBaseline?.added)}`)
    lines.push(`- 面板提示 key 移除：${formatKeyList(panelNoteEntryKeyDeltaFromLatestSuccessBaseline?.removed)}`)
    lines.push(`- 面板未结构化提示新增：${formatKeyList(panelNoteUnstructuredTextDeltaFromLatestSuccessBaseline?.added)}`)
    lines.push(`- 面板未结构化提示移除：${formatKeyList(panelNoteUnstructuredTextDeltaFromLatestSuccessBaseline?.removed)}`)
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

  lines.push('| 时间 | 状态 | 总耗时 | 面板耗时 | strategy | sections | topRecent | notes |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  recent.forEach((entry) => {
    lines.push(
      `| ${entry.generatedAt ?? 'n/a'} | ${entry.ok ? '通过' : '失败'} | ${entry.totalElapsedMs}ms | ${entry.panelElapsedMs}ms | ${entry.selectedStrategyName ?? 'n/a'} | ${entry.sectionCount}/6 | ${entry.topRecentActionCount} | ${entry.noteCount} |`,
    )
  })
  lines.push('')

  return {
    trendSummary,
    trendReport: `${lines.join('\n')}\n`,
  }
}

const steps = []
steps.push(runStep('backend-test-control-api', 'python3', ['-m', 'unittest', '-v', 'services/control-api/tests/test_control_api.py']))

let currentStatus = null
if (steps.at(-1)?.ok) {
  steps.push(runStep('desktop-verify-strategy-activity', 'pnpm', ['--dir', 'apps/desktop', 'verify:strategy-activity']))
}
if (steps.at(-1)?.ok) {
  const reportStep = runStep('desktop-report-strategy-activity-json', 'pnpm', ['--dir', 'apps/desktop', 'report:strategy-activity:json'])
  steps.push(reportStep)
  currentStatus = parseJsonFromMixedOutput(reportStep.stdout || '')?.currentStatus ?? null
}

const ok = steps.every((step) => step.ok)
const generatedAt = new Date().toISOString()
const historyKey = generatedAt.replaceAll(':', '-').replaceAll('.', '-')

const summary = {
  generatedAt,
  ok,
  steps: steps.map((step) => ({
    name: step.name,
    command: step.command,
    ok: step.ok,
    exitCode: step.exitCode,
    signal: step.signal,
    elapsedMs: step.elapsedMs,
    startedAt: step.startedAt,
  })),
  currentStatus,
}

const historyPayloads = [summary, ...readVerifyHistoryPayloads()]
const { trendSummary, trendReport } = buildVerifyTrendArtifacts(historyPayloads)
summary.verifyTrend = trendSummary

if (summary.currentStatus) {
  const verifyStepElapsedByName = buildStepElapsedByName(summary)
  summary.currentStatus = {
    ...summary.currentStatus,
    totalElapsedMs: sumStepElapsedMs(summary),
    backendTestElapsedMs: Number(verifyStepElapsedByName['backend-test-control-api'] ?? 0),
    desktopVerifyElapsedMs: Number(verifyStepElapsedByName['desktop-verify-strategy-activity'] ?? 0),
    desktopReportElapsedMs: Number(verifyStepElapsedByName['desktop-report-strategy-activity-json'] ?? 0),
    latestVerifySuccessGeneratedAt: trendSummary.latestSuccessBaseline?.generatedAt ?? null,
    consecutiveStableVerifyRuns: trendSummary.consecutiveStableRuns ?? 0,
    latestVerifyFailureGeneratedAt: trendSummary.latestFailureSample?.generatedAt ?? null,
    verifyAttentionStatus: trendSummary.attentionStatus ?? null,
    verifyAttentionReasons: Array.isArray(trendSummary.attentionReasons) ? trendSummary.attentionReasons : [],
    verifyRegressionChecked: Boolean(trendSummary.regression?.checked),
    verifyRegressionOk: trendSummary.regression?.checked ? trendSummary.regression?.ok !== false : null,
    verifyRegressionReasons: Array.isArray(trendSummary.regression?.reasons) ? trendSummary.regression.reasons : [],
    verifyRegressionThresholds: trendSummary.regression?.thresholds ?? null,
    deltaFromLatestVerifySuccessBaseline: trendSummary.deltaFromLatestSuccessBaseline ?? null,
  }
  currentStatus = summary.currentStatus
}

const reportLines = [
  '# 策略活动一键验证',
  '',
  `- 生成时间：${generatedAt}`,
  `- 状态：${ok ? '通过' : '失败'}`,
  `- 总耗时：${sumStepElapsedMs(summary)}ms`,
  '',
  '## 步骤结果',
  '',
]

for (const step of summary.steps) {
  reportLines.push(`- ${step.name}：${step.ok ? '通过' : '失败'}，${step.elapsedMs}ms，exit=${step.exitCode ?? 'null'}`)
}

if (currentStatus) {
  reportLines.push('', '## 当前策略活动状态', '')
  reportLines.push(`- 当前策略：${currentStatus.selectedStrategyName ?? 'n/a'}`)
  reportLines.push(`- 面板标题：${currentStatus.panelTitle ?? 'n/a'}`)
  reportLines.push(`- 当前区块：${currentStatus.activeSection ?? 'n/a'}`)
  reportLines.push(`- 统一验证 regression：${currentStatus.verifyRegressionChecked ? (currentStatus.verifyRegressionOk ? '通过' : '失败') : 'n/a'}`)
  reportLines.push(`- 统一验证 attention：${currentStatus.verifyAttentionStatus ?? 'n/a'}`)
  reportLines.push(`- 策略活动 smoke regression：${currentStatus.regressionChecked ? (currentStatus.regressionOk ? '通过' : '失败') : 'n/a'}`)
  reportLines.push(`- 策略活动 smoke attention：${currentStatus.attentionStatus ?? 'n/a'}`)
  reportLines.push(`- 验证总耗时：${currentStatus.totalElapsedMs ?? 0}ms`)
  reportLines.push(`- 桌面端验证链耗时：${currentStatus.desktopVerifyElapsedMs ?? 0}ms`)
  reportLines.push(`- 后端单测耗时：${currentStatus.backendTestElapsedMs ?? 0}ms`)
  reportLines.push(`- 面板耗时：${currentStatus.elapsedMs ?? 0}ms`)
  if (currentStatus.verifyRegressionThresholds) {
    reportLines.push(
      `- 统一验证阈值：desktop<=${currentStatus.verifyRegressionThresholds.desktopElapsedDeltaMs ?? 'n/a'}ms`
      + `，panel<=${currentStatus.verifyRegressionThresholds.basePanelElapsedDeltaMs ?? currentStatus.verifyRegressionThresholds.panelElapsedDeltaMs ?? 'n/a'}ms`
      + `${
        Number.isFinite(currentStatus.verifyRegressionThresholds.effectivePanelElapsedDeltaMs)
          ? `，当前 panel 有效阈值 ${currentStatus.verifyRegressionThresholds.effectivePanelElapsedDeltaMs}ms`
          : ''
      }`
      + `${
        Number.isFinite(currentStatus.verifyRegressionThresholds.addedRows) || Number.isFinite(currentStatus.verifyRegressionThresholds.addedRecentActions)
          ? `（新增记录 ${currentStatus.verifyRegressionThresholds.addedRows ?? 0}，新增 recent 动作 ${currentStatus.verifyRegressionThresholds.addedRecentActions ?? 0}）`
          : ''
      }`,
    )
  }
  reportLines.push(`- 查询状态：${currentStatus.queryStatus ?? 'n/a'} / ${currentStatus.fetchStatus ?? 'n/a'}`)
  reportLines.push(`- queryStrategyId：${currentStatus.queryStrategyId ?? 'n/a'}`)
  reportLines.push(`- 头部跟踪按钮：${currentStatus.headTrackButton ? 'ok' : 'missing'}`)
  reportLines.push(`- 顶部 recent 动作数：${currentStatus.topRecentActionCount ?? 0}`)
  reportLines.push(`- 顶部 recent 结构化 key：${currentStatus.topRecentActionsStructured ? 'ok' : 'missing'}`)
  reportLines.push(
    `- 顶部动作结构化：${Array.isArray(currentStatus.topActionsMissingStructuredKeys) && currentStatus.topActionsMissingStructuredKeys.length ? `missing (${currentStatus.topActionsMissingStructuredKeys.join(', ')})` : 'ok'}`,
  )
  reportLines.push(`- 顶部已渲染动作组：${formatKeyList(currentStatus.topActionVisibleGroups)}`)
  reportLines.push(`- 面板说明数：${currentStatus.noteCount ?? 0}`)
  reportLines.push(
    `- 关键面板提示 key：${Array.isArray(currentStatus.missingRequiredPanelNoteEntryKeys) && currentStatus.missingRequiredPanelNoteEntryKeys.length ? `missing (${currentStatus.missingRequiredPanelNoteEntryKeys.join(', ')})` : 'ok'}`,
  )
  reportLines.push(
    `- 区块动作结构化：${Array.isArray(currentStatus.sectionsMissingStructuredActionKeys) && currentStatus.sectionsMissingStructuredActionKeys.length ? `missing (${currentStatus.sectionsMissingStructuredActionKeys.join(', ')})` : 'ok'}`,
  )
  reportLines.push(
    `- 区块标签结构化：${Array.isArray(currentStatus.sectionsMissingStructuredBadgeKeys) && currentStatus.sectionsMissingStructuredBadgeKeys.length ? `missing (${currentStatus.sectionsMissingStructuredBadgeKeys.join(', ')})` : 'ok'}`,
  )
  reportLines.push(
    `- 区块记录主标题结构化：${Array.isArray(currentStatus.sectionsMissingStructuredRowTitles) && currentStatus.sectionsMissingStructuredRowTitles.length ? `missing (${currentStatus.sectionsMissingStructuredRowTitles.join(', ')})` : 'ok'}`,
  )
  reportLines.push(
    `- 区块对象标题绑定结构化：${Array.isArray(currentStatus.sectionsMissingStructuredRowTitleBindings) && currentStatus.sectionsMissingStructuredRowTitleBindings.length ? `missing (${currentStatus.sectionsMissingStructuredRowTitleBindings.join(', ')})` : 'ok'}`,
  )
  reportLines.push(
    `- 区块对象摘要绑定结构化：${Array.isArray(currentStatus.sectionsMissingStructuredRowSummaryBindings) && currentStatus.sectionsMissingStructuredRowSummaryBindings.length ? `missing (${currentStatus.sectionsMissingStructuredRowSummaryBindings.join(', ')})` : 'ok'}`,
  )
  reportLines.push(
    `- 区块对象动作绑定结构化：${Array.isArray(currentStatus.sectionsMissingStructuredRowActionBindings) && currentStatus.sectionsMissingStructuredRowActionBindings.length ? `missing (${currentStatus.sectionsMissingStructuredRowActionBindings.join(', ')})` : 'ok'}`,
  )
  reportLines.push(
    `- 区块对象标签绑定结构化：${Array.isArray(currentStatus.sectionsMissingStructuredRowBadgeBindings) && currentStatus.sectionsMissingStructuredRowBadgeBindings.length ? `missing (${currentStatus.sectionsMissingStructuredRowBadgeBindings.join(', ')})` : 'ok'}`,
  )
  reportLines.push(
    `- 区块行级语义指纹结构化：${
      (
        (Array.isArray(currentStatus.sectionsMissingStructuredRowSemanticBindings) && currentStatus.sectionsMissingStructuredRowSemanticBindings.length)
        || (Array.isArray(currentStatus.sectionsWithUnknownSemanticActions) && currentStatus.sectionsWithUnknownSemanticActions.length)
        || (Array.isArray(currentStatus.sectionsWithUnknownSemanticBadges) && currentStatus.sectionsWithUnknownSemanticBadges.length)
      )
        ? [
          Array.isArray(currentStatus.sectionsMissingStructuredRowSemanticBindings) && currentStatus.sectionsMissingStructuredRowSemanticBindings.length
            ? `missing (${currentStatus.sectionsMissingStructuredRowSemanticBindings.join(', ')})`
            : null,
          Array.isArray(currentStatus.sectionsWithUnknownSemanticActions) && currentStatus.sectionsWithUnknownSemanticActions.length
            ? `unknown_actions (${currentStatus.sectionsWithUnknownSemanticActions.join(', ')})`
            : null,
          Array.isArray(currentStatus.sectionsWithUnknownSemanticBadges) && currentStatus.sectionsWithUnknownSemanticBadges.length
            ? `unknown_badges (${currentStatus.sectionsWithUnknownSemanticBadges.join(', ')})`
            : null,
        ].filter(Boolean).join('；')
        : 'ok'
    }`,
  )
  reportLines.push(`- 区块行级语义指纹未映射动作：${formatKeyList(currentStatus.sectionsWithUnknownSemanticActions)}`)
  reportLines.push(`- 区块行级语义指纹未映射标签：${formatKeyList(currentStatus.sectionsWithUnknownSemanticBadges)}`)
  reportLines.push(
    `- 区块记录对象结构化：${Array.isArray(currentStatus.sectionsMissingStructuredRowIds) && currentStatus.sectionsMissingStructuredRowIds.length ? `missing (${currentStatus.sectionsMissingStructuredRowIds.join(', ')})` : 'ok'}`,
  )
  reportLines.push(
    `- 区块记录去重：${Array.isArray(currentStatus.sectionsWithDuplicateRowIds) && currentStatus.sectionsWithDuplicateRowIds.length ? `duplicated (${currentStatus.sectionsWithDuplicateRowIds.join(', ')})` : 'ok'}`,
  )
  reportLines.push(`- 已渲染动作区块：${formatKeyList(currentStatus.sectionActionVisibleSections)}`)
  reportLines.push(`- 区块内容异常：${Array.isArray(currentStatus.sectionsWithoutRowsOrEmptyState) && currentStatus.sectionsWithoutRowsOrEmptyState.length ? currentStatus.sectionsWithoutRowsOrEmptyState.join(', ') : '无'}`)
  reportLines.push(`- 区块就绪：${currentStatus.sectionCount ?? 0}/6`)
  reportLines.push(`- 统一验证成功基线：${currentStatus.latestVerifySuccessGeneratedAt ?? 'n/a'}`)
  reportLines.push(`- 统一验证连续稳定次数：${currentStatus.consecutiveStableVerifyRuns ?? 0}`)
  reportLines.push(`- 统一验证最近失败样本：${currentStatus.latestVerifyFailureGeneratedAt ?? 'n/a'}`)
  reportLines.push(`- 策略活动 smoke 成功基线：${currentStatus.latestSuccessGeneratedAt ?? 'n/a'}`)
  reportLines.push(`- 策略活动 smoke 连续稳定次数：${currentStatus.consecutiveStableRuns ?? 0}`)
  reportLines.push(`- 策略活动 smoke 最近失败样本：${currentStatus.latestFailureGeneratedAt ?? 'n/a'}`)
  if (Array.isArray(currentStatus.regressionReasons) && currentStatus.regressionReasons.length) {
    reportLines.push('', '## 退化原因', '')
    currentStatus.regressionReasons.slice(0, 5).forEach((reason) => {
      reportLines.push(`- ${reason}`)
    })
  }
  if (Array.isArray(currentStatus.attentionReasons) && currentStatus.attentionReasons.length) {
    reportLines.push('', '## 关注原因', '')
    currentStatus.attentionReasons.slice(0, 5).forEach((reason) => {
      reportLines.push(`- ${reason}`)
    })
  }
  if (Array.isArray(currentStatus.verifyRegressionReasons) && currentStatus.verifyRegressionReasons.length) {
    reportLines.push('', '## 统一验证退化原因', '')
    currentStatus.verifyRegressionReasons.slice(0, 5).forEach((reason) => {
      reportLines.push(`- ${reason}`)
    })
  }
  if (Array.isArray(currentStatus.verifyAttentionReasons) && currentStatus.verifyAttentionReasons.length) {
    reportLines.push('', '## 统一验证关注原因', '')
    currentStatus.verifyAttentionReasons.slice(0, 5).forEach((reason) => {
      reportLines.push(`- ${reason}`)
    })
  }
  if (Array.isArray(currentStatus.topRecentActionLabels) && currentStatus.topRecentActionLabels.length) {
    reportLines.push('', '## 顶部 Recent 动作', '')
    currentStatus.topRecentActionLabels.forEach((label, index) => {
      const key = Array.isArray(currentStatus.topRecentActionKeys) ? currentStatus.topRecentActionKeys[index] : null
      reportLines.push(`- ${key ? `${key} · ` : ''}${label}`)
    })
  }
  if (currentStatus.topActionKeysByGroup) {
    reportLines.push('', '## 顶部动作 Key', '')
    reportLines.push(formatTopActionKeyMap(currentStatus.topActionKeysByGroup))
  }
  if (currentStatus.topUnknownActionLabelsByGroup && requiredTopActionGroups.some((group) => {
    const values = currentStatus.topUnknownActionLabelsByGroup?.[group]
    return Array.isArray(values) && values.length > 0
  })) {
    reportLines.push('', '## 顶部未知动作标签', '')
    reportLines.push(formatTopActionKeyMap(currentStatus.topUnknownActionLabelsByGroup))
  }
  if (Array.isArray(currentStatus.panelNoteEntries) && currentStatus.panelNoteEntries.length) {
    reportLines.push('', '## 面板提示摘录', '')
    currentStatus.panelNoteEntries.slice(0, 8).forEach((entry) => {
      reportLines.push(`- ${entry?.key ? `${entry.key} · ` : ''}${entry?.text ?? ''}`)
    })
  } else if (Array.isArray(currentStatus.panelNoteTexts) && currentStatus.panelNoteTexts.length) {
    reportLines.push('', '## 面板提示摘录', '')
    currentStatus.panelNoteTexts.slice(0, 8).forEach((note) => {
      reportLines.push(`- ${note}`)
    })
  }
  if (currentStatus.sectionActionKeysBySection) {
    reportLines.push('', '## 区块动作 Key', '')
    reportLines.push(formatSectionKeyMap(currentStatus.sectionActionKeysBySection))
  }
  if (currentStatus.sectionRowCounts) {
    reportLines.push('', '## 区块记录数', '')
    reportLines.push(formatSectionCountMap(currentStatus.sectionRowCounts))
    reportLines.push('', `- 空态区块：${formatKeyList(currentStatus.sectionEmptyStateVisibleSections)}`)
  }
  if (currentStatus.sectionRowTitlesBySection) {
    reportLines.push('', '## 区块主标题', '')
    reportLines.push(formatSectionKeyMap(currentStatus.sectionRowTitlesBySection))
  }
  if (currentStatus.sectionRowTitleBindingsBySection) {
    reportLines.push('', '## 区块对象标题绑定', '')
    reportLines.push(formatSectionKeyMap(currentStatus.sectionRowTitleBindingsBySection))
  }
  if (currentStatus.sectionRowSummaryBindingsBySection) {
    reportLines.push('', '## 区块对象摘要绑定', '')
    reportLines.push(formatSectionKeyMap(currentStatus.sectionRowSummaryBindingsBySection))
  }
  if (currentStatus.sectionRowActionBindingsBySection) {
    reportLines.push('', '## 区块对象动作绑定', '')
    reportLines.push(formatSectionKeyMap(currentStatus.sectionRowActionBindingsBySection))
  }
  if (currentStatus.sectionRowBadgeBindingsBySection) {
    reportLines.push('', '## 区块对象标签绑定', '')
    reportLines.push(formatSectionKeyMap(currentStatus.sectionRowBadgeBindingsBySection))
  }
  if (currentStatus.sectionRowSemanticBindingsBySection) {
    reportLines.push('', '## 区块行级语义指纹', '')
    reportLines.push(formatSectionKeyMap(currentStatus.sectionRowSemanticBindingsBySection))
  }
  if (currentStatus.sectionRowIdsBySection) {
    reportLines.push('', '## 区块对象 ID', '')
    reportLines.push(formatSectionKeyMap(currentStatus.sectionRowIdsBySection))
  }
  if (currentStatus.sectionDuplicateRowIdsBySection) {
    reportLines.push('', '## 区块重复对象 ID', '')
    reportLines.push(formatSectionKeyMap(currentStatus.sectionDuplicateRowIdsBySection))
  }
  if (currentStatus.sectionBadgeKeysBySection) {
    reportLines.push('', '## 区块标签 Key', '')
    reportLines.push(formatSectionKeyMap(currentStatus.sectionBadgeKeysBySection))
  }
  if (
    currentStatus.sectionUnknownActionLabelsBySection
    && requiredActivitySections.some((section) => {
      const values = currentStatus.sectionUnknownActionLabelsBySection?.[section]
      return Array.isArray(values) && values.length > 0
    })
  ) {
    reportLines.push('', '## 区块未知动作标签', '')
    reportLines.push(formatSectionKeyMap(currentStatus.sectionUnknownActionLabelsBySection))
  }
  if (
    currentStatus.sectionUnknownBadgeLabelsBySection
    && requiredActivitySections.some((section) => {
      const values = currentStatus.sectionUnknownBadgeLabelsBySection?.[section]
      return Array.isArray(values) && values.length > 0
    })
  ) {
    reportLines.push('', '## 区块未知标签', '')
    reportLines.push(formatSectionKeyMap(currentStatus.sectionUnknownBadgeLabelsBySection))
  }
  if (
    currentStatus.sectionRowUnknownBadgeBindingsBySection
    && requiredActivitySections.some((section) => {
      const values = currentStatus.sectionRowUnknownBadgeBindingsBySection?.[section]
      return Array.isArray(values) && values.length > 0
    })
  ) {
    reportLines.push('', '## 区块对象未知标签绑定', '')
    reportLines.push(formatSectionKeyMap(currentStatus.sectionRowUnknownBadgeBindingsBySection))
  }
  if (currentStatus.output) {
    reportLines.push(`- 截图：${currentStatus.output}`)
  }
}

const report = `${reportLines.join('\n')}\n`
const logOutput = logChunks.join('')

fs.writeFileSync(latestVerifySummaryPath, `${JSON.stringify(summary, null, 2)}\n`)
fs.writeFileSync(latestVerifyReportPath, report)
fs.writeFileSync(latestVerifyLogPath, logOutput)
fs.writeFileSync(verifyTrendSummaryPath, `${JSON.stringify(trendSummary, null, 2)}\n`)
fs.writeFileSync(verifyTrendReportPath, trendReport)
fs.writeFileSync(tmpVerifyLogPath, logOutput)
fs.writeFileSync(path.join(verifyHistoryDir, `${historyKey}.json`), `${JSON.stringify(summary, null, 2)}\n`)
fs.writeFileSync(path.join(verifyHistoryDir, `${historyKey}.md`), report)
fs.writeFileSync(path.join(verifyHistoryDir, `${historyKey}.log`), logOutput)

if (isSuccessfulVerifyBaseline(summary)) {
  fs.writeFileSync(latestVerifySuccessSummaryPath, `${JSON.stringify(summary, null, 2)}\n`)
  fs.writeFileSync(latestVerifySuccessReportPath, report)
  fs.writeFileSync(latestVerifySuccessLogPath, logOutput)
}

const historyEntries = fs
  .readdirSync(verifyHistoryDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort()
const excessEntries = historyEntries.length - 90
if (excessEntries > 0) {
  for (const entry of historyEntries.slice(0, excessEntries)) {
    fs.rmSync(path.join(verifyHistoryDir, entry), { force: true })
  }
}

console.log(`[verify:strategy-activity] status=${ok ? 'ok' : 'failed'} steps=${summary.steps.length}`)
if (currentStatus) {
  console.log(
    `[verify:strategy-activity] strategy=${currentStatus.selectedStrategyName ?? 'n/a'} verify_regression=${currentStatus.verifyRegressionChecked ? (currentStatus.verifyRegressionOk ? 'pass' : 'fail') : 'n/a'} verify_attention=${currentStatus.verifyAttentionStatus ?? 'n/a'} smoke_regression=${currentStatus.regressionChecked ? (currentStatus.regressionOk ? 'pass' : 'fail') : 'n/a'} smoke_attention=${currentStatus.attentionStatus ?? 'n/a'} total=${currentStatus.totalElapsedMs ?? 0}ms elapsed=${currentStatus.elapsedMs ?? 0}ms sections=${currentStatus.sectionCount ?? 0}/6 top_recent=${currentStatus.topRecentActionCount ?? 0} notes=${currentStatus.noteCount ?? 0}`,
  )
}
console.log(`[verify:strategy-activity] summary=${latestVerifySummaryPath}`)
console.log(`[verify:strategy-activity] report=${latestVerifyReportPath}`)
console.log(`[verify:strategy-activity] log=${latestVerifyLogPath}`)
console.log(`[verify:strategy-activity] latest_success_summary=${latestVerifySuccessSummaryPath}`)
console.log(`[verify:strategy-activity] latest_success_report=${latestVerifySuccessReportPath}`)
console.log(`[verify:strategy-activity] latest_success_log=${latestVerifySuccessLogPath}`)
console.log(`[verify:strategy-activity] trend_summary=${verifyTrendSummaryPath}`)
console.log(`[verify:strategy-activity] trend_report=${verifyTrendReportPath}`)
console.log(`[verify:strategy-activity] history=${verifyHistoryDir}`)

if (!ok) {
  process.exit(1)
}

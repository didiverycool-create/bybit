import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const runtimeDir = fileURLToPath(new URL('../../../.runtime/market-switch/', import.meta.url))
const latestSummaryPath = path.join(runtimeDir, 'latest-summary.json')
const latestSuccessSummaryPath = path.join(runtimeDir, 'latest-success-summary.json')
const latestReportPath = path.join(runtimeDir, 'latest-report.md')
const latestSuccessReportPath = path.join(runtimeDir, 'latest-success-report.md')
const trendReportPath = path.join(runtimeDir, 'trend-report.md')
const trendSummaryPath = path.join(runtimeDir, 'trend-summary.json')
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

const latestReport = readFileOrNull(latestReportPath)
const latestSuccessReport = readFileOrNull(latestSuccessReportPath)
const trendReport = readFileOrNull(trendReportPath)
const trendSummary = readFileOrNull(trendSummaryPath)
const latestSummary = readFileOrNull(latestSummaryPath)
const latestSuccessSummary = readFileOrNull(latestSuccessSummaryPath)

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

const parsedLatestSummary = parseJsonOrNull(latestSummary)
const parsedLatestSuccessSummary = parseJsonOrNull(latestSuccessSummary)
const parsedTrendSummary = parseJsonOrNull(trendSummary)

const currentStatus = (() => {
  const latestSummaryData = parsedLatestSummary?.summary ?? {}
  const latestTrendSummary = Array.isArray(parsedTrendSummary?.recent) ? parsedTrendSummary.recent[0] ?? {} : {}
  const latestFailureSample = parsedTrendSummary?.latestFailureSample ?? null
  return {
    latestGeneratedAt: parsedLatestSummary?.generatedAt ?? null,
    latestSuccessGeneratedAt:
      parsedTrendSummary?.latestSuccessBaseline?.generatedAt
      ?? parsedLatestSuccessSummary?.generatedAt
      ?? null,
    attentionStatus: parsedTrendSummary?.attentionStatus ?? null,
    attentionReasons: Array.isArray(parsedTrendSummary?.attentionReasons) ? parsedTrendSummary.attentionReasons : [],
    consecutiveStableRuns: Number(parsedTrendSummary?.consecutiveStableRuns ?? 0),
    significantElapsedDeltaMs: Number(parsedTrendSummary?.significantElapsedDeltaMs ?? 0),
    maxElapsedMs: Number(latestSummaryData?.maxElapsedMs ?? 0),
    averageElapsedMs: Number(latestSummaryData?.averageElapsedMs ?? 0),
    minCandleCount: Number(latestSummaryData?.minCandleCount ?? 0),
    selectionCorrectedCount: Number(latestSummaryData?.selectionCorrectedCount ?? 0),
    fallbackCount: Number(latestSummaryData?.fallbackCount ?? 0),
    slowestStep: latestSummaryData?.slowestStep ?? null,
    detailSources: Array.isArray(latestSummaryData?.detailSources) ? latestSummaryData.detailSources : [],
    watchlistAligned: Boolean(latestTrendSummary?.watchlistAligned ?? false),
    invalidSelectionCorrected: Boolean(latestTrendSummary?.invalidSelectionCorrected ?? false),
    workspaceSelfHealOk: Boolean(latestTrendSummary?.workspaceSelfHealOk ?? false),
    workspaceSelfHealElapsedMs: Number(latestTrendSummary?.workspaceSelfHealElapsedMs ?? 0),
    invalidSelectedSymbol: latestTrendSummary?.invalidSelectedSymbol ?? null,
    latestFailureGeneratedAt: latestFailureSample?.generatedAt ?? null,
    latestFailureMaxElapsedMs: Number(latestFailureSample?.summary?.maxElapsedMs ?? 0),
    latestFailureSlowestStep: latestFailureSample?.summary?.slowestStep ?? null,
    deltaFromLatestSuccessBaseline: parsedTrendSummary?.deltaFromLatestSuccessBaseline ?? null,
    regressedStepCountFromLatestSuccessBaseline: Number(parsedTrendSummary?.regressedStepCountFromLatestSuccessBaseline ?? 0),
    improvedStepCountFromLatestSuccessBaseline: Number(parsedTrendSummary?.improvedStepCountFromLatestSuccessBaseline ?? 0),
  }
})()

if (!latestReport && !latestSuccessReport && !trendReport && !trendSummary && !latestSummary && !latestSuccessSummary) {
  console.error('[report:market-switch] 未找到任何 smoke 报告，请先运行 pnpm smoke:market-switch')
  process.exit(1)
}

if (outputJson) {
  console.log(JSON.stringify({
    latestSummaryPath,
    latestSuccessSummaryPath,
    latestReportPath,
    latestSuccessReportPath,
    trendReportPath,
    trendSummaryPath,
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
  }
  if (latestSuccessReport && latestSuccessReport !== latestReport) {
    if (latestReport) {
      console.log('\n---\n')
    }
    console.log('# 最近成功基线')
    console.log('')
    console.log(latestSuccessReport)
  }
  if ((latestReport || latestSuccessReport) && trendReport) {
    console.log('\n---\n')
  }
  if (trendReport) {
    console.log(trendReport)
  }

  console.log(
    `\n[report:market-switch] attention=${currentStatus.attentionStatus ?? 'n/a'} baseline=${currentStatus.latestSuccessGeneratedAt ?? 'n/a'} threshold=${currentStatus.significantElapsedDeltaMs || 0}ms stable_runs=${currentStatus.consecutiveStableRuns || 0} latest_failure=${currentStatus.latestFailureGeneratedAt ?? 'n/a'}`,
  )
  console.log(`\n[report:market-switch] latest-summary=${latestSummaryPath}`)
  console.log(`[report:market-switch] latest-success-summary=${latestSuccessSummaryPath}`)
  console.log(`[report:market-switch] latest=${latestReportPath}`)
  console.log(`[report:market-switch] latest-success=${latestSuccessReportPath}`)
  console.log(`[report:market-switch] trend=${trendReportPath}`)
  console.log(`[report:market-switch] trend-summary=${trendSummaryPath}`)
}

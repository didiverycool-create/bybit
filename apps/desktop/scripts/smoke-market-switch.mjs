import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const cwd = new URL('..', import.meta.url)
const timeoutMs = 90_000
const resultPath = process.env.BYBIT_SMOKE_MARKET_SWITCH_RESULT_PATH || '/tmp/bybit-smoke-market-switch-summary.json'
const rawLogPath = process.env.BYBIT_SMOKE_MARKET_SWITCH_LOG_PATH || '/tmp/bybit-smoke-market-switch.log'
const persistentDir = fileURLToPath(new URL('../../../.runtime/market-switch/', import.meta.url))
const persistentResultPath = process.env.BYBIT_SMOKE_MARKET_SWITCH_PERSISTENT_RESULT_PATH
  || path.join(persistentDir, 'latest-summary.json')
const persistentRawLogPath = process.env.BYBIT_SMOKE_MARKET_SWITCH_PERSISTENT_LOG_PATH
  || path.join(persistentDir, 'latest.log')
const persistentLatestSuccessResultPath = process.env.BYBIT_SMOKE_MARKET_SWITCH_LATEST_SUCCESS_RESULT_PATH
  || path.join(persistentDir, 'latest-success-summary.json')
const persistentLatestSuccessRawLogPath = process.env.BYBIT_SMOKE_MARKET_SWITCH_LATEST_SUCCESS_LOG_PATH
  || path.join(persistentDir, 'latest-success.log')
const persistentHistoryDir = process.env.BYBIT_SMOKE_MARKET_SWITCH_HISTORY_DIR
  || path.join(persistentDir, 'history')
const persistentReportPath = process.env.BYBIT_SMOKE_MARKET_SWITCH_REPORT_PATH
  || path.join(persistentDir, 'latest-report.md')
const persistentLatestSuccessReportPath = process.env.BYBIT_SMOKE_MARKET_SWITCH_LATEST_SUCCESS_REPORT_PATH
  || path.join(persistentDir, 'latest-success-report.md')
const persistentTrendReportPath = process.env.BYBIT_SMOKE_MARKET_SWITCH_TREND_REPORT_PATH
  || path.join(persistentDir, 'trend-report.md')
const persistentTrendSummaryPath = process.env.BYBIT_SMOKE_MARKET_SWITCH_TREND_SUMMARY_PATH
  || path.join(persistentDir, 'trend-summary.json')
const historyKeepCount = Number(process.env.BYBIT_SMOKE_MARKET_SWITCH_HISTORY_KEEP_COUNT || 20)
const successCleanupDelayMs = 500
const significantElapsedDeltaMs = Number(process.env.BYBIT_SMOKE_MARKET_SWITCH_SIGNIFICANT_ELAPSED_DELTA_MS || 20)
const attentionElapsedDeltaMs = Number(process.env.BYBIT_SMOKE_MARKET_SWITCH_ATTENTION_ELAPSED_DELTA_MS || 120)
const attentionAverageDeltaMs = Number(process.env.BYBIT_SMOKE_MARKET_SWITCH_ATTENTION_AVERAGE_DELTA_MS || 40)

const child = spawn('pnpm', ['dev:repair'], {
  cwd,
  env: {
    ...process.env,
    BYBIT_SMOKE_MARKET_SWITCH: '1',
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
    console.error(`[smoke:market-switch] 写入${description}失败: ${targetPath}`, error)
  }
}

const sanitizeTimestamp = (value) => String(value ?? '')
  .replaceAll(':', '-')
  .replaceAll('.', '-')

const isSuccessfulBaseline = (payload) => Boolean(payload?.ok) && payload?.regression?.ok !== false
const isFailureSample = (payload) => payload?.ok === false || payload?.regression?.ok === false

const extractMatrixSteps = (payload) => Array.isArray(payload?.results)
  ? payload.results
    .filter((step) => typeof step?.label === 'string' && step.label.startsWith('matrix-'))
    .map((step) => ({
      label: step.label,
      symbol: step.symbol,
      timeframe: step.timeframe,
      elapsedMs: Number(step?.readiness?.elapsedMs ?? 0),
      candles: Number(step?.readiness?.state?.renderedMarketCandleCount ?? 0),
      fallbackCount: Number(step?.readiness?.state?.renderedMarketFallbackCount ?? 0),
      selectionCorrected: Boolean(step?.readiness?.state?.renderedMarketSelectionCorrected ?? false),
      source: step?.readiness?.state?.renderedMarketDetailSource ?? 'unknown',
    }))
  : []

const buildNormalizedSummary = (payload) => {
  const rawSummary = payload?.summary ?? {}
  const matrixSteps = extractMatrixSteps(payload)
  const watchlistAligned = Boolean(payload?.smokePlan?.watchlistAligned ?? payload?.watchlistAligned ?? false)
  const invalidSelectionCorrected = Boolean(
    payload?.smokePlan?.invalidSelectionCorrected ?? payload?.invalidSelectionCorrected ?? false,
  )
  const workspaceSelfHealOk = Boolean(payload?.workspaceSelfHeal?.ok ?? false)
  const workspaceSelfHealElapsedMs = Number(payload?.workspaceSelfHeal?.elapsedMs ?? 0)
  const invalidSelectedSymbol = payload?.smokePlan?.invalidSelectedSymbol ?? payload?.invalidSelectedSymbol ?? null
  if (!matrixSteps.length) {
    return {
      totalSteps: Number(rawSummary?.totalSteps ?? 0),
      measuredSteps: Number(rawSummary?.measuredSteps ?? 0),
      maxElapsedMs: Number(rawSummary?.maxElapsedMs ?? 0),
      averageElapsedMs: Number(rawSummary?.averageElapsedMs ?? 0),
      slowestStep: rawSummary?.slowestStep ?? null,
      selectionCorrectedCount: Number(rawSummary?.selectionCorrectedCount ?? 0),
      fallbackCount: Number(rawSummary?.fallbackCount ?? 0),
      minCandleCount: Number(rawSummary?.minCandleCount ?? 0),
      detailSources: Array.isArray(rawSummary?.detailSources) ? rawSummary.detailSources : [],
      watchlistAligned,
      invalidSelectionCorrected,
      workspaceSelfHealOk,
      workspaceSelfHealElapsedMs,
      invalidSelectedSymbol,
    }
  }

  const elapsedValues = matrixSteps.map((step) => Number(step.elapsedMs ?? 0))
  const totalElapsedMs = elapsedValues.reduce((sum, value) => sum + value, 0)
  const slowestStep = matrixSteps.reduce((slowest, step) => {
    if (!slowest || step.elapsedMs > slowest.elapsedMs) {
      return step
    }
    return slowest
  }, null)

  return {
    totalSteps: Number(rawSummary?.totalSteps ?? matrixSteps.length),
    measuredSteps: matrixSteps.length,
    maxElapsedMs: elapsedValues.length ? Math.max(...elapsedValues) : 0,
    averageElapsedMs: elapsedValues.length ? Math.round(totalElapsedMs / elapsedValues.length) : 0,
    slowestStep: slowestStep
      ? {
        label: slowestStep.label,
        symbol: slowestStep.symbol,
        timeframe: slowestStep.timeframe,
        elapsedMs: slowestStep.elapsedMs,
      }
      : null,
    selectionCorrectedCount: matrixSteps.filter((step) => step.selectionCorrected).length,
    fallbackCount: matrixSteps.reduce((sum, step) => sum + Number(step.fallbackCount ?? 0), 0),
    minCandleCount: matrixSteps.reduce((min, step) => Math.min(min, Number(step.candles ?? 0)), Number.POSITIVE_INFINITY),
    detailSources: Array.from(new Set(matrixSteps.map((step) => step.source).filter(Boolean))),
    watchlistAligned,
    invalidSelectionCorrected,
    workspaceSelfHealOk,
    workspaceSelfHealElapsedMs,
    invalidSelectedSymbol,
  }
}

const buildComparableRegressionSummary = (steps) => {
  const normalizedSteps = Array.isArray(steps) ? steps : []
  if (!normalizedSteps.length) {
    return null
  }
  const elapsedValues = normalizedSteps.map((step) => Number(step.elapsedMs ?? 0))
  const totalElapsedMs = elapsedValues.reduce((sum, value) => sum + value, 0)
  return {
    maxElapsedMs: elapsedValues.length ? Math.max(...elapsedValues) : 0,
    averageElapsedMs: elapsedValues.length ? Math.round(totalElapsedMs / elapsedValues.length) : 0,
    minCandleCount: normalizedSteps.reduce((min, step) => Math.min(min, Number(step.candles ?? 0)), Number.POSITIVE_INFINITY),
    fallbackCount: normalizedSteps.reduce((sum, step) => sum + Number(step.fallbackCount ?? 0), 0),
    selectionCorrectedCount: normalizedSteps.filter((step) => step.selectionCorrected).length,
  }
}

const buildComparableStepSet = (latestPayload, baselinePayload) => {
  const latestSteps = extractMatrixSteps(latestPayload)
  const baselineStepMap = new Map(extractMatrixSteps(baselinePayload).map((step) => [step.label, step]))
  const comparableLatestSteps = latestSteps.filter((step) => baselineStepMap.has(step.label))
  const comparableBaselineSteps = comparableLatestSteps
    .map((step) => baselineStepMap.get(step.label))
    .filter(Boolean)
  return {
    comparableLatestSteps,
    comparableBaselineSteps,
  }
}

const buildStepDeltaSummary = (latestPayload, previousPayload) => {
  const latestSteps = extractMatrixSteps(latestPayload)
  const previousSteps = new Map(extractMatrixSteps(previousPayload).map((step) => [step.label, step]))
  return latestSteps
    .map((step) => {
      const previousStep = previousSteps.get(step.label)
      if (!previousStep) {
        return {
          label: step.label,
          symbol: step.symbol,
          timeframe: step.timeframe,
          isNew: true,
          elapsedDeltaMs: step.elapsedMs,
          candlesDelta: step.candles,
          fallbackDelta: step.fallbackCount,
          selectionCorrectedDelta: step.selectionCorrected ? 1 : 0,
          latest: step,
          previous: null,
        }
      }
      return {
        label: step.label,
        symbol: step.symbol,
        timeframe: step.timeframe,
        isNew: false,
        elapsedDeltaMs: step.elapsedMs - previousStep.elapsedMs,
        candlesDelta: step.candles - previousStep.candles,
        fallbackDelta: step.fallbackCount - previousStep.fallbackCount,
        selectionCorrectedDelta: Number(step.selectionCorrected) - Number(previousStep.selectionCorrected),
        latest: step,
        previous: previousStep,
      }
    })
    .filter((step) => step.isNew || step.elapsedDeltaMs !== 0 || step.candlesDelta !== 0 || step.fallbackDelta !== 0 || step.selectionCorrectedDelta !== 0)
    .sort((a, b) => {
      const elapsedGap = b.elapsedDeltaMs - a.elapsedDeltaMs
      if (elapsedGap !== 0) {
        return elapsedGap
      }
      return a.label.localeCompare(b.label)
    })
}

const splitStepDeltaSummary = (stepDeltas) => {
  const regressedSteps = stepDeltas.filter(
    (step) =>
      step.elapsedDeltaMs >= significantElapsedDeltaMs
      || step.fallbackDelta > 0
      || step.selectionCorrectedDelta > 0
      || step.candlesDelta < 0,
  )
  const improvedSteps = stepDeltas.filter(
    (step) =>
      step.elapsedDeltaMs <= -significantElapsedDeltaMs
      || step.candlesDelta > 0,
  )
  return {
    regressedSteps,
    improvedSteps,
  }
}

const buildAttentionAgainstSuccessBaseline = (latestPayload, successBaselinePayload) => {
  if (!latestPayload || !successBaselinePayload) {
    return {
      status: 'unavailable',
      reasons: [],
    }
  }

  const baselineSummary = buildNormalizedSummary(successBaselinePayload)
  const normalizedLatestSummary = buildNormalizedSummary(latestPayload)
  const { comparableLatestSteps, comparableBaselineSteps } = buildComparableStepSet(latestPayload, successBaselinePayload)
  const comparableLatestSummary = buildComparableRegressionSummary(comparableLatestSteps)
  const comparableBaselineSummary = buildComparableRegressionSummary(comparableBaselineSteps)
  const reasons = []

  const maxDelta =
    Number(comparableLatestSummary?.maxElapsedMs ?? normalizedLatestSummary?.maxElapsedMs ?? 0)
    - Number(comparableBaselineSummary?.maxElapsedMs ?? baselineSummary?.maxElapsedMs ?? 0)
  const averageDelta =
    Number(comparableLatestSummary?.averageElapsedMs ?? normalizedLatestSummary?.averageElapsedMs ?? 0)
    - Number(comparableBaselineSummary?.averageElapsedMs ?? baselineSummary?.averageElapsedMs ?? 0)
  const minCandleDelta =
    Number(comparableLatestSummary?.minCandleCount ?? normalizedLatestSummary?.minCandleCount ?? 0)
    - Number(comparableBaselineSummary?.minCandleCount ?? baselineSummary?.minCandleCount ?? 0)
  const correctedDelta =
    Number(comparableLatestSummary?.selectionCorrectedCount ?? normalizedLatestSummary?.selectionCorrectedCount ?? 0)
    - Number(comparableBaselineSummary?.selectionCorrectedCount ?? baselineSummary?.selectionCorrectedCount ?? 0)
  const fallbackDelta =
    Number(comparableLatestSummary?.fallbackCount ?? normalizedLatestSummary?.fallbackCount ?? 0)
    - Number(comparableBaselineSummary?.fallbackCount ?? baselineSummary?.fallbackCount ?? 0)

  if (normalizedLatestSummary?.watchlistAligned === false) {
    reasons.push('watchlist 未对齐')
  }
  if (normalizedLatestSummary?.invalidSelectionCorrected === false) {
    reasons.push('失效 symbol 自愈失败')
  }
  if (normalizedLatestSummary?.workspaceSelfHealOk === false) {
    reasons.push('本地工作台自愈失败')
  }

  if (maxDelta >= attentionElapsedDeltaMs) {
    reasons.push(`maxElapsedMs 相对成功基线增加 ${maxDelta}ms`)
  }
  if (averageDelta >= attentionAverageDeltaMs) {
    reasons.push(`averageElapsedMs 相对成功基线增加 ${averageDelta}ms`)
  }
  if (minCandleDelta < 0) {
    reasons.push(`minCandleCount 相对成功基线下降 ${Math.abs(minCandleDelta)}`)
  }
  if (correctedDelta > 0) {
    reasons.push(`selectionCorrectedCount 相对成功基线增加 ${correctedDelta}`)
  }
  if (fallbackDelta > 0) {
    reasons.push(`fallbackCount 相对成功基线增加 ${fallbackDelta}`)
  }

  const stepDeltas = buildStepDeltaSummary(latestPayload, successBaselinePayload)
  const { regressedSteps, improvedSteps } = splitStepDeltaSummary(stepDeltas)
  regressedSteps
    .filter((step) =>
      !step.isNew && (
        step.elapsedDeltaMs >= attentionElapsedDeltaMs
        || step.fallbackDelta > 0
        || step.selectionCorrectedDelta > 0
        || step.candlesDelta < 0
      ),
    )
    .slice(0, 5)
    .forEach((step) => {
    reasons.push(`${step.symbol}/${step.timeframe} 相对成功基线变慢 ${step.elapsedDeltaMs}ms`)
    })

  return {
    status: reasons.length ? 'attention' : 'stable',
    reasons,
    regressedSteps,
    improvedSteps,
  }
}

const buildLatestReport = (payload) => {
  const summary = buildNormalizedSummary(payload)
  const regression = payload?.regression ?? {}
  const stepComparisons = Array.isArray(regression?.stepComparisons) ? regression.stepComparisons : []
  const failedSteps = stepComparisons.filter((step) => step?.checked && step?.ok === false)
  const slowSteps = Array.isArray(payload?.results)
    ? payload.results
      .filter((step) => typeof step?.label === 'string' && step.label.startsWith('matrix-'))
      .map((step) => ({
        label: step.label,
        symbol: step.symbol,
        timeframe: step.timeframe,
        elapsedMs: Number(step?.readiness?.elapsedMs ?? 0),
        candles: Number(step?.readiness?.state?.renderedMarketCandleCount ?? 0),
        source: step?.readiness?.state?.renderedMarketDetailSource ?? 'unknown',
      }))
      .sort((a, b) => b.elapsedMs - a.elapsedMs)
      .slice(0, 5)
    : []

  const lines = [
    '# 行情切换 smoke 最新结果',
    '',
    `- 生成时间：${payload?.generatedAt ?? 'n/a'}`,
    `- 状态：${payload?.ok ? '通过' : '失败'}`,
    `- 最大耗时：${summary?.maxElapsedMs ?? 0}ms`,
    `- 平均耗时：${summary?.averageElapsedMs ?? 0}ms`,
    `- 最慢步骤：${summary?.slowestStep ? `${summary.slowestStep.symbol}/${summary.slowestStep.timeframe} ${summary.slowestStep.elapsedMs}ms` : 'n/a'}`,
    `- 最小 K 线根数：${summary?.minCandleCount ?? 0}`,
    `- symbol 自动纠正次数：${summary?.selectionCorrectedCount ?? 0}`,
    `- fallback 次数：${summary?.fallbackCount ?? 0}`,
    `- 数据源：${Array.isArray(summary?.detailSources) && summary.detailSources.length ? summary.detailSources.join(', ') : 'n/a'}`,
    `- watchlist 对齐：${summary?.watchlistAligned ? '是' : '否'}`,
    `- 失效 symbol 自愈：${summary?.invalidSelectionCorrected ? '是' : '否'}${summary?.invalidSelectedSymbol ? `（当前有效 symbol：${summary.invalidSelectedSymbol}）` : ''}`,
    `- 本地工作台自愈：${summary?.workspaceSelfHealOk ? '是' : '否'}${summary?.workspaceSelfHealElapsedMs ? `，${summary.workspaceSelfHealElapsedMs}ms` : ''}`,
    '',
    '## 退化比较',
    '',
    `- 已检查：${regression?.checked ? '是' : '否'}`,
    `- 结果：${regression?.ok === false ? '失败' : '通过'}`,
  ]

  if (regression?.checked) {
    lines.push(`- 阈值：max<=${regression?.thresholds?.maxAllowed ?? 'n/a'}ms，avg<=${regression?.thresholds?.averageAllowed ?? 'n/a'}ms`)
  }
  if (failedSteps.length) {
    lines.push('', '### 失败步骤')
    failedSteps.forEach((step) => {
      lines.push(`- ${step.symbol}/${step.timeframe}：${Array.isArray(step?.reasons) ? step.reasons.join('；') : '未知原因'}`)
    })
  }

  if (slowSteps.length) {
    lines.push('', '## 最慢步骤 Top 5', '')
    slowSteps.forEach((step) => {
      lines.push(`- ${step.symbol}/${step.timeframe}：${step.elapsedMs}ms，candles=${step.candles}，source=${step.source}`)
    })
  }

  lines.push('')
  return `${lines.join('\n')}\n`
}

const archivePersistentResult = (payload) => {
  try {
    fs.mkdirSync(persistentHistoryDir, { recursive: true })
    const stamp = sanitizeTimestamp(payload?.generatedAt || new Date().toISOString())
    const historyPath = path.join(persistentHistoryDir, `${stamp}.json`)
    fs.writeFileSync(historyPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    const files = fs.readdirSync(persistentHistoryDir)
      .filter((file) => file.endsWith('.json'))
      .sort()
    const excessFiles = files.slice(0, Math.max(0, files.length - historyKeepCount))
    excessFiles.forEach((file) => {
      fs.rmSync(path.join(persistentHistoryDir, file), { force: true })
    })
  } catch (error) {
    console.error(`[smoke:market-switch] 写入历史结果失败: ${persistentHistoryDir}`, error)
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

const buildTrendReport = (historyPayloads) => {
  const recent = historyPayloads.slice(0, 10)
  const latest = recent[0] ?? null
  const successBaseline = findLatestSuccessBaseline(historyPayloads, latest)
  const latestFailureSample = findLatestFailureSample(historyPayloads, latest)
  const consecutiveStableRuns = countConsecutiveSuccessfulRuns(historyPayloads)
  const attention = buildAttentionAgainstSuccessBaseline(latest, successBaseline)
  const lines = [
    '# 行情切换 smoke 趋势',
    '',
    `- 历史样本数：${historyPayloads.length}`,
    `- 展示最近：${recent.length} 次`,
    '',
  ]

  if (!recent.length) {
    lines.push('- 暂无历史结果', '')
    return `${lines.join('\n')}\n`
  }

  if (successBaseline) {
    lines.push('## 当前关注', '')
    lines.push(`- 状态：${attention.status === 'attention' ? '需关注' : '稳定'}`)
    lines.push(`- 成功基线：${successBaseline?.generatedAt ?? 'n/a'}`)
    lines.push(`- 距上次失败连续通过：${consecutiveStableRuns} 次`)
    if (attention.reasons.length) {
      attention.reasons.slice(0, 5).forEach((reason) => {
        lines.push(`- ${reason}`)
      })
    }
    lines.push('')
  }

  if (latestFailureSample) {
    const failureSummary = buildNormalizedSummary(latestFailureSample)
    lines.push('## 最近失败样本', '')
    lines.push(`- 时间：${latestFailureSample?.generatedAt ?? 'n/a'}`)
    lines.push(`- 最大耗时：${failureSummary?.maxElapsedMs ?? 0}ms`)
    lines.push(`- 平均耗时：${failureSummary?.averageElapsedMs ?? 0}ms`)
    lines.push(`- 最慢步骤：${failureSummary?.slowestStep ? `${failureSummary.slowestStep.symbol}/${failureSummary.slowestStep.timeframe} ${failureSummary.slowestStep.elapsedMs}ms` : 'n/a'}`)
    const failureReasons = Array.isArray(latestFailureSample?.regression?.reasons) ? latestFailureSample.regression.reasons : []
    failureReasons.slice(0, 5).forEach((reason) => {
      lines.push(`- ${reason}`)
    })
    lines.push('')
  }

  lines.push('| 时间 | max | avg | 最慢步骤 | candles(min) | corrected | fallback | sources |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  recent.forEach((payload) => {
    const summary = buildNormalizedSummary(payload)
    const slowest = summary?.slowestStep
      ? `${summary.slowestStep.symbol}/${summary.slowestStep.timeframe} ${summary.slowestStep.elapsedMs}ms`
      : 'n/a'
    const sources = Array.isArray(summary?.detailSources) && summary.detailSources.length
      ? summary.detailSources.join(', ')
      : 'n/a'
    lines.push(
      `| ${payload?.generatedAt ?? 'n/a'} | ${summary?.maxElapsedMs ?? 0}ms | ${summary?.averageElapsedMs ?? 0}ms | ${slowest} | ${summary?.minCandleCount ?? 0} | ${summary?.selectionCorrectedCount ?? 0} | ${summary?.fallbackCount ?? 0} | ${sources} |`,
    )
  })

  if (recent.length >= 2) {
    const [, previous] = recent
    const latestSummary = buildNormalizedSummary(latest)
    const previousSummary = buildNormalizedSummary(previous)
    const stepDeltas = buildStepDeltaSummary(latest, previous)
    const { regressedSteps, improvedSteps } = splitStepDeltaSummary(stepDeltas)
    lines.push('', '## 最近两次对比', '')
    lines.push(`- 最新：${latest?.generatedAt ?? 'n/a'}`)
    lines.push(`- 上次：${previous?.generatedAt ?? 'n/a'}`)
    lines.push(`- max：${previousSummary?.maxElapsedMs ?? 0}ms -> ${latestSummary?.maxElapsedMs ?? 0}ms`)
    lines.push(`- avg：${previousSummary?.averageElapsedMs ?? 0}ms -> ${latestSummary?.averageElapsedMs ?? 0}ms`)
    lines.push(`- candles(min)：${previousSummary?.minCandleCount ?? 0} -> ${latestSummary?.minCandleCount ?? 0}`)
    lines.push(`- corrected：${previousSummary?.selectionCorrectedCount ?? 0} -> ${latestSummary?.selectionCorrectedCount ?? 0}`)
    lines.push(`- fallback：${previousSummary?.fallbackCount ?? 0} -> ${latestSummary?.fallbackCount ?? 0}`)
    lines.push(`- 显著变慢步骤数：${regressedSteps.length}（阈值 ${significantElapsedDeltaMs}ms）`)
    lines.push(`- 显著变快步骤数：${improvedSteps.length}（阈值 ${significantElapsedDeltaMs}ms）`)
    const renderStepDelta = (step) => {
      const deltaParts = [`elapsed=${step.elapsedDeltaMs >= 0 ? '+' : ''}${step.elapsedDeltaMs}ms`]
      if (step.candlesDelta !== 0) {
        deltaParts.push(`candles=${step.candlesDelta >= 0 ? '+' : ''}${step.candlesDelta}`)
      }
      if (step.fallbackDelta !== 0) {
        deltaParts.push(`fallback=${step.fallbackDelta >= 0 ? '+' : ''}${step.fallbackDelta}`)
      }
      if (step.selectionCorrectedDelta !== 0) {
        deltaParts.push(`corrected=${step.selectionCorrectedDelta >= 0 ? '+' : ''}${step.selectionCorrectedDelta}`)
      }
      lines.push(`- ${step.symbol}/${step.timeframe}：${deltaParts.join('，')}`)
    }
    if (regressedSteps.length) {
      lines.push('', '### 变慢步骤 Top 5', '')
      regressedSteps.slice(0, 5).forEach(renderStepDelta)
    }
    if (improvedSteps.length) {
      lines.push('', '### 变快步骤 Top 5', '')
      improvedSteps.slice(0, 5).forEach(renderStepDelta)
    }
  }

  if (latest && successBaseline) {
    const latestSummary = buildNormalizedSummary(latest)
    const baselineSummary = buildNormalizedSummary(successBaseline)
    const stepDeltas = buildStepDeltaSummary(latest, successBaseline)
    const { regressedSteps, improvedSteps } = splitStepDeltaSummary(stepDeltas)
    lines.push('', '## 最近成功基线对比', '')
    lines.push(`- 最新：${latest?.generatedAt ?? 'n/a'}`)
    lines.push(`- 成功基线：${successBaseline?.generatedAt ?? 'n/a'}`)
    lines.push(`- max：${baselineSummary?.maxElapsedMs ?? 0}ms -> ${latestSummary?.maxElapsedMs ?? 0}ms`)
    lines.push(`- avg：${baselineSummary?.averageElapsedMs ?? 0}ms -> ${latestSummary?.averageElapsedMs ?? 0}ms`)
    lines.push(`- candles(min)：${baselineSummary?.minCandleCount ?? 0} -> ${latestSummary?.minCandleCount ?? 0}`)
    lines.push(`- corrected：${baselineSummary?.selectionCorrectedCount ?? 0} -> ${latestSummary?.selectionCorrectedCount ?? 0}`)
    lines.push(`- fallback：${baselineSummary?.fallbackCount ?? 0} -> ${latestSummary?.fallbackCount ?? 0}`)
    lines.push(`- 相对成功基线显著变慢步骤数：${regressedSteps.length}（阈值 ${significantElapsedDeltaMs}ms）`)
    lines.push(`- 相对成功基线显著变快步骤数：${improvedSteps.length}（阈值 ${significantElapsedDeltaMs}ms）`)
    const renderBaselineStepDelta = (step) => {
      const deltaParts = [`elapsed=${step.elapsedDeltaMs >= 0 ? '+' : ''}${step.elapsedDeltaMs}ms`]
      if (step.candlesDelta !== 0) {
        deltaParts.push(`candles=${step.candlesDelta >= 0 ? '+' : ''}${step.candlesDelta}`)
      }
      if (step.fallbackDelta !== 0) {
        deltaParts.push(`fallback=${step.fallbackDelta >= 0 ? '+' : ''}${step.fallbackDelta}`)
      }
      if (step.selectionCorrectedDelta !== 0) {
        deltaParts.push(`corrected=${step.selectionCorrectedDelta >= 0 ? '+' : ''}${step.selectionCorrectedDelta}`)
      }
      lines.push(`- ${step.symbol}/${step.timeframe}：${deltaParts.join('，')}`)
    }
    if (regressedSteps.length) {
      lines.push('', '### 相对成功基线变慢步骤 Top 5', '')
      regressedSteps.slice(0, 5).forEach(renderBaselineStepDelta)
    }
    if (improvedSteps.length) {
      lines.push('', '### 相对成功基线变快步骤 Top 5', '')
      improvedSteps.slice(0, 5).forEach(renderBaselineStepDelta)
    }
  }

  lines.push('')
  return `${lines.join('\n')}\n`
}

const buildTrendSummary = (historyPayloads) => {
  const recent = historyPayloads.slice(0, 10)
  const latest = recent[0] ?? null
  const previous = recent[1] ?? null
  const successBaseline = findLatestSuccessBaseline(historyPayloads, latest)
  const latestFailureSample = findLatestFailureSample(historyPayloads, latest)
  const consecutiveStableRuns = countConsecutiveSuccessfulRuns(historyPayloads)
  const latestSummary = buildNormalizedSummary(latest)
  const previousSummary = buildNormalizedSummary(previous)
  const stepDeltas = previous ? buildStepDeltaSummary(latest, previous) : []
  const { regressedSteps, improvedSteps } = splitStepDeltaSummary(stepDeltas)
  const successBaselineSummary = buildNormalizedSummary(successBaseline)
  const successBaselineStepDeltas = successBaseline ? buildStepDeltaSummary(latest, successBaseline) : []
  const {
    regressedSteps: regressedStepsFromSuccessBaseline,
    improvedSteps: improvedStepsFromSuccessBaseline,
  } = splitStepDeltaSummary(successBaselineStepDeltas)
  const attention = buildAttentionAgainstSuccessBaseline(latest, successBaseline)

  return {
    generatedAt: new Date().toISOString(),
    historyCount: historyPayloads.length,
    significantElapsedDeltaMs,
    attentionStatus: attention.status,
    attentionReasons: attention.reasons,
    consecutiveStableRuns,
    recent: recent.map((payload) => {
      const summary = buildNormalizedSummary(payload)
      return {
        generatedAt: payload?.generatedAt ?? null,
        maxElapsedMs: Number(summary?.maxElapsedMs ?? 0),
        averageElapsedMs: Number(summary?.averageElapsedMs ?? 0),
        slowestStep: summary?.slowestStep ?? null,
        minCandleCount: Number(summary?.minCandleCount ?? 0),
        selectionCorrectedCount: Number(summary?.selectionCorrectedCount ?? 0),
        fallbackCount: Number(summary?.fallbackCount ?? 0),
        detailSources: Array.isArray(summary?.detailSources) ? summary.detailSources : [],
        watchlistAligned: Boolean(summary?.watchlistAligned ?? false),
        invalidSelectionCorrected: Boolean(summary?.invalidSelectionCorrected ?? false),
        workspaceSelfHealOk: Boolean(summary?.workspaceSelfHealOk ?? false),
        workspaceSelfHealElapsedMs: Number(summary?.workspaceSelfHealElapsedMs ?? 0),
        invalidSelectedSymbol: summary?.invalidSelectedSymbol ?? null,
      }
    }),
    deltaFromPrevious: previous
      ? {
        latestGeneratedAt: latest?.generatedAt ?? null,
        previousGeneratedAt: previous?.generatedAt ?? null,
        maxElapsedMs: Number(latestSummary?.maxElapsedMs ?? 0) - Number(previousSummary?.maxElapsedMs ?? 0),
        averageElapsedMs: Number(latestSummary?.averageElapsedMs ?? 0) - Number(previousSummary?.averageElapsedMs ?? 0),
        minCandleCount: Number(latestSummary?.minCandleCount ?? 0) - Number(previousSummary?.minCandleCount ?? 0),
        selectionCorrectedCount: Number(latestSummary?.selectionCorrectedCount ?? 0) - Number(previousSummary?.selectionCorrectedCount ?? 0),
        fallbackCount: Number(latestSummary?.fallbackCount ?? 0) - Number(previousSummary?.fallbackCount ?? 0),
      }
      : null,
    latestSuccessBaseline: successBaseline
      ? {
        generatedAt: successBaseline?.generatedAt ?? null,
        maxElapsedMs: Number(successBaselineSummary?.maxElapsedMs ?? 0),
        averageElapsedMs: Number(successBaselineSummary?.averageElapsedMs ?? 0),
        slowestStep: successBaselineSummary?.slowestStep ?? null,
        minCandleCount: Number(successBaselineSummary?.minCandleCount ?? 0),
        selectionCorrectedCount: Number(successBaselineSummary?.selectionCorrectedCount ?? 0),
        fallbackCount: Number(successBaselineSummary?.fallbackCount ?? 0),
        detailSources: Array.isArray(successBaselineSummary?.detailSources) ? successBaselineSummary.detailSources : [],
      }
      : null,
    latestFailureSample: latestFailureSample
      ? {
        generatedAt: latestFailureSample?.generatedAt ?? null,
        ok: Boolean(latestFailureSample?.ok),
        regressionOk: latestFailureSample?.regression?.ok ?? null,
        summary: buildNormalizedSummary(latestFailureSample),
        reasons: Array.isArray(latestFailureSample?.regression?.reasons) ? latestFailureSample.regression.reasons : [],
      }
      : null,
    deltaFromLatestSuccessBaseline: successBaseline
      ? {
        latestGeneratedAt: latest?.generatedAt ?? null,
        baselineGeneratedAt: successBaseline?.generatedAt ?? null,
        maxElapsedMs: Number(latestSummary?.maxElapsedMs ?? 0) - Number(successBaselineSummary?.maxElapsedMs ?? 0),
        averageElapsedMs: Number(latestSummary?.averageElapsedMs ?? 0) - Number(successBaselineSummary?.averageElapsedMs ?? 0),
        minCandleCount: Number(latestSummary?.minCandleCount ?? 0) - Number(successBaselineSummary?.minCandleCount ?? 0),
        selectionCorrectedCount: Number(latestSummary?.selectionCorrectedCount ?? 0) - Number(successBaselineSummary?.selectionCorrectedCount ?? 0),
        fallbackCount: Number(latestSummary?.fallbackCount ?? 0) - Number(successBaselineSummary?.fallbackCount ?? 0),
      }
      : null,
    stepDeltasFromPrevious: stepDeltas,
    regressedStepCount: regressedSteps.length,
    improvedStepCount: improvedSteps.length,
    regressedSteps: regressedSteps.slice(0, 10),
    improvedSteps: improvedSteps.slice(0, 10),
    stepDeltasFromLatestSuccessBaseline: successBaselineStepDeltas,
    regressedStepCountFromLatestSuccessBaseline: regressedStepsFromSuccessBaseline.length,
    improvedStepCountFromLatestSuccessBaseline: improvedStepsFromSuccessBaseline.length,
    regressedStepsFromLatestSuccessBaseline: regressedStepsFromSuccessBaseline.slice(0, 10),
    improvedStepsFromLatestSuccessBaseline: improvedStepsFromSuccessBaseline.slice(0, 10),
  }
}

const readPreviousResult = () => {
  for (const candidatePath of [
    persistentLatestSuccessResultPath,
    persistentResultPath,
    resultPath,
  ]) {
    try {
      if (!candidatePath || !fs.existsSync(candidatePath)) {
        continue
      }
      const raw = fs.readFileSync(candidatePath, 'utf8').trim()
      if (!raw) {
        continue
      }
      const parsed = JSON.parse(raw)
      if (isSuccessfulBaseline(parsed)) {
        return parsed
      }
    } catch {
      continue
    }
  }
  const historyPayloads = readHistoryPayloads()
  const previousSuccessfulPayload = historyPayloads.find((payload) => isSuccessfulBaseline(payload))
  if (previousSuccessfulPayload) {
    return previousSuccessfulPayload
  }
  return null
}

const buildRegressionCheck = (previousPayload, currentPayload) => {
  const previousSummary = previousPayload?.summary
  const currentSummary = currentPayload?.summary
  const previousMatrixSteps = extractMatrixSteps(previousPayload)
  const currentMatrixSteps = extractMatrixSteps(currentPayload)
  if (!previousSummary || !currentSummary) {
    return {
      checked: false,
      ok: true,
      reasons: [],
    }
  }

  const previousSteps = new Map(previousMatrixSteps.map((step) => [step.label, step]))
  const comparableCurrentSteps = currentMatrixSteps.filter((step) => previousSteps.has(step.label))
  const comparablePreviousSteps = comparableCurrentSteps
    .map((step) => previousSteps.get(step.label))
    .filter(Boolean)
  const previousComparableSummary = buildComparableRegressionSummary(comparablePreviousSteps)
  const currentComparableSummary = buildComparableRegressionSummary(comparableCurrentSteps)
  if (!previousComparableSummary || !currentComparableSummary) {
    return {
      checked: false,
      ok: true,
      reasons: [],
    }
  }

  const reasons = []
  const previousMax = Number(previousComparableSummary.maxElapsedMs ?? 0)
  const previousAverage = Number(previousComparableSummary.averageElapsedMs ?? 0)
  const previousMinCandles = Number(previousComparableSummary.minCandleCount ?? 0)
  const previousCorrected = Number(previousComparableSummary.selectionCorrectedCount ?? 0)

  const currentMax = Number(currentComparableSummary.maxElapsedMs ?? 0)
  const currentAverage = Number(currentComparableSummary.averageElapsedMs ?? 0)
  const currentMinCandles = Number(currentComparableSummary.minCandleCount ?? 0)
  const currentCorrected = Number(currentComparableSummary.selectionCorrectedCount ?? 0)

  const maxAllowed = Math.max(4500, previousMax + 250, previousMax * 40)
  const averageAllowed = Math.max(4000, previousAverage + 80, previousAverage * 40)

  if (currentMax > maxAllowed) {
    reasons.push(`maxElapsedMs 从 ${previousMax}ms 升到 ${currentMax}ms，超出阈值 ${maxAllowed}ms`)
  }
  if (currentAverage > averageAllowed) {
    reasons.push(`averageElapsedMs 从 ${previousAverage}ms 升到 ${currentAverage}ms，超出阈值 ${averageAllowed}ms`)
  }
  if (currentMinCandles < previousMinCandles) {
    reasons.push(`minCandleCount 从 ${previousMinCandles} 降到 ${currentMinCandles}`)
  }
  if (currentCorrected > previousCorrected) {
    reasons.push(`selectionCorrectedCount 从 ${previousCorrected} 升到 ${currentCorrected}`)
  }

  const stepComparisons = currentMatrixSteps.map((step) => {
    const previousStep = previousSteps.get(step.label)
    const currentElapsed = Number(step.elapsedMs ?? 0)
    const currentCandles = Number(step.candles ?? 0)
    const currentFallback = Number(step.fallbackCount ?? 0)
    const currentCorrectedStep = Boolean(step.selectionCorrected ?? false)
    if (!previousStep) {
      return {
        label: step.label,
        symbol: step.symbol,
        timeframe: step.timeframe,
        checked: false,
        ok: true,
        reasons: [],
      }
    }

    const previousElapsedStep = Number(previousStep.elapsedMs ?? 0)
    const previousCandlesStep = Number(previousStep.candles ?? 0)
    const previousCorrectedStep = Boolean(previousStep.selectionCorrected ?? false)
    const elapsedAllowed = Math.max(4000, previousElapsedStep + 200, previousElapsedStep * 40)
    const stepReasons = []

    if (currentElapsed > elapsedAllowed) {
      stepReasons.push(`elapsedMs 从 ${previousElapsedStep}ms 升到 ${currentElapsed}ms，超出阈值 ${elapsedAllowed}ms`)
    }
    if (currentCandles < previousCandlesStep) {
      stepReasons.push(`renderedMarketCandleCount 从 ${previousCandlesStep} 降到 ${currentCandles}`)
    }
    if (currentCorrectedStep && !previousCorrectedStep) {
      stepReasons.push('renderedMarketSelectionCorrected 从 false 变成 true')
    }

    return {
      label: step.label,
      symbol: step.symbol,
      timeframe: step.timeframe,
      checked: true,
      ok: stepReasons.length === 0,
      reasons: stepReasons,
      thresholds: {
        elapsedAllowed,
        previousCandlesStep,
        previousCorrectedStep,
      },
    }
  })

  const failedSteps = stepComparisons.filter((step) => step.checked && !step.ok)
  if (failedSteps.length) {
    failedSteps.forEach((step) => {
      reasons.push(`${step.symbol}/${step.timeframe} 退化: ${step.reasons.join('；')}`)
    })
  }

  return {
    checked: true,
    ok: reasons.length === 0,
    reasons,
    stepComparisons,
    previousSummary,
    thresholds: {
      maxAllowed,
      averageAllowed,
      previousMinCandles,
      previousCorrected,
    },
  }
}

const writeResult = (payload) => {
  const resultPayload = {
    generatedAt: new Date().toISOString(),
    ...payload,
  }
  const content = `${JSON.stringify(resultPayload, null, 2)}\n`
  writeFileSafely(resultPath, content, '结果文件')
  if (persistentResultPath !== resultPath) {
    writeFileSafely(persistentResultPath, content, '持久结果文件')
  }
  writeFileSafely(persistentReportPath, buildLatestReport(resultPayload), '最新报告')
  if (isSuccessfulBaseline(resultPayload)) {
    writeFileSafely(
      persistentLatestSuccessResultPath,
      content,
      '最近成功基线结果文件',
    )
    writeFileSafely(
      persistentLatestSuccessReportPath,
      buildLatestReport(resultPayload),
      '最近成功基线报告',
    )
  }
  archivePersistentResult(resultPayload)
  const historyPayloads = readHistoryPayloads()
  writeFileSafely(persistentTrendReportPath, buildTrendReport(historyPayloads), '趋势报告')
  writeFileSafely(
    persistentTrendSummaryPath,
    `${JSON.stringify(buildTrendSummary(historyPayloads), null, 2)}\n`,
    '趋势摘要',
  )
}

const writeRawLog = () => {
  const content = `${rawLines.join('\n')}\n`
  writeFileSafely(rawLogPath, content, '原始日志')
  if (persistentRawLogPath !== rawLogPath) {
    writeFileSafely(persistentRawLogPath, content, '持久原始日志')
  }
}

const writeLatestSuccessRawLog = () => {
  const content = `${rawLines.join('\n')}\n`
  writeFileSafely(
    persistentLatestSuccessRawLogPath,
    content,
    '最近成功基线原始日志',
  )
}

const emitFailureContext = () => {
  writeRawLog()
  const tail = rawLines.slice(-80)
  if (tail.length) {
    console.error('[smoke:market-switch] 最近日志片段:')
    console.error(tail.join('\n'))
  }
  console.error(`[smoke:market-switch] 原始日志已写入 ${rawLogPath}`)
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
  const marker = '[renderer:smoke:result] '
  const markerIndex = line.indexOf(marker)
  if (markerIndex === -1) {
    return
  }
  try {
    const payload = JSON.parse(line.slice(markerIndex + marker.length))
    const previousPayload = readPreviousResult()
    const regression = buildRegressionCheck(previousPayload, payload)
    const nextPayload = {
      ...payload,
      regression,
    }
    writeResult(nextPayload)
    if (payload?.ok && regression.ok) {
      writeRawLog()
      writeLatestSuccessRawLog()
      const summary = payload?.summary ?? {}
      const slowestStep = summary?.slowestStep
        ? `${summary.slowestStep.symbol}/${summary.slowestStep.timeframe} ${summary.slowestStep.elapsedMs}ms`
        : 'n/a'
      const detailSources = Array.isArray(summary?.detailSources) && summary.detailSources.length
        ? summary.detailSources.join(',')
        : 'n/a'
      console.log(
        `[smoke:market-switch] 行情切换回归通过 max=${summary?.maxElapsedMs ?? 0}ms avg=${summary?.averageElapsedMs ?? 0}ms slowest=${slowestStep} candles(min)=${summary?.minCandleCount ?? 0} corrected=${summary?.selectionCorrectedCount ?? 0} fallback=${summary?.fallbackCount ?? 0} sources=${detailSources}`,
      )
      if (regression.checked) {
        console.log(
          `[smoke:market-switch] 对比上次结果通过 max<=${regression.thresholds.maxAllowed}ms avg<=${regression.thresholds.averageAllowed}ms steps=${Array.isArray(regression.stepComparisons) ? regression.stepComparisons.filter((step) => step.checked).length : 0}`,
        )
      } else {
        console.log('[smoke:market-switch] 未找到上次结果，本次结果已作为后续对比基线')
      }
      console.log(`[smoke:market-switch] 结果文件已写入 ${resultPath}（已同步 ${persistentResultPath}）`)
      console.log(`[smoke:market-switch] 原始日志已写入 ${rawLogPath}（已同步 ${persistentRawLogPath}）`)
      console.log(`[smoke:market-switch] 最近成功基线已写入 ${persistentLatestSuccessResultPath}`)
      cleanupAfterSuccess()
      return
    }
    console.error('[smoke:market-switch] 行情切换回归失败')
    console.error(JSON.stringify(nextPayload, null, 2))
    console.error(`[smoke:market-switch] 结果文件已写入 ${resultPath}`)
    emitFailureContext()
    cleanup(1)
  } catch (error) {
    console.error('[smoke:market-switch] 解析结果失败', error)
    emitFailureContext()
    cleanup(1)
  }
}

readline.createInterface({ input: child.stdout }).on('line', handleLine)
readline.createInterface({ input: child.stderr }).on('line', handleLine)

child.on('exit', (code, signal) => {
  if (!settled) {
    console.error(`[smoke:market-switch] 桌面进程提前退出 code=${code} signal=${signal}`)
    emitFailureContext()
    cleanup(1)
  }
})

timeout = setTimeout(() => {
  console.error(`[smoke:market-switch] 超时未拿到回归结果（>${timeoutMs}ms）`)
  emitFailureContext()
  cleanup(1)
}, timeoutMs)

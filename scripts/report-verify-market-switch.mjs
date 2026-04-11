import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('../', import.meta.url))
const runtimeDir = path.join(rootDir, '.runtime/market-switch')
const historyDir = path.join(runtimeDir, 'verify-history')
const summaryPath = path.join(runtimeDir, 'latest-verify-summary.json')
const reportPath = path.join(runtimeDir, 'latest-verify-report.md')
const logPath = path.join(runtimeDir, 'latest-verify.log')
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

const report = readFileOrNull(reportPath)
const summaryContent = readFileOrNull(summaryPath)

if (!report && !summaryContent) {
  console.error('[report:verify-market-switch] 未找到任何 verify 结果，请先运行 pnpm verify:market-switch')
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

if (outputJson) {
  console.log(JSON.stringify({
    summaryPath,
    reportPath,
    logPath,
    historyDir,
    summary: parsedSummary,
    report,
  }, null, 2))
} else {
  if (report) {
    console.log(report)
  }
  if (parsedSummary?.currentStatus) {
    const status = parsedSummary.currentStatus
    console.log(
      `\n[report:verify-market-switch] attention=${status.attentionStatus ?? 'n/a'} baseline=${status.latestSuccessGeneratedAt ?? 'n/a'} stable_runs=${status.consecutiveStableRuns ?? 0} latest_failure=${status.latestFailureGeneratedAt ?? 'n/a'}`,
    )
  }
  console.log(`\n[report:verify-market-switch] summary=${summaryPath}`)
  console.log(`[report:verify-market-switch] report=${reportPath}`)
  console.log(`[report:verify-market-switch] log=${logPath}`)
  console.log(`[report:verify-market-switch] history=${historyDir}`)
}

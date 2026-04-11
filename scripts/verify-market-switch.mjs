import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('../', import.meta.url))
const runtimeDir = path.join(rootDir, '.runtime/market-switch')
const verifyHistoryDir = path.join(runtimeDir, 'verify-history')
const latestVerifySummaryPath = path.join(runtimeDir, 'latest-verify-summary.json')
const latestVerifyReportPath = path.join(runtimeDir, 'latest-verify-report.md')
const latestVerifyLogPath = path.join(runtimeDir, 'latest-verify.log')
const tmpVerifyLogPath = path.join(os.tmpdir(), 'bybit-verify-market-switch.log')
const spawnMaxBufferBytes = Number(process.env.BYBIT_VERIFY_SPAWN_MAX_BUFFER_BYTES || 50 * 1024 * 1024)

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

const steps = []
steps.push(runStep('backend-test-control-api', 'python3', ['-m', 'unittest', '-v', 'services/control-api/tests/test_control_api.py']))

let currentStatus = null
if (steps.at(-1)?.ok) {
  steps.push(runStep('desktop-verify-market-switch', 'pnpm', ['--dir', 'apps/desktop', 'verify:market-switch']))
}
if (steps.at(-1)?.ok) {
  const reportStep = runStep('desktop-report-market-switch-json', 'pnpm', ['--dir', 'apps/desktop', 'report:market-switch:json'])
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

const reportLines = [
  '# 行情主图一键验证',
  '',
  `- 生成时间：${generatedAt}`,
  `- 状态：${ok ? '通过' : '失败'}`,
  '',
  '## 步骤结果',
  '',
]

for (const step of summary.steps) {
  reportLines.push(`- ${step.name}：${step.ok ? '通过' : '失败'}，${step.elapsedMs}ms，exit=${step.exitCode ?? 'null'}`)
}

if (currentStatus) {
  reportLines.push('', '## 当前行情状态', '')
  reportLines.push(`- attention：${currentStatus.attentionStatus ?? 'n/a'}`)
  reportLines.push(`- baseline：${currentStatus.latestSuccessGeneratedAt ?? 'n/a'}`)
  reportLines.push(`- stable_runs：${currentStatus.consecutiveStableRuns ?? 0}`)
  reportLines.push(`- latest_failure：${currentStatus.latestFailureGeneratedAt ?? 'n/a'}`)
  reportLines.push(`- max：${currentStatus.maxElapsedMs ?? 0}ms`)
  reportLines.push(`- avg：${currentStatus.averageElapsedMs ?? 0}ms`)
  reportLines.push(`- candles(min)：${currentStatus.minCandleCount ?? 0}`)
  reportLines.push(`- corrected：${currentStatus.selectionCorrectedCount ?? 0}`)
  reportLines.push(`- fallback：${currentStatus.fallbackCount ?? 0}`)
  reportLines.push(`- watchlist 对齐：${currentStatus.watchlistAligned ? '是' : '否'}`)
  reportLines.push(`- 失效 symbol 自愈：${currentStatus.invalidSelectionCorrected ? '是' : '否'}${currentStatus.invalidSelectedSymbol ? `（当前有效 symbol：${currentStatus.invalidSelectedSymbol}）` : ''}`)
  reportLines.push(`- 本地工作台自愈：${currentStatus.workspaceSelfHealOk ? '是' : '否'}${currentStatus.workspaceSelfHealElapsedMs ? `，${currentStatus.workspaceSelfHealElapsedMs}ms` : ''}`)
  if (Array.isArray(currentStatus.attentionReasons) && currentStatus.attentionReasons.length > 0) {
    reportLines.push('', '## 关注原因', '')
    for (const reason of currentStatus.attentionReasons) {
      reportLines.push(`- ${reason}`)
    }
  }
}

const report = `${reportLines.join('\n')}\n`
const logOutput = logChunks.join('')

fs.writeFileSync(latestVerifySummaryPath, `${JSON.stringify(summary, null, 2)}\n`)
fs.writeFileSync(latestVerifyReportPath, report)
fs.writeFileSync(latestVerifyLogPath, logOutput)
fs.writeFileSync(tmpVerifyLogPath, logOutput)
fs.writeFileSync(path.join(verifyHistoryDir, `${historyKey}.json`), `${JSON.stringify(summary, null, 2)}\n`)
fs.writeFileSync(path.join(verifyHistoryDir, `${historyKey}.md`), report)
fs.writeFileSync(path.join(verifyHistoryDir, `${historyKey}.log`), logOutput)

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

console.log(`[verify:market-switch] status=${ok ? 'ok' : 'failed'} steps=${summary.steps.length}`)
if (currentStatus) {
  console.log(
    `[verify:market-switch] attention=${currentStatus.attentionStatus ?? 'n/a'} baseline=${currentStatus.latestSuccessGeneratedAt ?? 'n/a'} stable_runs=${currentStatus.consecutiveStableRuns ?? 0} latest_failure=${currentStatus.latestFailureGeneratedAt ?? 'n/a'}`,
  )
}
console.log(`[verify:market-switch] summary=${latestVerifySummaryPath}`)
console.log(`[verify:market-switch] report=${latestVerifyReportPath}`)
console.log(`[verify:market-switch] log=${latestVerifyLogPath}`)
console.log(`[verify:market-switch] history=${verifyHistoryDir}`)

if (!ok) {
  process.exit(1)
}

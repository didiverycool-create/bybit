#!/usr/bin/env node

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

function printUsageAndExit() {
  console.error(
    "Usage: dev-reuse-or-run.mjs [--replace-stale <command-substring> <watch-path>] [--replace-unhealthy <command-substring>] <http> <target> <command> [args...]",
  );
  process.exit(1);
}

async function isHttpReady(url) {
  const candidates = buildHttpLoopbackCandidates(url);
  for (const candidate of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(candidate, { signal: controller.signal });
      if (response.ok) {
        return true;
      }
    } catch {
      // ignore and continue trying loopback aliases
    } finally {
      clearTimeout(timeout);
    }
  }
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttpReady(url, attempts = 5, intervalMs = 500) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await isHttpReady(url)) {
      return true;
    }
    if (attempt < attempts - 1) {
      await sleep(intervalMs);
    }
  }
  return false;
}

async function waitForPortRelease(target, attempts = 20, intervalMs = 250) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (!(await isTcpPortOccupied(target))) {
      return true;
    }
    if (attempt < attempts - 1) {
      await sleep(intervalMs);
    }
  }
  return false;
}

function parseNetworkTarget(target) {
  try {
    const url = new URL(target);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return {
      host: url.hostname,
      port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
    };
  } catch {
    return null;
  }
}

function isLoopbackHost(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function buildLoopbackHosts(host) {
  if (!isLoopbackHost(host)) {
    return [host];
  }
  return Array.from(new Set([host, "localhost", "127.0.0.1", "::1"]));
}

function buildHttpLoopbackCandidates(target) {
  try {
    const url = new URL(target);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return [target];
    }
    return buildLoopbackHosts(url.hostname).map((host) => {
      const candidate = new URL(url.toString());
      candidate.hostname = host;
      return candidate.toString();
    });
  } catch {
    return [target];
  }
}

async function isTcpPortOccupied(target) {
  const parsed = parseNetworkTarget(target);
  if (!parsed) {
    return false;
  }

  if (isLoopbackHost(parsed.host)) {
    return getListeningPids(target).length > 0;
  }

  for (const host of buildLoopbackHosts(parsed.host)) {
    // Non-loopback hosts return themselves unchanged.
    const isOccupied = await new Promise((resolve) => {
      const socket = net.createConnection({
        host,
        port: parsed.port,
      });

      let settled = false;
      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        socket.destroy();
        resolve(value);
      };

      socket.setTimeout(1000);
      socket.once("connect", () => finish(true));
      socket.once("timeout", () => finish(false));
      socket.once("error", () => finish(false));
    });
    if (isOccupied) {
      return true;
    }
  }
  return false;
}

function getListeningPids(target) {
  const parsed = parseNetworkTarget(target);
  if (!parsed) {
    return [];
  }

  try {
    const output = execFileSync("lsof", ["-nP", "-t", `-iTCP:${parsed.port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return output
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function getProcessCommand(pid) {
  try {
    return execFileSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function getProcessCwd(pid) {
  try {
    const output = execFileSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const match = output.match(/\nn(.+)\s*$/m);
    return match?.[1]?.trim() || "";
  } catch {
    return "";
  }
}

function buildReplaceExpectation(marker) {
  const resolvedMarker = path.resolve(process.cwd(), marker);
  return {
    marker,
    commandPath: resolvedMarker,
    commandDir: path.dirname(resolvedMarker),
    basename: path.basename(resolvedMarker),
  };
}

function matchesReplaceExpectation(processCommand, processCwd, expectation) {
  if (processCommand.includes(expectation.marker) || processCommand.includes(expectation.commandPath)) {
    return true;
  }
  if (processCwd && processCwd === expectation.commandDir) {
    return true;
  }
  if (processCwd && processCwd.startsWith(`${expectation.commandDir}${path.sep}`)) {
    return true;
  }
  if (processCommand && expectation.basename && processCommand.includes(expectation.basename) && processCwd === expectation.commandDir) {
    return true;
  }
  return false;
}

function getProcessStartedAtMs(pid) {
  try {
    const output = execFileSync("ps", ["-p", String(pid), "-o", "lstart="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const startedAtMs = Date.parse(output);
    return Number.isFinite(startedAtMs) ? startedAtMs : null;
  } catch {
    return null;
  }
}

function isWatchableFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return [
    ".py",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".json",
    ".toml",
    ".yaml",
    ".yml",
    ".ini",
    ".cfg",
  ].includes(extension);
}

function shouldSkipWalk(entryPath) {
  const base = path.basename(entryPath);
  return [
    ".git",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".runtime",
    "dist",
    "dist-electron",
  ].includes(base);
}

function getLatestWatchedMtimeMs(inputPath) {
  const resolvedPath = path.resolve(process.cwd(), inputPath);
  const visit = (currentPath) => {
    let stat;
    try {
      stat = fs.statSync(currentPath);
    } catch {
      return 0;
    }
    if (stat.isFile()) {
      return isWatchableFile(currentPath) ? stat.mtimeMs : 0;
    }
    if (!stat.isDirectory() || shouldSkipWalk(currentPath)) {
      return 0;
    }
    let latest = 0;
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        latest = Math.max(latest, visit(path.join(currentPath, entry.name)));
      }
    } catch {
      return latest;
    }
    return latest;
  };
  return visit(resolvedPath);
}

async function terminatePid(pid, signal = "SIGTERM") {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

function keepAlive(target) {
  console.log(`[dev] Reusing existing service at ${target}`);

  const timer = setInterval(() => {}, 60_000);
  const shutdown = () => {
    clearInterval(timer);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function replaceListeningProcess(target, marker, reason) {
  const listeningPids = getListeningPids(target);
  const expectation = buildReplaceExpectation(marker);
  const replaceablePid = listeningPids.find((pid) => {
    const processCommand = getProcessCommand(pid);
    const processCwd = getProcessCwd(pid);
    return matchesReplaceExpectation(processCommand, processCwd, expectation);
  });
  if (!replaceablePid) {
    return false;
  }

  const processCommand = getProcessCommand(replaceablePid);
  const processCwd = getProcessCwd(replaceablePid);
  console.log(
    `[dev] Replacing ${reason} listener ${replaceablePid} (${processCommand || "unknown command"}${processCwd ? ` @ ${processCwd}` : ""}) at ${target}...`,
  );
  await terminatePid(replaceablePid, "SIGTERM");
  if (await waitForPortRelease(target, 20, 250)) {
    console.log(`[dev] ${target} has been released after SIGTERM.`);
    return true;
  }

  console.log(`[dev] ${target} still occupied after SIGTERM; sending SIGKILL to ${replaceablePid}.`);
  await terminatePid(replaceablePid, "SIGKILL");
  if (!(await waitForPortRelease(target, 20, 250))) {
    console.error(`[dev] ${target} remained occupied after replacing ${reason} process ${replaceablePid}.`);
    process.exit(1);
  }
  console.log(`[dev] ${target} has been released after SIGKILL.`);
  return true;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  let replaceUnhealthyMatch = null;
  let replaceStale = null;

  while (rawArgs[0]?.startsWith("--")) {
    if (rawArgs[0] === "--replace-unhealthy") {
      replaceUnhealthyMatch = rawArgs[1] || null;
      rawArgs.splice(0, 2);
      continue;
    }
    if (rawArgs[0] === "--replace-stale") {
      replaceStale = {
        marker: rawArgs[1] || null,
        watchPath: rawArgs[2] || null,
      };
      rawArgs.splice(0, 3);
      continue;
    }
    break;
  }

  const [mode, target, ...command] = rawArgs;
  if (mode !== "http" || !target || command.length === 0) {
    printUsageAndExit();
  }

  if (await isHttpReady(target)) {
    if (replaceStale?.marker && replaceStale.watchPath) {
      const listeningPids = getListeningPids(target);
      const expectation = buildReplaceExpectation(replaceStale.marker);
      const matchedPid = listeningPids.find((pid) => {
        const processCommand = getProcessCommand(pid);
        const processCwd = getProcessCwd(pid);
        return matchesReplaceExpectation(processCommand, processCwd, expectation);
      });
      if (matchedPid) {
        const processStartedAtMs = getProcessStartedAtMs(matchedPid);
        const latestWatchedMtimeMs = getLatestWatchedMtimeMs(replaceStale.watchPath);
        if (latestWatchedMtimeMs > 0 && processStartedAtMs > 0 && latestWatchedMtimeMs > processStartedAtMs + 1000) {
          const replaced = await replaceListeningProcess(target, replaceStale.marker, "stale");
          if (replaced) {
            console.log(`[dev] ${target} is now free; starting replacement process.`);
          }
        } else {
          keepAlive(target);
          return;
        }
      } else {
        keepAlive(target);
        return;
      }
    } else {
      keepAlive(target);
      return;
    }
  }

  if (await isTcpPortOccupied(target)) {
    console.log(`[dev] ${target} is already bound; waiting briefly for health recovery...`);
    if (await waitForHttpReady(target, 5, 500)) {
      keepAlive(target);
      return;
    }
    if (replaceUnhealthyMatch) {
      const replaced = await replaceListeningProcess(target, replaceUnhealthyMatch, "unhealthy");
      if (!replaced) {
        console.error(
          `[dev] ${target} is unhealthy, but no listening process matched "${replaceUnhealthyMatch}". Refusing to replace it automatically.`,
        );
        process.exit(1);
      }
      console.log(`[dev] ${target} is now free; starting replacement process.`);
    } else {
      console.error(
        `[dev] ${target} is already bound, but the HTTP health check never passed. Refusing to start a duplicate process.`,
      );
      process.exit(1);
    }
  }

  console.log(`[dev] Starting ${command.join(" ")}`);
  const child = spawn(command[0], command.slice(1), {
    stdio: "inherit",
    env: process.env,
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  child.on("error", (error) => {
    console.error(`[dev] Failed to start ${command[0]}:`, error);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(0);
      return;
    }
    process.exit(code ?? 0);
  });
}

main();

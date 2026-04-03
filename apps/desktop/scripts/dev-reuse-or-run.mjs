#!/usr/bin/env node

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import net from "node:net";
import path from "node:path";

function printUsageAndExit() {
  console.error(
    "Usage: dev-reuse-or-run.mjs [--replace-unhealthy <command-substring>] <http> <target> <command> [args...]",
  );
  process.exit(1);
}

async function isHttpReady(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
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

async function isTcpPortOccupied(target) {
  const parsed = parseNetworkTarget(target);
  if (!parsed) {
    return false;
  }

  return await new Promise((resolve) => {
    const socket = net.createConnection({
      host: parsed.host,
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

async function main() {
  const rawArgs = process.argv.slice(2);
  let replaceUnhealthyMatch = null;

  if (rawArgs[0] === "--replace-unhealthy") {
    replaceUnhealthyMatch = rawArgs[1] || null;
    rawArgs.splice(0, 2);
  }

  const [mode, target, ...command] = rawArgs;
  if (mode !== "http" || !target || command.length === 0) {
    printUsageAndExit();
  }

  if (await isHttpReady(target)) {
    keepAlive(target);
    return;
  }

  if (await isTcpPortOccupied(target)) {
    console.log(`[dev] ${target} is already bound; waiting briefly for health recovery...`);
    if (await waitForHttpReady(target, 5, 500)) {
      keepAlive(target);
      return;
    }
    if (replaceUnhealthyMatch) {
      const listeningPids = getListeningPids(target);
      const expectation = buildReplaceExpectation(replaceUnhealthyMatch);
      const replaceablePid = listeningPids.find((pid) => {
        const processCommand = getProcessCommand(pid);
        const processCwd = getProcessCwd(pid);
        return matchesReplaceExpectation(processCommand, processCwd, expectation);
      });
      if (!replaceablePid) {
        console.error(
          `[dev] ${target} is unhealthy, but no listening process matched "${replaceUnhealthyMatch}". Refusing to replace it automatically.`,
        );
        process.exit(1);
      }

      const processCommand = getProcessCommand(replaceablePid);
      const processCwd = getProcessCwd(replaceablePid);
      console.log(
        `[dev] Replacing unhealthy listener ${replaceablePid} (${processCommand || "unknown command"}${processCwd ? ` @ ${processCwd}` : ""}) at ${target}...`,
      );
      await terminatePid(replaceablePid, "SIGTERM");
      if (await waitForPortRelease(target, 20, 250)) {
        console.log(`[dev] ${target} has been released after SIGTERM.`);
      } else {
        console.log(`[dev] ${target} still occupied after SIGTERM; sending SIGKILL to ${replaceablePid}.`);
        await terminatePid(replaceablePid, "SIGKILL");
        if (!(await waitForPortRelease(target, 20, 250))) {
          console.error(`[dev] ${target} remained occupied after replacing unhealthy process ${replaceablePid}.`);
          process.exit(1);
        }
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

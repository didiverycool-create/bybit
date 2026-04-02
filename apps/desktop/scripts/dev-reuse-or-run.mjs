#!/usr/bin/env node

import { spawn } from "node:child_process";

function printUsageAndExit() {
  console.error("Usage: dev-reuse-or-run.mjs <http> <target> <command> [args...]");
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
  const [mode, target, ...command] = process.argv.slice(2);
  if (mode !== "http" || !target || command.length === 0) {
    printUsageAndExit();
  }

  if (await isHttpReady(target)) {
    keepAlive(target);
    return;
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

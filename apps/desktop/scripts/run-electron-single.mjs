#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import path from "node:path";

function listMatchingPids(pattern) {
  try {
    const output = execFileSync("pgrep", ["-af", pattern], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!output) {
      return [];
    }
    return output
      .split("\n")
      .map((line) => {
        const [pidText, ...commandParts] = line.trim().split(/\s+/);
        const pid = Number(pidText);
        return Number.isInteger(pid) && pid > 0
          ? { pid, command: commandParts.join(" ") }
          : null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function terminatePid(pid) {
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function terminateExistingElectron(repoRoot) {
  const candidates = listMatchingPids(repoRoot).filter(
    ({ command }) => command.includes("/node_modules/.pnpm/electron@") && command.includes("Electron ."),
  );
  if (candidates.length === 0) {
    return;
  }
  for (const { pid } of candidates) {
    terminatePid(pid);
  }
  await sleep(800);
}

async function main() {
  const repoRoot = path.resolve(process.cwd(), "../..");
  await terminateExistingElectron(repoRoot);

  const child = spawn("electron", ["."], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("[dev] Failed to launch single Electron instance", error);
  process.exit(1);
});

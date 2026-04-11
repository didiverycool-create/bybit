import fs from "node:fs";

import type { BrowserWindow } from "electron";

import {
  buildMarketSwitchReadWorkspaceSelfHealStateScript,
  buildMarketSwitchSmokePlanScript,
  buildMarketSwitchSnapshotScript,
  buildMarketSwitchSwitchScriptSource,
  buildMarketSwitchWaitScriptSource,
  buildMarketSwitchWorkspaceSelfHealSetupScript,
} from "./market-switch-smoke-scripts";

export async function runMarketSwitchSmoke(
  win: BrowserWindow,
  {
    controlApiBase,
  }: {
    controlApiBase: string;
  },
) {
  const buildSnapshotScript = buildMarketSwitchSnapshotScript();
  const buildSmokePlanScript = buildMarketSwitchSmokePlanScript(controlApiBase);
  const buildWorkspaceSelfHealSetupScript = buildMarketSwitchWorkspaceSelfHealSetupScript(controlApiBase);
  const readWorkspaceSelfHealStateScript = buildMarketSwitchReadWorkspaceSelfHealStateScript();
  const switchMarketScript = buildMarketSwitchSwitchScriptSource();
  const waitForSwitchScript = buildMarketSwitchWaitScriptSource();
  const smokeRenderBudgetMs = 1800;
  const smokeSwitchTimeoutMs = 3000;
  const smokeSelfHealTimeoutMs = 6000;

  const captureState = async (label: string, output: string) => {
    try {
      const delayedSnapshot = await win.webContents.executeJavaScript(buildSnapshotScript);
      console.log(label, JSON.stringify(delayedSnapshot));
      const image = await win.webContents.capturePage();
      fs.writeFileSync(output, image.toPNG());
      console.log("[renderer:capture]", output);
      return delayedSnapshot;
    } catch (error) {
      console.error("[renderer:capture-failed]", error);
      return null;
    }
  };

  const runSwitchCapture = async (symbol: string, timeframe: string, label: string, output: string) => {
    try {
      const interaction = await win.webContents.executeJavaScript(
        `(${switchMarketScript})(${JSON.stringify(symbol)}, ${JSON.stringify(timeframe)})`,
      );
      console.log(`[renderer:switch:${label}]`, JSON.stringify(interaction));
      const readiness = await win.webContents.executeJavaScript(
        `(${waitForSwitchScript})(${JSON.stringify(symbol)}, ${JSON.stringify(timeframe)}, ${smokeSwitchTimeoutMs})`,
      );
      const snapshot = await captureState(`[renderer:${label}]`, output);
      return { interaction, readiness, snapshot };
    } catch (error) {
      console.error(`[renderer:switch-failed:${label}]`, error);
      return { interaction: null, readiness: null, snapshot: null, error: String(error) };
    }
  };

  const runWorkspaceSelfHealSmoke = async () => {
    const phase = await win.webContents.executeJavaScript(readWorkspaceSelfHealStateScript);
    if (phase?.phase === "prepared") {
      return {
        ok: true,
        skipped: false,
        phase,
      };
    }

    const setup = await win.webContents.executeJavaScript(buildWorkspaceSelfHealSetupScript);
    console.log("[renderer:smoke:workspace-self-heal:setup]", JSON.stringify(setup));
    await win.webContents.executeJavaScript("window.location.reload()");

    const startedAt = Date.now();
    while (Date.now() - startedAt <= smokeSelfHealTimeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        const state = await win.webContents.executeJavaScript(readWorkspaceSelfHealStateScript);
        const chartSnapshot = await win.webContents.executeJavaScript(buildSnapshotScript);
        const healed =
          state?.phase === "prepared" &&
          state?.localSelectedSymbol &&
          state.localSelectedSymbol !== "__SMOKE_INVALID__" &&
          chartSnapshot?.activeMarketSymbol === state.localSelectedSymbol &&
          chartSnapshot?.renderedMarketSymbol === state.localSelectedSymbol &&
          chartSnapshot?.chartCanvasCount >= 1;
        if (healed) {
          await win.webContents.executeJavaScript(
            "sessionStorage.removeItem('bybit-smoke-market-switch-local-workspace-phase')",
          );
          console.log(
            "[renderer:smoke:workspace-self-heal:result]",
            JSON.stringify({
              ok: true,
              elapsedMs: Date.now() - startedAt,
              state,
              chartSnapshot,
            }),
          );
          return {
            ok: true,
            skipped: false,
            elapsedMs: Date.now() - startedAt,
            state,
            chartSnapshot,
          };
        }
      } catch {
        // keep waiting while the page is reloading and queries are refilling
      }
    }

    const finalState = await win.webContents.executeJavaScript(readWorkspaceSelfHealStateScript).catch(() => null);
    const finalSnapshot = await win.webContents.executeJavaScript(buildSnapshotScript).catch(() => null);
    console.log(
      "[renderer:smoke:workspace-self-heal:result]",
      JSON.stringify({
        ok: false,
        elapsedMs: Date.now() - startedAt,
        state: finalState,
        chartSnapshot: finalSnapshot,
      }),
    );
    return {
      ok: false,
      skipped: false,
      elapsedMs: Date.now() - startedAt,
      state: finalState,
      chartSnapshot: finalSnapshot,
    };
  };

  setTimeout(async () => {
    await captureState("[renderer:dom+1800ms]", "/tmp/bybit-electron-capture.png");
  }, 1800);
  setTimeout(async () => {
    await captureState("[renderer:dom+6000ms]", "/tmp/bybit-electron-capture-late.png");
  }, 6000);
  setTimeout(async () => {
    const workspaceSelfHeal = await runWorkspaceSelfHealSmoke();
    const smokePlan = await win.webContents.executeJavaScript(buildSmokePlanScript);
    const results = [];
    for (const step of smokePlan.steps ?? []) {
      const output = `/tmp/bybit-electron-${step.label}.png`;
      const result = await runSwitchCapture(step.symbol, step.timeframe, step.label, output);
      results.push({
        ...step,
        output,
        interaction: result.interaction,
        readiness: result.readiness,
        snapshot: result.snapshot,
      });
    }
    const ok =
      workspaceSelfHeal.ok &&
      smokePlan.watchlistAligned &&
      smokePlan.invalidSelectionCorrected &&
      results.every(
        (result) =>
          result.interaction?.symbolFound &&
          result.interaction?.timeframeFound &&
          result.readiness &&
          result.readiness.ok &&
          result.readiness.elapsedMs <= smokeRenderBudgetMs &&
          result.readiness.state?.chartCanvasCount >= 1 &&
          result.readiness.state?.renderedMarketSymbol === result.symbol &&
          result.readiness.state?.renderedMarketTimeframe === result.timeframe &&
          result.readiness.state?.activeSymbol === result.symbol &&
          result.readiness.state?.activeTimeframe === result.timeframe,
      );
    const summary = (() => {
      const completed = results.filter((result) => result.readiness?.ok).length;
      const total = results.length;
      return `${completed}/${total}`;
    })();
    console.log(
      "[renderer:smoke:result]",
      JSON.stringify({
        ok,
        workspaceSelfHeal,
        smokePlan,
        summary,
        results,
      }),
    );
  }, 2200);
}

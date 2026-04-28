import fs from "node:fs";

import type { BrowserWindow } from "electron";

import {
  buildStrategyActivityReadStateScript,
  buildStrategyActivitySetupScript,
  buildStrategyActivityWaitScriptSource,
} from "./strategy-activity-smoke-scripts";

export async function runStrategyActivitySmoke(
  win: BrowserWindow,
  {
    controlApiBase,
    renderBudgetMs,
  }: {
    controlApiBase: string;
    renderBudgetMs: number;
  },
) {
  const strategyActivitySetupScript = buildStrategyActivitySetupScript(controlApiBase);
  const readStrategyActivityStateScript = buildStrategyActivityReadStateScript();
  const waitForStrategyActivityScript = buildStrategyActivityWaitScriptSource().replace(
    "const readState = ${readStrategyActivityStateScript};",
    `const readState = ${readStrategyActivityStateScript};`,
  );
  const captureTimeoutMs = 1500;

  setTimeout(async () => {
    const output = "/tmp/bybit-electron-strategy-activity.png";
    const captureStrategyActivityState = async (label: string) => {
      try {
        const state = await win.webContents.executeJavaScript(`(${readStrategyActivityStateScript})()`);
        console.log(label, JSON.stringify(state));
        const image = await Promise.race([
          win.webContents.capturePage(),
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), captureTimeoutMs);
          }),
        ]);
        if (image) {
          fs.writeFileSync(output, image.toPNG());
          console.log("[renderer:capture]", output);
        } else {
          console.warn("[renderer:strategy-activity-capture-timeout]", output);
        }
        return state;
      } catch (error) {
        console.error("[renderer:strategy-activity-capture-failed]", error);
        return null;
      }
    };

    try {
      const setup = await win.webContents.executeJavaScript(strategyActivitySetupScript);
      console.log("[renderer:smoke:strategy-activity:setup]", JSON.stringify(setup));
      await win.webContents.executeJavaScript("window.location.reload()");
      const readiness = await win.webContents.executeJavaScript(
        `(${waitForStrategyActivityScript})(${renderBudgetMs})`,
      );
      const snapshot = await captureStrategyActivityState("[renderer:smoke:strategy-activity:snapshot]");
      console.log(
        "[renderer:smoke:strategy-activity:result]",
        JSON.stringify({
          ok: Boolean(readiness?.ok),
          readiness,
          snapshot,
          output,
        }),
      );
    } catch (error) {
      const snapshot = await captureStrategyActivityState("[renderer:smoke:strategy-activity:failed-snapshot]");
      console.log(
        "[renderer:smoke:strategy-activity:result]",
        JSON.stringify({
          ok: false,
          error: String(error),
          snapshot,
          output,
        }),
      );
    }
  }, 2200);
}

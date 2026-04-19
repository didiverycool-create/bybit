import type { BrowserWindow as BrowserWindowType, Rectangle } from "electron";
import { BrowserWindow } from "electron";
import path from "node:path";
import { runRequestedSmokeOnLoad, shouldCloseRequestedSmokeOnLogMessage } from "./runRequestedSmokeOnLoad";

export type CreateMainWindowOptions = {
  initialBounds: Rectangle | { width: number; height: number };
  initialMaximized: boolean;
  minWidth: number;
  minHeight: number;
  title: string;
  backgroundColor: string;
  preloadPath: string;
  isDev: boolean;
  devServerUrl: string;
  productionIndexPath: string;
  shouldOpenDevTools: boolean;
  shouldRunRequestedSmoke: boolean;
  shouldRunStrategyActivitySmoke: boolean;
  shouldRunMarketSwitchSmoke: boolean;
  controlApiBase: string;
  strategyActivitySmokeRenderBudgetMs: number;
  onPersistBounds: (win: BrowserWindowType) => void;
  onTrayMenuShouldUpdate: () => void;
  onClosed: (win: BrowserWindowType) => void;
};

export function createMainWindow(options: CreateMainWindowOptions): BrowserWindowType {
  const {
    initialBounds,
    initialMaximized,
    minWidth,
    minHeight,
    title,
    backgroundColor,
    preloadPath,
    isDev,
    devServerUrl,
    productionIndexPath,
    shouldOpenDevTools,
    shouldRunRequestedSmoke,
    shouldRunStrategyActivitySmoke,
    shouldRunMarketSwitchSmoke,
    controlApiBase,
    strategyActivitySmokeRenderBudgetMs,
    onPersistBounds,
    onTrayMenuShouldUpdate,
    onClosed,
  } = options;

  let requestedSmokeStarted = false;
  let didFinishLoad = false;
  let readyForRequestedSmoke = false;

  const win = new BrowserWindow({
    ...initialBounds,
    minWidth,
    minHeight,
    show: false,
    backgroundColor,
    title,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const maybeStartRequestedSmoke = async () => {
    if (
      !isDev ||
      !shouldRunRequestedSmoke ||
      requestedSmokeStarted ||
      !didFinishLoad ||
      !readyForRequestedSmoke
    ) {
      return;
    }
    requestedSmokeStarted = true;
    await runRequestedSmokeOnLoad(win, {
      shouldRunStrategyActivitySmoke,
      shouldRunMarketSwitchSmoke,
      controlApiBase,
      strategyActivitySmokeRenderBudgetMs,
    });
  };

  if (isDev) {
    win.loadURL(devServerUrl);
    if (shouldOpenDevTools) {
      win.webContents.openDevTools({ mode: "detach" });
    }
    win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${sourceId}:${line} ${message}`);
      if (
        shouldCloseRequestedSmokeOnLogMessage(message, {
          shouldRunStrategyActivitySmoke,
          shouldRunMarketSwitchSmoke,
        })
      ) {
        setTimeout(() => {
          if (!win.isDestroyed()) {
            win.close();
          }
        }, 100);
      }
    });
    win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[renderer:load-failed] ${errorCode} ${errorDescription} ${validatedURL}`);
    });
    win.webContents.on("did-finish-load", async () => {
      didFinishLoad = true;
      await maybeStartRequestedSmoke();
    });
  } else {
    win.loadFile(productionIndexPath);
  }

  win.once("ready-to-show", () => {
    if (initialMaximized) {
      win.maximize();
    }
    win.show();
    win.focus();
    onPersistBounds(win);
    onTrayMenuShouldUpdate();
    if (isDev) {
      readyForRequestedSmoke = true;
      void maybeStartRequestedSmoke();
    }
  });

  // Debounce move/resize persistence: these events fire continuously while the user
  // drags the title bar or resize handle, and syncing the JSON file on every pixel
  // would thrash the disk. maximize/unmaximize/close remain immediate because they
  // are discrete/terminal and we must not lose the latest state on exit.
  const persistDebounceMs = 500;
  let persistTimer: NodeJS.Timeout | null = null;
  const cancelPendingPersist = () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
  };
  const schedulePersist = () => {
    cancelPendingPersist();
    persistTimer = setTimeout(() => {
      persistTimer = null;
      if (!win.isDestroyed()) {
        onPersistBounds(win);
      }
    }, persistDebounceMs);
  };
  const flushPersist = () => {
    cancelPendingPersist();
    if (!win.isDestroyed()) {
      onPersistBounds(win);
    }
  };

  win.on("move", () => schedulePersist());
  win.on("resize", () => schedulePersist());
  win.on("maximize", () => flushPersist());
  win.on("unmaximize", () => flushPersist());
  win.on("show", () => onTrayMenuShouldUpdate());
  win.on("hide", () => onTrayMenuShouldUpdate());
  win.on("focus", () => onTrayMenuShouldUpdate());
  win.on("close", () => flushPersist());
  win.on("closed", () => {
    cancelPendingPersist();
    onClosed(win);
    onTrayMenuShouldUpdate();
  });

  return win;
}

// Re-export helper so callers can build default paths without re-importing path.
export function defaultPreloadPath(dirname: string): string {
  return path.join(dirname, "../preload.js");
}

export function defaultProductionIndexPath(dirname: string): string {
  return path.join(dirname, "../../dist/index.html");
}

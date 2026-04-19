import { app, BrowserWindow, ipcMain, Notification, Tray, screen, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { applyTrayMenu, createTray as createTrayInstance, createTrayIcon } from "./tray";
import {
  createMainWindow,
  defaultPreloadPath,
  defaultProductionIndexPath,
} from "./window-factory";
import {
  persistWindowBoundsState as persistWindowBoundsStateToFile,
  readWindowBoundsState as readWindowBoundsStateFromFile,
  resolveWindowBoundsState as resolveWindowBoundsStateFor,
  windowStateFilePath as windowStateFilePathFor,
} from "./window-bounds";

const isDev = !app.isPackaged;
const shouldOpenDevTools = process.env.BYBIT_OPEN_DEVTOOLS === "1";
const shouldRunMarketSwitchSmoke = isDev && process.env.BYBIT_SMOKE_MARKET_SWITCH === "1";
const shouldRunStrategyActivitySmoke = isDev && process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY === "1";
const shouldRunRequestedSmoke = shouldRunStrategyActivitySmoke || shouldRunMarketSwitchSmoke;
const strategyActivitySmokeRenderBudgetMs = Number(
  process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY_RENDER_BUDGET_MS ?? "30000",
);
const controlApiBase =
  process.env.BYBIT_CONTROL_API_BASE ??
  process.env.VITE_CONTROL_API_BASE ??
  "http://127.0.0.1:8787";

app.disableHardwareAcceleration();

type DesktopNotificationPayload = {
  title?: string;
  body?: string;
  urgency?: "normal" | "critical";
  silent?: boolean;
};

type DesktopOpenPathPayload = {
  path?: string;
  revealInFolder?: boolean;
};

type DesktopOpenPathResult = {
  ok: boolean;
  path?: string;
  message?: string;
};

let mainWindow: BrowserWindow | null = null;
let appTray: Tray | null = null;

const defaultWindowWidth = 1600;
const defaultWindowHeight = 1020;
const minWindowWidth = 1280;
const minWindowHeight = 820;
const windowStateFileName = "window-state.json";
const appTitle = "Bybit 量化交易控制端";

function windowStateFilePath() {
  return windowStateFilePathFor(app.getPath("userData"), windowStateFileName);
}

function resolveWindowBoundsState() {
  const saved = readWindowBoundsStateFromFile(windowStateFilePath());
  const result = resolveWindowBoundsStateFor(saved, screen, {
    defaultWidth: defaultWindowWidth,
    defaultHeight: defaultWindowHeight,
    minWidth: minWindowWidth,
    minHeight: minWindowHeight,
  });
  if (saved && (result.reason === "clamped" || result.reason === "fallback-no-display")) {
    console.log(
      `[window-state:restore] reason=${result.reason} saved=${JSON.stringify(saved)} resolved=${JSON.stringify(result.bounds)} maximized=${result.maximized}`,
    );
  }
  return result;
}

function persistWindowBoundsState(win: BrowserWindow) {
  persistWindowBoundsStateToFile(win, windowStateFilePath());
}

function toggleMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }

  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function updateTrayMenu() {
  if (!appTray) {
    return;
  }
  applyTrayMenu(appTray, {
    isMainWindowVisible: Boolean(mainWindow?.isVisible()),
    tooltip: appTitle,
    onToggle: () => toggleMainWindow(),
    onQuit: () => app.quit(),
  });
}

function createTray() {
  if (appTray) {
    updateTrayMenu();
    return;
  }

  appTray = createTrayInstance({
    image: createTrayIcon(),
    tooltip: appTitle,
    onClick: () => toggleMainWindow(),
  });
  updateTrayMenu();
}

function createWindow() {
  const initialWindowState = resolveWindowBoundsState();
  const win = createMainWindow({
    initialBounds: initialWindowState.bounds,
    initialMaximized: initialWindowState.maximized,
    minWidth: minWindowWidth,
    minHeight: minWindowHeight,
    title: appTitle,
    backgroundColor: "#0b1220",
    preloadPath: defaultPreloadPath(__dirname),
    isDev,
    devServerUrl: "http://localhost:5173",
    productionIndexPath: defaultProductionIndexPath(__dirname),
    shouldOpenDevTools,
    shouldRunRequestedSmoke,
    shouldRunStrategyActivitySmoke,
    shouldRunMarketSwitchSmoke,
    controlApiBase,
    strategyActivitySmokeRenderBudgetMs,
    onPersistBounds: (target) => persistWindowBoundsState(target),
    onTrayMenuShouldUpdate: () => updateTrayMenu(),
    onClosed: (target) => {
      if (mainWindow === target) {
        mainWindow = null;
      }
    },
  });
  mainWindow = win;
}

ipcMain.handle("desktop-notification:show", (_event, payload: DesktopNotificationPayload) => {
  if (!Notification.isSupported()) {
    return false;
  }

  const title = typeof payload?.title === "string" && payload.title.trim()
    ? payload.title.trim()
    : appTitle;
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";

  if (!body && title === appTitle) {
    return false;
  }

  const notification = new Notification({
    title,
    body,
    urgency: payload?.urgency === "critical" ? "critical" : "normal",
    silent: payload?.silent ?? false,
  });

  notification.on("click", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) {
      return;
    }
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
  });

  notification.show();
  return true;
});

ipcMain.handle(
  "desktop-path:open",
  async (_event, payload: DesktopOpenPathPayload): Promise<DesktopOpenPathResult> => {
    const requestedPath = typeof payload?.path === "string" ? payload.path.trim() : "";
    if (!requestedPath) {
      return {
        ok: false,
        message: "未提供有效路径。",
      };
    }

    if (!path.isAbsolute(requestedPath)) {
      return {
        ok: false,
        path: requestedPath,
        message: "当前路径不是本机绝对路径，无法直接打开。",
      };
    }

    const normalizedPath = path.normalize(requestedPath);
    const targetExists = fs.existsSync(normalizedPath);
    const revealDirectory = path.dirname(normalizedPath);

    try {
      if (payload?.revealInFolder) {
        if (targetExists) {
          shell.showItemInFolder(normalizedPath);
          return {
            ok: true,
            path: normalizedPath,
          };
        }
        if (!fs.existsSync(revealDirectory)) {
          return {
            ok: false,
            path: normalizedPath,
            message: "目标路径和所在目录都不存在，无法打开。",
          };
        }
        const openDirectoryError = await shell.openPath(revealDirectory);
        if (openDirectoryError) {
          return {
            ok: false,
            path: revealDirectory,
            message: openDirectoryError,
          };
        }
        return {
          ok: true,
          path: revealDirectory,
        };
      }

      if (!targetExists) {
        return {
          ok: false,
          path: normalizedPath,
          message: "目标文件不存在，无法直接打开。",
        };
      }

      const openError = await shell.openPath(normalizedPath);
      if (openError) {
        return {
          ok: false,
          path: normalizedPath,
          message: openError,
        };
      }
      return {
        ok: true,
        path: normalizedPath,
      };
    } catch (error) {
      return {
        ok: false,
        path: normalizedPath,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
);

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
    updateTrayMenu();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

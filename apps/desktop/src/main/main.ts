import { app, BrowserWindow, Tray, screen } from "electron";
import { registerDesktopIpcHandlers } from "./ipc-handlers";
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

app.whenReady().then(() => {
  registerDesktopIpcHandlers({ fallbackNotificationTitle: appTitle });
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

import { app, BrowserWindow, ipcMain, Menu, Notification, Tray, nativeImage, screen, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { runRequestedSmokeOnLoad, shouldCloseRequestedSmokeOnLogMessage } from "./runRequestedSmokeOnLoad";

const isDev = !app.isPackaged;
const shouldOpenDevTools = process.env.BYBIT_OPEN_DEVTOOLS === "1";
const shouldRunMarketSwitchSmoke = isDev && process.env.BYBIT_SMOKE_MARKET_SWITCH === "1";
const shouldRunStrategyActivitySmoke = isDev && process.env.BYBIT_SMOKE_STRATEGY_ACTIVITY === "1";
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

type WindowBoundsState = {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
};

const defaultWindowWidth = 1600;
const defaultWindowHeight = 1020;
const minWindowWidth = 1280;
const minWindowHeight = 820;
const windowStateFileName = "window-state.json";

function windowStateFilePath() {
  return path.join(app.getPath("userData"), windowStateFileName);
}

function coerceNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readWindowBoundsState(): WindowBoundsState | null {
  try {
    const raw = fs.readFileSync(windowStateFilePath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<WindowBoundsState>;
    const x = coerceNumber(parsed.x);
    const y = coerceNumber(parsed.y);
    const width = coerceNumber(parsed.width);
    const height = coerceNumber(parsed.height);
    if (x == null || y == null || width == null || height == null) {
      return null;
    }
    return {
      x,
      y,
      width,
      height,
      maximized: parsed.maximized === true,
    };
  } catch {
    return null;
  }
}

function resolveWindowBoundsState() {
  const saved = readWindowBoundsState();
  if (!saved) {
    return {
      bounds: {
        width: defaultWindowWidth,
        height: defaultWindowHeight,
      },
      maximized: false,
    };
  }

  const width = Math.max(minWindowWidth, Math.round(saved.width));
  const height = Math.max(minWindowHeight, Math.round(saved.height));
  const bounds = {
    x: Math.round(saved.x),
    y: Math.round(saved.y),
    width,
    height,
  };
  const display = screen.getDisplayMatching(bounds);
  const workArea = display.workArea;
  const intersectsVisibleArea =
    bounds.x < workArea.x + workArea.width &&
    bounds.x + bounds.width > workArea.x &&
    bounds.y < workArea.y + workArea.height &&
    bounds.y + bounds.height > workArea.y;

  if (!intersectsVisibleArea) {
    return {
      bounds: {
        width: defaultWindowWidth,
        height: defaultWindowHeight,
      },
      maximized: false,
    };
  }

  return {
    bounds,
    maximized: saved.maximized,
  };
}

function snapshotWindowBoundsState(win: BrowserWindow): WindowBoundsState {
  const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    maximized: win.isMaximized(),
  };
}

function persistWindowBoundsState(win: BrowserWindow) {
  try {
    fs.writeFileSync(
      windowStateFilePath(),
      JSON.stringify(snapshotWindowBoundsState(win), null, 2),
      "utf-8",
    );
  } catch (error) {
    console.error("[window-state:save-failed]", error);
  }
}

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <path d="M2 11.5h2.1l1.4-4 2.2 7 2.2-9 1.8 6h3.3" fill="none" stroke="#111827" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `.trim();
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
  );
  image.setTemplateImage(true);
  return image;
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

  const isVisible = Boolean(mainWindow?.isVisible());
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isVisible ? "隐藏窗口" : "显示窗口",
      click: () => toggleMainWindow(),
    },
    {
      label: "退出",
      click: () => app.quit(),
    },
  ]);

  appTray.setContextMenu(contextMenu);
  appTray.setToolTip("Bybit 量化交易控制端");
}

function createTray() {
  if (appTray) {
    updateTrayMenu();
    return;
  }

  appTray = new Tray(createTrayIcon());
  appTray.on("click", () => toggleMainWindow());
  updateTrayMenu();
}

function createWindow() {
  const initialWindowState = resolveWindowBoundsState();
  const win = new BrowserWindow({
    ...initialWindowState.bounds,
    minWidth: minWindowWidth,
    minHeight: minWindowHeight,
    show: false,
    backgroundColor: "#0b1220",
    title: "Bybit 量化交易控制端",
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow = win;

  if (isDev) {
    let requestedSmokeStarted = false;
    win.loadURL("http://localhost:5173");
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
      if (requestedSmokeStarted || (!shouldRunStrategyActivitySmoke && !shouldRunMarketSwitchSmoke)) {
        return;
      }
      requestedSmokeStarted = true;
      await runRequestedSmokeOnLoad(win, {
        shouldRunStrategyActivitySmoke,
        shouldRunMarketSwitchSmoke,
        controlApiBase,
        strategyActivitySmokeRenderBudgetMs,
      });
    });
  } else {
    win.loadFile(path.join(__dirname, "../../dist/index.html"));
  } 

  win.once("ready-to-show", () => {
    if (initialWindowState.maximized) {
      win.maximize();
    }
    win.show();
    win.focus();
    persistWindowBoundsState(win);
    updateTrayMenu();
  });

  win.on("move", () => persistWindowBoundsState(win));
  win.on("resize", () => persistWindowBoundsState(win));
  win.on("maximize", () => persistWindowBoundsState(win));
  win.on("unmaximize", () => persistWindowBoundsState(win));
  win.on("show", () => updateTrayMenu());
  win.on("hide", () => updateTrayMenu());
  win.on("focus", () => updateTrayMenu());
  win.on("close", () => persistWindowBoundsState(win));
  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
    updateTrayMenu();
  });
}

ipcMain.handle("desktop-notification:show", (_event, payload: DesktopNotificationPayload) => {
  if (!Notification.isSupported()) {
    return false;
  }

  const title = typeof payload?.title === "string" && payload.title.trim()
    ? payload.title.trim()
    : "Bybit 量化交易控制端";
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";

  if (!body && title === "Bybit 量化交易控制端") {
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

import { app, BrowserWindow, ipcMain, Menu, Notification, Tray, nativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";

const isDev = !app.isPackaged;
const shouldOpenDevTools = process.env.BYBIT_OPEN_DEVTOOLS === "1";

app.disableHardwareAcceleration();

type DesktopNotificationPayload = {
  title?: string;
  body?: string;
  urgency?: "normal" | "critical";
  silent?: boolean;
};

let mainWindow: BrowserWindow | null = null;
let appTray: Tray | null = null;

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
  const win = new BrowserWindow({
    width: 1600,
    height: 1020,
    minWidth: 1280,
    minHeight: 820,
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
    win.loadURL("http://localhost:5173");
    if (shouldOpenDevTools) {
      win.webContents.openDevTools({ mode: "detach" });
    }
    win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${sourceId}:${line} ${message}`);
    });
    win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[renderer:load-failed] ${errorCode} ${errorDescription} ${validatedURL}`);
    });
    win.webContents.on("did-finish-load", async () => {
      try {
        const snapshot = await win.webContents.executeJavaScript(`
          (() => {
            const root = document.querySelector('#root');
            const shell = document.querySelector('.app-shell');
            const sidebar = document.querySelector('.sidebar');
            const workspace = document.querySelector('.workspace');
            const brand = document.querySelector('.brand');
            const shellStyle = shell ? getComputedStyle(shell) : null;
            const sidebarStyle = sidebar ? getComputedStyle(sidebar) : null;
            const workspaceStyle = workspace ? getComputedStyle(workspace) : null;
            const brandStyle = brand ? getComputedStyle(brand) : null;
            const sample = (x, y) => {
              const el = document.elementFromPoint(x, y);
              return {
                x,
                y,
                tag: el?.tagName ?? null,
                className: el?.className ?? null,
                text: el?.textContent?.trim().slice(0, 40) ?? null,
              };
            };
            const title = document.title;
            return {
              title,
              rootHtmlLength: root?.innerHTML.length ?? 0,
              hasAppShell: Boolean(shell),
              shellRect: shell ? shell.getBoundingClientRect().toJSON() : null,
              sidebarRect: sidebar ? sidebar.getBoundingClientRect().toJSON() : null,
              workspaceRect: workspace ? workspace.getBoundingClientRect().toJSON() : null,
              shellDisplay: shellStyle?.display ?? null,
              shellGrid: shellStyle?.gridTemplateColumns ?? null,
              shellOpacity: shellStyle?.opacity ?? null,
              sidebarVisibility: sidebarStyle?.visibility ?? null,
              sidebarOpacity: sidebarStyle?.opacity ?? null,
              workspaceVisibility: workspaceStyle?.visibility ?? null,
              workspaceOpacity: workspaceStyle?.opacity ?? null,
              brandRect: brand ? brand.getBoundingClientRect().toJSON() : null,
              brandDisplay: brandStyle?.display ?? null,
              brandColor: brandStyle?.color ?? null,
              sampleTopLeft: sample(40, 90),
              sampleSidebar: sample(120, 150),
              sampleWorkspace: sample(420, 160),
              bodyTextLength: document.body.innerText.length,
              bodyTextPreview: document.body.innerText.slice(0, 120),
            };
          })()
        `);
        console.log("[renderer:dom]", JSON.stringify(snapshot));
        setTimeout(async () => {
          try {
            const image = await win.webContents.capturePage();
            const output = "/tmp/bybit-electron-capture.png";
            fs.writeFileSync(output, image.toPNG());
            console.log("[renderer:capture]", output);
          } catch (error) {
            console.error("[renderer:capture-failed]", error);
          }
        }, 1800);
      } catch (error) {
        console.error("[renderer:dom-failed]", error);
      }
    });
  } else {
    win.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  win.once("ready-to-show", () => {
    win.show();
    win.focus();
    updateTrayMenu();
  });

  win.on("show", () => updateTrayMenu());
  win.on("hide", () => updateTrayMenu());
  win.on("focus", () => updateTrayMenu());
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

import { app, BrowserWindow } from "electron";
import path from "node:path";

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1020,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: "#0b1220",
    title: "Bybit 量化交易控制端",
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

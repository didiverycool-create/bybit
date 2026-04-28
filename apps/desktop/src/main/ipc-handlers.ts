import type { IpcMainInvokeEvent } from "electron";
import { BrowserWindow, ipcMain, Notification, shell } from "electron";
import fs from "node:fs";
import path from "node:path";

export type DesktopNotificationPayload = {
  title?: string;
  body?: string;
  urgency?: "normal" | "critical";
  silent?: boolean;
};

export type DesktopOpenPathPayload = {
  path?: string;
  revealInFolder?: boolean;
};

export type DesktopOpenPathResult = {
  ok: boolean;
  path?: string;
  message?: string;
};

export type DesktopNotificationShowOptions = {
  fallbackTitle: string;
};

export function handleDesktopNotificationShow(
  payload: DesktopNotificationPayload,
  options: DesktopNotificationShowOptions,
): boolean {
  if (!Notification.isSupported()) {
    return false;
  }

  const title = typeof payload?.title === "string" && payload.title.trim()
    ? payload.title.trim()
    : options.fallbackTitle;
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";

  if (!body && title === options.fallbackTitle) {
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
}

export async function handleDesktopPathOpen(
  payload: DesktopOpenPathPayload,
): Promise<DesktopOpenPathResult> {
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
}

export type RegisterDesktopIpcHandlersOptions = {
  ipc?: typeof ipcMain;
  fallbackNotificationTitle: string;
};

export function registerDesktopIpcHandlers(options: RegisterDesktopIpcHandlersOptions): void {
  const ipc = options.ipc ?? ipcMain;
  const fallbackTitle = options.fallbackNotificationTitle;

  ipc.handle(
    "desktop-notification:show",
    (_event: IpcMainInvokeEvent, payload: DesktopNotificationPayload) =>
      handleDesktopNotificationShow(payload, { fallbackTitle }),
  );

  ipc.handle(
    "desktop-path:open",
    (_event: IpcMainInvokeEvent, payload: DesktopOpenPathPayload) =>
      handleDesktopPathOpen(payload),
  );
}

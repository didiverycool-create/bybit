import type { MenuItemConstructorOptions } from "electron";
import { Menu } from "electron";

export type BuildAppMenuOptions = {
  appTitle: string;
  isDev: boolean;
  onToggleMainWindow: () => void;
  onReload: () => void;
  onToggleDevTools: () => void;
  onQuit: () => void;
};

export function buildAppMenu(options: BuildAppMenuOptions): Menu {
  const { appTitle, isDev, onToggleMainWindow, onReload, onToggleDevTools, onQuit } = options;
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: appTitle,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { label: "Quit", accelerator: "Cmd+Q", click: onQuit },
      ],
    });
  }

  const fileSubmenu: MenuItemConstructorOptions[] = [
    {
      label: "Toggle Main Window",
      accelerator: isMac ? "Cmd+Shift+H" : "Ctrl+Shift+H",
      click: onToggleMainWindow,
    },
    { type: "separator" },
    isMac
      ? { role: "close" }
      : { label: "Quit", accelerator: "Ctrl+Q", click: onQuit },
  ];

  template.push({
    label: "File",
    submenu: fileSubmenu,
  });

  const viewSubmenu: MenuItemConstructorOptions[] = [
    { label: "Reload", accelerator: "CmdOrCtrl+R", click: onReload },
    { role: "forceReload" },
    { type: "separator" },
  ];

  if (isDev) {
    viewSubmenu.push({
      label: "Toggle DevTools",
      accelerator: isMac ? "Alt+Cmd+I" : "Ctrl+Shift+I",
      click: onToggleDevTools,
    });
    viewSubmenu.push({ type: "separator" });
  }

  viewSubmenu.push({ role: "resetZoom" });
  viewSubmenu.push({ role: "zoomIn" });
  viewSubmenu.push({ role: "zoomOut" });
  viewSubmenu.push({ type: "separator" });
  viewSubmenu.push({ role: "togglefullscreen" });

  template.push({
    label: "View",
    submenu: viewSubmenu,
  });

  template.push({
    label: "Window",
    role: "window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      { role: "close" },
    ],
  });

  return Menu.buildFromTemplate(template);
}

export function applyAppMenu(options: BuildAppMenuOptions): void {
  Menu.setApplicationMenu(buildAppMenu(options));
}

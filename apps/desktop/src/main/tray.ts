import type { Menu as MenuType, NativeImage, Tray as TrayType } from "electron";
import { Menu, nativeImage, Tray } from "electron";

const TRAY_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
  <path d="M2 11.5h2.1l1.4-4 2.2 7 2.2-9 1.8 6h3.3" fill="none" stroke="#111827" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`.trim();

export function createTrayIcon(): NativeImage {
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(TRAY_ICON_SVG).toString("base64")}`,
  );
  image.setTemplateImage(true);
  return image;
}

export type TrayMenuOptions = {
  isMainWindowVisible: boolean;
  onToggle: () => void;
  onQuit: () => void;
};

export function buildTrayMenu(options: TrayMenuOptions): MenuType {
  return Menu.buildFromTemplate([
    {
      label: options.isMainWindowVisible ? "隐藏窗口" : "显示窗口",
      click: () => options.onToggle(),
    },
    {
      label: "退出",
      click: () => options.onQuit(),
    },
  ]);
}

export type CreateTrayOptions = {
  image: NativeImage;
  tooltip: string;
  onClick: () => void;
};

export function createTray(options: CreateTrayOptions): TrayType {
  const tray = new Tray(options.image);
  tray.setToolTip(options.tooltip);
  tray.on("click", () => options.onClick());
  return tray;
}

export function applyTrayMenu(
  tray: TrayType,
  options: TrayMenuOptions & { tooltip: string },
): void {
  tray.setContextMenu(buildTrayMenu(options));
  tray.setToolTip(options.tooltip);
}

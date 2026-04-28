import type { BrowserWindow, Rectangle, Screen } from "electron";
import fs from "node:fs";
import path from "node:path";

export type WindowBoundsState = {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
};

export type WindowBoundsResolveOptions = {
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
};

export type WindowBoundsResolveResult = {
  bounds: Rectangle | { width: number; height: number };
  maximized: boolean;
  restoredFromSaved: boolean;
  adjustedToFit: boolean;
  reason: "default" | "restored" | "clamped" | "fallback-no-display";
};

// Must overlap at least this many pixels horizontally and vertically with a display
// work-area, otherwise the window can end up almost entirely off-screen (e.g. only
// the resize handle visible). Smaller than this is treated as "no display".
const MIN_VISIBLE_OVERLAP_PX = 80;

export function windowStateFilePath(userDataDir: string, fileName: string) {
  return path.join(userDataDir, fileName);
}

function coerceNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readWindowBoundsState(filePath: string): WindowBoundsState | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
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

function intersectionArea(a: Rectangle, b: Rectangle) {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= left || bottom <= top) {
    return { width: 0, height: 0, area: 0 };
  }
  const width = right - left;
  const height = bottom - top;
  return { width, height, area: width * height };
}

export type DisplayLike = { workArea: Rectangle };

export function pickBestDisplay(
  displays: ReadonlyArray<DisplayLike>,
  savedRect: Rectangle,
): DisplayLike | null {
  let best: DisplayLike | null = null;
  let bestScore = 0;
  for (const display of displays) {
    const overlap = intersectionArea(display.workArea, savedRect);
    // Require non-trivial overlap: at least MIN_VISIBLE_OVERLAP_PX in both dims.
    if (overlap.width < MIN_VISIBLE_OVERLAP_PX || overlap.height < MIN_VISIBLE_OVERLAP_PX) {
      continue;
    }
    if (overlap.area > bestScore) {
      bestScore = overlap.area;
      best = display;
    }
  }
  return best;
}

export function clampBoundsToWorkArea(
  savedRect: Rectangle,
  workArea: Rectangle,
  minWidth: number,
  minHeight: number,
): { rect: Rectangle; adjusted: boolean } {
  // Width/height: never smaller than the user-chosen size (unless the work area itself
  // is smaller), and never larger than the work area. If the target display is smaller
  // than minWidth/minHeight (rare), we still respect the work area as the hard cap.
  const maxWidth = Math.max(1, workArea.width);
  const maxHeight = Math.max(1, workArea.height);
  const width = Math.min(Math.max(savedRect.width, Math.min(minWidth, maxWidth)), maxWidth);
  const height = Math.min(Math.max(savedRect.height, Math.min(minHeight, maxHeight)), maxHeight);

  // Position: clamp so the entire rect sits inside the work area. `Math.min` after
  // `Math.max` handles the case where the saved x is beyond the right edge.
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;
  const x = Math.min(Math.max(savedRect.x, workArea.x), maxX);
  const y = Math.min(Math.max(savedRect.y, workArea.y), maxY);

  const rect: Rectangle = { x, y, width, height };
  const adjusted =
    rect.x !== savedRect.x ||
    rect.y !== savedRect.y ||
    rect.width !== savedRect.width ||
    rect.height !== savedRect.height;
  return { rect, adjusted };
}

export function centerOnDisplay(
  display: DisplayLike,
  width: number,
  height: number,
): Rectangle {
  const workArea = display.workArea;
  const clampedWidth = Math.min(width, Math.max(1, workArea.width));
  const clampedHeight = Math.min(height, Math.max(1, workArea.height));
  const x = Math.round(workArea.x + (workArea.width - clampedWidth) / 2);
  const y = Math.round(workArea.y + (workArea.height - clampedHeight) / 2);
  return { x, y, width: clampedWidth, height: clampedHeight };
}

export function resolveWindowBoundsState(
  saved: WindowBoundsState | null,
  screenModule: Pick<Screen, "getAllDisplays" | "getPrimaryDisplay">,
  options: WindowBoundsResolveOptions,
): WindowBoundsResolveResult {
  const displays = screenModule.getAllDisplays();
  const primary = screenModule.getPrimaryDisplay();

  if (!saved) {
    return {
      bounds: { width: options.defaultWidth, height: options.defaultHeight },
      maximized: false,
      restoredFromSaved: false,
      adjustedToFit: false,
      reason: "default",
    };
  }

  const savedRect: Rectangle = {
    x: Math.round(saved.x),
    y: Math.round(saved.y),
    width: Math.max(options.minWidth, Math.round(saved.width)),
    height: Math.max(options.minHeight, Math.round(saved.height)),
  };

  const matchedDisplay = pickBestDisplay(displays, savedRect);

  if (!matchedDisplay) {
    if (displays.length === 0) {
      // Headless or all displays disconnected. Return default size with no position;
      // Electron will place the window wherever it can.
      return {
        bounds: { width: options.defaultWidth, height: options.defaultHeight },
        maximized: saved.maximized,
        restoredFromSaved: false,
        adjustedToFit: true,
        reason: "fallback-no-display",
      };
    }
    // Saved display disappeared. Re-center the saved size on the primary display,
    // then clamp to guarantee the whole rect stays inside the work area.
    const centered = centerOnDisplay(
      primary,
      Math.max(options.minWidth, savedRect.width),
      Math.max(options.minHeight, savedRect.height),
    );
    const clamped = clampBoundsToWorkArea(centered, primary.workArea, options.minWidth, options.minHeight);
    return {
      bounds: clamped.rect,
      maximized: saved.maximized,
      restoredFromSaved: false,
      adjustedToFit: true,
      reason: "fallback-no-display",
    };
  }

  const { rect, adjusted } = clampBoundsToWorkArea(
    savedRect,
    matchedDisplay.workArea,
    options.minWidth,
    options.minHeight,
  );
  return {
    bounds: rect,
    maximized: saved.maximized,
    restoredFromSaved: true,
    adjustedToFit: adjusted,
    reason: adjusted ? "clamped" : "restored",
  };
}

export function snapshotWindowBoundsState(win: BrowserWindow): WindowBoundsState {
  const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    maximized: win.isMaximized(),
  };
}

export function persistWindowBoundsState(win: BrowserWindow, filePath: string) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(snapshotWindowBoundsState(win), null, 2), "utf-8");
  } catch (error) {
    console.error("[window-state:save-failed]", error);
  }
}

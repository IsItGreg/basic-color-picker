import overlayCss from "./overlay.css?inline";
import {
  type Rgb,
  rgbToHex,
  rgbToHsl,
  rgbToOklab,
  oklabToOklch,
  formatRgb,
  formatHsl,
  formatOklab,
  formatOklch,
} from "../lib/color";
import { matchTailwindPalette, type TailwindVersion } from "../lib/tailwind-match";
import { detectElementTailwind } from "../lib/element-classes";
import {
  type ColorEntry,
  getHistory,
  appendToHistory,
  deleteFromHistory,
  clearHistory,
  makeId,
} from "../lib/storage";

// Injected on demand by the background service worker via
// chrome.scripting.executeScript. Each injection re-runs this top-level
// code: if a previous overlay is still mounted, tear it down (toggle off);
// otherwise mount fresh.
const HOST_ID = "__cp-host";
declare global {
  interface Window {
    __colorPickerCleanup?: () => void;
  }
}

if (window.__colorPickerCleanup) {
  window.__colorPickerCleanup();
} else {
  mountOverlay();
}

type FormatKey = "hex" | "rgb" | "hsl" | "oklab" | "oklch";
const FORMAT_LABELS: Record<FormatKey, string> = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
  oklab: "Oklab",
  oklch: "Oklch",
};

function mountOverlay() {
  const existing = document.getElementById(HOST_ID);
  if (existing) existing.remove();

  // ------------------------------------------------------------------
  // Shadow root + markup
  // ------------------------------------------------------------------
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.all = "initial";
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = overlayCss;
  shadow.appendChild(style);

  const root = document.createElement("div");
  root.className = "cp-root";
  root.innerHTML = `
    <div class="cp-surface"></div>
    <canvas class="cp-screenshot"></canvas>

    <div class="cp-magnifier" data-hidden="true" data-mode="follow">
      <canvas class="cp-magnifier-canvas" width="180" height="180"></canvas>
      <div class="cp-magnifier-crosshair"></div>
      <div class="cp-magnifier-info" title="Drag to pin in place">
        <div class="cp-magnifier-swatch"></div>
        <div class="cp-magnifier-hex">#______</div>
        <button class="cp-magnifier-mode" title="Return magnifier to follow the cursor">&#x21A9;&#xFE0E; follow</button>
      </div>
    </div>

    <div class="cp-markers"></div>

    <div class="cp-toolbar">
      <span class="cp-toolbar-drag" title="Drag to move toolbar">&#x22ee;&#x22ee;</span>
      <span class="cp-help">Click to pick · Esc to exit · H for history · C to clear pins</span>
      <div class="cp-format" data-open="false">
        <button class="cp-format-button" title="Primary format">
          <span class="cp-format-label">HEX</span>
          <span class="cp-format-caret" aria-hidden="true">&#x25BE;</span>
        </button>
        <ul class="cp-format-menu" role="listbox">
          <li role="option" data-value="hex" data-selected="true">HEX</li>
          <li role="option" data-value="rgb">RGB</li>
          <li role="option" data-value="hsl">HSL</li>
          <li role="option" data-value="oklab">Oklab</li>
          <li role="option" data-value="oklch">Oklch</li>
        </ul>
      </div>
      <button class="cp-clear" title="Clear pins (C)">Clear pins</button>
      <button class="cp-history-toggle" title="Toggle history (H)">History</button>
      <button class="cp-done" title="Exit picker (Esc)">Done</button>
    </div>

    <aside class="cp-history-panel">
      <header>
        <h2>History</h2>
        <button class="cp-history-clear" title="Clear all history">Clear all</button>
        <button class="cp-history-close" title="Close">&times;</button>
      </header>
      <ul class="cp-history-list"></ul>
    </aside>

    <div class="cp-toast"></div>
  `;
  shadow.appendChild(root);

  const $ = <T extends Element>(sel: string) => root.querySelector(sel) as T;
  const surface = $<HTMLDivElement>(".cp-surface");
  const screenshotCanvas = $<HTMLCanvasElement>(".cp-screenshot");
  const magnifier = $<HTMLDivElement>(".cp-magnifier");
  const magCanvas = $<HTMLCanvasElement>(".cp-magnifier-canvas");
  const magSwatch = $<HTMLDivElement>(".cp-magnifier-swatch");
  const magHex = $<HTMLDivElement>(".cp-magnifier-hex");
  const magInfo = $<HTMLDivElement>(".cp-magnifier-info");
  const magModeBtn = $<HTMLButtonElement>(".cp-magnifier-mode");
  const markersLayer = $<HTMLDivElement>(".cp-markers");
  const toolbar = $<HTMLDivElement>(".cp-toolbar");
  const toolbarDrag = $<HTMLSpanElement>(".cp-toolbar-drag");
  const toolbarHelp = $<HTMLSpanElement>(".cp-help");
  const formatBox = $<HTMLDivElement>(".cp-format");
  const formatButton = $<HTMLButtonElement>(".cp-format-button");
  const formatLabel = $<HTMLSpanElement>(".cp-format-label");
  const formatMenu = $<HTMLUListElement>(".cp-format-menu");
  const clearBtn = $<HTMLButtonElement>(".cp-clear");
  const historyToggle = $<HTMLButtonElement>(".cp-history-toggle");
  const historyClear = $<HTMLButtonElement>(".cp-history-clear");
  const historyClose = $<HTMLButtonElement>(".cp-history-close");
  const doneBtn = $<HTMLButtonElement>(".cp-done");
  const historyPanel = $<HTMLElement>(".cp-history-panel");
  const historyList = $<HTMLUListElement>(".cp-history-list");
  const toast = $<HTMLDivElement>(".cp-toast");

  const screenshotCtx = screenshotCanvas.getContext("2d", { willReadFrequently: true })!;
  const magCtx = magCanvas.getContext("2d")!;
  magCtx.imageSmoothingEnabled = false;

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const sessionMarkers: Array<{ id: string; entry: ColorEntry; node: HTMLElement }> = [];
  let history: ColorEntry[] = [];
  let primaryFormat: FormatKey = "hex";
  let cachedScreenshotBitmap: ImageBitmap | null = null;
  let cachedDpr = window.devicePixelRatio;
  let magnifierFollow = true;
  let lastCursor: { x: number; y: number } | null = null;

  // Lock page scroll so screenshot pixels stay aligned with click coords.
  const prevHtmlOverflow = document.documentElement.style.overflow;
  const prevBodyOverflow = document.body?.style.overflow;
  document.documentElement.style.overflow = "hidden";
  if (document.body) document.body.style.overflow = "hidden";

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------
  function cleanup() {
    document.documentElement.style.overflow = prevHtmlOverflow;
    if (document.body) document.body.style.overflow = prevBodyOverflow ?? "";
    host.remove();
    cachedScreenshotBitmap?.close();
    cachedScreenshotBitmap = null;
    delete window.__colorPickerCleanup;
  }
  window.__colorPickerCleanup = cleanup;

  // ------------------------------------------------------------------
  // Screenshot pipeline
  //
  // captureVisibleTab takes whatever is rendered, so we must hide the overlay
  // for one frame or the magnifier / toolbar / history panel pixels would end
  // up sampled instead of the real page underneath.
  // ------------------------------------------------------------------
  async function fetchScreenshot(): Promise<ImageBitmap | null> {
    const prevVisibility = root.style.visibility;
    root.style.visibility = "hidden";
    // Two RAFs flush style + paint reliably across browsers.
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));

    const resp = await chrome.runtime.sendMessage({ type: "capture" }).catch(() => null);
    root.style.visibility = prevVisibility;

    if (!resp?.ok || !resp.dataUrl) {
      showToast("Capture failed", true);
      return null;
    }
    try {
      const blob = await (await fetch(resp.dataUrl)).blob();
      return await createImageBitmap(blob);
    } catch {
      showToast("Capture decode failed", true);
      return null;
    }
  }

  async function refreshCachedScreenshot() {
    const bm = await fetchScreenshot();
    if (!bm) return;
    cachedScreenshotBitmap?.close();
    cachedScreenshotBitmap = bm;
    cachedDpr = window.devicePixelRatio;
    screenshotCanvas.width = bm.width;
    screenshotCanvas.height = bm.height;
    screenshotCtx.drawImage(bm, 0, 0);
  }

  // ------------------------------------------------------------------
  // Magnifier
  // ------------------------------------------------------------------
  const MAG_SIZE = 180;
  const MAG_PIXELS = 15; // device pixels sampled per side → 12× zoom at 180px output

  function positionMagnifier(clientX: number, clientY: number) {
    const offset = 20;
    const w = magnifier.offsetWidth;
    const h = magnifier.offsetHeight;
    let x = clientX + offset;
    let y = clientY + offset;
    if (x + w > window.innerWidth - 8) x = clientX - w - offset;
    if (y + h > window.innerHeight - 8) y = clientY - h - offset;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    magnifier.style.left = `${x}px`;
    magnifier.style.top = `${y}px`;
  }

  function paintMagnifier(clientX: number, clientY: number) {
    if (!cachedScreenshotBitmap) return;
    const dpr = cachedDpr;
    // Snap to integer device-pixel coordinates and treat that as the cursor
    // pixel. With MAG_PIXELS odd, we want the cursor pixel to be the exact
    // centre tile of the grid; sampling half = (MAG_PIXELS-1)/2 on each
    // side makes the centre tile in the canvas line up with the CSS
    // crosshair (centred at MAG_SIZE / 2).
    const px = Math.floor(clientX * dpr);
    const py = Math.floor(clientY * dpr);
    const half = (MAG_PIXELS - 1) / 2;
    magCtx.fillStyle = "#000";
    magCtx.fillRect(0, 0, MAG_SIZE, MAG_SIZE);
    magCtx.drawImage(
      cachedScreenshotBitmap,
      px - half,
      py - half,
      MAG_PIXELS,
      MAG_PIXELS,
      0,
      0,
      MAG_SIZE,
      MAG_SIZE,
    );
    // Sample the centre pixel for the swatch label.
    try {
      const data = screenshotCtx.getImageData(px, py, 1, 1).data;
      const rgb = { r: data[0]!, g: data[1]!, b: data[2]! };
      const hex = rgbToHex(rgb);
      magSwatch.style.background = hex;
      magHex.textContent = hex.toUpperCase();
    } catch {
      // getImageData can fail near edges; ignore.
    }
  }

  // ------------------------------------------------------------------
  // Marker placement + color entry construction
  // ------------------------------------------------------------------
  function buildEntry(rgb: Rgb, element: Element | null): ColorEntry {
    const hsl = rgbToHsl(rgb);
    const oklab = rgbToOklab(rgb);
    const oklch = oklabToOklch(oklab);
    const palette = matchTailwindPalette(rgb);
    const elementHits = detectElementTailwind(element, rgb);
    return {
      id: makeId(),
      pickedAt: Date.now(),
      pageUrl: location.href,
      pageTitle: document.title,
      rgb,
      hex: rgbToHex(rgb),
      rgbStr: formatRgb(rgb),
      hslStr: formatHsl(hsl),
      oklabStr: formatOklab(oklab),
      oklchStr: formatOklch(oklch),
      tailwindMatch: palette ? { name: palette.name, version: palette.version } : null,
      elementTailwind: elementHits.map((h) => ({ className: h.className, version: h.version })),
    };
  }

  function primaryString(entry: ColorEntry): string {
    switch (primaryFormat) {
      case "hex": return entry.hex;
      case "rgb": return entry.rgbStr;
      case "hsl": return entry.hslStr;
      case "oklab": return entry.oklabStr;
      case "oklch": return entry.oklchStr;
    }
  }

  function placeMarker(clientX: number, clientY: number, entry: ColorEntry) {
    const node = document.createElement("div");
    node.className = "cp-marker";
    node.style.left = `${clientX}px`;
    node.style.top = `${clientY}px`;
    const num = sessionMarkers.length + 1;
    node.innerHTML = `
      <div class="cp-marker-pin" style="background:${entry.hex}">
        <span class="cp-marker-num">${num}</span>
      </div>
      <button class="cp-marker-label" type="button" title="Click to copy">
        <span class="cp-marker-label-text">${escapeHtml(primaryString(entry))}</span>
        <span class="cp-marker-label-copy" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="5" width="8" height="9" rx="1.4"/>
            <path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H10"/>
          </svg>
          Copy
        </span>
      </button>
    `;
    node.title = `${entry.hex} · ${entry.rgbStr}`;
    const label = node.querySelector<HTMLButtonElement>(".cp-marker-label");
    label?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      copy(primaryString(entry));
    });
    // Don't let pointerdown on the label fall through to the surface
    // (which would treat it as a fresh pick where the marker sits).
    label?.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    markersLayer.appendChild(node);
    sessionMarkers.push({ id: entry.id, entry, node });
  }

  async function pick(clientX: number, clientY: number) {
    const fresh = await fetchScreenshot();
    if (!fresh) return;
    cachedScreenshotBitmap?.close();
    cachedScreenshotBitmap = fresh;
    cachedDpr = window.devicePixelRatio;
    screenshotCanvas.width = fresh.width;
    screenshotCanvas.height = fresh.height;
    screenshotCtx.drawImage(fresh, 0, 0);

    // Match paintMagnifier: floor() identifies the pixel that physically
    // contains the cursor, so the picked color always equals the centre
    // tile of the magnifier preview.
    const px = Math.floor(clientX * cachedDpr);
    const py = Math.floor(clientY * cachedDpr);
    let data: Uint8ClampedArray;
    try {
      data = screenshotCtx.getImageData(px, py, 1, 1).data;
    } catch {
      showToast("Pixel read failed", true);
      return;
    }
    const rgb: Rgb = { r: data[0]!, g: data[1]!, b: data[2]! };
    const element = document.elementFromPoint(clientX, clientY);
    const entry = buildEntry(rgb, element);

    placeMarker(clientX, clientY, entry);

    const resp = await chrome.runtime.sendMessage({ type: "save-color", payload: entry }).catch(() => null);
    if (resp?.ok && Array.isArray(resp.history)) {
      history = resp.history as ColorEntry[];
    } else {
      // Fall back to local append so the panel still updates if messaging hiccups.
      history = await appendToHistory(entry);
    }
    renderHistory();
    showToast(`Picked ${entry.hex}`);
  }

  // ------------------------------------------------------------------
  // History rendering
  // ------------------------------------------------------------------
  function renderHistory() {
    const sessionIds = new Set(sessionMarkers.map((m) => m.id));
    const sessionEntries = history.filter((e) => sessionIds.has(e.id));
    const olderEntries = history.filter((e) => !sessionIds.has(e.id));

    historyList.innerHTML = "";
    if (sessionEntries.length === 0 && olderEntries.length === 0) {
      const empty = document.createElement("li");
      empty.className = "cp-history-empty";
      empty.textContent = "No colors yet — click anywhere on the page to pick one.";
      historyList.appendChild(empty);
      return;
    }

    if (sessionEntries.length > 0) {
      const heading = document.createElement("li");
      heading.className = "cp-history-section";
      heading.textContent = "This session";
      historyList.appendChild(heading);
      for (const e of sessionEntries) historyList.appendChild(renderRow(e));
    }
    if (olderEntries.length > 0) {
      const heading = document.createElement("li");
      heading.className = "cp-history-section";
      heading.textContent = "Earlier";
      historyList.appendChild(heading);
      for (const e of olderEntries.slice(0, 200)) historyList.appendChild(renderRow(e));
    }
  }

  function renderRow(entry: ColorEntry): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "cp-row";

    const top = document.createElement("div");
    top.className = "cp-row-top";

    const swatch = document.createElement("div");
    swatch.className = "cp-row-swatch";
    swatch.style.background = entry.hex;
    swatch.title = "Copy primary format";
    swatch.addEventListener("click", () => copy(primaryString(entry)));

    const primary = document.createElement("div");
    primary.className = "cp-row-primary";
    primary.textContent = primaryString(entry);
    primary.title = "Copy";
    primary.addEventListener("click", () => copy(primaryString(entry)));

    const del = document.createElement("button");
    del.className = "cp-row-delete";
    del.textContent = "×";
    del.title = "Delete from history";
    del.addEventListener("click", async () => {
      history = await deleteFromHistory(entry.id);
      // Also remove a visual session marker if it was the same id.
      const idx = sessionMarkers.findIndex((m) => m.id === entry.id);
      if (idx >= 0) {
        sessionMarkers[idx]!.node.remove();
        sessionMarkers.splice(idx, 1);
      }
      renderHistory();
    });

    top.append(swatch, primary, del);
    li.appendChild(top);

    const formats = document.createElement("div");
    formats.className = "cp-row-formats";
    const pillSpecs: Array<{ key: FormatKey | "tw" | "tw-el"; value: string; label: string; cls?: string }> = [
      { key: "hex", value: entry.hex, label: "HEX" },
      { key: "rgb", value: entry.rgbStr, label: "RGB" },
      { key: "hsl", value: entry.hslStr, label: "HSL" },
      { key: "oklab", value: entry.oklabStr, label: "OKLAB" },
      { key: "oklch", value: entry.oklchStr, label: "OKLCH" },
    ];
    if (entry.tailwindMatch) {
      pillSpecs.push({
        key: "tw",
        value: entry.tailwindMatch.name,
        label: tailwindLabel(entry.tailwindMatch.version),
        cls: "cp-pill-tw",
      });
    }
    for (const ec of entry.elementTailwind) {
      pillSpecs.push({
        key: "tw-el",
        value: ec.className,
        label: "EL " + tailwindLabel(ec.version),
        cls: "cp-pill-tw",
      });
    }
    for (const spec of pillSpecs) {
      const pill = document.createElement("button");
      pill.className = `cp-pill${spec.cls ? " " + spec.cls : ""}`;
      pill.innerHTML = `<span class="cp-pill-label">${spec.label}</span>${escapeHtml(spec.value)}`;
      pill.title = `Copy ${spec.label}`;
      pill.addEventListener("click", () => copy(spec.value));
      formats.appendChild(pill);
    }
    li.appendChild(formats);

    const meta = document.createElement("div");
    meta.className = "cp-row-meta";
    const time = new Date(entry.pickedAt).toLocaleString();
    let host = "";
    try { host = new URL(entry.pageUrl).hostname; } catch { /* opaque urls — leave blank */ }
    meta.innerHTML = `<span>${time}</span><span title="${escapeHtml(entry.pageUrl)}">${escapeHtml(host)}</span>`;
    li.appendChild(meta);

    return li;
  }

  function tailwindLabel(v: TailwindVersion): string {
    return v === "both" ? "TW" : `TW ${v}`;
  }

  function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c] as string);
  }

  // ------------------------------------------------------------------
  // Clipboard
  // ------------------------------------------------------------------
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${text}`);
    } catch {
      // navigator.clipboard can fail when the document isn't focused. Fallback:
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.documentElement.appendChild(ta);
      ta.focus(); ta.select();
      try { document.execCommand("copy"); showToast(`Copied ${text}`); }
      catch { showToast("Copy failed", true); }
      ta.remove();
    }
  }

  let toastTimer: number | null = null;
  function showToast(message: string, isError = false) {
    toast.textContent = message;
    toast.style.borderColor = isError ? "rgba(251,113,133,0.6)" : "var(--cp-border)";
    toast.dataset.show = "true";
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.dataset.show = "false"; }, 1400);
  }

  // ------------------------------------------------------------------
  // Drag helper — used by the toolbar and the magnifier
  // ------------------------------------------------------------------
  function makeDraggable(handle: HTMLElement, target: HTMLElement, opts?: {
    onDragStart?: () => void;
  }) {
    let active = false;
    let startX = 0, startY = 0;
    let originX = 0, originY = 0;

    handle.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      active = true;
      handle.setPointerCapture(ev.pointerId);
      startX = ev.clientX;
      startY = ev.clientY;
      const rect = target.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      target.dataset.dragging = "true";
      opts?.onDragStart?.();
    });
    handle.addEventListener("pointermove", (ev) => {
      if (!active) return;
      const nx = originX + (ev.clientX - startX);
      const ny = originY + (ev.clientY - startY);
      const maxX = window.innerWidth - target.offsetWidth - 4;
      const maxY = window.innerHeight - target.offsetHeight - 4;
      target.style.left = `${Math.min(Math.max(4, nx), maxX)}px`;
      target.style.top = `${Math.min(Math.max(4, ny), maxY)}px`;
      target.style.right = "auto";
      target.style.bottom = "auto";
      target.style.transform = "none";
    });
    const end = (ev: PointerEvent) => {
      if (!active) return;
      active = false;
      try { handle.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
      target.dataset.dragging = "false";
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  // ------------------------------------------------------------------
  // Magnifier modes
  // ------------------------------------------------------------------
  function setMagnifierMode(follow: boolean) {
    magnifierFollow = follow;
    magnifier.dataset.mode = follow ? "follow" : "free";
    // The button is hidden when in follow mode (see CSS). When pinned, it
    // labels what clicking will do — return the magnifier to follow.
    magModeBtn.innerHTML = "&#x21A9;&#xFE0E; follow";
    if (follow && lastCursor) positionMagnifier(lastCursor.x, lastCursor.y);
  }
  magModeBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    setMagnifierMode(!magnifierFollow);
  });
  // Dragging the info bar implicitly switches to "free" mode.
  makeDraggable(magInfo, magnifier, {
    onDragStart: () => setMagnifierMode(false),
  });
  makeDraggable(toolbarDrag, toolbar);
  // The help-text region is also a convenient drag handle for the toolbar.
  makeDraggable(toolbarHelp, toolbar);

  // ------------------------------------------------------------------
  // Picking events
  // ------------------------------------------------------------------
  surface.addEventListener("pointermove", (ev) => {
    lastCursor = { x: ev.clientX, y: ev.clientY };
    magnifier.dataset.hidden = "false";
    if (magnifierFollow) positionMagnifier(ev.clientX, ev.clientY);
    paintMagnifier(ev.clientX, ev.clientY);
  });
  surface.addEventListener("pointerleave", () => {
    // Only auto-hide while in follow mode — a pinned magnifier should stay put.
    if (magnifierFollow) magnifier.dataset.hidden = "true";
  });
  surface.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    pick(ev.clientX, ev.clientY);
  });

  function setFormat(key: FormatKey) {
    primaryFormat = key;
    formatLabel.textContent = FORMAT_LABELS[key];
    for (const item of formatMenu.querySelectorAll<HTMLLIElement>("li[role=option]")) {
      item.dataset.selected = item.dataset.value === key ? "true" : "false";
    }
    renderHistory();
    for (const m of sessionMarkers) {
      const text = m.node.querySelector(".cp-marker-label-text");
      if (text) text.textContent = primaryString(m.entry);
    }
  }
  function setFormatMenuOpen(open: boolean) {
    formatBox.dataset.open = open ? "true" : "false";
  }
  formatButton.addEventListener("click", (ev) => {
    ev.stopPropagation();
    setFormatMenuOpen(formatBox.dataset.open !== "true");
  });
  formatMenu.addEventListener("click", (ev) => {
    const item = (ev.target as HTMLElement).closest("li[role=option]") as HTMLLIElement | null;
    if (!item || !item.dataset.value) return;
    setFormat(item.dataset.value as FormatKey);
    setFormatMenuOpen(false);
  });
  // Click anywhere outside the format box closes the menu.
  shadow.addEventListener("pointerdown", (ev) => {
    if (formatBox.dataset.open !== "true") return;
    const path = ev.composedPath();
    if (!path.includes(formatBox)) setFormatMenuOpen(false);
  }, true);

  clearBtn.addEventListener("click", () => {
    for (const m of sessionMarkers) m.node.remove();
    sessionMarkers.length = 0;
    renderHistory();
  });

  function toggleHistory() {
    const open = historyPanel.dataset.open === "true";
    historyPanel.dataset.open = open ? "false" : "true";
  }
  historyToggle.addEventListener("click", toggleHistory);
  historyClose.addEventListener("click", () => { historyPanel.dataset.open = "false"; });
  doneBtn.addEventListener("click", cleanup);

  // Two-step "Clear all" — first click arms the button, second confirms. Auto
  // disarms after 3s so an accidental tap can't wipe history.
  let clearArmTimer: number | null = null;
  function disarmClear() {
    historyClear.dataset.confirm = "false";
    historyClear.textContent = "Clear all";
    if (clearArmTimer) { window.clearTimeout(clearArmTimer); clearArmTimer = null; }
  }
  historyClear.addEventListener("click", async () => {
    if (historyClear.dataset.confirm !== "true") {
      historyClear.dataset.confirm = "true";
      historyClear.textContent = "Confirm clear";
      if (clearArmTimer) window.clearTimeout(clearArmTimer);
      clearArmTimer = window.setTimeout(disarmClear, 3000);
      return;
    }
    disarmClear();
    await clearHistory();
    history = [];
    // Also drop session markers since their entries are gone too.
    for (const m of sessionMarkers) m.node.remove();
    sessionMarkers.length = 0;
    renderHistory();
    showToast("History cleared");
  });

  document.addEventListener("keydown", keyHandler, true);
  function keyHandler(ev: KeyboardEvent) {
    // Escape always closes the picker, even if focus is on a page input —
    // when the script is first injected, focus is typically still on the
    // page (e.g. Google's search box) so we'd otherwise eat the key.
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      cleanup();
      return;
    }
    // Ignore key shortcuts when any modifier is held — Cmd/Ctrl+C is
    // copy-text, not clear-pins, and Cmd/Ctrl+H is browser-native.
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    // For other shortcuts, defer to the page when typing in a form.
    const target = ev.target as Element | null;
    const isEditable = target instanceof HTMLElement &&
      (target.isContentEditable || target.matches("input, textarea, select"));
    if (isEditable) return;
    if (ev.key === "h" || ev.key === "H") { ev.preventDefault(); toggleHistory(); }
    else if (ev.key === "c" || ev.key === "C") {
      ev.preventDefault();
      for (const m of sessionMarkers) m.node.remove();
      sessionMarkers.length = 0;
      renderHistory();
    }
  }
  // Strip the keydown listener as part of cleanup.
  const origCleanup = window.__colorPickerCleanup;
  window.__colorPickerCleanup = () => {
    document.removeEventListener("keydown", keyHandler, true);
    origCleanup?.();
  };

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  (async () => {
    history = await getHistory();
    renderHistory();
    await refreshCachedScreenshot();
  })();
}

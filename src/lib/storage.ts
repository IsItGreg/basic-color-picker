import type { Rgb } from "./color";
import type { TailwindVersion } from "./tailwind-match";

export type ColorEntry = {
  id: string;
  pickedAt: number;
  pageUrl: string;
  pageTitle: string;
  rgb: Rgb;
  hex: string;
  rgbStr: string;
  hslStr: string;
  oklabStr: string;
  oklchStr: string;
  /** Closest Tailwind palette match across v3 + v4 (null when nothing close). */
  tailwindMatch: { name: string; version: TailwindVersion } | null;
  /** Tailwind color utilities present on the picked element/ancestors that resolve to the picked color. */
  elementTailwind: Array<{ className: string; version: TailwindVersion }>;
};

// Old (pre-v4) entries stored these as plain strings. Coerce on read so
// the UI doesn't need to branch.
function normalize(e: any): ColorEntry {
  if (typeof e.tailwindMatch === "string") {
    e.tailwindMatch = { name: e.tailwindMatch, version: "v3" as TailwindVersion };
  }
  if (
    Array.isArray(e.elementTailwind) &&
    e.elementTailwind.length > 0 &&
    typeof e.elementTailwind[0] === "string"
  ) {
    e.elementTailwind = e.elementTailwind.map((cls: string) => ({
      className: cls,
      version: "v3" as TailwindVersion,
    }));
  }
  return e as ColorEntry;
}

const STORAGE_KEY = "history";
const HISTORY_CAP = 500;

export async function getHistory(): Promise<ColorEntry[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const list = result[STORAGE_KEY];
  return Array.isArray(list) ? list.map(normalize) : [];
}

export async function appendToHistory(entry: ColorEntry): Promise<ColorEntry[]> {
  const current = await getHistory();
  const next = [entry, ...current].slice(0, HISTORY_CAP);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function deleteFromHistory(id: string): Promise<ColorEntry[]> {
  const current = await getHistory();
  const next = current.filter((e) => e.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

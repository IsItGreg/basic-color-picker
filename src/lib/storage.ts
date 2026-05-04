import type { Rgb } from "./color";

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
  /** Closest Tailwind palette match (or null when no perceptually-equal match). */
  tailwindMatch: string | null;
  /** Tailwind color utilities found on the picked element / ancestors. */
  elementTailwind: string[];
};

const STORAGE_KEY = "history";
const HISTORY_CAP = 500;

export async function getHistory(): Promise<ColorEntry[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const list = result[STORAGE_KEY];
  return Array.isArray(list) ? (list as ColorEntry[]) : [];
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

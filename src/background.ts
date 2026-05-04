import { appendToHistory, type ColorEntry } from "./lib/storage";

const RESTRICTED_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "about:",
  "https://chromewebstore.google.com/",
  "https://chrome.google.com/webstore",
];

function isRestricted(url: string | undefined): boolean {
  if (!url) return true;
  return RESTRICTED_PREFIXES.some((p) => url.startsWith(p));
}

async function notify(title: string, message: string) {
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("src/icons/icon-128.png"),
      title,
      message,
    });
  } catch {
    // Notifications can fail on some platforms; non-fatal.
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || isRestricted(tab.url)) {
    await notify(
      "Color picker unavailable",
      "This page is restricted by Chrome. Try a regular http(s) page.",
    );
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle-picker" });
  } catch (err) {
    // sendMessage rejects if the receiver isn't loaded yet (e.g. the user
    // installed the extension after opening the tab). Reload guidance.
    await notify(
      "Color picker not ready",
      "Reload this tab once and try again.",
    );
  }
});

type CaptureRequest = { type: "capture" };
type SaveRequest = { type: "save-color"; payload: ColorEntry };
type Request = CaptureRequest | SaveRequest;

chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
  const message = rawMessage as Request | undefined;
  if (!message || typeof message !== "object" || !("type" in message)) return false;

  if (message.type === "capture") {
    const windowId = sender.tab?.windowId;
    chrome.tabs.captureVisibleTab(windowId ?? chrome.windows.WINDOW_ID_CURRENT, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({ ok: false, error: chrome.runtime.lastError?.message ?? "captureVisibleTab failed" });
        return;
      }
      sendResponse({ ok: true, dataUrl });
    });
    return true; // keep the message channel open for async sendResponse
  }

  if (message.type === "save-color") {
    appendToHistory(message.payload)
      .then((history) => sendResponse({ ok: true, history }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message ?? err) }));
    return true;
  }

  return false;
});

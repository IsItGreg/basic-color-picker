# Privacy Policy — Basic Color Picker

> **Canonical version is hosted at <https://gsme.dev/basic-color-picker/privacy>** (source: [gsme.dev-v3/app/basic-color-picker/privacy/page.tsx](https://github.com/IsItGreg/gsme.dev-v3/blob/main/app/basic-color-picker/privacy/page.tsx)). This file is kept as a markdown mirror for offline reading; the gsme.dev URL is what the Chrome Web Store listing references.

**Last updated: 2026-05-04**

Basic Color Picker is a Chrome extension that lets you sample colors from any web page. It is designed to do its job without collecting, transmitting, or sharing any user data.

## What we collect

The extension stores **only** the following on your device, and only when you actively pick a color:

- the picked sRGB value, plus its derived HEX / RGB / HSL / Oklab / Oklch / Tailwind-class representations,
- the URL and title of the page you picked from,
- the local timestamp of the pick.

This data is written to `chrome.storage.local`, which is private to the extension and never synced to any cloud service.

## What we don't collect

- We do **not** read or transmit page contents.
- We do **not** track your browsing history.
- We do **not** record IP addresses, device identifiers, or any analytics.
- We do **not** use cookies.
- We do **not** make any network requests. The extension is fully offline.

## Who we share it with

Nobody. The data never leaves your device.

## Your control

You can delete individual entries with the **×** button on each history row, or wipe everything with **Clear all** in the history panel. Removing the extension from Chrome also removes all stored data.

## Permissions explained

| Permission | Why it's requested |
| --- | --- |
| `activeTab` | Capture the visible pixels of the active tab when you click the toolbar icon, so we can read the color you're hovering over. |
| `scripting` | Inject the picker overlay into the active tab on icon click. Required because we don't auto-inject content scripts. |
| `storage` | Persist your pick history in `chrome.storage.local`. Local only. |
| `notifications` | Show a single non-blocking notification when the picker can't run on a restricted page (e.g. `chrome://` URLs). |

## Changes

If this policy ever changes, the new version will appear at this URL with an updated date. Material changes to data handling would also be called out in the extension's release notes.

## Contact

Issues, questions, or concerns: open an issue at <https://github.com/IsItGreg/basic-color-picker/issues>.

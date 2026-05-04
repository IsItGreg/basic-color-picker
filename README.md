# Basic Color Picker

Chrome extension (Manifest V3). Click the toolbar icon to enter pick mode, drop
multiple colored pins on the page in one session, and read every pick back as
HEX / RGB / HSL / Oklab / Oklch — plus a Tailwind class when the color matches
the default v3 palette or appears on the picked element.

## Building

```sh
npm install
npm run build
```

The unpacked extension is in `dist/`.

## Loading in Chrome

1. `chrome://extensions`
2. Enable **Developer mode** (top right).
3. **Load unpacked** → pick the `dist/` directory.
4. Pin the extension from the puzzle-piece menu.
5. Click the toolbar icon on any http(s) page — the picker injects on demand;
   no need to reload tabs after install.

## Using

| Key / action                              | Effect                                                          |
| ----------------------------------------- | --------------------------------------------------------------- |
| Click the toolbar icon                    | Toggle pick mode                                                |
| Click on the page                         | Drop a numbered pin and read the pixel                          |
| Hover                                     | Magnifier follows the cursor with HEX                           |
| Drag the toolbar grip (`⋮⋮` or help text) | Move the toolbar out of the way                                 |
| Drag the magnifier's bottom bar           | Pin the magnifier somewhere; cursor still updates its preview   |
| Click `FOLLOW` / `PINNED` on magnifier    | Toggle between cursor-follow and pinned-in-place                |
| `H`                                       | Toggle the History panel                                        |
| `C`                                       | Clear the current session's pins                                |
| `Esc` / Done button                       | Exit pick mode (history is preserved)                           |
| Click a swatch / pill row                 | Copy that format to the clipboard                               |
| Format dropdown                           | Change the primary format shown                                 |
| **Clear all** in history header           | Two-step: click once to arm, again within 3s to wipe history    |

History is kept in `chrome.storage.local` across sessions, capped at 500 entries.

## Layout

```
src/
├── background.ts           Service worker — action click + capture/save messaging
├── content/
│   ├── overlay.ts          Magnifier, markers, history panel
│   ├── overlay.css         Shadow-DOM-scoped styles
│   └── tailwind-map.ts     Default Tailwind v3 palette
└── lib/
    ├── color.ts            sRGB ↔ HEX/RGB/HSL/Oklab/Oklch
    ├── tailwind-match.ts   Nearest palette lookup (Oklab ΔE)
    ├── element-classes.ts  Tailwind utilities found on picked element
    └── storage.ts          chrome.storage.local wrappers
```

## Permissions

| Permission     | Why                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------- |
| `activeTab`    | Read pixels from the currently-focused tab when you click the toolbar icon.               |
| `scripting`    | Inject the picker overlay into the active tab on demand (no auto-injection).              |
| `storage`      | Persist the picked-color history in `chrome.storage.local` (never leaves your machine).   |
| `notifications`| Surface a one-line message when the picker can't run (e.g. on `chrome://` pages).         |

The extension does **not** request `<all_urls>` host access. It runs only on the active
tab when you click its icon, never in the background, and never sends data anywhere.

## Limitations

- Restricted pages (`chrome://`, web store, `file://`) are skipped with a
  notification — Chrome doesn't allow extensions to inject there.
- The picker scrolls are locked while open; scroll first, then activate the picker
  to pick from a different region.
- Cross-origin iframes capture pixels correctly but element-based Tailwind
  detection won't see inside them.
- Tailwind detection covers the default v3 palette; custom config support is
  not implemented (could be added by reading the resolved CSS variables in v2).

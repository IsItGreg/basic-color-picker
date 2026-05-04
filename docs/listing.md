# Chrome Web Store listing — copy reference

Paste these strings into the corresponding fields in the [Chrome Web Store dev console](https://chrome.google.com/webstore/devconsole). Lengths shown are as of 2026-05-04 against the public limits.

---

## Item name (max 75 chars)

```
Basic Color Picker
```

## Short description (max 132 chars)

```
Click the toolbar icon to drop multiple color pins on any page. Copy HEX, RGB, HSL, Oklab, Oklch, or a Tailwind class.
```

*(118 chars)*

## Detailed description (max 16,000 chars; markdown-flavored)

```
A no-frills color picker that does one thing well: drop pins on any web page and read back every color in every format you'll need.

WHAT MAKES IT DIFFERENT
• Multi-point picking — click as many spots as you want in one session and see numbered pins at every location simultaneously, without losing any picks.
• Magnifier you can pin — drag it out of the way when it's covering the area you're sampling.
• Modern color formats — copy as HEX, RGB, HSL, Oklab, or Oklch.
• Tailwind detection — exact-palette match across both Tailwind CSS v3 and v4 (including the new mauve / olive / mist / taupe families). Element-class detection surfaces things like bg-orange-500 directly when present on the picked element.
• Persistent history — every pick is saved with its source URL and time. Filter by current session or browse everything you've sampled.

HOW TO USE
1. Click the toolbar icon on any http(s) page.
2. Hover to preview the pixel under your cursor in the magnifier.
3. Click to drop a numbered pin and add the color to history.
4. Repeat as many times as you want — pins persist on screen.
5. Press H to open the history panel; click a swatch to copy.
6. Press Esc or click Done to exit.

KEYBOARD
• Esc — exit pick mode
• H — toggle the history panel
• C — clear the current session's pins

PRIVACY
The extension is fully offline. It never sends data anywhere, never tracks browsing, and stores history only on your device in chrome.storage.local. No analytics, no cookies, no telemetry. See the privacy policy for the full version.

PERMISSIONS
• activeTab — read pixels from the active tab when you click the toolbar icon.
• scripting — inject the picker on demand (no auto-injection on every page).
• storage — keep history locally.
• notifications — single notification when the picker can't run on a restricted page.

The extension does not request <all_urls> host access. It runs only when you click its icon, only on the active tab.

OPEN SOURCE
Source code: https://github.com/IsItGreg/basic-color-picker
```

## Category

```
Developer Tools
```

(Secondary candidate: Productivity)

## Language

```
English
```

---

## Single-purpose statement

```
Pick colors from rendered web pages and copy them in standard formats (HEX, RGB, HSL, Oklab, Oklch) or as a Tailwind CSS class name.
```

## Permission justifications

Paste each into its corresponding text field in the *Permissions justification* section.

### `activeTab`

```
Required to read the pixel color the user clicks on. The extension uses chrome.tabs.captureVisibleTab on the user's gesture (toolbar icon click) to sample the rendered pixel under the cursor. activeTab grants this access only after the explicit user action and only on the active tab.
```

### `scripting`

```
Required to inject the picker overlay UI into the active tab when the user clicks the toolbar icon. The script is delivered via chrome.scripting.executeScript so injection is on-demand and scoped to the active tab. The extension does not declare any content_scripts in the manifest.
```

### `storage`

```
Used to persist the user's pick history in chrome.storage.local so colors saved in one session are still visible later. Data is stored only on the user's device. There is no remote sync, no third-party storage, and no transmission of stored data.
```

### `notifications`

```
Used solely to surface a non-blocking notification when the picker cannot run on the current page (for example, chrome:// pages or the Web Store itself). One short notification, no recurring or marketing notifications.
```

### Host permissions

The extension does not declare host permissions or content_script matches. Activation happens only when the user clicks the toolbar action, which grants activeTab on the current tab.

---

## Data usage / privacy practices form

When prompted by the dashboard's *Data usage* checklist:

| Question | Answer |
| --- | --- |
| Does this extension collect or use user data? | **Yes — for the limited purpose described below** |
| What user data does this extension collect? | **Website content** (only the picked-pixel color and the page URL/title for the history record) |
| Is this data used for any purpose unrelated to the single purpose? | **No** |
| Is this data transferred to any third party? | **No** |
| Is this data sold to third parties? | **No** |
| Is this data used or transferred for credit-worthiness or lending? | **No** |
| Encrypted in transit? | N/A — not transmitted |
| Mechanism for users to request deletion? | **Yes — Clear all in the extension's history panel, or by uninstalling the extension** |

Privacy policy URL: `https://isitgreg.github.io/basic-color-picker/privacy.html`
*(Enable GitHub Pages on the repo with /docs as the source folder so this URL resolves.)*

---

## Visual assets checklist

| Asset | Size | Source |
| --- | --- | --- |
| Store icon | 128×128 PNG | [src/icons/icon-128.png](../src/icons/icon-128.png) |
| Small promo tile | 440×280 PNG | [docs/promo-440x280.png](promo-440x280.png) |
| Screenshot 1 | 1280×800 PNG | crop / resize [docs/screenshots/magnifier-on-google.png](screenshots/magnifier-on-google.png) |
| Screenshot 2 (recommended) | 1280×800 PNG | multi-pin shot |
| Screenshot 3 (recommended) | 1280×800 PNG | history panel |
| Screenshot 4 (recommended) | 1280×800 PNG | format dropdown |
| Marquee tile (optional, for featured placement) | 1400×560 PNG | not generated yet |

The store accepts 640×400 screenshots as a minimum, but 1280×800 looks much better in the listing.

---

## Submission

```sh
npm run package        # produces dist.zip at the repo root
```

Upload `dist.zip` in the Web Store dashboard, paste the strings above into the corresponding fields, attach the assets, and submit.

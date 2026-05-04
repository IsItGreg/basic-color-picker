// Builds src/content/overlay.ts as a single self-contained IIFE bundle at
// dist/overlay.js. The background service worker injects this file via
// chrome.scripting.executeScript on icon click, so the file must run as a
// classic script (no `import` statements at runtime — everything bundled).
//
// This runs as a second pass after the main vite build (see package.json
// "build" script). emptyOutDir is false so we don't wipe the manifest /
// background bundle / icons that the main pass produced.
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/content/overlay.ts"),
      formats: ["iife"],
      name: "__BasicColorPickerOverlay",
      fileName: () => "overlay.js",
    },
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        // Inline any CSS-as-string imports rather than emitting separate
        // .css files alongside the bundle.
        inlineDynamicImports: true,
      },
    },
  },
});

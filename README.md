# Image Comparison App

A local-first before/after image comparison tool for the browser. Drop in screenshots, design revisions, or photo edits; the app pairs `-before` / `-after` files automatically and gives you four ways to inspect the differences. Images never leave your machine.

**Live demo:** <https://fcyd5454.github.io/image-comparison-app/>

## Features

- Import individual images or a whole folder.
- Auto-pair `name-before.jpg` / `name-after.jpg` (also `_before` / `_after`); manually pair unmatched images and unpair when needed.
- Four comparison modes: **slider**, **opacity**, **side-by-side**, and **loupe**.
- Per-card controls, or apply the slider/opacity to all selected cards.
- Pixel difference count computed in a Web Worker (OffscreenCanvas), keeping the UI responsive.
- Per-card fullscreen and keyboard shortcuts.
- View state (mode, slider, opacity, selection) persisted locally in IndexedDB.
- Installable PWA with an offline app shell.
- Privacy by design: all processing happens locally; no uploads and no analytics.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `F` | Fullscreen the first selected card |
| `←` / `→` | Move the slider (slider mode) |
| `↑` / `↓` | Adjust opacity (opacity mode) |
| `G` | Toggle applying changes to selected cards |

## Tech stack

React 18, TypeScript, Vite 5, Web Workers with OffscreenCanvas, IndexedDB, and a Service Worker for PWA support. No runtime dependencies beyond React.

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

Production build:

```bash
npm run build
npm run preview
```

## Deployment

A GitHub Pages workflow is included and builds with `BASE_PATH=/image-comparison-app/`. For other hosts, set `BASE_PATH` to your subpath, or leave it unset to serve from the domain root.

## Notes and limitations

- Supported browsers: Chrome/Edge 90+, Firefox 88+, Safari 15+.
- Folder import uses the File System Access API (Chromium-based browsers only).
- Files must share a base name to pair automatically; unmatched images appear in the unpaired section, where two can be selected and paired manually.
- The app is entirely client-side; there is no server component.

## License

[MIT](LICENSE)

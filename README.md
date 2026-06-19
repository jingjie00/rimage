# Rimage

**Remake** your images — crop, compress, and download in the browser. The name is a play on *remake* + *image*.

All processing runs **locally in your browser** (Canvas API). Images never leave your device — no uploads, no server. Works fully offline once loaded.

## Live

- [rimage.jingjietan.com](https://rimage.jingjietan.com) — primary site
- [rimage-size.web.app](https://rimage-size.web.app) — Firebase Hosting

## Features

- **Upload, drop, or paste** images (⌘V / Ctrl+V)
- **Intuitive crop** with 8 resize handles, drag-to-move, rule-of-thirds grid, zoom (scroll wheel), and 1px keyboard nudging
- **Target file size** — set a KB/MB budget; Rimage maximizes visual quality within that limit
- **Smart compression** — binary-searches JPEG/WebP quality and scales dimensions only when needed
- **Live preview** updates as you crop or change settings

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Deploy

Static output goes to `dist/`. The live sites are hosted on Firebase (`rimage-size` project); `rimage.jingjietan.com` points to the same deployment.

```bash
npm run build
firebase deploy --only hosting
```

## Links

- [Source on GitHub](https://github.com/jingjietan/rimage)
- [jingjietan.com](https://jingjietan.com)

# proddata.github.io

Simple Vue (Vite) site using Ant Design Vue, deployed to GitHub Pages via GitHub Actions.

This repo is intended as a hub for small PoCs and demo pages; the home page links to each demo.

## Local dev

```bash
npm install
npm run dev
```

## Deploy

1. Push to `main`.
2. In GitHub: Settings → Pages → Build and deployment → select `GitHub Actions`.

The Vite `base` is auto-detected for `*.github.io` user/org sites vs project sites (`vite.config.js`).

Tip: commit a `package-lock.json` to make CI deterministic (the workflow will use `npm ci` when it exists).

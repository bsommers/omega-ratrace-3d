# Building the web game and site

Requirements: Node 22+. No bundler and no npm install: the game is plain ES modules with an importmap and vendored three.js.

| Command | Result |
|---|---|
| `node tools/build-web.mjs [--out dir]` | `dist/web/`: `index.html`, `style.css`, `src/`, `vendor/three/{build,examples/jsm}`, `assets/{models,textures,manifest.json}`. All paths are relative, so it runs under any sub-path. |
| `node tools/build-site.mjs [--out dir]` | `dist/site/`: landing page (`docs/site/`), `play/` (the web build), `stl/` (print models), `.nojekyll`. |
| `node tools/serve.mjs` | Dev server for the repo root. |
| `node tools/shot.mjs --url "/play/index.html?autostart=1" --out out/shots/x.png` | Headless screenshot (serves the repo root). |
| `npm test` | Full test suite (also run by CI before deploy). |

## Deploy

`.github/workflows/pages.yml` runs on push to `main`: `npm test`, `node tools/build-site.mjs`, then uploads `dist/site` to GitHub Pages. Enable it once under Settings > Pages > Source: GitHub Actions. The site lives at `/omega-ratrace-3d/`, the game at `/omega-ratrace-3d/play/`.

## Updating screenshots

The gallery images are `docs/site/img/shot-*.png` (menu, play at high/ultra/low). Regenerate with `tools/shot.mjs` against a served `dist/site` and copy into `docs/site/img/`. Missing gallery images are hidden by the page.

## Notes

- The STL files are about 62 MB; they are copied into the site but not into `play/`.
- `play/assets/manifest.json` feeds the asset table on the landing page.

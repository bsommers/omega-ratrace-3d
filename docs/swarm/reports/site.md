# site report (2026-11-20)
## What I built
tools/build-web.mjs (stages game into dist/web, no bundler, relative paths, inline empty favicon), tools/build-site.mjs (dist/site: landing + play/ + stl/ + .nojekyll), docs/site/{index.html,favicon.svg,img/}, .github/workflows/pages.yml (npm test, build-site, deploy on push to main), docs/BUILD.md, LICENSE (Apache-2.0), test/site.test.mjs.
Landing: hero, features, controls, quality tiers, asset pipeline (live table from manifest.json: tris/faces/shells/wall), previews, gallery, play links.
## Verification evidence
Served dist/site, shot play/ (menu, high, ultra, low, final): errors [], zero non-200 requests. Full `npm test`: 51/51 pass after integrate/models-v2 reports landed. Rebuilt site after.
## Deviations
No esbuild bundle (importmap + vendored three; unbundled copy). Site is ~95 MB (68 MB STL).
## Mistakes and fixes
Port 8765 was in use by a foreign process (left alone); used 18765. Initial /favicon.ico 404 fixed by injecting data: icon at build.
## Learnings
shot.mjs accepts http URLs, so a custom static server can verify 404s.
## Requests
index.html could add its own favicon link; Pages source must be set to GitHub Actions; add repo URL link to landing once known.

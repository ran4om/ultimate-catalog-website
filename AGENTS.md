# Ultimate Catalog of Web Game Ports

A genre-sorted catalog of browser game ports, merged from two awesome lists:
Carter54git's Ultimate Catalog and bitburner's Awesome Browser Game Ports.
Duplicates are merged into one entry with every known port listed.

## Layout

- `sources/` – copies of the two upstream READMEs, kept for provenance.
- `scripts/build.mjs` – parses both sources, classifies games into genres and
  writes `data/games.json`, `docs/data/games.json` and `README.md`. Has no
  dependencies; run with `node scripts/build.mjs`. Genre lists (`GENRES`,
  `ALIASES`, `SPECIAL`) live at the top of the file.
- `docs/` – static website, no build step. One screen: genre bank, game rack
  and a deck with a 3D cartridge. `app.js` holds state (kept in the hash, e.g.
  `#/?g=shooters&q=doom&play=1&id=doom`), rendering and keyboard shortcuts;
  `cart.js` is the Three.js cartridge and its label art (flat 2D fallback
  without WebGL); `styles.css` is the hardware look.
- `docs/vendor/three/` – vendored Three.js 0.186.1 (`three.module.js`,
  `three.core.js`, LICENSE). Don't edit.
- `data/games.json` – generated data, same content as `docs/data/games.json`.

## Running

- Rebuild the data: `node scripts/build.mjs`
- Serve the site: `python3 -m http.server -d docs 8000`, then open
  http://localhost:8000 (ES modules and `fetch` need HTTP, not `file://`).

## Conventions

- Generated files (`README.md`, `data/`, `docs/data/`) come from `build.mjs`.
  Change the generator, then rebuild; don't hand-edit them.
- Genre fixes go in the lists in `scripts/build.mjs`. Run the build afterwards
  and spot-check the affected titles.
- The site respects `prefers-reduced-motion`: the cartridge swaps instantly
  without sway and CSS transitions are cut. Keep new motion behind the same check.

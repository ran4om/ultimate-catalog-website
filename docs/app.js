// Router and pages. Everything is hash-routed, so the site works from any static host:
//   #/                       home: sector keypad, featured playable titles
//   #/catalog?cat&q&play     catalog with filters; the filters live in the URL
//   #/game/:id               one game and its ports
import { createScene } from "./scene.js";

const LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const $ = (sel) => document.querySelector(sel);
const app = $("#app");
const rail = $("#rail");
const search = $("#search");

let cats = [];
let catById = new Map();
let games = [];
let gameById = new Map();
let stats = { total: 0, playable: 0, withSource: 0 };
let scene;
let lastPath = null;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const safeUrl = (u) => (/^https?:\/\//.test(u || "") ? esc(u) : "#");
const letterKey = (l) => (l === "#" ? "hash" : l);
const pad = (n) => String(n).padStart(2, "0");

function tags(g) {
  return `<span class="tags">${g.playable ? `<span class="tag ok">Playable</span>` : `<span class="tag">Info only</span>`}${
    g.hasSource ? `<span class="tag src">Source</span>` : ""
  }</span>`;
}

function unitCard(g) {
  const c = catById.get(g.category);
  return `<a class="unit" href="#/game/${esc(g.id)}" style="--accent:${c.color}">
    <span class="unit-head">
      <span class="led" aria-hidden="true"></span>
      <span class="unit-cat">${esc(c.name)}</span>
      <span class="unit-no">${pad(g.no)}</span>
    </span>
    <span class="unit-title">${esc(g.title)}</span>
    ${tags(g)}
  </a>`;
}

function drawRail(activeCat) {
  rail.innerHTML = `
    <h2 class="rail-title">Sectors</h2>
    <ol class="sectors">
      <li><a class="sector ${activeCat ? "" : "on"}" href="#/catalog">
        <span class="led ${activeCat ? "off" : ""}" aria-hidden="true"></span>
        <span class="sector-no">00</span>
        <span class="sector-name">All games</span>
        <span class="sector-count">${games.length}</span>
      </a></li>
      ${cats
        .map(
          (c, i) => `<li><a class="sector ${activeCat === c.id ? "on" : ""}" href="#/catalog?cat=${esc(c.id)}" style="--accent:${c.color}">
            <span class="led ${activeCat === c.id ? "" : "off"}" aria-hidden="true"></span>
            <span class="sector-no">${pad(i + 1)}</span>
            <span class="sector-name">${esc(c.name)}</span>
            <span class="sector-count">${c.count}</span>
          </a></li>`,
        )
        .join("")}
    </ol>`;
}

function renderHome() {
  const picks = games.filter((g) => g.featured && g.playable).slice(0, 8);
  const featured = picks.length ? picks : games.filter((g) => g.playable).slice(0, 8);
  const random = games[Math.floor(Math.random() * games.length)];

  app.innerHTML = `
    <section class="panel">
      <div class="panel-head mono"><span class="hazard" aria-hidden="true"></span>Index online · ${stats.total} entries</div>
      <h1>Browser ports, sorted by genre.</h1>
      <p class="lede">Two awesome lists, merged and de-duplicated. Pick a sector to browse it, or search from the bar above. Titles marked <strong>Playable</strong> open in your browser.</p>
      <dl class="readouts">
        <div><dt>Entries</dt><dd>${stats.total}</dd></div>
        <div><dt>Playable</dt><dd>${stats.playable}</dd></div>
        <div><dt>With source</dt><dd>${stats.withSource}</dd></div>
        <div><dt>Sectors</dt><dd>${cats.length}</dd></div>
      </dl>
      <div class="cta">
        <a class="btn primary" href="#/catalog?play=1">Show playable only</a>
        <a class="btn" href="#/game/${esc(random.id)}">Random pick</a>
      </div>
    </section>

    <section class="block">
      <header class="block-head"><h2>Sectors</h2><span class="mono">Select to browse</span></header>
      <div class="keypad">
        ${cats
          .map(
            (c, i) => `<a class="key" href="#/catalog?cat=${esc(c.id)}" style="--accent:${c.color}">
              <span class="key-top"><span class="led" aria-hidden="true"></span><span class="mono">${pad(i + 1)}</span></span>
              <span class="key-name">${esc(c.name)}</span>
              <span class="key-count">${c.count}</span>
            </a>`,
          )
          .join("")}
      </div>
    </section>

    <section class="block">
      <header class="block-head"><h2>Featured, playable now</h2><a href="#/catalog?play=1">All playable →</a></header>
      <div class="grid">${featured.map(unitCard).join("")}</div>
    </section>`;
}

function renderCatalog(params) {
  const cat = catById.get(params.get("cat") || "") ?? null;
  const q = (params.get("q") || "").trim().toLowerCase();
  const playOnly = params.get("play") === "1";

  const list = games.filter(
    (g) => (!cat || g.category === cat.id) && (!playOnly || g.playable) && (!q || g.search.includes(q)),
  );
  const groups = new Map(LETTERS.map((l) => [l, []]));
  for (const g of list) groups.get(groups.has(g.letter) ? g.letter : "#").push(g);
  const filtered = Boolean(cat || q || playOnly);

  app.innerHTML = `
    <section class="panel">
      <div class="crumbs"><a href="#/catalog">All games</a>${cat ? ` / <span>${esc(cat.name)}</span>` : ""}</div>
      <div class="panel-head">
        <span class="led" style="--accent:${cat ? cat.color : "var(--amber)"}" aria-hidden="true"></span>
        <span class="mono">${cat ? `Sector ${pad(cats.indexOf(cat) + 1)}` : "Full index"}</span>
      </div>
      <h1>${esc(cat ? cat.name : "All games")}</h1>
      <p class="lede">${esc(cat ? cat.blurb : "Every merged entry. Filters are kept in the address bar, so links and Back both work.")}</p>
      <div class="filters">
        <label class="toggle">
          <input type="checkbox" id="play-toggle" ${playOnly ? "checked" : ""}>
          <span class="switch" aria-hidden="true"></span>
          <span>Playable only</span>
        </label>
        <span class="mono count">${list.length} of ${games.length} shown</span>
        ${filtered ? `<a class="clear" href="#/catalog">Clear filters</a>` : ""}
      </div>
      <nav class="letters" aria-label="Jump to letter">
        ${LETTERS.map((l) => {
          const n = groups.get(l).length;
          return `<button type="button" class="letter" data-jump="${letterKey(l)}" ${n ? "" : "disabled"} aria-label="Letter ${l}, ${n} games">${l}</button>`;
        }).join("")}
      </nav>
    </section>

    <div class="results">
      ${
        [...groups]
          .filter(([, items]) => items.length)
          .map(
            ([l, items]) => `<section class="letter-group" id="L${letterKey(l)}">
              <h2 class="letter-head">${l}<small>${items.length}</small></h2>
              <div class="grid">${items.map(unitCard).join("")}</div>
            </section>`,
          )
          .join("") || `<p class="empty">No titles match these filters. <a href="#/catalog">Clear filters</a>.</p>`
      }
    </div>`;

  $("#play-toggle").addEventListener("change", (e) => setParams({ play: e.target.checked ? "1" : null }));
}

function renderGame(id) {
  const g = gameById.get(id);
  if (!g) return renderNotFound();
  const c = catById.get(g.category);
  const related = games.filter((x) => x.category === c.id && x.id !== g.id).slice(0, 6);

  app.innerHTML = `
    <div class="crumbs"><a href="#/catalog">All games</a> / <a href="#/catalog?cat=${esc(c.id)}">${esc(c.name)}</a></div>
    <article class="panel spec" style="--accent:${c.color}">
      <div class="spec-head"><span class="led" aria-hidden="true"></span>${esc(c.name)} · No. ${pad(g.no)}</div>
      <h1>${esc(g.title)}</h1>
      ${tags(g)}
      <h2 class="ports-title">Ports (${g.ports.length})</h2>
      <ul class="ports">
        ${g.ports
          .map(
            (p) => `<li class="port">
              <span>
                <span class="port-label">${esc(p.label)}</span>
                <span class="port-origin">From ${p.origin === "ultimate" ? "Ultimate Catalog" : "Awesome Browser Game Ports"}</span>
              </span>
              <span class="port-actions">
                ${p.play ? `<a class="btn primary" href="${safeUrl(p.play)}" target="_blank" rel="noopener noreferrer">▶ Play in browser</a>` : ""}
                ${p.source ? `<a class="btn" href="${safeUrl(p.source)}" target="_blank" rel="noopener noreferrer">Source</a>` : ""}
                ${p.site ? `<a class="btn ghost" href="${safeUrl(p.site)}" target="_blank" rel="noopener noreferrer">Website</a>` : ""}
              </span>
            </li>`,
          )
          .join("")}
      </ul>
      <p class="note">Links open in a new tab on third-party sites. Ports that need game files will ask you for them.</p>
    </article>

    ${
      related.length
        ? `<section class="block">
            <header class="block-head"><h2>More in ${esc(c.name)}</h2><a href="#/catalog?cat=${esc(c.id)}">Whole sector →</a></header>
            <div class="grid">${related.map(unitCard).join("")}</div>
          </section>`
        : ""
    }`;
}

function renderNotFound() {
  app.innerHTML = `<p class="empty">That page doesn't exist. <a href="#/">Back to the index</a>.</p>`;
}

// Filters are stored in the hash. Typing replaces the entry so Back doesn't step through every keystroke.
function currentCatalogParams() {
  const [path, qs = ""] = location.hash.slice(1).split("?");
  return path.startsWith("/catalog") ? new URLSearchParams(qs) : new URLSearchParams();
}

function setParams(patch, { replace = false } = {}) {
  const next = currentCatalogParams();
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  const url = `#/catalog${qs ? `?${qs}` : ""}`;
  if (replace) {
    history.replaceState(null, "", url);
    route();
  } else {
    location.hash = url;
  }
}

function route() {
  const [pathPart, qs = ""] = location.hash.slice(1).split("?");
  const params = new URLSearchParams(qs);
  const [, page = "", arg = ""] = pathPart.split("/");
  const id = decodeURIComponent(arg);

  if (page === "category") {
    // Old genre links redirect to the catalog filter.
    location.replace(`#/catalog?cat=${encodeURIComponent(id)}`);
    return;
  }

  if (pathPart !== lastPath) {
    window.scrollTo(0, 0);
    lastPath = pathPart;
  }

  scene.show(page === "");

  if (page === "") {
    drawRail(null);
    renderHome();
    document.title = "Ultimate Catalog · Web Game Ports";
  } else if (page === "catalog") {
    const cat = catById.get(params.get("cat") || "");
    drawRail(cat?.id ?? null);
    renderCatalog(params);
    document.title = `${cat ? `${cat.name} · ` : ""}Catalog · Ultimate Catalog`;
  } else if (page === "game") {
    const g = gameById.get(id);
    drawRail(g?.category ?? null);
    renderGame(id);
    document.title = `${g ? g.title : "Not found"} · Ultimate Catalog`;
  } else {
    drawRail(null);
    renderNotFound();
    document.title = "Not found · Ultimate Catalog";
  }

  if (document.activeElement !== search) search.value = page === "catalog" ? params.get("q") || "" : "";
}

// Search on any page: typing jumps to the catalog with the query applied.
search.addEventListener("input", (e) => {
  const q = e.target.value.trim();
  const onCatalog = location.hash.startsWith("#/catalog");
  if (!onCatalog) {
    if (!q) return;
    history.replaceState(null, "", `#/catalog?q=${encodeURIComponent(q)}`);
    route();
  } else {
    setParams({ q: q || null }, { replace: true });
  }
});

// Letter jumps scroll within the page; the topbar offset comes from scroll-margin-top.
app.addEventListener("click", (e) => {
  const jump = e.target.closest("[data-jump]");
  if (!jump) return;
  document.getElementById(`L${jump.dataset.jump}`)?.scrollIntoView({ block: "start" });
});

async function boot() {
  const res = await fetch("data/games.json");
  if (!res.ok) throw new Error(`games.json: HTTP ${res.status}`);
  const data = await res.json();

  cats = data.categories;
  catById = new Map(cats.map((c) => [c.id, c]));
  games = data.games
    .map((g) => ({ ...g, search: [g.title, ...g.ports.map((p) => p.label)].join(" ").toLowerCase() }))
    .sort((a, b) => collator.compare(a.title, b.title))
    .map((g, i) => ({ ...g, no: i + 1 }));
  gameById = new Map(games.map((g) => [g.id, g]));
  stats = {
    total: data.total,
    playable: data.playable,
    withSource: games.filter((g) => g.hasSource).length,
  };

  scene = createScene(document.getElementById("scene"));
  window.addEventListener("hashchange", route);
  route();
}

boot().catch((err) => {
  console.error(err);
  app.innerHTML = `<p class="empty">Couldn't load the catalog data. Serve the <code>docs/</code> folder over HTTP (see README).</p>`;
});

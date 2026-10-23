// Single-screen catalog: genre bank on the left, the cartridge rack in the middle and
// the deck (3D cartridge plus port sheet) on the right. All state lives in the hash,
// e.g. #/?g=shooters&q=doom&play=1&id=doom, and is updated with replaceState so typing
// and browsing don't fill the history.
import { createCart } from "./cart.js";

// Tactical palette per genre; overrides the neon colors in the data file.
const PALETTE = {
  shooters: "#e5533d",
  action: "#f08a24",
  adventure: "#3d9a74",
  rpg: "#8e7ad6",
  strategy: "#4f8fd6",
  racing: "#e2c33b",
  arcade: "#3fc1c9",
  horror: "#b04a8a",
  sandbox: "#a9bd45",
  indie: "#d9a066",
  tools: "#9aa3ab",
  libraries: "#6f8193",
};
const ORIGIN = { ultimate: "Ultimate Catalog", awesome: "Awesome Ports" };

const $ = (sel) => document.querySelector(sel);
const els = {
  bank: $("#bank"),
  list: $("#list"),
  sheet: $("#sheet"),
  search: $("#search"),
  playOnly: $("#play-only"),
  random: $("#random"),
  readout: $("#readout"),
  readoutLabel: $("#readout-label"),
  rackTitle: $("#rack-title"),
  deck: $("#deck"),
  deckClose: $("#deck-close"),
  bayLed: $("#bay-led"),
};

const state = { g: "", q: "", play: false, id: "" };
let cats = [];
let catById = new Map();
let games = [];
let gameById = new Map();
let visible = [];
let cart;

const narrow = matchMedia("(max-width: 900px)");

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fold = (s) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
const pad = (n, w = 3) => String(n).padStart(w, "0");
const host = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// ---------- state <-> hash ----------

function readHash() {
  const raw = location.hash.slice(1);
  const [path, query = ""] = raw.split("?");
  const p = new URLSearchParams(query);
  const [, page = "", arg = ""] = path.split("/");
  state.g = catById.has(p.get("g") || p.get("cat")) ? p.get("g") || p.get("cat") : "";
  state.q = p.get("q") || "";
  state.play = p.get("play") === "1";
  state.id = p.get("id") || "";
  // links from the previous version of the site
  if (page === "game" && gameById.has(decodeURIComponent(arg))) state.id = decodeURIComponent(arg);
  if (page === "category" && catById.has(arg)) state.g = arg;
}

function writeHash() {
  const p = new URLSearchParams();
  if (state.g) p.set("g", state.g);
  if (state.q) p.set("q", state.q);
  if (state.play) p.set("play", "1");
  if (state.id) p.set("id", state.id);
  const qs = p.toString();
  history.replaceState(null, "", `#/${qs ? `?${qs}` : ""}`);
}

// ---------- filtering ----------

function matches(g, { ignoreGenre = false } = {}) {
  if (!ignoreGenre && state.g && g.category !== state.g) return false;
  if (state.play && !g.playable) return false;
  if (state.q) {
    const q = fold(state.q.trim());
    if (q && !g.search.includes(q)) return false;
  }
  return true;
}

function highlight(title) {
  const q = fold(state.q.trim());
  if (!q) return esc(title);
  const i = fold(title).indexOf(q);
  if (i < 0) return esc(title);
  return `${esc(title.slice(0, i))}<mark>${esc(title.slice(i, i + q.length))}</mark>${esc(title.slice(i + q.length))}`;
}

// ---------- render ----------

function drawBank() {
  const counts = new Map(cats.map((c) => [c.id, 0]));
  let all = 0;
  for (const g of games) {
    if (!matches(g, { ignoreGenre: true })) continue;
    counts.set(g.category, counts.get(g.category) + 1);
    all++;
  }
  const keyFor = (id, name, color, n) => `
    <button class="gkey${state.g === id ? " on" : ""}${n ? "" : " empty"}" type="button" data-g="${id}" style="--c:${color}" aria-pressed="${state.g === id}">
      <span class="gkey-led" aria-hidden="true"></span>
      <span class="gkey-name">${esc(name)}</span>
      <span class="gkey-count">${pad(n)}</span>
    </button>`;
  els.bank.innerHTML =
    `<span class="stencil bank-title">Genre bank</span>` +
    keyFor("", "All genres", "#ff6b1a", all) +
    cats.map((c) => keyFor(c.id, c.name, c.color, counts.get(c.id))).join("");
}

function spine(g) {
  const c = catById.get(g.category);
  return `<li><button class="spine${g.id === state.id ? " on" : ""}" type="button" data-id="${esc(g.id)}" style="--c:${c.color}" aria-current="${g.id === state.id}">
    <span class="spine-band" aria-hidden="true"></span>
    <span class="spine-no">${pad(g.no)}</span>
    <span class="spine-title">${highlight(g.title)}${g.featured ? `<span class="star" title="Highlighted in the source list">★</span>` : ""}</span>
    <span class="spine-genre">${esc(c.short)}</span>
    <span class="spine-flags" aria-label="${g.playable ? "Playable" : "No browser build"}${g.hasSource ? ", source available" : ""}">
      <i class="flag play${g.playable ? " lit" : ""}" title="Playable in browser">▶</i><i class="flag src${g.hasSource ? " lit" : ""}" title="Source code">{}</i>
    </span>
  </button></li>`;
}

function drawList() {
  visible = games.filter((g) => matches(g));
  const parts = [];
  let letter = null;
  for (const g of visible) {
    if (g.letterKey !== letter) {
      letter = g.letterKey;
      const n = visible.filter((x) => x.letterKey === letter).length;
      parts.push(`<li class="divider" aria-hidden="true"><span>${letter}</span><i></i><em>${pad(n, 2)}</em></li>`);
    }
    parts.push(spine(g));
  }
  if (!visible.length) {
    parts.push(`<li class="nothing">
      <p class="stencil">No cartridges match</p>
      <p>Nothing in ${state.g ? esc(catById.get(state.g).name) : "the rack"}${state.q ? ` for “${esc(state.q)}”` : ""}${state.play ? " with a browser build" : ""}.</p>
      <button class="key" type="button" data-clear>Clear filters</button>
    </li>`);
  }
  els.list.innerHTML = parts.join("");
  els.list.classList.toggle("one-genre", Boolean(state.g));

  els.readout.textContent = pad(visible.length);
  els.readoutLabel.textContent = `of ${games.length} shown`;
  els.rackTitle.textContent = state.g ? catById.get(state.g).name : "All genres";
  els.playOnly.setAttribute("aria-checked", String(state.play));
  if (document.activeElement !== els.search) els.search.value = state.q;
}

function portRow(p, i) {
  const link = (kind, url, text) =>
    url
      ? `<a class="pkey ${kind}" href="${esc(url)}" target="_blank" rel="noopener noreferrer"${kind === "play" ? " data-play" : ""}>
          <b>${text}</b><small>${esc(host(url))}</small></a>`
      : "";
  return `<li class="port">
    <div class="port-head"><span class="port-no">P${pad(i + 1, 2)}</span><span class="port-name">${esc(p.label)}</span><span class="port-origin">${esc(ORIGIN[p.origin] || p.origin)}</span></div>
    <div class="port-links">${link("play", p.play, "▶ Play")}${link("src", p.source, "{ } Source")}${link("site", p.site, "↗ Site")}</div>
  </li>`;
}

function drawDeck() {
  const g = gameById.get(state.id);
  if (!g) {
    els.sheet.innerHTML = `<p class="stencil dim sheet-empty">Bay empty. Pick a cartridge from the rack.</p>`;
    return;
  }
  const c = catById.get(g.category);
  const firstPlay = g.ports.find((p) => p.play);
  const firstSrc = g.ports.find((p) => p.source || p.site);
  const primary = firstPlay
    ? `<a class="big-btn" href="${esc(firstPlay.play)}" target="_blank" rel="noopener noreferrer" data-play>
        <span class="big-btn-cap">▶ Insert &amp; play</span><small>${esc(host(firstPlay.play))}</small></a>`
    : firstSrc
      ? `<a class="big-btn alt" href="${esc(firstSrc.source || firstSrc.site)}" target="_blank" rel="noopener noreferrer">
          <span class="big-btn-cap">{ } Open source</span><small>No browser build listed</small></a>`
      : "";

  els.sheet.innerHTML = `
    <div class="sheet-head" style="--c:${c.color}">
      <button class="tag" type="button" data-g="${c.id}" title="Show all ${esc(c.name)}">${esc(c.name)}</button>
      <span class="sheet-no">UC·${pad(g.no)}</span>
    </div>
    <h2 class="sheet-title">${esc(g.title)}</h2>
    <dl class="specs">
      <div><dt>Ports</dt><dd>${pad(g.ports.length, 2)}</dd></div>
      <div><dt>Browser</dt><dd class="${g.playable ? "ok" : "no"}">${g.playable ? "Yes" : "No"}</dd></div>
      <div><dt>Source</dt><dd class="${g.hasSource ? "ok" : "no"}">${g.hasSource ? "Yes" : "No"}</dd></div>
      <div><dt>Listed in</dt><dd>${g.sources.map((s) => (s === "ultimate" ? "ULT" : "AWE")).join(" + ")}</dd></div>
    </dl>
    <div class="actions">
      ${primary}
      <button class="key" type="button" data-copy>Copy link</button>
    </div>
    <h3 class="stencil sheet-sub">Ports</h3>
    <ol class="ports">${g.ports.map(portRow).join("")}</ol>
    <p class="note">These are third-party sites. Some ports need your own copy of the game files.</p>`;
  els.bayLed.classList.toggle("lit", g.playable);
  cart.show(g, c);
}

// ---------- actions ----------

function render() {
  drawBank();
  drawList();
  drawDeck();
  writeHash();
}

function select(id, { scroll = true, open = false } = {}) {
  if (!gameById.has(id)) return;
  state.id = id;
  for (const b of els.list.querySelectorAll(".spine.on")) {
    b.classList.remove("on");
    b.setAttribute("aria-current", "false");
  }
  const btn = els.list.querySelector(`.spine[data-id="${CSS.escape(id)}"]`);
  if (btn) {
    btn.classList.add("on");
    btn.setAttribute("aria-current", "true");
    if (scroll) btn.scrollIntoView({ block: "nearest" });
  }
  drawDeck();
  writeHash();
  if (open && narrow.matches) openDeck();
}

function move(delta) {
  if (!visible.length) return;
  const i = visible.findIndex((g) => g.id === state.id);
  const next = i < 0 ? (delta > 0 ? 0 : visible.length - 1) : Math.max(0, Math.min(visible.length - 1, i + delta));
  select(visible[next].id);
}

function setGenre(id) {
  state.g = id;
  render();
  els.list.scrollTop = 0;
}

function cycleGenre(delta) {
  const ids = ["", ...cats.map((c) => c.id)];
  const i = ids.indexOf(state.g);
  setGenre(ids[(i + delta + ids.length) % ids.length]);
}

function togglePlay() {
  state.play = !state.play;
  render();
}

function random() {
  const pool = visible.length ? visible : games;
  let pick = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1) while (pick.id === state.id) pick = pool[Math.floor(Math.random() * pool.length)];
  select(pick.id, { open: true });
  els.random.classList.add("spin");
  setTimeout(() => els.random.classList.remove("spin"), 500);
}

function play() {
  const g = gameById.get(state.id);
  if (!g) return;
  const p = g.ports.find((x) => x.play) || g.ports.find((x) => x.source || x.site);
  const url = p && (p.play || p.source || p.site);
  if (!url) return;
  if (p.play) cart.insert();
  window.open(url, "_blank", "noopener,noreferrer");
}

function openDeck() {
  els.deck.classList.add("open");
  document.body.classList.add("deck-open");
}
function closeDeck() {
  els.deck.classList.remove("open");
  document.body.classList.remove("deck-open");
  els.list.querySelector(".spine.on")?.focus({ preventScroll: true });
}

// ---------- events ----------

function bind() {
  els.bank.addEventListener("click", (e) => {
    const k = e.target.closest("[data-g]");
    if (k) setGenre(k.dataset.g);
  });

  els.list.addEventListener("click", (e) => {
    const s = e.target.closest(".spine");
    if (s) return select(s.dataset.id, { scroll: false, open: true });
    if (e.target.closest("[data-clear]")) {
      Object.assign(state, { g: "", q: "", play: false });
      els.search.value = "";
      render();
    }
  });

  els.sheet.addEventListener("click", (e) => {
    const tag = e.target.closest("[data-g]");
    if (tag) {
      setGenre(tag.dataset.g);
      if (narrow.matches) closeDeck();
      return;
    }
    if (e.target.closest("[data-play]")) cart.insert();
    const copy = e.target.closest("[data-copy]");
    if (copy) {
      navigator.clipboard?.writeText(location.href).then(
        () => {
          copy.textContent = "Copied";
          setTimeout(() => (copy.textContent = "Copy link"), 1400);
        },
        () => {},
      );
    }
  });

  els.search.addEventListener("input", () => {
    state.q = els.search.value;
    drawBank();
    drawList();
    writeHash();
    els.list.scrollTop = 0;
  });

  els.playOnly.addEventListener("click", togglePlay);
  els.random.addEventListener("click", random);
  els.deckClose.addEventListener("click", closeDeck);
  $("[data-reset]").addEventListener("click", (e) => {
    e.preventDefault();
    Object.assign(state, { g: "", q: "", play: false });
    els.search.value = "";
    render();
    els.list.scrollTop = 0;
  });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const inSearch = e.target === els.search;
    const typing = inSearch || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

    if (e.key === "Escape") {
      if (document.body.classList.contains("deck-open")) return closeDeck();
      if (inSearch) {
        if (els.search.value) {
          els.search.value = "";
          els.search.dispatchEvent(new Event("input"));
        } else els.search.blur();
      }
      return;
    }
    if (e.key === "ArrowDown" || (!typing && e.key === "j")) {
      e.preventDefault();
      return move(1);
    }
    if (e.key === "ArrowUp" || (!typing && e.key === "k")) {
      e.preventDefault();
      return move(-1);
    }
    if (e.key === "PageDown" && !typing) {
      e.preventDefault();
      return move(12);
    }
    if (e.key === "PageUp" && !typing) {
      e.preventDefault();
      return move(-12);
    }
    if (e.key === "Enter" && (inSearch || e.target.classList?.contains("spine"))) {
      e.preventDefault();
      if (narrow.matches && !els.deck.classList.contains("open")) return openDeck();
      return play();
    }
    if (typing) return;
    if (e.key === "/") {
      e.preventDefault();
      els.search.focus();
      els.search.select();
    } else if (e.key === "r" || e.key === "R") random();
    else if (e.key === "p" || e.key === "P") togglePlay();
    else if (e.key === "[") cycleGenre(-1);
    else if (e.key === "]") cycleGenre(1);
  });

  window.addEventListener("hashchange", () => {
    readHash();
    render();
  });
  narrow.addEventListener("change", () => {
    if (!narrow.matches) closeDeck();
  });
}

// ---------- boot ----------

async function boot() {
  let data;
  try {
    const res = await fetch("data/games.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    els.list.innerHTML = `<li class="nothing"><p class="stencil">Rack offline</p><p>Couldn't load the catalog (${esc(err.message)}). Serve the site over HTTP and reload.</p></li>`;
    return;
  }

  cats = data.categories.map((c) => ({
    ...c,
    color: PALETTE[c.id] || c.color,
    short: c.name.split(/\s*[&,]\s*/)[0],
  }));
  catById = new Map(cats.map((c) => [c.id, c]));
  const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
  games = data.games
    .slice()
    .sort((a, b) => collator.compare(a.title, b.title))
    .map((g, i) => ({
      ...g,
      no: i + 1,
      letterKey: /^[a-z]/i.test(g.title) ? g.title[0].toUpperCase() : "#",
      search: fold([g.title, ...g.ports.map((p) => p.label)].join(" ")),
    }));
  gameById = new Map(games.map((g) => [g.id, g]));

  cart = createCart($("#cart"));
  readHash();
  if (!gameById.has(state.id)) {
    // Start on a random highlighted game that runs in the browser.
    const pool = games.filter((g) => matches(g) && g.playable && g.featured);
    state.id = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : games[0].id;
  }
  bind();
  render();
  els.list.querySelector(".spine.on")?.scrollIntoView({ block: "center" });

  // Canvas text needs the web fonts; canvas use doesn't trigger loading, so ask for them.
  Promise.all(
    ['700 66px "Barlow Condensed"', '600 30px "JetBrains Mono"', '400 22px "JetBrains Mono"'].map((f) =>
      document.fonts.load(f),
    ),
  ).then(
    () => cart.refresh(),
    () => {},
  );
}

boot();

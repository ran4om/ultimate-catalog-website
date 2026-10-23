// The 3D cartridge in the deck. Selecting a game ejects the current cartridge, prints
// a new label and drops it back into the dock. Drag rotates it. Without WebGL the
// label is drawn flat on the same canvas. Under prefers-reduced-motion the swap is
// instant and the idle sway is off.
import * as THREE from "./vendor/three/three.module.js";

const W = 2.4;
const H = 2.9;
const D = 0.42;
const BEVEL = 0.035;
const FRONT = D / 2 + BEVEL;
const LABEL_W = 2.08;
const LABEL_H = 1.96;
const SEAT_Y = 0.25;

// ---------- label art (shared by the 3D and flat paths) ----------

function hashCode(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawLabel(ctx, game, cat, w, h) {
  const s = w / 1024;
  ctx.save();
  ctx.scale(s, s);
  const W2 = 1024;
  const H2 = h / s;

  ctx.fillStyle = "#ece7da";
  ctx.fillRect(0, 0, W2, H2);

  // paper grain
  const rnd = mulberry(hashCode(game.id));
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(60,50,30,${rnd() * 0.06})`;
    ctx.fillRect(rnd() * W2, rnd() * H2, 2, 2);
  }

  // genre band
  ctx.fillStyle = cat.color;
  ctx.fillRect(0, 0, W2, 150);
  ctx.fillStyle = "#111";
  ctx.font = `700 66px "Barlow Condensed", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(cat.name.toUpperCase(), 44, 80);
  ctx.font = `600 34px "JetBrains Mono", monospace`;
  ctx.textAlign = "right";
  ctx.fillText(`UC·${String(game.no).padStart(3, "0")}`, W2 - 44, 80);
  ctx.textAlign = "left";

  // hazard strip
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 150, W2, 22);
  ctx.clip();
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 150, W2, 22);
  ctx.fillStyle = cat.color;
  for (let x = -40; x < W2 + 40; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 172);
    ctx.lineTo(x + 22, 150);
    ctx.lineTo(x + 40, 150);
    ctx.lineTo(x + 18, 172);
    ctx.fill();
  }
  ctx.restore();

  // title, shrunk until it fits in three lines
  ctx.fillStyle = "#121212";
  ctx.textBaseline = "alphabetic";
  const title = game.title.toUpperCase();
  const room = H2 - 230 - 230;
  let size = 230;
  let lines;
  for (; size > 50; size -= 6) {
    ctx.font = `700 ${size}px "Barlow Condensed", sans-serif`;
    lines = wrap(ctx, title, W2 - 96);
    const fits = lines.length <= 3 && lines.every((l) => ctx.measureText(l).width <= W2 - 96);
    if (fits && lines.length * size * 0.92 <= room) break;
  }
  const lh = size * 0.92;
  const top = 200 + size * 0.85;
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, 48, top + i * lh));

  // footer: spec cells and barcode
  const fy = H2 - 230;
  ctx.fillStyle = "#121212";
  ctx.fillRect(48, fy, W2 - 96, 4);
  ctx.font = `600 38px "JetBrains Mono", monospace`;
  ctx.fillText(`PORTS ${String(game.ports.length).padStart(2, "0")}`, 48, fy + 56);
  ctx.fillText(`SRC ${game.sources.length === 2 ? "A+U" : game.sources[0] === "awesome" ? "AWE" : "ULT"}`, 48, fy + 108);

  const badge = (x, text, on) => {
    ctx.font = `700 34px "Barlow Condensed", sans-serif`;
    const tw = ctx.measureText(text).width + 30;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#121212";
    if (on) {
      ctx.fillStyle = "#121212";
      ctx.fillRect(x, fy + 132, tw, 56);
      ctx.fillStyle = "#ece7da";
    } else {
      ctx.strokeRect(x + 2, fy + 134, tw - 4, 52);
      ctx.fillStyle = "rgba(18,18,18,.45)";
    }
    ctx.fillText(text, x + 15, fy + 172);
    ctx.fillStyle = "#121212";
    return tw;
  };
  let bx = 48;
  bx += badge(bx, game.playable ? "▶ PLAYABLE" : "NO BUILD", game.playable) + 14;
  badge(bx, "SOURCE", game.hasSource);

  const r = mulberry(hashCode(game.id) ^ 0x9e3779b9);
  let x = W2 - 380;
  while (x < W2 - 52) {
    const bw = 3 + Math.floor(r() * 4) * 3;
    if (r() > 0.35) ctx.fillRect(x, fy + 30, bw, 120);
    x += bw + 3;
  }
  ctx.font = `400 22px "JetBrains Mono", monospace`;
  ctx.fillText(game.id.slice(0, 22).toUpperCase(), W2 - 380, fy + 182);

  ctx.strokeStyle = "rgba(18,18,18,.8)";
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, W2 - 28, H2 - 28);
  ctx.restore();
}

function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 3D ----------

function bodyShape() {
  const s = new THREE.Shape();
  const r = 0.12;
  const c = 0.34;
  const x0 = -W / 2;
  const x1 = W / 2;
  const y0 = -H / 2;
  const y1 = H / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - c);
  s.lineTo(x1 - c, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

// A cheap studio environment so the plastic and metal pick up soft reflections.
function studio(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(20, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0x15171a, side: THREE.BackSide }),
  );
  env.add(room);
  const panel = (color, w, h, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(0xffffff, 8, 3, [-6, 7, 5]);
  panel(0xcfd6dd, 4, 8, [8, 2, 2]);
  panel(0xff8a3a, 10, 1.5, [0, -3, -9]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  return tex;
}

function flat(canvas) {
  const ctx = canvas.getContext("2d");
  let last = null;
  return {
    show(game, cat) {
      last = [game, cat];
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const lw = Math.min(rect.width * 0.7, rect.height * 0.86 * (LABEL_W / LABEL_H)) * dpr;
      const lh = lw * (LABEL_H / LABEL_W);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate((canvas.width - lw) / 2, (canvas.height - lh) / 2);
      drawLabel(ctx, game, cat, lw, lh);
      ctx.restore();
    },
    insert() {},
    refresh() {
      if (last) this.show(...last);
    },
  };
}

export function createCart(canvas, { onSeat } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch (err) {
    console.warn("WebGL unavailable; showing a flat label.", err);
    return flat(canvas);
  }

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.environment = studio(renderer);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x101214, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff7a2a, 2.4);
  rim.position.set(4, 2, -5);
  scene.add(rim);

  // cartridge
  const cart = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.48, metalness: 0.05 });
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape(), {
    depth: D,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 3,
    curveSegments: 8,
  });
  bodyGeo.translate(0, 0, -D / 2);
  cart.add(new THREE.Mesh(bodyGeo, bodyMat));

  const recess = new THREE.Mesh(
    new THREE.PlaneGeometry(LABEL_W + 0.1, LABEL_H + 0.1),
    new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.9 }),
  );
  recess.position.set(-0.04, 0.4, FRONT + 0.001);
  cart.add(recess);

  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 1024;
  labelCanvas.height = Math.round(1024 * (LABEL_H / LABEL_W));
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  labelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(LABEL_W, LABEL_H),
    new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.82, metalness: 0 }),
  );
  label.position.set(-0.04, 0.4, FRONT + 0.003);
  cart.add(label);

  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x34383d, roughness: 0.4 });
  for (let i = 0; i < 5; i++) {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.045, 0.04), ridgeMat);
    ridge.position.set(0, -0.84 - i * 0.085, FRONT + 0.01);
    cart.add(ridge);
  }

  const arrow = new THREE.Shape();
  arrow.moveTo(-0.09, 0);
  arrow.lineTo(0.09, 0);
  arrow.lineTo(0, -0.11);
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xff6b1a, roughness: 0.5, emissive: 0x3a1500 });
  const arrowMesh = new THREE.Mesh(new THREE.ShapeGeometry(arrow), accentMat);
  arrowMesh.position.set(0.95, -0.8, FRONT + 0.002);
  cart.add(arrowMesh);

  const pcb = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.2, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x1f3a2a, roughness: 0.6 }),
  );
  pcb.position.set(0, -H / 2 - 0.06, 0);
  cart.add(pcb);
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a73a, metalness: 1, roughness: 0.3 });
  const pinGeo = new THREE.BoxGeometry(0.05, 0.15, 0.012);
  for (let i = 0; i < 22; i++) {
    const pin = new THREE.Mesh(pinGeo, goldMat);
    pin.position.set(-0.86 + i * 0.082, -H / 2 - 0.08, 0.052);
    cart.add(pin);
  }
  scene.add(cart);

  // dock
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x1b1e21, roughness: 0.35, metalness: 0.6 });
  const dockTop = -H / 2 + SEAT_Y - 0.3;
  const dock = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.55, 1.5), dockMat);
  dock.position.set(0, dockTop - 0.275, 0);
  scene.add(dock);
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(2.62, 0.02, D + 0.16),
    new THREE.MeshBasicMaterial({ color: 0x030303 }),
  );
  slot.position.set(0, dockTop + 0.005, 0);
  scene.add(slot);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.06, 0.06), accentMat);
  lip.position.set(0, dockTop - 0.08, 0.76);
  scene.add(lip);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xff6b1a });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.02), ledMat);
  led.position.set(1.45, dockTop - 0.28, 0.76);
  scene.add(led);

  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext("2d");
  const grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,.65)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 2.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = dockTop - 0.56;
  scene.add(floor);

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Back the camera off until both the cartridge and the dock fit.
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const needH = 4.9 / (2 * Math.tan(vfov / 2));
    const needW = 4.4 / (2 * Math.tan(vfov / 2) * camera.aspect);
    const dist = Math.max(needH, needW);
    camera.position.set(0, 1.1, dist);
    camera.lookAt(0, 0.05, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(() => {
    resize();
    renderer.render(scene, camera);
  }).observe(canvas);

  // motion state
  const anim = {
    y: SEAT_Y + 5,
    vy: 0,
    target: SEAT_Y,
    rotY: -0.5,
    vRot: 0,
    rotX: 0,
    drag: null,
    lastDrag: -1e9,
    tiltX: 0,
    tiltY: 0,
    pending: null,
    phase: "drop",
    insertedUntil: 0,
  };
  let current = null;

  function paint(game, cat) {
    const ctx = labelCanvas.getContext("2d");
    drawLabel(ctx, game, cat, labelCanvas.width, labelCanvas.height);
    labelTex.needsUpdate = true;
    bodyMat.color.set(0x24272b).lerp(new THREE.Color(cat.color), 0.22);
    current = { game, cat };
  }

  canvas.addEventListener("pointerdown", (e) => {
    anim.drag = { x: e.clientX, rot: anim.rotY, last: e.clientX, t: performance.now() };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    anim.tiltX = ((e.clientY - r.top) / r.height - 0.5) * 0.25;
    anim.tiltY = ((e.clientX - r.left) / r.width - 0.5) * 0.35;
    if (!anim.drag) return;
    const now = performance.now();
    anim.vRot = ((e.clientX - anim.drag.last) / Math.max(now - anim.drag.t, 1)) * 0.012 * 16;
    anim.drag.last = e.clientX;
    anim.drag.t = now;
    anim.rotY = anim.drag.rot + (e.clientX - anim.drag.x) * 0.012;
  });
  const endDrag = () => {
    if (!anim.drag) return;
    anim.drag = null;
    anim.lastDrag = performance.now();
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => {
    anim.tiltX = anim.tiltY = 0;
  });

  let last = performance.now();
  function frame(now = performance.now()) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = now / 1000;

    // vertical spring: underdamped on the drop so the cartridge settles with a bump
    const k = anim.phase === "eject" ? 260 : 150;
    const c = anim.phase === "eject" ? 22 : 13;
    anim.vy += ((anim.target - anim.y) * k - anim.vy * c) * dt;
    anim.y += anim.vy * dt;

    if (anim.phase === "eject" && anim.y > SEAT_Y + 3.6) {
      paint(anim.pending.game, anim.pending.cat);
      anim.pending = null;
      anim.phase = "drop";
      anim.y = SEAT_Y + 4.6;
      anim.vy = -6;
      anim.target = SEAT_Y;
      anim.rotY = -0.7;
    }
    if (anim.phase === "drop" && Math.abs(anim.y - SEAT_Y) < 0.002 && Math.abs(anim.vy) < 0.02) {
      anim.phase = "seated";
      onSeat?.();
    }
    if (anim.phase === "insert" && now > anim.insertedUntil) {
      anim.phase = "drop";
      anim.target = SEAT_Y;
    }

    // rotation: free while dragging, then coasts and eases back to a gentle sway
    if (!anim.drag) {
      const idle = now - anim.lastDrag > 1600;
      const home = reduceMotion ? -0.35 : -0.35 + Math.sin(t * 0.6) * 0.18;
      if (idle) {
        anim.vRot *= 0.9;
        anim.rotY += (home - anim.rotY) * Math.min(dt * 2.2, 1);
      } else {
        anim.rotY += anim.vRot;
        anim.vRot *= 0.92;
      }
    }

    cart.position.y = anim.y + (reduceMotion || anim.phase !== "seated" ? 0 : Math.sin(t * 1.3) * 0.02);
    cart.rotation.y = anim.rotY + anim.tiltY;
    cart.rotation.x += (anim.tiltX - cart.rotation.x) * Math.min(dt * 6, 1);
    ledMat.color.set(anim.phase === "insert" ? 0x7bd88f : anim.phase === "seated" ? 0xff6b1a : 0x3a2414);

    renderer.render(scene, camera);
  }

  // Only animate while the canvas is on screen (the mobile deck is off-canvas when closed).
  let looping = false;
  function setLoop(on) {
    if (on === looping) return;
    looping = on;
    last = performance.now();
    renderer.setAnimationLoop(on ? frame : null);
  }
  new IntersectionObserver(([entry]) => setLoop(entry.isIntersecting)).observe(canvas);

  resize();

  return {
    show(game, cat) {
      if (current && current.game.id === game.id) return;
      if (reduceMotion || !current) {
        paint(game, cat);
        if (reduceMotion) {
          anim.y = SEAT_Y;
          anim.vy = 0;
          anim.phase = "seated";
        }
        frame();
        return;
      }
      anim.pending = { game, cat };
      if (anim.phase !== "eject") {
        anim.phase = "eject";
        anim.target = SEAT_Y + 6;
        anim.vy = Math.max(anim.vy, 4);
      }
    },
    // Pushes the cartridge into the dock and lights the LED green for a moment.
    insert() {
      if (anim.phase === "eject") return;
      anim.phase = "insert";
      anim.target = SEAT_Y - 0.62;
      anim.insertedUntil = performance.now() + 1400;
      if (reduceMotion) anim.y = anim.target;
      frame();
    },
    // Repaint the label after web fonts load.
    refresh() {
      if (current) paint(current.game, current.cat);
      frame();
    },
  };
}

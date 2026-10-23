// Backdrop for the home page: a slow olive-and-amber sky shader, a warp starfield and
// a wireframe core. It only runs while the home page is visible and freezes under
// prefers-reduced-motion, so the catalog pages stay light.
import * as THREE from "./vendor/three/three.module.js";

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float t = uTime * 0.02;
    float n = fbm(d * 2.2 + vec3(t, -t * 0.5, t * 0.3));
    vec3 base = vec3(0.02, 0.025, 0.02);
    vec3 olive = vec3(0.12, 0.17, 0.11);
    vec3 amber = vec3(0.85, 0.6, 0.22);
    vec3 col = mix(base, olive, smoothstep(0.3, 0.8, n));
    col += amber * smoothstep(0.72, 1.0, n) * 0.12;
    col *= 0.6 + 0.4 * smoothstep(-0.2, 0.9, d.y);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createScene(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
  } catch (err) {
    console.warn("WebGL unavailable; the page keeps its CSS background.", err);
    canvas.hidden = true;
    return { show() {} };
  }

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x050605, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
  camera.position.set(0, 0, 18);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(150, 32, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
    }),
  );
  scene.add(sky);

  const STARS = 1600;
  const starPos = new Float32Array(STARS * 3);
  const starSpeed = new Float32Array(STARS);
  for (let i = 0; i < STARS; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 120;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 80;
    starPos[i * 3 + 2] = -200 + Math.random() * 220;
    starSpeed[i] = 0.4 + Math.random() * 1.2;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  scene.add(
    new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ size: 0.12, color: 0xf2ead2, transparent: true, opacity: 0.7, depthWrite: false }),
    ),
  );

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.2, 2),
    new THREE.MeshBasicMaterial({ color: 0xd9a441, wireframe: true, transparent: true, opacity: 0.18 }),
  );
  scene.add(core);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  const start = performance.now();
  let last = start;
  let looping = false;

  // With reduced motion, time stays frozen and the scene renders once instead of looping.
  function frame(now = performance.now()) {
    const dt = reduceMotion ? 0 : Math.min((now - last) / 1000, 0.05);
    const t = reduceMotion ? 0 : (now - start) / 1000;
    last = now;

    sky.material.uniforms.uTime.value = t;
    const pos = starGeo.attributes.position;
    for (let i = 0; i < STARS; i++) {
      let z = pos.getZ(i) + starSpeed[i] * dt * 10;
      if (z > 20) z = -200;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    core.rotation.y = t * 0.05;
    core.rotation.x = t * 0.03;

    renderer.render(scene, camera);
  }

  function setLoop(on) {
    if (on === looping) return;
    looping = on;
    if (on && !reduceMotion) {
      renderer.setAnimationLoop(frame);
    } else {
      renderer.setAnimationLoop(null);
      frame();
    }
  }

  window.addEventListener("resize", () => {
    resize();
    if (!looping) frame();
  });

  return {
    show(on) {
      canvas.hidden = !on;
      setLoop(on);
    },
  };
}

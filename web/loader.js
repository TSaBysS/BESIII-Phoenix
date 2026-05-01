/**
 * loader.js — Detector geometry configuration, Phoenix loading, and rendering helpers.
 *
 * Geometry config (formerly geometry-config.js):
 *   assembledComponents         — list of sub-detectors with opacity slider bindings
 *   getGeometryEntries()        — [{key, path}] from window.BES3_GEOMETRIES
 *   getGeometryList()           — [path, ...] shorthand
 *
 * Phoenix loading:
 *   ensurePhoenixLoaded()       — lazy-load Phoenix; populates phoenixCtor / phoenixApi
 *   loadPhoenix(viewerEl)       — load geometry into an EventDisplay instance
 *   adjustPhoenixCamera()       — position camera to frame the whole detector
 *   applyOpacityToNamedGeometry()
 *   applyDetectorOpacityFromUi()
 *
 * Fallback renderers:
 *   loadJsrootGeometry()        — JSROOT-based fallback
 *   loadThreeFallback()         — last-resort Three.js wireframe preview
 */

// ── Geometry configuration ────────────────────────────────────────────────────
// Sub-detector opacity defaults and UI slider bindings.
// window.BES3_GEOMETRIES is written by index.html inline script.

const DETECTOR_OPACITY_DEFAULTS = { mdc: 1.0, tof: 1.0, muc: 1.0, emc: 0.3 };

export const assembledComponents = [
  { key: "mdc", label: "MDC", get alphaEl() { return document.getElementById("alphaMdc"); }, defaultAlpha: DETECTOR_OPACITY_DEFAULTS.mdc },
  { key: "tof", label: "TOF", get alphaEl() { return document.getElementById("alphaTof"); }, defaultAlpha: DETECTOR_OPACITY_DEFAULTS.tof },
  { key: "muc", label: "MUC", get alphaEl() { return document.getElementById("alphaMuc"); }, defaultAlpha: DETECTOR_OPACITY_DEFAULTS.muc },
  { key: "emc", label: "EMC", get alphaEl() { return document.getElementById("alphaEmc"); }, defaultAlpha: DETECTOR_OPACITY_DEFAULTS.emc },
];

const geometryMap = () => window.BES3_GEOMETRIES || { full: "../data/bes3.root.json" };

function getSelectedView() {
  return window.BES3_SELECTED_VIEW || window.BES3_DEFAULT_VIEW || "assembled_besiii";
}

async function loadGeometryWithFallback(loader, entry) {
  try {
    await loader(entry.path, entry.key);
  } catch (err) {
    if (entry.key !== "emc") throw err;
    const fallback = "../data/views/emc_approx.root.json";
    console.warn(`EMC mesh cache load failed, fallback to ${fallback}:`, err);
    await loader(fallback, entry.key);
  }
}

export function getGeometryEntries(view = getSelectedView()) {
  const gm = geometryMap();

  // Assembled mode: load sub-detectors and overlay them together.
  // This is the intended BESIII assembled visualization mode.
  if (view === "assembled_besiii") {
    return assembledComponents
      .map((c) => ({ key: c.key, path: gm[c.key] }))
      .filter((e) => Boolean(e.path));
  }

  // Single-detector view.
  if (gm[view]) return [{ key: view, path: gm[view] }];
  return [];
}

export function getGeometryList(view = getSelectedView()) {
  return getGeometryEntries(view).map((e) => e.path);
}

export let phoenixCtor = null;
export let phoenixApi  = null;
export let phoenixLastError = "";
let lastEmcDebugInfo = null;

export function setPhoenixCtor(v) { phoenixCtor = v; }
export function setPhoenixApi(v)  { phoenixApi  = v; }
export function getLastEmcDebugInfo() { return lastEmcDebugInfo; }

// ── geometry opacity helpers ──────────────────────────────────────────────────

function findNamedGeometryRoots(geometries, objectName) {
  if (!geometries || !objectName) return [];
  const exact = geometries.getObjectByName?.(objectName);
  if (exact) return [exact];
  const roots = [];
  const key = String(objectName).toLowerCase();
  geometries.traverse?.((obj) => {
    const n = String(obj?.name || "").toLowerCase();
    if (!n) return;
    // Fallback for Phoenix builds that preserve original GDML volume names
    // (e.g. logicalEMC) instead of the loadRootJSONGeometry alias.
    if (n.includes(key)) roots.push(obj);
  });
  return roots;
}

export function applyOpacityToNamedGeometry(eventDisplay, objectName, alpha = 0.1) {
  try {
    const tm = eventDisplay?.getThreeManager?.();
    const sm = tm?.getSceneManager?.();
    const geometries = sm?.getGeometries?.() || sm?.getScene?.();
    if (!geometries) return;
    const roots = findNamedGeometryRoots(geometries, objectName);
    if (!roots.length) return;
    const a = Math.max(0, Math.min(1, Number(alpha)));
    roots.forEach((root) => {
      root.traverse((obj) => {
        const mats = Array.isArray(obj?.material) ? obj.material : [obj?.material];
        mats.forEach((mat) => {
          if (!mat) return;
          // Cache original material flags once so opacity 1.0 can fully restore state.
          if (!mat.userData.__bes3OpacityOriginal) {
            mat.userData.__bes3OpacityOriginal = {
              transparent: Boolean(mat.transparent),
              opacity: Number.isFinite(Number(mat.opacity)) ? Number(mat.opacity) : 1,
              depthWrite: Boolean(mat.depthWrite),
            };
          }
          const orig = mat.userData.__bes3OpacityOriginal;
          if (a >= 0.999) {
            // EMC may contain source materials with very low/default opacity in some
            // geometry exports; force fully opaque when user sets alpha to 1.
            if (objectName === "emc") {
              mat.transparent = false;
              mat.opacity = 1.0;
              mat.depthWrite = true;
            } else {
              mat.transparent = orig.transparent;
              mat.opacity = orig.opacity;
              mat.depthWrite = orig.depthWrite;
            }
          } else {
            mat.transparent = true;
            mat.opacity = a;
            mat.depthWrite = false;
          }
          mat.needsUpdate = true;
        });
      });
    });
  } catch (err) {
    console.warn("Opacity adjustment for named geometry skipped:", err);
  }
}

export function applyDetectorOpacityFromUi(eventDisplay) {
  assembledComponents.forEach((component) => {
    const alpha = Number(component.alphaEl?.value ?? component.defaultAlpha);
    // Only force opacity when explicitly non-default (e.g. EMC at 0.1).
    if (component.key !== "emc" && alpha >= 0.999) return;
    applyOpacityToNamedGeometry(eventDisplay, component.key, alpha);
  });
}

async function forceDoubleSidedForNamedGeometry(eventDisplay, objectName) {
  try {
    const THREE = await import("three");
    const tm = eventDisplay?.getThreeManager?.();
    const sm = tm?.getSceneManager?.();
    const geometries = sm?.getGeometries?.() || sm?.getScene?.();
    if (!geometries) return;
    const roots = findNamedGeometryRoots(geometries, objectName);
    if (!roots.length) return;
    roots.forEach((root) => {
      root.traverse((obj) => {
        const mats = Array.isArray(obj?.material) ? obj.material : [obj?.material];
        mats.forEach((mat) => {
          if (!mat) return;
          if (!mat.userData.__bes3SideOriginal) mat.userData.__bes3SideOriginal = mat.side;
          mat.side = THREE.DoubleSide;
          mat.needsUpdate = true;
        });
      });
    });
  } catch (err) {
    console.warn(`Force DoubleSide for ${objectName} skipped:`, err);
  }
}

function hideEmcContainerShells(eventDisplay) {
  try {
    const tm = eventDisplay?.getThreeManager?.();
    const sm = tm?.getSceneManager?.();
    const geometries = sm?.getGeometries?.() || sm?.getScene?.();
    if (!geometries) return;
    const hideHints = [
      "logicalendworld",
      "logicalbscworld",
      "solidendworld",
      "solidbscworld",
      "solidbscworld0",
    ];
    geometries.traverse?.((obj) => {
      const n = String(obj?.name || "").toLowerCase();
      if (!n) return;
      if (n === "emc" || n === "logicalemc" || n === "solidemc") return;
      if (!hideHints.some((k) => n.includes(k))) return;
      // Do not hide the full node; parent containers may own crystal children.
      // Only suppress the container shell material itself.
      const mats = Array.isArray(obj?.material) ? obj.material : [obj?.material];
      mats.forEach((mat) => {
        if (!mat) return;
        mat.transparent = true;
        mat.opacity = 0.0;
        mat.depthWrite = false;
        mat.needsUpdate = true;
      });
    });
  } catch (err) {
    console.warn("Hide EMC container shells skipped:", err);
  }
}

export function refreshEmcDebugInfo(eventDisplay) {
  try {
    const tm = eventDisplay?.getThreeManager?.();
    const sm = tm?.getSceneManager?.();
    const geometries = sm?.getGeometries?.() || sm?.getScene?.();
    if (!geometries) {
      lastEmcDebugInfo = { ready: false, reason: "no-geometries" };
      return lastEmcDebugInfo;
    }
    const info = {
      ready: true,
      timestamp: Date.now(),
      totalObjects: 0,
      visibleObjects: 0,
      emcRootHits: 0,
      logicalEndCrystal: 0,
      logicalEndCrystalVisible: 0,
      logicalEndCasing: 0,
      logicalEndCasingVisible: 0,
      logicalBscCasing: 0,
      logicalBscCasingVisible: 0,
      logicalEndWorld: 0,
      logicalEndWorldVisible: 0,
      logicalBscWorld: 0,
      logicalBscWorldVisible: 0,
      meshes: 0,
      visibleMeshes: 0,
    };
    geometries.traverse?.((obj) => {
      info.totalObjects += 1;
      if (obj?.visible !== false) info.visibleObjects += 1;
      if (obj?.isMesh) {
        info.meshes += 1;
        if (obj?.visible !== false) info.visibleMeshes += 1;
      }
      const n = String(obj?.name || "").toLowerCase();
      if (!n) return;
      if (n === "emc" || n.includes("logicalemc") || n.includes("solidemc")) info.emcRootHits += 1;
      if (n.includes("logicalendcrystal_")) {
        info.logicalEndCrystal += 1;
        if (obj?.visible !== false) info.logicalEndCrystalVisible += 1;
      }
      if (n.includes("logicalendcasing_")) {
        info.logicalEndCasing += 1;
        if (obj?.visible !== false) info.logicalEndCasingVisible += 1;
      }
      if (n.includes("logicalbsccasing")) {
        info.logicalBscCasing += 1;
        if (obj?.visible !== false) info.logicalBscCasingVisible += 1;
      }
      if (n.includes("logicalendworld") || n.includes("solidendworld")) {
        info.logicalEndWorld += 1;
        if (obj?.visible !== false) info.logicalEndWorldVisible += 1;
      }
      if (n.includes("logicalbscworld") || n.includes("solidbscworld")) {
        info.logicalBscWorld += 1;
        if (obj?.visible !== false) info.logicalBscWorldVisible += 1;
      }
    });
    lastEmcDebugInfo = info;
    return info;
  } catch (err) {
    lastEmcDebugInfo = { ready: false, reason: String(err?.message || err || "unknown") };
    return lastEmcDebugInfo;
  }
}

// ── camera ────────────────────────────────────────────────────────────────────

export async function adjustPhoenixCamera(eventDisplay) {
  try {
    const THREE = await import("three");
    const tm = eventDisplay?.getThreeManager?.();
    const sm = tm?.getSceneManager?.();
    const geometries = sm?.getGeometries?.();
    if (!geometries) return;

    const box = new THREE.Box3().setFromObject(geometries);
    if (!Number.isFinite(box.min.x) || box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.8 || 1000;

    const target = [center.x, center.y + size.y * 0.18, center.z];
    const pos    = [center.x + radius * 0.55, center.y + radius * 0.85, center.z + radius * 1.15];

    if (typeof tm?.animateCameraTransform === "function") {
      tm.animateCameraTransform(pos, target, 0);
    }

    const controls = tm?.controlsManager?.getMainControls?.();
    const camera   = tm?.controlsManager?.getMainCamera?.();
    if (controls?.target && camera?.position) {
      controls.target.set(target[0], target[1], target[2]);
      camera.position.set(pos[0], pos[1], pos[2]);
      controls.update?.();
    }
  } catch (err) {
    console.warn("Phoenix camera auto-adjust skipped:", err);
  }
}

// ── Phoenix loading ───────────────────────────────────────────────────────────

export async function ensurePhoenixLoaded() {
  if (phoenixCtor || phoenixApi) return;
  const errors = [];

  const esmCandidates = [
    "https://cdn.jsdelivr.net/npm/phoenix-event-display@3.0.5/+esm",
    "https://cdn.jsdelivr.net/npm/phoenix-event-display@latest/+esm",
    "https://esm.sh/phoenix-event-display@3.0.5",
  ];
  for (const src of esmCandidates) {
    try {
      const mod  = await import(src);
      const ctor = mod?.EventDisplay || mod?.default?.EventDisplay || mod?.default;
      if (typeof ctor === "function") { phoenixCtor = ctor; return; }
      errors.push(`esm loaded but no ctor: ${src}`);
    } catch (err) {
      errors.push(`esm fail: ${src} :: ${err.message || err}`);
    }
  }

  const browserModuleCandidates = [
    "./vendor/phoenix-dist/full/browser.js",
    "https://cdn.jsdelivr.net/npm/phoenix-event-display@latest/dist/browser.js",
    "https://unpkg.com/phoenix-event-display@latest/dist/browser.js",
  ];
  for (const src of browserModuleCandidates) {
    try {
      await import(src);
      if (typeof globalThis.EventDisplay === "function") { phoenixCtor = globalThis.EventDisplay; return; }
      if (globalThis.EventDisplay?.loadRootJSONGeometry) { phoenixApi = globalThis.EventDisplay; return; }
      errors.push(`browser module loaded but no API: ${src}`);
    } catch (err) {
      errors.push(`browser module fail: ${src} :: ${err.message || err}`);
    }
  }

  const phoenixBundleCandidates = [
    "./vendor/phoenix-dist/bundle/phoenix.min.js",
    "https://cdn.jsdelivr.net/npm/phoenix-event-display@latest/dist/bundle/phoenix.min.js",
    "https://unpkg.com/phoenix-event-display@latest/dist/bundle/phoenix.min.js",
  ];
  for (const src of phoenixBundleCandidates) {
    try {
      delete globalThis.EventDisplay;
      await loadClassicScript(src, "phoenix-loader", false);
      if (typeof window.EventDisplay === "function") { phoenixCtor = window.EventDisplay; return; }
      if (window.EventDisplay?.loadRootJSONGeometry) { phoenixApi = window.EventDisplay; return; }
      errors.push(`script loaded but no API: ${src}`);
    } catch (err) {
      errors.push(`script fail: ${src} :: ${err.message || err}`);
    }
  }

  phoenixLastError = errors.join(" | ");
  throw new Error(phoenixLastError || "Failed to load phoenix script");
}

function loadClassicScript(src, tagKey, reuse = true) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-${tagKey}="${src}"]`);
    if (existing && !reuse) {
      existing.remove();
    } else if (existing) {
      if (existing.dataset.loaded === "1") { resolve(); return; }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load: ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src   = src;
    script.async = true;
    script.setAttribute(`data-${tagKey}`, src);
    script.onload  = () => { script.dataset.loaded = "1"; resolve(); };
    script.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(script);
  });
}

// ── geometry loading ──────────────────────────────────────────────────────────

export async function loadPhoenix(viewerEl) {
  await ensurePhoenixLoaded();
  const EventDisplay = phoenixCtor;
  const apiObj       = phoenixApi || window.EventDisplay;
  const entries      = getGeometryEntries();

  if (typeof EventDisplay === "function") {
    const eventDisplay = new EventDisplay({ element: viewerEl, defaultConfig: { autoplay: false } });
    if (typeof eventDisplay.loadRootJSONGeometry !== "function") {
      throw new Error("loadRootJSONGeometry() is unavailable in this Phoenix build");
    }
    for (const entry of entries) {
      await loadGeometryWithFallback(
        (path, key) => eventDisplay.loadRootJSONGeometry(path, key),
        entry,
      );
    }
    // EMC endcaps can disappear when source normals are flipped; force double-sided.
    await forceDoubleSidedForNamedGeometry(eventDisplay, "emc");
    applyDetectorOpacityFromUi(eventDisplay);
    // TEMP: disable container suppression while debugging EMC visibility.
    // hideEmcContainerShells(eventDisplay);
    refreshEmcDebugInfo(eventDisplay);
    await adjustPhoenixCamera(eventDisplay);
    return eventDisplay;
  }

  if (apiObj?.loadRootJSONGeometry) {
    for (const entry of entries) {
      await loadGeometryWithFallback(
        (path, key) => apiObj.loadRootJSONGeometry(path, key),
        entry,
      );
    }
    await forceDoubleSidedForNamedGeometry(apiObj, "emc");
    applyDetectorOpacityFromUi(apiObj);
    // TEMP: disable container suppression while debugging EMC visibility.
    // hideEmcContainerShells(apiObj);
    refreshEmcDebugInfo(apiObj);
    return apiObj;
  }

  throw new Error(
    `Phoenix API not usable (ctor=${typeof EventDisplay}, objectLoader=${apiObj && typeof apiObj.loadRootJSONGeometry})`
  );
}

// ── fallback renderers ────────────────────────────────────────────────────────

export async function loadJsrootGeometry(viewerEl, paths) {
  const JSROOT = await import("https://root.cern/js/latest/modules/main.mjs");
  if (paths.length === 0) throw new Error("No geometry paths provided");
  viewerEl.innerHTML = "";
  let isFirst = true;
  for (const p of paths) {
    const resp = await fetch(p);
    if (!resp.ok) throw new Error(`Failed to fetch JSON: HTTP ${resp.status}`);
    const obj = JSROOT.parse(await resp.text());
    if (!obj) throw new Error("JSROOT failed to parse geometry JSON");
    await JSROOT.draw(viewerEl, obj, isFirst ? "" : "same");
    isFirst = false;
  }
}

export async function loadThreeFallback(viewerEl, paths) {
  const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js");
  const scene    = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);
  const camera   = new THREE.PerspectiveCamera(60, viewerEl.clientWidth / viewerEl.clientHeight, 0.1, 1e7);
  camera.position.set(2000, 1200, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(viewerEl.clientWidth, viewerEl.clientHeight);
  viewerEl.innerHTML = "";
  viewerEl.appendChild(renderer.domElement);
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const d = new THREE.DirectionalLight(0xffffff, 0.8);
  d.position.set(1, 2, 1);
  scene.add(d);
  scene.add(new THREE.AxesHelper(800));

  if (paths.length === 0) throw new Error("No geometry paths provided");
  let topName = "TopVolume";
  for (const p of paths) {
    const resp = await fetch(p);
    if (!resp.ok) throw new Error(`Failed to fetch JSON: HTTP ${resp.status}`);
    const data = await resp.json();
    topName = data?.fTopVolume?.fName || data?.fTopVolume?.name || topName;
  }
  const box  = new THREE.BoxGeometry(600, 600, 600);
  const mesh = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x2e7de9, wireframe: true }));
  scene.add(mesh);
  function animate() {
    requestAnimationFrame(animate);
    mesh.rotation.y += 0.003;
    camera.position.x = 2000 * Math.cos(mesh.rotation.y * 0.4);
    camera.position.z = 2000 * Math.sin(mesh.rotation.y * 0.4);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  animate();
  window.addEventListener("resize", () => {
    const w = viewerEl.clientWidth, h = viewerEl.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  return topName;
}

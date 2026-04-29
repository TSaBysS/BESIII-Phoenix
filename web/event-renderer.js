/**
 * event-renderer.js — Three.js overlay: tracks, hits, clusters.
 *
 * Builds a named THREE.Group ("BESIII_REC_EVENT_OVERLAY") with all
 * reconstructed and MC-truth objects for the selected event.
 *
 * Detector colour / style notes (restored from legacy version):
 *   REC track (stable) : red   0xff4d4d
 *   REC track (helix5) : blue  0x42a5f5
 *   MC truth track     : light-blue 0x90caf9
 *   MDC fired wire     : red   0xff4d4d (BesVis style)
 *   TOF barrel hit     : cyan  0x4dd0e1
 *   TOF endcap hit     : orange 0xffb74d
 *   MUC strip          : green  0x81c784
 *   EMC shower         : radial glow (energy-driven, yellow-orange-red)
 *   EMC crystal overlay: red   0xff2b2b
 */

import { C_MM_PER_NS, estimateEventTimeRange } from "./timeline.js";

export const EVENT_GLOBAL_R_SCALE = 0.1;

let cachedThreeModule = null;
async function getThree() {
  if (!cachedThreeModule) cachedThreeModule = await import("three");
  return cachedThreeModule;
}

// Track candidate cache for PID interaction (populated by buildCustomEventOverlay).
export let trackCandidateCache = [];
export function clearTrackCandidateCache() { trackCandidateCache = []; }

// ── helpers ───────────────────────────────────────────────────────────────────

export function scaleEventPoint(p) {
  if (!Array.isArray(p) || p.length < 3) return [0, 0, 0];
  const x = Number(p[0]), y = Number(p[1]), z = Number(p[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return [0, 0, 0];
  return [x * EVENT_GLOBAL_R_SCALE, y * EVENT_GLOBAL_R_SCALE, z * EVENT_GLOBAL_R_SCALE];
}

export function estimateEmcRadius(scene, THREE) {
  try {
    const emcObj = scene.getObjectByName?.("emc");
    if (emcObj) {
      const box = new THREE.Box3().setFromObject(emcObj);
      if (!box.isEmpty()) {
        const size = box.getSize(new THREE.Vector3());
        return Math.max(size.x, size.y) * 0.5;
      }
    }
  } catch (e) {
    console.warn("EMC radius estimate failed:", e);
  }
  return null;
}

// ── main overlay builder ──────────────────────────────────────────────────────

/**
 * Build or rebuild the event overlay group in the Three.js scene.
 * @returns {number} count of drawable objects added
 */
export async function buildCustomEventOverlay(
  eventDisplay,
  eventsData,
  selectedEventKey = "",
  showMcTruth = false,
  helixDebugEnabled = false,
  trackModeSelectEl = null,
) {
  const allKeys  = Object.keys(eventsData || {});
  const eventKey = allKeys.includes(selectedEventKey) ? selectedEventKey : allKeys[0];
  if (!eventKey) return 0;

  const ev        = eventsData[eventKey] || {};
  const trkMode   = helixDebugEnabled ? (trackModeSelectEl?.value || "stable") : "stable";

  const trackStable = Array.isArray(ev?.Tracks?.["REC MdcTrack (stable)"]) ? ev.Tracks["REC MdcTrack (stable)"] : [];
  const trackHelix5 = Array.isArray(ev?.Tracks?.["REC MdcTrack (helix5)"]) ? ev.Tracks["REC MdcTrack (helix5)"] : [];
  const trackMc     = Array.isArray(ev?.Tracks?.["MC Truth"]) ? ev.Tracks["MC Truth"] : [];
  const mdcHits     = Array.isArray(ev?.Hits?.["REC MdcHit"]) ? ev.Hits["REC MdcHit"] : [];
  const emcHits     = Array.isArray(ev?.Hits?.["REC EmcHit"]) ? ev.Hits["REC EmcHit"] : [];
  const tofHits     = Array.isArray(ev?.Hits?.["REC TofHit"]) ? ev.Hits["REC TofHit"] : [];
  const mucHits     = Array.isArray(ev?.Hits?.["REC MucHit"]) ? ev.Hits["REC MucHit"] : [];

  let tracks = [];
  if (trkMode === "stable")      tracks = [...trackStable];
  else if (trkMode === "helix5") tracks = [...trackHelix5];
  else                           tracks = [...trackStable, ...trackHelix5];
  if (showMcTruth) tracks.push(...trackMc);
  if (tracks.length === 0 && ev?.Tracks) tracks = Object.values(ev.Tracks).flat();

  const clusters   = ev?.CaloClusters ? Object.values(ev.CaloClusters).flat() : [];
  const eventTime  = estimateEventTimeRange(ev, tracks, mdcHits, emcHits, tofHits, mucHits);
  const emcTimeValues = emcHits.map((h) => Number(h?.time)).filter((v) => Number.isFinite(v) && v >= 0);
  const emcTimeMin = emcTimeValues.length ? Math.min(...emcTimeValues) : NaN;
  const emcTimeMax = emcTimeValues.length ? Math.max(...emcTimeValues) : NaN;

  const tm    = eventDisplay?.getThreeManager?.();
  const sm    = tm?.getSceneManager?.();
  const scene = sm?.getScene?.();
  if (!scene) return 0;

  const THREE = await getThree();

  const overlayName = "BESIII_REC_EVENT_OVERLAY";
  const old = scene.getObjectByName(overlayName);
  if (old) scene.remove(old);

  const group = new THREE.Group();
  group.name  = overlayName;
  trackCandidateCache = [];
  let count = 0;

  const emcRadiusHint = estimateEmcRadius(scene, THREE) ?? 95.0;

  // ── tracks ──────────────────────────────────────────────────────────────────
  for (const t of tracks) {
    const pos = t?.pos || [];
    if (!Array.isArray(pos) || pos.length < 2) continue;
    const points = pos
      .filter((p) => Array.isArray(p) && p.length >= 3)
      .map((p) => scaleEventPoint(p))
      .map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    if (points.length < 2) continue;

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    // Colour convention: red=stable, blue=helix5, light-blue=MC truth.
    const lineColor = t?.mode === "helix5" ? 0x42a5f5 : (t?.mode === "mc" ? 0x90caf9 : 0xff4d4d);
    const lineOpac  = t?.mode === "helix5" ? 0.80    : (t?.mode === "mc" ? 0.72     : 0.92);
    const mat = new THREE.LineBasicMaterial({
      color: lineColor, transparent: true, opacity: lineOpac, depthTest: false, depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 999;

    let lengthMm = 0;
    for (let i = 1; i < points.length; i += 1) lengthMm += points[i].distanceTo(points[i - 1]);
    const pGeV  = Number(t?.pt_debug?.p_est ?? 0.6);
    const beta  = pGeV > 0 ? pGeV / Math.sqrt(pGeV * pGeV + 0.13957 * 0.13957) : 0.9;
    const dtNs  = lengthMm / Math.max(1e-6, beta * C_MM_PER_NS);
    const normalizedTrackId = Number.isFinite(Number(t?.trackId)) ? Number(t.trackId)
      : (Number.isFinite(Number(t?.id)) ? Number(t.id) : (count + 1));

    line.userData = { kind: "track", ...t, trackId: normalizedTrackId, pointCount: points.length,
      timeStartNs: eventTime.minNs, timeEndNs: eventTime.minNs + dtNs };
    group.add(line);
    trackCandidateCache.push(line);

    // Dense luminous point cloud for visibility.
    const ptColor = t?.mode === "helix5" ? 0x6bb8ff : (t?.mode === "mc" ? 0x40c4ff : 0xff6161);
    const ptMat = new THREE.PointsMaterial({
      color: ptColor, size: t?.mode === "mc" ? 4.2 : 3.6, sizeAttenuation: true,
      transparent: true, opacity: t?.mode === "mc" ? 0.88 : 0.86, depthTest: false, depthWrite: false,
    });
    const ptObj = new THREE.Points(geo.clone(), ptMat);
    ptObj.renderOrder = 998;
    ptObj.userData = { ...line.userData, kind: "track_points" };
    group.add(ptObj);
    trackCandidateCache.push(ptObj);
    count += 1;
  }

  // ── EMC showers (radial glow, not a box) ────────────────────────────────────
  for (const c of clusters) {
    let x, y, z;
    if (Array.isArray(c?.pos) && c.pos.length >= 3) {
      [x, y, z] = c.pos;
    } else {
      const r  = Number(c?.radius ?? 0);
      const th = Number(c?.theta ?? 0);
      const ph = Number(c?.phi ?? 0);
      if (!Number.isFinite(r) || !Number.isFinite(th) || !Number.isFinite(ph)) continue;
      x = r * Math.sin(th) * Math.cos(ph);
      y = r * Math.sin(th) * Math.sin(ph);
      z = r * Math.cos(th);
    }
    const e  = Math.max(0, Number(c?.energy ?? 0));
    const rr = Math.sqrt(x * x + y * y + z * z);
    // Project onto EMC shell.
    if (Number.isFinite(emcRadiusHint) && emcRadiusHint > 1 && Number.isFinite(rr) && rr > 1) {
      const sc = emcRadiusHint / rr; x *= sc; y *= sc; z *= sc;
    }

    // Energy → colour and size: yellow (low) → orange → red (high).
    const tcol = Math.max(0, Math.min(1, e / 1000.0));
    let colorHex = 0xffee58;
    if (tcol > 0.35) colorHex = 0xffc107;
    if (tcol > 0.60) colorHex = 0xff7043;
    if (tcol > 0.85) colorHex = 0xff1744;

    // Layered radial glow: 3 concentric translucent spheres, innermost brightest.
    const baseR   = 3.5 + 22.0 * Math.pow(tcol, 0.6);
    const nLayers = 3;
    const clusterTimeRaw = Number(c?.time);
    const showerStartNs  = Number.isFinite(clusterTimeRaw) && clusterTimeRaw >= 0
      ? clusterTimeRaw
      : (Number.isFinite(emcTimeMin) && Number.isFinite(emcTimeMax)
        ? (emcTimeMin + 0.55 * (emcTimeMax - emcTimeMin))
        : (eventTime.minNs + 0.45 * (eventTime.maxNs - eventTime.minNs)));

    for (let li = 0; li < nLayers; li += 1) {
      const layerFrac = (li + 1) / nLayers;          // 1/3, 2/3, 1
      const r_i  = baseR * layerFrac;
      const opac = (0.82 - 0.24 * li) * (0.18 + 0.82 * tcol);  // inner brightest
      const geo  = new THREE.SphereGeometry(r_i, 12, 10);
      const mat  = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex), transparent: true, opacity: opac,
        depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const sphere = new THREE.Mesh(geo, mat);
      sphere.position.set(x, y, z);
      sphere.renderOrder = 1200 - li;
      sphere.userData = { kind: "emc_shower", timeStartNs: showerStartNs, ...c };
      group.add(sphere);
    }
    count += 1;
  }

  // ── EMC crystal hit overlay ─────────────────────────────────────────────────
  if (emcHits.length) {
    const emcObj = scene.getObjectByName?.("emc");
    let rBarrel = emcRadiusHint || 95, zHalf = 90;
    if (emcObj) {
      const box = new THREE.Box3().setFromObject(emcObj);
      if (!box.isEmpty()) {
        const size = box.getSize(new THREE.Vector3());
        rBarrel = Math.max(size.x, size.y) * 0.5;
        zHalf   = Math.max(200, size.z * 0.5);
      }
    }
    const cellMap = new Map();
    for (const h of emcHits) {
      const cellId = Number(h?.cellId ?? -1);
      if (cellId < 0) continue;
      const cur = cellMap.get(cellId);
      if (!cur) cellMap.set(cellId, { ...h, energy: Math.max(0, Number(h?.energy ?? 0)) });
      else cur.energy += Math.max(0, Number(h?.energy ?? 0));
    }
    const mergedHits = Array.from(cellMap.values());
    const emax = Math.max(...mergedHits.map((h) => Number(h.energy || 0)), 1e-6);

    for (const h of mergedHits) {
      const part     = Number(h.part ?? 1);
      const thetaIdx = Number(h.theta ?? 0);
      const phiIdx   = Number(h.phi ?? 0);
      const frac     = Math.max(0, Math.min(1, Number(h.energy ?? 0) / emax));

      let x = 0, y = 0, z = 0, sx = 14, sy = 14, sz = 40;
      if (part === 1) {
        // Barrel: 120 phi × 44 theta rings.
        const phi  = ((phiIdx + 0.5) / 120.0) * Math.PI * 2.0;
        const zNorm = (thetaIdx + 0.5) / 44.0;
        z  = (zNorm - 0.5) * (zHalf * 1.15);
        const rr = Math.max(50, rBarrel * 0.98);
        x = rr * Math.cos(phi); y = rr * Math.sin(phi);
        sx = 10; sy = 18; sz = 34;
      } else {
        // Endcap (part 0 = −z, part 2 = +z).
        const nPhi = thetaIdx < 2 ? 64.0 : thetaIdx < 4 ? 80.0 : 96.0;
        const phi  = ((phiIdx + 0.5) / nPhi) * Math.PI * 2.0;
        const ring = Math.max(0, Math.min(5, thetaIdx));
        const rMin = rBarrel * 0.22, rMax = rBarrel * 0.95;
        const rr   = rMin + ((ring + 0.5) / 6.0) * (rMax - rMin);
        x  = rr * Math.cos(phi); y = rr * Math.sin(phi);
        z  = (part === 0 ? -1 : 1) * (zHalf * 0.98);
        sx = 20; sy = 20; sz = 26;
      }

      const geo     = new THREE.BoxGeometry(sx, sy, sz);
      const mat     = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0xff2b2b), transparent: true,
        opacity: 0.12 + 0.83 * frac, depthTest: false, depthWrite: false, blending: THREE.NormalBlending,
      });
      const crystal = new THREE.Mesh(geo, mat);
      crystal.position.set(x, y, z);
      if (part === 1) crystal.lookAt(new THREE.Vector3(0, 0, z));
      crystal.renderOrder = 1000;
      const th = Number(h?.time);
      crystal.userData = { kind: "emc_hit_crystal_overlay", timeStartNs: Number.isFinite(th) ? th : eventTime.minNs, ...h };
      group.add(crystal);
      count += 1;
    }
  }

  // ── MDC wire-fire hits ──────────────────────────────────────────────────────
  for (const h of mdcHits) {
    if (!Array.isArray(h?.pos) || h.pos.length < 3) continue;
    const hp = scaleEventPoint(h.pos);
    const x = Number(hp[0]), y = Number(hp[1]), z = Number(hp[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;

    const adc     = Math.max(0, Number(h?.adc ?? 0));
    const t       = Math.max(0, Math.min(1, adc / 800.0));
    const isStereo = String(h?.wireType ?? "") === "stereo";
    const col      = new THREE.Color(0xff4d4d);  // BesVis fired-wire red

    let dir;
    if (Array.isArray(h?.wireDir) && h.wireDir.length >= 3) {
      dir = new THREE.Vector3(Number(h.wireDir[0]), Number(h.wireDir[1]), Number(h.wireDir[2]));
      if (!Number.isFinite(dir.x) || !Number.isFinite(dir.y) || !Number.isFinite(dir.z) || dir.lengthSq() < 1e-12)
        dir = new THREE.Vector3(0, 0, 1);
      else dir.normalize();
    } else {
      dir = new THREE.Vector3(0, 0, 1);
    }

    const fireLen = (isStereo ? (22 + 30 * t) : (10 + 16 * t)) * EVENT_GLOBAL_R_SCALE;
    const pHit   = new THREE.Vector3(x, y, z);
    const p0     = pHit.clone().addScaledVector(dir, -fireLen * 0.5);
    const p1     = pHit.clone().addScaledVector(dir,  fireLen * 0.5);
    const coreGeo = new THREE.BufferGeometry().setFromPoints([p0, p1]);
    const coreMat = new THREE.LineBasicMaterial({
      color: col, transparent: true,
      opacity: isStereo ? (0.62 + 0.16 * t) : (0.48 + 0.18 * t),
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Line(coreGeo, coreMat);
    core.renderOrder = 1000;
    const tdc = Number(h?.tdc);
    core.userData = { kind: "mdc_hit_fire", timeStartNs: Number.isFinite(tdc) ? tdc : eventTime.minNs, ...h };
    group.add(core);

    if (isStereo) {
      const coneLen = 5 + 5 * t, coneR = 0.7 + 0.45 * t;
      const coneGeo = new THREE.ConeGeometry(coneR, coneLen, 8, 1);
      const coneMat = new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: 0.48 + 0.16 * t,
        depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.copy(p1).addScaledVector(dir.clone().normalize(), -coneLen * 0.5);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      cone.renderOrder = 1001;
      cone.userData = { kind: "mdc_hit_cone", timeStartNs: Number.isFinite(tdc) ? tdc : eventTime.minNs, ...h };
      group.add(cone);
    }

    // Bright head bubble at wire end.
    const headR  = isStereo ? (2.0 + 2.0 * t) : (1.7 + 1.8 * t);
    const glowGeo = new THREE.SphereGeometry(headR, 10, 10);
    const glowMat = new THREE.MeshBasicMaterial({
      color: col, transparent: true,
      opacity: isStereo ? (0.26 + 0.18 * t) : (0.18 + 0.16 * t),
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(p1);
    glow.renderOrder = 999;
    glow.userData = { kind: "mdc_hit_bubble", timeStartNs: Number.isFinite(tdc) ? tdc : eventTime.minNs, ...h };
    group.add(glow);
    count += 1;
  }

  // ── TOF hits ────────────────────────────────────────────────────────────────
  for (const h of tofHits) {
    if (!Array.isArray(h?.pos) || h.pos.length < 3) continue;
    const p = scaleEventPoint(h.pos);
    const x = Number(p[0]), y = Number(p[1]), z = Number(p[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const sz  = Array.isArray(h?.size) && h.size.length >= 3 ? h.size : [28, 56, 80];
    const sx  = Math.max(6, Number(sz[0]) * EVENT_GLOBAL_R_SCALE);
    const sy  = Math.max(6, Number(sz[1]) * EVENT_GLOBAL_R_SCALE);
    const ss  = Math.max(6, Number(sz[2]) * EVENT_GLOBAL_R_SCALE);
    const col = Number(h?.part ?? 1) === 1 ? 0x4dd0e1 : 0xffb74d;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, ss),
      new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    box.position.set(x, y, z);
    box.lookAt(new THREE.Vector3(0, 0, z));
    box.renderOrder = 995;
    const tof = Number(h?.tof);
    box.userData = { kind: "tof_hit", timeStartNs: Number.isFinite(tof) ? tof : eventTime.minNs, ...h };
    group.add(box);
    count += 1;
  }

  // ── MUC strip hits ──────────────────────────────────────────────────────────
  const mucObj = scene.getObjectByName?.("muc");
  let mucRMax = 260, mucZHalf = 280;
  if (mucObj) {
    const mb = new THREE.Box3().setFromObject(mucObj);
    if (!mb.isEmpty()) {
      const ms = mb.getSize(new THREE.Vector3());
      mucRMax  = Math.max(120, Math.max(ms.x, ms.y) * 0.5);
      mucZHalf = Math.max(120, ms.z * 0.5);
    }
  }
  for (const h of mucHits) {
    if (!Array.isArray(h?.pos) || h.pos.length < 3) continue;
    const p = scaleEventPoint(h.pos);
    let x = Number(p[0]), y = Number(p[1]), z = Number(p[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const rr = Math.hypot(x, y);
    if (!mucObj && rr > 1e-6) {
      const rClamp = Math.max(120, Math.min(mucRMax, rr));
      x = x * (rClamp / rr); y = y * (rClamp / rr);
      z = Math.max(-mucZHalf, Math.min(mucZHalf, z));
    }
    const sz  = Array.isArray(h?.size) && h.size.length >= 3 ? h.size : [120, 320, 24];
    const sx  = Math.max(10, Number(sz[0]) * EVENT_GLOBAL_R_SCALE);
    const sy  = Math.max(10, Number(sz[1]) * EVENT_GLOBAL_R_SCALE);
    const ss  = Math.max(4,  Number(sz[2]) * EVENT_GLOBAL_R_SCALE);
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, ss),
      new THREE.MeshBasicMaterial({
        color: 0x81c784, transparent: true, opacity: 0.34, depthTest: false, depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    );
    slab.position.set(x, y, z);
    const bx = Array.isArray(h?.basisX) && h.basisX.length >= 3 ? h.basisX.map(Number) : null;
    const by = Array.isArray(h?.basisY) && h.basisY.length >= 3 ? h.basisY.map(Number) : null;
    const bz = Array.isArray(h?.basisZ) && h.basisZ.length >= 3 ? h.basisZ.map(Number) : null;
    if (bx && by && bz && bx.every(Number.isFinite) && by.every(Number.isFinite) && bz.every(Number.isFinite)) {
      const ex  = new THREE.Vector3(...bx).normalize();
      const ey  = new THREE.Vector3(...by).normalize();
      const ez  = new THREE.Vector3(...bz).normalize();
      slab.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
    } else {
      slab.lookAt(new THREE.Vector3(0, 0, z));
    }
    slab.renderOrder = 992;
    const mucTdc = Number(h?.timeChannel);
    const mucT   = Number.isFinite(mucTdc) && mucTdc >= 0 ? mucTdc : (Number(h?.depth) * 5.0);
    slab.userData = { kind: "muc_hit_strip", timeStartNs: Number.isFinite(mucT) ? mucT : eventTime.minNs, ...h };
    group.add(slab);
    count += 1;
  }

  scene.add(group);
  return { group, count, eventTime, emcTimeMin, emcTimeMax };
}

// ── MDC geometry transform helpers (kept for coordinate debugging) ────────────

export function estimateMdcTransform(scene, THREE, mdcHits) {
  const tf = { enabled: false, rScale: 1.0, zScale: 1.0 };
  try {
    const layerR = (mdcHits || []).map((h) => Number(h?.layerRadius ?? NaN)).filter((v) => Number.isFinite(v) && v > 1);
    if (layerR.length < 10) return tf;
    const rLayerMax = Math.max(...layerR);
    if (!Number.isFinite(rLayerMax) || rLayerMax < 50) return tf;
    const mdcObj = scene.getObjectByName?.("mdc");
    if (!mdcObj) return tf;
    const box = new THREE.Box3().setFromObject(mdcObj);
    if (box.isEmpty()) return tf;
    const size   = box.getSize(new THREE.Vector3());
    const rGeomMax = Math.max(size.x, size.y) * 0.5;
    const zGeomHalf = Math.max(1, size.z * 0.5);
    const rScale = rGeomMax / rLayerMax;
    const zScale = zGeomHalf / 1400.0;
    if (rScale < 0.3 || rScale > 3.0 || zScale < 0.3 || zScale > 3.0) {
      tf.enabled = true; tf.rScale = rScale; tf.zScale = zScale;
    }
  } catch (e) {
    console.warn("estimateMdcTransform failed:", e);
  }
  return tf;
}

export function forceShowEventData(eventDisplay) {
  try {
    const tm = eventDisplay?.getThreeManager?.();
    const sm = tm?.getSceneManager?.();
    if (!tm || !sm) return;
    tm.eventDataDepthTest?.(false);
    const evtGroup = sm.getEventData?.();
    if (!evtGroup) return;
    evtGroup.visible = true;
    evtGroup.traverse?.((obj) => {
      const mats = Array.isArray(obj?.material) ? obj.material : [obj?.material];
      mats.forEach((mat) => {
        if (!mat) return;
        mat.transparent = true; mat.opacity = 1.0;
        mat.depthTest = false; mat.depthWrite = false;
        if ("color" in mat && mat.color?.set) mat.color.set(0xff4d4d);
        mat.needsUpdate = true;
      });
    });
  } catch (err) {
    console.warn("Force show event data skipped:", err);
  }
}

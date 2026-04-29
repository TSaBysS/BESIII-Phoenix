/**
 * timeline.js — Animation timeline state and controls.
 *
 * Manages the ns-level event timeline: play/pause, slider updates,
 * and per-object visibility gating based on timeStartNs / timeEndNs.
 */

export const C_MM_PER_NS = 299.792458;

export const timelineState = {
  minNs: 0,
  maxNs: 100,
  currentNs: 0,
  enabled: false,
  isPlaying: false,
  lastTs: 0,
  speedNsPerSec: 40,
};

let animationFrameId = null;

// Reference to the current overlay group (set externally by event-renderer).
let _overlayGroupRef = null;
export function setOverlayGroup(g) { _overlayGroupRef = g; }

// ── time range estimation ─────────────────────────────────────────────────────

/**
 * Estimate [minNs, maxNs] for the event from hit timing arrays or track length.
 */
export function estimateEventTimeRange(ev, tracks, mdcHits, emcHits, tofHits, mucHits) {
  const values = [];
  for (const h of mdcHits) if (Number.isFinite(Number(h?.tdc))) values.push(Number(h.tdc));
  for (const h of emcHits) if (Number.isFinite(Number(h?.time))) values.push(Number(h.time));
  for (const h of tofHits) if (Number.isFinite(Number(h?.tof))) values.push(Number(h.tof));
  for (const h of mucHits) {
    const tdc = Number(h?.timeChannel);
    if (Number.isFinite(tdc) && tdc >= 0) values.push(tdc);
    else if (Number.isFinite(Number(h?.depth))) values.push(Number(h.depth) * 5.0);
  }
  if (values.length > 1) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max > min) return { minNs: min, maxNs: max, source: "hits" };
  }
  let maxTrackNs = 0;
  for (const t of tracks) {
    const points = Array.isArray(t?.pos) ? t.pos : [];
    if (points.length < 2) continue;
    const pGeV = Number(t?.pt_debug?.p_est ?? 0.6);
    const beta = pGeV > 0 ? pGeV / Math.sqrt(pGeV * pGeV + 0.13957 * 0.13957) : 0.9;
    let lengthMm = 0;
    for (let i = 1; i < points.length; i += 1) {
      const dx = Number(points[i][0]) - Number(points[i - 1][0]);
      const dy = Number(points[i][1]) - Number(points[i - 1][1]);
      const dz = Number(points[i][2]) - Number(points[i - 1][2]);
      lengthMm += Math.hypot(dx, dy, dz);
    }
    const dt = lengthMm / Math.max(1e-6, beta * C_MM_PER_NS);
    if (Number.isFinite(dt)) maxTrackNs = Math.max(maxTrackNs, dt);
  }
  return { minNs: 0, maxNs: Math.max(30, maxTrackNs), source: "track" };
}

// ── UI update ─────────────────────────────────────────────────────────────────

export function updateTimelineUi(timelineSliderEl, timelineTimeEl) {
  const span = Math.max(1e-6, timelineState.maxNs - timelineState.minNs);
  const frac = (timelineState.currentNs - timelineState.minNs) / span;
  if (timelineSliderEl) {
    timelineSliderEl.value = String(Math.max(0, Math.min(1000, Math.round(frac * 1000))));
  }
  if (timelineTimeEl) timelineTimeEl.textContent = `${timelineState.currentNs.toFixed(2)} ns`;
}

// ── overlay visibility ────────────────────────────────────────────────────────

export function applyTimelineToOverlay(timelineSliderEl, timelineTimeEl) {
  const group = _overlayGroupRef;
  if (!group) { updateTimelineUi(timelineSliderEl, timelineTimeEl); return; }

  if (!timelineState.enabled) {
    group.traverse((obj) => {
      if (!obj?.userData?.kind) return;
      obj.visible = true;
      const ud = obj.userData || {};
      if (obj.geometry?.setDrawRange && ud.pointCount) {
        obj.geometry.setDrawRange(0, ud.pointCount);
      }
    });
    updateTimelineUi(timelineSliderEl, timelineTimeEl);
    return;
  }

  const now = timelineState.currentNs;
  group.traverse((obj) => {
    const ud = obj.userData || {};
    const t0 = Number(ud.timeStartNs);
    const t1 = Number(ud.timeEndNs);
    if (!Number.isFinite(t0)) return;
    const visible = now >= t0;
    obj.visible = visible;
    if (!visible) return;
    if (Number.isFinite(t1) && t1 > t0 && obj.geometry?.setDrawRange && ud.pointCount) {
      const frac = Math.max(0, Math.min(1, (now - t0) / (t1 - t0)));
      obj.geometry.setDrawRange(0, Math.max(2, Math.floor(frac * ud.pointCount)));
    }
  });
  updateTimelineUi(timelineSliderEl, timelineTimeEl);
}

// ── animation loop ────────────────────────────────────────────────────────────

export function ensureTimelineAnimation(timelineSliderEl, timelineTimeEl) {
  if (animationFrameId) return;
  const step = (ts) => {
    if (!timelineState.isPlaying || !timelineState.enabled) {
      animationFrameId = null;
      return;
    }
    if (!timelineState.lastTs) timelineState.lastTs = ts;
    const dtSec = Math.max(0, (ts - timelineState.lastTs) / 1000);
    timelineState.lastTs = ts;
    timelineState.currentNs += dtSec * timelineState.speedNsPerSec;
    if (timelineState.currentNs > timelineState.maxNs) timelineState.currentNs = timelineState.minNs;
    applyTimelineToOverlay(timelineSliderEl, timelineTimeEl);
    animationFrameId = window.requestAnimationFrame(step);
  };
  animationFrameId = window.requestAnimationFrame(step);
}

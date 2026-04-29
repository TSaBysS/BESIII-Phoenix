/**
 * pid-interaction.js — Mouse-based track picking and PID display.
 *
 * Handles:
 *   - Track hover tooltip
 *   - Track selection (click)
 *   - Raycasting + screen-proximity fallback
 *   - Track visual highlight state
 *   - PID info panel rendering
 */

import { buildPidDisplay, formatPidValue, selectPidForTrack } from "./pid-tools.js";
import { computeClosestTruthMatch, estimateTruthMomentumMagnitude } from "./truth.js";

let _THREE = null;
async function getThree() {
  if (!_THREE) _THREE = await import("three");
  return _THREE;
}

// State exposed by and shared with app.js.
export const interactionState = {
  pidMode: false,
  truthMode: false,
  hoveredTrackId: null,
  selectedTrackId: null,
};

const raycaster = { instance: null, mouse: null };
let globalPointerBound = false;
let selectionMouseDownPos = null;

// Injected references (set via init()).
let _viewerEl = null;
let _trackHoverTipEl = null;
let _trackInfoPanelEl = null;
let _cachedEventsData  = null;
let _eventSelectEl     = null;
let _currentOverlayGroupRef = null;
let _currentEventDisplayRef = null;
let _trackCandidateCacheRef = null;

export function init(refs) {
  _viewerEl             = refs.viewerEl;
  _trackHoverTipEl      = refs.trackHoverTipEl;
  _trackInfoPanelEl     = refs.trackInfoPanelEl;
  _cachedEventsData     = refs.cachedEventsDataRef;
  _eventSelectEl        = refs.eventSelectEl;
  _currentOverlayGroupRef    = refs.overlayGroupRef;
  _currentEventDisplayRef    = refs.eventDisplayRef;
  _trackCandidateCacheRef    = refs.trackCandidateCacheRef;
}

// ── track lookup ──────────────────────────────────────────────────────────────

export function getTrackCandidateObjects() {
  const cache = _trackCandidateCacheRef?.();
  if (Array.isArray(cache) && cache.length > 0) {
    const valid = cache
      .filter((obj) => Boolean(obj?.geometry?.attributes?.position?.count))
      .map((obj, idx) => {
        const ud = obj.userData || {};
        if (!Number.isFinite(Number(ud.trackId))) { ud.trackId = (obj.id ?? 100000) + idx; obj.userData = ud; }
        return obj;
      });
    if (valid.length > 0) return valid;
  }
  const objs = [];
  const push = (obj) => {
    if (!obj) return;
    const ud = obj.userData || {};
    const isTrackKind  = ud.kind === "track" || ud.kind === "track_points";
    const isTrackShape = obj.isLine || obj.isPoints;
    if ((isTrackKind || isTrackShape) && obj?.geometry?.attributes?.position?.count) {
      if (!Number.isFinite(Number(ud.trackId))) { ud.trackId = (obj.id ?? 0) + 100000; obj.userData = ud; }
      objs.push(obj);
    }
  };
  _currentOverlayGroupRef?.()?.traverse?.((obj) => push(obj));
  if (objs.length > 0) return objs;
  const tm = _currentEventDisplayRef?.()?.getThreeManager?.();
  const sm = tm?.getSceneManager?.();
  sm?.getEventData?.()?.traverse?.((obj) => push(obj));
  if (objs.length > 0) return objs;
  sm?.getScene?.()?.traverse?.((obj) => push(obj));
  return objs;
}

function getPidSelectableObjects() {
  return getTrackCandidateObjects().filter((obj) => obj?.userData?.mode !== "mc");
}

export function getTrackInfoById(trackId) {
  if (trackId === null || trackId === undefined) return null;
  const tid = Number(trackId);
  if (!Number.isFinite(tid)) return null;
  let found = null;
  _currentOverlayGroupRef?.()?.traverse((obj) => {
    if (found) return;
    const ud = obj?.userData || {};
    if (ud.kind === "track" && Number(ud.trackId) === tid) found = ud;
  });
  const selectedEventKey = _eventSelectEl?.value || "";
  const ev = (selectedEventKey && _cachedEventsData?.()?.[selectedEventKey]) ? _cachedEventsData()[selectedEventKey] : null;
  if (ev?.Tracks) {
    const all = [
      ...(Array.isArray(ev.Tracks["REC MdcTrack (stable)"]) ? ev.Tracks["REC MdcTrack (stable)"] : []),
      ...(Array.isArray(ev.Tracks["MC Truth"]) ? ev.Tracks["MC Truth"] : []),
    ];
    const src = all.find((t) => Number(t?.trackId) === tid);
    if (src) return { ...(found || {}), ...src, trackId: tid };
  }
  return found;
}

// ── hover / selection visuals ─────────────────────────────────────────────────

export function refreshTrackSelectionVisuals() {
  _currentOverlayGroupRef?.()?.traverse((obj) => {
    const ud = obj?.userData || {};
    if (!(ud.kind === "track" || ud.kind === "track_points")) return;
    const tid        = Number(ud.trackId);
    const isHover    = interactionState.pidMode && interactionState.hoveredTrackId !== null && tid === Number(interactionState.hoveredTrackId);
    const isSelected = interactionState.selectedTrackId !== null && tid === Number(interactionState.selectedTrackId);
    const mats       = Array.isArray(obj?.material) ? obj.material : [obj?.material];
    mats.forEach((mat) => {
      if (!mat) return;
      const baseOpac = Number(
        ud.kind === "track_points"
          ? (ud.mode === "mc" ? 0.88 : 0.86)
          : (ud.mode === "mc" ? 0.94 : 0.92),
      );
      if (isSelected) {
        mat.opacity = Math.min(1.0, baseOpac + 0.08);
        if (mat.color?.setHex) mat.color.setHex(0xd9d9d9);
        if (ud.kind === "track_points" && Number.isFinite(mat.size)) mat.size = 5.4;
      } else if (isHover) {
        mat.opacity = Math.min(1.0, baseOpac + 0.06);
        if (ud.kind === "track_points" && Number.isFinite(mat.size)) mat.size = 4.6;
      } else {
        mat.opacity = baseOpac;
        if (ud.kind === "track_points" && Number.isFinite(mat.size))
          mat.size = ud.mode === "mc" ? 4.2 : 3.6;
        if (mat.color?.setHex) {
          const fallback = ud.mode === "mc" ? 0x40c4ff : 0xff6161;
          mat.color.setHex(fallback);
        }
      }
      mat.needsUpdate = true;
    });
  });
}

// ── tooltip ───────────────────────────────────────────────────────────────────

export function hideTrackHoverTip() {
  if (_trackHoverTipEl) _trackHoverTipEl.style.display = "none";
}

export function showTrackHoverTip(clientX, clientY, text) {
  if (!_trackHoverTipEl) return;
  _trackHoverTipEl.textContent = text;
  _trackHoverTipEl.style.left = `${clientX + 14}px`;
  _trackHoverTipEl.style.top  = `${clientY + 10}px`;
  _trackHoverTipEl.style.display = "block";
}

// ── PID panel ─────────────────────────────────────────────────────────────────

export function renderTrackInfoPanel(trackInfo) {
  if (!_trackInfoPanelEl) return;
  if (!trackInfo) {
    _trackInfoPanelEl.classList.remove("open");
    _trackInfoPanelEl.innerHTML = "";
    return;
  }
  const p      = Number(trackInfo?.pt_debug?.p_est ?? 0);
  const nhits  = Number(trackInfo?.nhits ?? -1);
  const selectedEventKey = _eventSelectEl?.value || "";
  const ev     = (selectedEventKey && _cachedEventsData?.()?.[selectedEventKey]) ? _cachedEventsData()[selectedEventKey] : null;
  const hasMcTruth = Array.isArray(ev?.Tracks?.["MC Truth"]) && ev.Tracks["MC Truth"].length > 0;
  const pidPick = selectPidForTrack(ev, trackInfo?.trackId, trackInfo);
  const { normalizedProb, top } = buildPidDisplay(pidPick?.pid || {});

  const rows = [
    `<div class="kv"><strong>Momentum:</strong> ${Number.isFinite(p) ? p.toFixed(3) : "N/A"} GeV/c</div>`,
    `<div class="kv"><strong>Hits:</strong> ${nhits >= 0 ? nhits : "N/A"}</div>`,
  ];
  if (hasMcTruth && trackInfo?.mode !== "mc") {
    const truth = computeClosestTruthMatch(trackInfo, ev);
    if (truth) {
      const mcTracks = Array.isArray(ev?.Tracks?.["MC Truth"]) ? ev.Tracks["MC Truth"] : [];
      const truthObj = mcTracks.find((x) => Number(x?.trackId) === Number(truth.trackId));
      const pTruth   = estimateTruthMomentumMagnitude(truthObj);
      rows.push(
        `<div class="kv"><strong>Truth Match:</strong> pdg=${truth.pdg}, p=${Number.isFinite(pTruth) ? pTruth.toFixed(3) : "N/A"} GeV/c</div>`,
      );
    }
  }
  const topText  = top.length ? top.map((x) => `${x.name}:${formatPidValue(Number(x.score))}`).join(" | ") : "N/A";
  const probText = ["electron", "muon", "pion", "kaon", "proton"]
    .map((k) => `${k}:${formatPidValue(Number(normalizedProb?.[k]))}`)
    .join(" | ");

  _trackInfoPanelEl.innerHTML =
    `<h4>Track Detail</h4>${rows.join("")}<div class="pid"><div><strong>PID Top:</strong> ${topText}</div><div style="margin-top:4px;"><strong>PID Prob:</strong> ${probText}</div></div>`;
  _trackInfoPanelEl.classList.add("open");
}

// ── cursor ────────────────────────────────────────────────────────────────────

let _interactionCanvas = null;

export function updateInteractionCursor() {
  const shouldPointer = interactionState.pidMode && Number.isFinite(Number(interactionState.hoveredTrackId));
  const cursor = shouldPointer ? "pointer" : "default";
  if (_viewerEl) _viewerEl.style.cursor = cursor;
  if (_interactionCanvas) _interactionCanvas.style.cursor = cursor;
}

// ── binding ───────────────────────────────────────────────────────────────────

export async function bindTrackInteractionsIfNeeded() {
  updateInteractionCursor();
  const canvas = document.getElementById("three-canvas") || _viewerEl?.querySelector("canvas");
  if (!canvas) {
    _interactionCanvas = _viewerEl;
    return;
  }
  if (_interactionCanvas === canvas && _viewerEl?.dataset.pidBound === "1") {
    updateInteractionCursor();
    return;
  }
  _interactionCanvas = canvas;

  const THREE = await getThree();
  raycaster.instance = new THREE.Raycaster();
  raycaster.mouse    = new THREE.Vector2();
  raycaster.instance.params.Line.threshold   = 36;
  raycaster.instance.params.Points.threshold = 28;

  const getMainCamera = () => {
    const tm = _currentEventDisplayRef?.()?.getThreeManager?.();
    const sm = tm?.getSceneManager?.();
    const controls = tm?.controlsManager?.getMainControls?.() || tm?.getControlsManager?.()?.getMainControls?.();
    if (controls?.object?.isCamera) return controls.object;
    const mgr = tm?.controlsManager?.getMainCamera?.() || tm?.getControlsManager?.()?.getMainCamera?.();
    if (mgr?.isCamera) return mgr;
    if (sm?.getScene?.()?.traverse) {
      let cam = null;
      sm.getScene().traverse((obj) => { if (!cam && obj?.isCamera) cam = obj; });
      if (cam) return cam;
    }
    return tm?.camera || null;
  };

  const pickTrackByScreenProximity = async (evt) => {
    const camera = getMainCamera();
    if (!camera) return null;
    const rect    = _interactionCanvas?.getBoundingClientRect?.() || _viewerEl.getBoundingClientRect();
    const mx      = evt.clientX - rect.left, my = evt.clientY - rect.top;
    const maxDist = 40;
    let best = null, bestDist = Number.POSITIVE_INFINITY;
    for (const obj of getPidSelectableObjects().filter((o) => o?.userData?.kind === "track_points" || o?.userData?.kind === "track")) {
      const tid  = Number(obj?.userData?.trackId);
      if (!Number.isFinite(tid)) continue;
      const posAttr = obj?.geometry?.attributes?.position;
      if (!posAttr?.count) continue;
      for (let i = 0; i < posAttr.count; i += 1) {
        const v = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        v.applyMatrix4(obj.matrixWorld).project(camera);
        if (v.z < -1 || v.z > 1) continue;
        const sx = (v.x * 0.5 + 0.5) * rect.width;
        const sy = (-v.y * 0.5 + 0.5) * rect.height;
        const d  = Math.hypot(sx - mx, sy - my);
        if (d < bestDist) { bestDist = d; best = tid; }
      }
    }
    return bestDist <= maxDist ? best : null;
  };

  const pickTrack = async (evt) => {
    if (!interactionState.pidMode || !_interactionCanvas) return null;
    const rect   = _interactionCanvas?.getBoundingClientRect?.() || _viewerEl.getBoundingClientRect();
    raycaster.mouse.x =  ((evt.clientX - rect.left) / rect.width) * 2 - 1;
    raycaster.mouse.y = -((evt.clientY - rect.top)  / rect.height) * 2 + 1;
    const camera = getMainCamera();
    camera?.updateMatrixWorld?.(true);
    if (camera) {
      raycaster.instance.setFromCamera(raycaster.mouse, camera);
      const hits = raycaster.instance.intersectObjects(getPidSelectableObjects(), false);
      if (hits.length) return Number(hits[0]?.object?.userData?.trackId);
    }
    return pickTrackByScreenProximity(evt);
  };

  const onMove = async (evt) => {
    if (!interactionState.pidMode) {
      interactionState.hoveredTrackId = null;
      hideTrackHoverTip();
      updateInteractionCursor();
      return;
    }
    const tid = await pickTrack(evt);
    interactionState.hoveredTrackId = tid;
    if (tid !== null && tid !== undefined && Number.isFinite(Number(tid))) {
      const info = getTrackInfoById(tid);
      showTrackHoverTip(evt.clientX, evt.clientY, info?.mode === "mc" ? `Truth track ${tid}` : `Track ${tid} (click for PID)`);
    } else {
      hideTrackHoverTip();
    }
    updateInteractionCursor();
    refreshTrackSelectionVisuals();
  };

  const onLeave = () => {
    interactionState.hoveredTrackId = null;
    hideTrackHoverTip();
    updateInteractionCursor();
    refreshTrackSelectionVisuals();
  };

  const onClick = async (evt) => {
    if (!interactionState.pidMode) return;
    const tid = await pickTrack(evt);
    if (tid === null || tid === undefined || !Number.isFinite(Number(tid))) return;
    const info = getTrackInfoById(tid);
    if (!info || info?.mode === "mc") return;
    interactionState.selectedTrackId = tid;
    renderTrackInfoPanel(info);
    if (_trackInfoPanelEl) {
      _trackInfoPanelEl.classList.add("flash");
      setTimeout(() => _trackInfoPanelEl.classList.remove("flash"), 160);
    }
    refreshTrackSelectionVisuals();
  };

  const onMouseDown = (evt) => { selectionMouseDownPos = { x: evt.clientX, y: evt.clientY }; };
  const onMouseUp   = async (evt) => {
    if (!interactionState.pidMode || !selectionMouseDownPos) return;
    const dx = evt.clientX - selectionMouseDownPos.x;
    const dy = evt.clientY - selectionMouseDownPos.y;
    selectionMouseDownPos = null;
    if (Math.hypot(dx, dy) <= 10) await onClick(evt);
  };

  canvas.addEventListener("mousemove",  onMove,      true);
  canvas.addEventListener("mouseleave", onLeave,     true);
  canvas.addEventListener("mousedown",  onMouseDown, true);
  canvas.addEventListener("mouseup",    onMouseUp,   true);
  _viewerEl.addEventListener("pointermove",  onMove,  true);
  _viewerEl.addEventListener("pointerleave", onLeave, true);
  _viewerEl.addEventListener("click",        onClick, true);

  if (!globalPointerBound) {
    const inside = (evt) => {
      const rect = _viewerEl.getBoundingClientRect();
      return evt.clientX >= rect.left && evt.clientX <= rect.right && evt.clientY >= rect.top && evt.clientY <= rect.bottom;
    };
    window.addEventListener("pointermove", (evt) => { if (!interactionState.pidMode) return; if (inside(evt)) onMove(evt); else onLeave(); }, true);
    window.addEventListener("click",       (evt) => { if (!interactionState.pidMode) return; if (inside(evt)) onClick(evt); }, true);
    window.addEventListener("mousemove",   (evt) => { if (!interactionState.pidMode) return; if (inside(evt)) onMove(evt); else onLeave(); }, true);
    window.addEventListener("mouseup",     (evt) => { if (!interactionState.pidMode) return; if (inside(evt)) onClick(evt); }, true);
    globalPointerBound = true;
  }

  _viewerEl.dataset.pidBound = "1";
  if (canvas) canvas.style.cursor = interactionState.pidMode ? "pointer" : "default";
}

export function scheduleBindTrackInteractions() {
  let retryCount = 0;
  const attemptBind = async () => {
    try {
      await bindTrackInteractionsIfNeeded();
      if (_viewerEl?.dataset.pidBound !== "1" && retryCount < 12) {
        retryCount += 1; setTimeout(attemptBind, 250);
      }
    } catch (err) {
      console.warn("track interaction bind retry failed:", err);
      if (retryCount < 12) { retryCount += 1; setTimeout(attemptBind, 250); }
    }
  };
  setTimeout(attemptBind, 0);
}

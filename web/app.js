const {
  buildPidDisplay,
  formatPidValue,
  selectPidForTrack,
} = await import(`./pid-tools.js?v=${Date.now()}`);

const viewerEl = document.getElementById("viewer");
const statusEl = document.getElementById("status");
const jsonPathEl = document.getElementById("jsonPath");
const trackModeSelectEl = document.getElementById("trackModeSelect");
const eventSelectEl = document.getElementById("eventSelect");
const chkMcTruthEl = document.getElementById("chkMcTruth");
const mcTruthWrapEl = document.getElementById("mcTruthWrap");
const btnOpacityMenuEl = document.getElementById("btnOpacityMenu");
const btnResetCameraEl = document.getElementById("btnResetCamera");
const opacityPanelEl = document.getElementById("opacityPanel");
const alphaMdcEl = document.getElementById("alphaMdc");
const alphaTofEl = document.getElementById("alphaTof");
const alphaMucEl = document.getElementById("alphaMuc");
const alphaEmcEl = document.getElementById("alphaEmc");
const btnTimelineMenuEl = document.getElementById("btnTimelineMenu");
const btnTimelinePlayEl = document.getElementById("btnTimelinePlay");
const timelineSliderEl = document.getElementById("timelineSlider");
const timelineTimeEl = document.getElementById("timelineTime");
const timelinePanelEl = document.getElementById("timelinePanel");
const btnPidModeEl = document.getElementById("btnPidMode");
const btnTruthModeEl = document.getElementById("btnTruthMode");
const trackHoverTipEl = document.getElementById("trackHoverTip");
const trackInfoPanelEl = document.getElementById("trackInfoPanel");
const pidDebugPanelEl = document.getElementById("pidDebugPanel");
const appLoaderEl = document.getElementById("appLoader");
const loaderStatusEl = document.getElementById("loaderStatus");
const loaderProgressBarEl = document.getElementById("loaderProgressBar");

const geometryMap = window.BES3_GEOMETRIES || { full: "../data/bes3.root.json" };
const eventJsonPath = "../data/events/event.mixed.json";
let phoenixCtor = null;
let phoenixApi = null;
let phoenixLastError = "";
let eventStatusTouched = false;
let currentEventDisplay = null;
let cachedEventsData = null;
let cachedThreeModule = null;
let currentOverlayGroup = null;
let animationFrameId = null;
let interactionCanvas = null;
let bindRetryCount = 0;
let globalPointerBound = false;
let pidDebugTickId = null;
let trackCandidateCache = [];
let selectionMouseDownPos = null;
let loaderProgressValue = 10;
const interactionState = {
  pidMode: false,
  truthMode: false,
  hoveredTrackId: null,
  selectedTrackId: null,
};
const raycaster = { instance: null, mouse: null };
const pidDebugState = {
  pidMode: false,
  bound: false,
  camera: false,
  candidates: 0,
  hoverTrackId: null,
  selectedTrackId: null,
  lastPickTrackId: null,
  mouseX: null,
  mouseY: null,
  bindingTarget: "none",
  cameraSource: "none",
  pidLookupEventKey: "",
  pidLookupTrackId: null,
  pidLookupHit: false,
  pidLookupPidKeys: "",
  pidLookupPidPreview: "",
  pidLookupCollection: "",
  pidLookupMatchedCount: 0,
  pidLookupChosenTrackId: null,
  pidLookupChosenHasPidField: false,
  pidLookupChosenTrackKeys: "",
};
const timelineState = {
  minNs: 0,
  maxNs: 100,
  currentNs: 0,
  enabled: false,
  isPlaying: false,
  lastTs: 0,
  speedNsPerSec: 40,
};
const urlParams = new URLSearchParams(window.location.search);
const trackModeFromQuery = urlParams.get("trkmode") || "stable";
const helixDebugEnabled = urlParams.get("helixdbg") === "1" || Boolean(window.BES3_ENABLE_HELIX_DEBUG);
const selectedEventKeyFromQuery = urlParams.get("evt") || "";
const showMcFromQuery = urlParams.get("mc") === "1";
const showTruthFromQuery = urlParams.get("truth") === "1" || showMcFromQuery;
// Global event rendering scale: keep phi/theta, scale radius only (uniform xyz).
// This is independent of current detector selection/loading state.
const EVENT_GLOBAL_R_SCALE = 0.1;
const DETECTOR_OPACITY_DEFAULTS = { mdc: 1.0, tof: 1.0, muc: 1.0, emc: 0.1 };
const C_MM_PER_NS = 299.792458;
const PID_DEBUG_BUILD = "pid-prob-lookup-20260428-14";

const assembledComponents = [
  { key: "mdc", label: "MDC", alphaEl: alphaMdcEl, defaultAlpha: DETECTOR_OPACITY_DEFAULTS.mdc },
  { key: "tof", label: "TOF", alphaEl: alphaTofEl, defaultAlpha: DETECTOR_OPACITY_DEFAULTS.tof },
  { key: "muc", label: "MUC", alphaEl: alphaMucEl, defaultAlpha: DETECTOR_OPACITY_DEFAULTS.muc },
  { key: "emc", label: "EMC", alphaEl: alphaEmcEl, defaultAlpha: DETECTOR_OPACITY_DEFAULTS.emc },
];

if (trackModeSelectEl) {
  trackModeSelectEl.value = ["stable", "helix5", "both"].includes(trackModeFromQuery) ? trackModeFromQuery : "stable";
  if (!helixDebugEnabled) {
    trackModeSelectEl.value = "stable";
    Array.from(trackModeSelectEl.options).forEach((op) => {
      if (op.value !== "stable") op.style.display = "none";
    });
    trackModeSelectEl.disabled = true;
    const parent = trackModeSelectEl.closest("label");
    if (parent) parent.style.display = "none";
  }
  trackModeSelectEl.addEventListener("change", () => renderSelectedEventOverlay());
}

function getGeometryList() {
  return assembledComponents
    .map((c) => ({ key: c.key, path: geometryMap[c.key] }))
    .filter((e) => Boolean(e.path))
    .map((e) => e.path);
}

function getGeometryEntries() {
  return assembledComponents
    .map((c) => ({ key: c.key, path: geometryMap[c.key] }))
    .filter((e) => Boolean(e.path));
}

function setupFixedUi() {
  jsonPathEl.textContent = getGeometryList().join(" + ");
  if (btnOpacityMenuEl && opacityPanelEl) {
    btnOpacityMenuEl.onclick = () => opacityPanelEl.classList.toggle("open");
  }
  if (btnResetCameraEl) {
    btnResetCameraEl.onclick = () => {
      if (currentEventDisplay) adjustPhoenixCamera(currentEventDisplay);
    };
  }
  assembledComponents.forEach((component) => {
    if (!component.alphaEl) return;
    component.alphaEl.value = String(component.defaultAlpha);
    component.alphaEl.addEventListener("input", () => {
      if (!currentEventDisplay) return;
      applyOpacityToNamedGeometry(currentEventDisplay, component.key, Number(component.alphaEl.value));
    });
  });
  if (btnTimelinePlayEl) {
    btnTimelinePlayEl.onclick = () => {
      timelineState.isPlaying = !timelineState.isPlaying;
      btnTimelinePlayEl.textContent = timelineState.isPlaying ? "❚❚" : "▶";
      if (timelineState.isPlaying) {
        timelineState.lastTs = 0;
        ensureTimelineAnimation();
      }
    };
  }
  if (timelineSliderEl) {
    timelineSliderEl.addEventListener("input", () => {
      const frac = Number(timelineSliderEl.value) / 1000;
      timelineState.currentNs = timelineState.minNs + frac * (timelineState.maxNs - timelineState.minNs);
      applyTimelineToOverlay();
    });
  }
  if (btnTimelineMenuEl && timelinePanelEl) {
    btnTimelineMenuEl.onclick = () => {
      timelineState.enabled = !timelineState.enabled;
      timelinePanelEl.classList.toggle("open", timelineState.enabled);
      if (!timelineState.enabled) {
        timelineState.isPlaying = false;
        timelineState.lastTs = 0;
        if (btnTimelinePlayEl) btnTimelinePlayEl.textContent = "▶";
      }
      applyTimelineToOverlay();
    };
  }
  if (btnPidModeEl) {
    btnPidModeEl.onclick = () => {
      interactionState.pidMode = !interactionState.pidMode;
      btnPidModeEl.style.background = interactionState.pidMode
        ? "rgba(72, 104, 150, 0.95)"
        : "rgba(20, 28, 40, 0.9)";
      if (!interactionState.pidMode) {
        interactionState.hoveredTrackId = null;
        interactionState.selectedTrackId = null;
        pidDebugState.hoverTrackId = null;
        pidDebugState.selectedTrackId = null;
        pidDebugState.lastPickTrackId = null;
        hideTrackHoverTip();
        renderTrackInfoPanel(null);
        refreshTrackSelectionVisuals();
      }
      updateInteractionCursor();
      pidDebugState.pidMode = interactionState.pidMode;
      updatePidDebugPanel();
    };
  }
  if (btnTruthModeEl) {
    btnTruthModeEl.onclick = () => {
      interactionState.truthMode = !interactionState.truthMode;
      btnTruthModeEl.style.background = interactionState.truthMode
        ? "rgba(72, 104, 150, 0.95)"
        : "rgba(20, 28, 40, 0.9)";
      renderSelectedEventOverlay();
    };
  }
  updatePidDebugPanel();
}

function updatePidDebugPanel() {
  if (!pidDebugPanelEl) return;
  const lines = [
    `build: ${PID_DEBUG_BUILD}`,
    `pidMode: ${pidDebugState.pidMode ? "ON" : "OFF"}`,
    `listenersBound: ${pidDebugState.bound ? "YES" : "NO"}`,
    `cameraFound: ${pidDebugState.camera ? "YES" : "NO"}`,
    `candidateObjects: ${pidDebugState.candidates}`,
    `hoverTrackId: ${pidDebugState.hoverTrackId ?? "null"}`,
    `selectedTrackId: ${pidDebugState.selectedTrackId ?? "null"}`,
    `lastPickTrackId: ${pidDebugState.lastPickTrackId ?? "null"}`,
    `mouse(viewer): ${pidDebugState.mouseX ?? "null"}, ${pidDebugState.mouseY ?? "null"}`,
    `bindingTarget: ${pidDebugState.bindingTarget}`,
    `cameraSource: ${pidDebugState.cameraSource}`,
    `pidLookupEvent: ${pidDebugState.pidLookupEventKey || "N/A"}`,
    `pidLookupTrackId: ${pidDebugState.pidLookupTrackId ?? "null"}`,
    `pidLookupHit: ${pidDebugState.pidLookupHit ? "YES" : "NO"}`,
    `pidLookupCollection: ${pidDebugState.pidLookupCollection || "N/A"}`,
    `pidLookupMatchedCount: ${pidDebugState.pidLookupMatchedCount ?? 0}`,
    `pidLookupChosenTrackId: ${pidDebugState.pidLookupChosenTrackId ?? "null"}`,
    `pidLookupChosenHasPidField: ${pidDebugState.pidLookupChosenHasPidField ? "YES" : "NO"}`,
    `pidLookupPidKeys: ${pidDebugState.pidLookupPidKeys || "N/A"}`,
    `pidLookupPidPreview: ${pidDebugState.pidLookupPidPreview || "N/A"}`,
    `pidLookupChosenTrackKeys: ${pidDebugState.pidLookupChosenTrackKeys || "N/A"}`,
  ];
  pidDebugPanelEl.textContent = lines.join("\n");
}

function updateInteractionCursor() {
  const shouldPointer =
    interactionState.pidMode && Number.isFinite(Number(interactionState.hoveredTrackId));
  const cursor = shouldPointer ? "pointer" : "default";
  viewerEl.style.cursor = cursor;
  if (interactionCanvas) interactionCanvas.style.cursor = cursor;
}

function startPidDebugTick() {
  if (pidDebugTickId) return;
  pidDebugTickId = window.setInterval(() => {
    pidDebugState.candidates = getTrackCandidateObjects().length;
    const tm = currentEventDisplay?.getThreeManager?.();
    const sm = tm?.getSceneManager?.();
    const hasCam = Boolean(
      tm?.controlsManager?.getMainCamera?.() ||
      tm?.getControlsManager?.()?.getMainCamera?.() ||
      tm?.getMainCamera?.() ||
      tm?.cameraManager?.getMainCamera?.() ||
      tm?.camera ||
      sm?.getScene?.()?.camera
    );
    if (hasCam) pidDebugState.camera = true;
    updatePidDebugPanel();
  }, 500);
}

function getTrackCandidateObjects() {
  if (Array.isArray(trackCandidateCache) && trackCandidateCache.length > 0) {
    const valid = trackCandidateCache
      .filter((obj) => Boolean(obj?.geometry?.attributes?.position?.count))
      .map((obj, idx) => {
        const ud = obj.userData || {};
        if (!Number.isFinite(Number(ud.trackId))) {
          ud.trackId = (obj.id ?? 100000) + idx;
          obj.userData = ud;
        }
        return obj;
      });
    trackCandidateCache = valid;
    if (valid.length > 0) return valid;
  }
  const objs = [];
  const pushTrackLike = (obj) => {
    if (!obj) return;
    const ud = obj.userData || {};
    const isTrackKind = ud.kind === "track" || ud.kind === "track_points";
    const isTrackShape = obj.isLine || obj.isPoints;
    const hasPos = Boolean(obj?.geometry?.attributes?.position?.count);
    if ((isTrackKind || isTrackShape) && hasPos) {
      if (!Number.isFinite(Number(ud.trackId))) {
        // Fallback synthetic id for picking when source track id is absent.
        ud.trackId = (obj.id ?? 0) + 100000;
        obj.userData = ud;
      }
      objs.push(obj);
    }
  };

  currentOverlayGroup?.traverse?.((obj) => pushTrackLike(obj));
  if (objs.length > 0) return objs;

  const tm = currentEventDisplay?.getThreeManager?.();
  const sm = tm?.getSceneManager?.();
  sm?.getEventData?.()?.traverse?.((obj) => pushTrackLike(obj));
  if (objs.length > 0) return objs;

  sm?.getScene?.()?.traverse?.((obj) => pushTrackLike(obj));
  return objs;
}

function getPidSelectableTrackObjects() {
  return getTrackCandidateObjects().filter((obj) => {
    const ud = obj?.userData || {};
    // In PID mode, only reconstructed tracks should be pickable.
    return ud?.mode !== "mc";
  });
}

function getTrackInfoById(trackId) {
  if (trackId === null || trackId === undefined) return null;
  const tid = Number(trackId);
  if (!Number.isFinite(tid)) return null;

  let found = null;
  if (currentOverlayGroup) {
    currentOverlayGroup.traverse((obj) => {
      if (found) return;
      const ud = obj?.userData || {};
      if (ud.kind === "track" && Number(ud.trackId) === tid) {
        found = ud;
      }
    });
  }

  const selectedEventKey = eventSelectEl?.value || "";
  const ev = (selectedEventKey && cachedEventsData?.[selectedEventKey]) ? cachedEventsData[selectedEventKey] : null;
  if (ev?.Tracks) {
    const stable = Array.isArray(ev.Tracks["REC MdcTrack (stable)"]) ? ev.Tracks["REC MdcTrack (stable)"] : [];
    const helix5 = Array.isArray(ev.Tracks["REC MdcTrack (helix5)"]) ? ev.Tracks["REC MdcTrack (helix5)"] : [];
    const mc = Array.isArray(ev.Tracks["MC Truth"]) ? ev.Tracks["MC Truth"] : [];
    const all = [...stable, ...helix5, ...mc];
    const src = all.find((t) => Number(t?.trackId) === tid);
    if (src) {
      // JSON source has the canonical PID payload.
      return {
        ...(found || {}),
        ...src,
        trackId: tid,
      };
    }
  }
  return found;
}

function computeClosestTruthMatch(trackInfo, ev) {
  if (!trackInfo || trackInfo?.mode === "mc") return null;
  const recoPos = Array.isArray(trackInfo?.pos) ? trackInfo.pos : [];
  if (recoPos.length < 2) return null;
  const mcTracks = Array.isArray(ev?.Tracks?.["MC Truth"]) ? ev.Tracks["MC Truth"] : [];
  if (mcTracks.length === 0) return null;
  const sampleStep = Math.max(1, Math.floor(recoPos.length / 24));
  let best = null;
  for (const cand of mcTracks) {
    const mcPos = Array.isArray(cand?.pos) ? cand.pos : [];
    if (mcPos.length < 2) continue;
    let sumMin = 0;
    let nUsed = 0;
    for (let i = 0; i < recoPos.length; i += sampleStep) {
      const rp = recoPos[i];
      let localBest = Number.POSITIVE_INFINITY;
      for (let j = 0; j < mcPos.length; j += 1) {
        const mp = mcPos[j];
        const dx = Number(rp?.[0] ?? 0) - Number(mp?.[0] ?? 0);
        const dy = Number(rp?.[1] ?? 0) - Number(mp?.[1] ?? 0);
        const dz = Number(rp?.[2] ?? 0) - Number(mp?.[2] ?? 0);
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < localBest) localBest = d2;
      }
      if (Number.isFinite(localBest)) {
        sumMin += localBest;
        nUsed += 1;
      }
    }
    if (nUsed === 0) continue;
    const meanDistMm = Math.sqrt(sumMin / nUsed);
    const recoHead = recoPos[Math.min(4, recoPos.length - 1)];
    const recoTail = recoPos[0];
    const mcHead = mcPos[Math.min(4, mcPos.length - 1)];
    const mcTail = mcPos[0];
    const dStart = Math.hypot(
      Number(recoTail?.[0] ?? 0) - Number(mcTail?.[0] ?? 0),
      Number(recoTail?.[1] ?? 0) - Number(mcTail?.[1] ?? 0),
      Number(recoTail?.[2] ?? 0) - Number(mcTail?.[2] ?? 0),
    );
    const v1x = Number(recoHead?.[0] ?? 0) - Number(recoTail?.[0] ?? 0);
    const v1y = Number(recoHead?.[1] ?? 0) - Number(recoTail?.[1] ?? 0);
    const v1z = Number(recoHead?.[2] ?? 0) - Number(recoTail?.[2] ?? 0);
    const v2x = Number(mcHead?.[0] ?? 0) - Number(mcTail?.[0] ?? 0);
    const v2y = Number(mcHead?.[1] ?? 0) - Number(mcTail?.[1] ?? 0);
    const v2z = Number(mcHead?.[2] ?? 0) - Number(mcTail?.[2] ?? 0);
    const l1 = Math.hypot(v1x, v1y, v1z);
    const l2 = Math.hypot(v2x, v2y, v2z);
    let angleDeg = 180;
    if (l1 > 1e-9 && l2 > 1e-9) {
      const cs = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y + v1z * v2z) / (l1 * l2)));
      angleDeg = Math.acos(cs) * 180.0 / Math.PI;
    }
    const score = meanDistMm + 0.2 * dStart + 1.5 * angleDeg;
    if (!best || score < best.score) {
      best = {
        score,
        trackId: Number(cand?.trackId),
        pdg: Number(cand?.pdg ?? 0),
        p: Number(cand?.p ?? NaN),
      };
    }
  }
  return best;
}

function estimateTruthMomentumMagnitude(trackObj) {
  const direct = Number(trackObj?.p);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const pos = Array.isArray(trackObj?.pos) ? trackObj.pos : [];
  if (pos.length < 6) return NaN;
  const p0 = pos[0];
  const p2 = pos[2];
  const p4 = pos[4];
  const x1 = Number(p0?.[0] ?? 0);
  const y1 = Number(p0?.[1] ?? 0);
  const x2 = Number(p2?.[0] ?? 0);
  const y2 = Number(p2?.[1] ?? 0);
  const x3 = Number(p4?.[0] ?? 0);
  const y3 = Number(p4?.[1] ?? 0);
  const a = Math.hypot(x2 - x1, y2 - y1);
  const b = Math.hypot(x3 - x2, y3 - y2);
  const c = Math.hypot(x3 - x1, y3 - y1);
  const s = 0.5 * (a + b + c);
  const area2 = Math.max(0, s * (s - a) * (s - b) * (s - c));
  if (area2 <= 1e-12) return NaN;
  const area = Math.sqrt(area2);
  const rMm = (a * b * c) / (4 * area);
  if (!Number.isFinite(rMm) || rMm <= 1e-6) return NaN;
  const pt = 0.299792458 * (rMm / 1000.0); // B=1T
  let sxy = 0;
  let dz = 0;
  for (let i = 1; i < Math.min(pos.length, 12); i += 1) {
    const pa = pos[i - 1];
    const pb = pos[i];
    const dx = Number(pb?.[0] ?? 0) - Number(pa?.[0] ?? 0);
    const dy = Number(pb?.[1] ?? 0) - Number(pa?.[1] ?? 0);
    const zz = Number(pb?.[2] ?? 0) - Number(pa?.[2] ?? 0);
    sxy += Math.hypot(dx, dy);
    dz += zz;
  }
  if (sxy <= 1e-9) return pt;
  const pz = pt * (dz / sxy);
  return Math.sqrt(pt * pt + pz * pz);
}

function lookupPidFromCurrentEvent(trackId) {
  const tid = Number(trackId);
  if (!Number.isFinite(tid)) return null;
  const selectedEventKey = eventSelectEl?.value || "";
  pidDebugState.pidLookupEventKey = selectedEventKey;
  pidDebugState.pidLookupTrackId = tid;
  const ev = (selectedEventKey && cachedEventsData?.[selectedEventKey]) ? cachedEventsData[selectedEventKey] : null;
  const selectedTrackInfo = getTrackInfoById(tid);
  const result = selectPidForTrack(ev, tid, selectedTrackInfo);
  pidDebugState.pidLookupHit = Boolean(result?.hit);
  pidDebugState.pidLookupCollection = result?.collection || "";
  pidDebugState.pidLookupMatchedCount = Number(result?.matchedCount ?? 0);
  pidDebugState.pidLookupChosenTrackId = Number.isFinite(Number(result?.chosenTrackId))
    ? Number(result?.chosenTrackId)
    : null;
  pidDebugState.pidLookupChosenHasPidField = Boolean(result?.chosenHasPidField);
  pidDebugState.pidLookupPidKeys = result?.pidKeys || "";
  pidDebugState.pidLookupPidPreview = result?.pidPreview || "";
  pidDebugState.pidLookupChosenTrackKeys = result?.chosenTrackKeys || "";
  return result?.pid || null;
}

function hideTrackHoverTip() {
  if (trackHoverTipEl) trackHoverTipEl.style.display = "none";
}

function showTrackHoverTip(clientX, clientY, text) {
  if (!trackHoverTipEl) return;
  trackHoverTipEl.textContent = text;
  trackHoverTipEl.style.left = `${clientX + 14}px`;
  trackHoverTipEl.style.top = `${clientY + 10}px`;
  trackHoverTipEl.style.display = "block";
}

function renderTrackInfoPanel(trackInfo) {
  if (!trackInfoPanelEl) return;
  if (!trackInfo) {
    trackInfoPanelEl.classList.remove("open");
    trackInfoPanelEl.innerHTML = "";
    return;
  }
  const p = Number(trackInfo?.pt_debug?.p_est ?? 0);
  const nhits = Number(trackInfo?.nhits ?? -1);
  const selectedEventKey = eventSelectEl?.value || "";
  const ev = (selectedEventKey && cachedEventsData?.[selectedEventKey]) ? cachedEventsData[selectedEventKey] : null;
  const hasMcTruth = Array.isArray(ev?.Tracks?.["MC Truth"]) && ev.Tracks["MC Truth"].length > 0;
  const pidPick = selectPidForTrack(ev, trackInfo?.trackId, trackInfo);
  pidDebugState.pidLookupEventKey = selectedEventKey;
  pidDebugState.pidLookupTrackId = Number(trackInfo?.trackId);
  pidDebugState.pidLookupHit = Boolean(pidPick?.hit);
  pidDebugState.pidLookupCollection = pidPick?.collection || "";
  pidDebugState.pidLookupMatchedCount = Number(pidPick?.matchedCount ?? 0);
  pidDebugState.pidLookupChosenTrackId = Number.isFinite(Number(pidPick?.chosenTrackId))
    ? Number(pidPick?.chosenTrackId)
    : null;
  pidDebugState.pidLookupChosenHasPidField = Boolean(pidPick?.chosenHasPidField);
  pidDebugState.pidLookupPidKeys = pidPick?.pidKeys || "";
  pidDebugState.pidLookupPidPreview = pidPick?.pidPreview || "";
  pidDebugState.pidLookupChosenTrackKeys = pidPick?.chosenTrackKeys || "";
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
      const pTruth = estimateTruthMomentumMagnitude(truthObj);
      rows.push(
        `<div class="kv"><strong>Truth Match:</strong> pdg=${truth.pdg}, p=${Number.isFinite(pTruth) ? pTruth.toFixed(3) : "N/A"} GeV/c</div>`,
      );
    }
  }
  const topText = top.length ? top.map((x) => `${x.name}:${formatPidValue(Number(x.score))}`).join(" | ") : "N/A";
  const probText = ["electron", "muon", "pion", "kaon", "proton"]
    .map((k) => `${k}:${formatPidValue(Number(normalizedProb?.[k]))}`)
    .join(" | ");
  trackInfoPanelEl.innerHTML = `<h4>Track Detail</h4>${rows.join("")}<div class="pid"><div><strong>PID Top:</strong> ${topText}</div><div style="margin-top:4px;"><strong>PID Prob:</strong> ${probText}</div></div>`;
  trackInfoPanelEl.classList.add("open");
}

function refreshTrackSelectionVisuals() {
  if (!currentOverlayGroup) return;
  currentOverlayGroup.traverse((obj) => {
    const ud = obj?.userData || {};
    if (!(ud.kind === "track" || ud.kind === "track_points")) return;
    const tid = Number(ud.trackId);
    const isHover = interactionState.pidMode && interactionState.hoveredTrackId !== null && tid === Number(interactionState.hoveredTrackId);
    const isSelected = interactionState.selectedTrackId !== null && tid === Number(interactionState.selectedTrackId);
    const mats = Array.isArray(obj?.material) ? obj.material : [obj?.material];
    mats.forEach((mat) => {
      if (!mat) return;
      const baseOpacity = Number(
        ud.kind === "track_points"
          ? (ud.mode === "mc" ? 0.88 : 0.86)
          : (ud.mode === "mc" ? 0.94 : (ud.mode === "helix5" ? 0.8 : 0.92)),
      );
      if (isSelected) {
        mat.opacity = Math.min(1.0, baseOpacity + 0.08);
        if (mat.color?.setHex) mat.color.setHex(0xd9d9d9);
        if (ud.kind === "track_points" && Number.isFinite(mat.size)) mat.size = 5.4;
      } else if (isHover) {
        mat.opacity = Math.min(1.0, baseOpacity + 0.06);
        if (ud.kind === "track_points" && Number.isFinite(mat.size)) mat.size = 4.6;
      } else {
        mat.opacity = baseOpacity;
        if (ud.kind === "track_points" && Number.isFinite(mat.size)) {
          mat.size = ud.mode === "mc" ? 4.2 : 3.6;
        }
        if (mat.color?.setHex) {
          const fallback = ud.mode === "helix5" ? 0x6bb8ff : (ud.mode === "mc" ? 0x40c4ff : 0xff6161);
          mat.color.setHex(fallback);
        }
      }
      mat.needsUpdate = true;
    });
  });
}

async function bindTrackInteractionsIfNeeded() {
  updateInteractionCursor();
  const canvas = document.getElementById("three-canvas") || viewerEl.querySelector("canvas");
  if (!canvas) {
    // Keep interaction alive even when internal canvas is delayed/recreated.
    interactionCanvas = viewerEl;
    pidDebugState.bound = viewerEl.dataset.pidBound === "1";
    pidDebugState.pidMode = interactionState.pidMode;
    pidDebugState.candidates = getTrackCandidateObjects().length;
    pidDebugState.bindingTarget = "viewer-fallback";
    updatePidDebugPanel();
  }
  if (interactionCanvas === canvas && viewerEl.dataset.pidBound === "1") {
    updateInteractionCursor();
    pidDebugState.bound = true;
    pidDebugState.pidMode = interactionState.pidMode;
    pidDebugState.candidates = getTrackCandidateObjects().length;
    updatePidDebugPanel();
    return;
  }
  interactionCanvas = canvas;
  pidDebugState.bindingTarget = canvas?.id ? `canvas#${canvas.id}` : "canvas(anonymous)";
  const THREE = await getThree();
  raycaster.instance = new THREE.Raycaster();
  raycaster.mouse = new THREE.Vector2();
  raycaster.instance.params.Line.threshold = 36;
  raycaster.instance.params.Points.threshold = 28;

  const getMainCamera = () => {
    const tm = currentEventDisplay?.getThreeManager?.();
    const sm = tm?.getSceneManager?.();
    const controls =
      tm?.controlsManager?.getMainControls?.() ||
      tm?.getControlsManager?.()?.getMainControls?.();
    const controlsCamera = controls?.object;
    if (controlsCamera?.isCamera) {
      pidDebugState.cameraSource = "mainControls.object";
      return controlsCamera;
    }
    const managerMainCamera =
      tm?.controlsManager?.getMainCamera?.() ||
      tm?.getControlsManager?.()?.getMainCamera?.();
    if (managerMainCamera?.isCamera) {
      pidDebugState.cameraSource = "controlsManager.getMainCamera";
      return managerMainCamera;
    }
    const scene = sm?.getScene?.();
    if (scene?.traverse) {
      let cam = null;
      scene.traverse((obj) => {
        if (!cam && obj?.isCamera) cam = obj;
      });
      if (cam) {
        pidDebugState.cameraSource = "scene.traverse";
        return cam;
      }
    }

    // Deep fallback: recursively search camera-like object on manager trees.
    const deepFindCamera = (root, maxDepth = 5) => {
      const seen = new Set();
      const stack = [{ node: root, depth: 0 }];
      while (stack.length > 0) {
        const { node, depth } = stack.pop();
        if (!node || depth > maxDepth) continue;
        if (typeof node === "object") {
          if (seen.has(node)) continue;
          seen.add(node);
        }
        if (node?.isCamera || (node?.projectionMatrix && node?.matrixWorldInverse)) {
          return node;
        }
        if (typeof node !== "object") continue;
        for (const key of Object.keys(node)) {
          let child = null;
          try {
            child = node[key];
          } catch (e) {
            child = null;
          }
          if (!child) continue;
          if (Array.isArray(child)) {
            for (const c of child) stack.push({ node: c, depth: depth + 1 });
          } else if (typeof child === "object") {
            stack.push({ node: child, depth: depth + 1 });
          }
        }
      }
      return null;
    };

    const deepCam = deepFindCamera(tm) || deepFindCamera(sm) || deepFindCamera(currentEventDisplay);
    if (deepCam) {
      pidDebugState.cameraSource = "deepFindCamera";
      return deepCam;
    }
    const fallback = (
      tm?.controlsManager?.getMainCamera?.() ||
      tm?.getControlsManager?.()?.getMainCamera?.() ||
      tm?.getMainCamera?.() ||
      tm?.cameraManager?.getMainCamera?.() ||
      tm?.camera ||
      null
    );
    pidDebugState.cameraSource = fallback ? "manager-fallback" : "none";
    return fallback;
  };

  const pickTrackByScreenProximity = (evt) => {
    const camera = getMainCamera();
    if (!camera) return null;
    const rect = interactionCanvas?.getBoundingClientRect?.() || viewerEl.getBoundingClientRect();
    const mx = evt.clientX - rect.left;
    const my = evt.clientY - rect.top;
    const maxDistPx = 40;
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;

    const tracks = getPidSelectableTrackObjects().filter((o) => {
      const k = o?.userData?.kind;
      return k === "track_points" || k === "track";
    });
    for (const obj of tracks) {
      const tid = Number(obj?.userData?.trackId);
      if (!Number.isFinite(tid)) continue;
      const posAttr = obj?.geometry?.attributes?.position;
      if (!posAttr || !posAttr.count) continue;
      const world = obj.matrixWorld;
      for (let i = 0; i < posAttr.count; i += 1) {
        const v = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        v.applyMatrix4(world).project(camera);
        if (v.z < -1 || v.z > 1) continue;
        const sx = (v.x * 0.5 + 0.5) * rect.width;
        const sy = (-v.y * 0.5 + 0.5) * rect.height;
        const d = Math.hypot(sx - mx, sy - my);
        if (d < bestDist) {
          bestDist = d;
          best = tid;
        }
      }
    }
    return bestDist <= maxDistPx ? best : null;
  };

  const pickTrackByRayDistance = (evt) => {
    const camera = getMainCamera();
    if (!camera) return null;
    const rect = interactionCanvas?.getBoundingClientRect?.() || viewerEl.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((evt.clientX - rect.left) / rect.width) * 2 - 1,
      -((evt.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const localRaycaster = new THREE.Raycaster();
    localRaycaster.setFromCamera(ndc, camera);
    const ray = localRaycaster.ray;
    let bestTid = null;
    let bestSq = Number.POSITIVE_INFINITY;
    const segA = new THREE.Vector3();
    const segB = new THREE.Vector3();
    const tmpOnRay = new THREE.Vector3();
    const tmpOnSeg = new THREE.Vector3();
    const tracks = getPidSelectableTrackObjects();
    for (const obj of tracks) {
      const tid = Number(obj?.userData?.trackId);
      if (!Number.isFinite(tid)) continue;
      const posAttr = obj?.geometry?.attributes?.position;
      if (!posAttr || posAttr.count < 2) continue;
      for (let i = 1; i < posAttr.count; i += 1) {
        segA.set(posAttr.getX(i - 1), posAttr.getY(i - 1), posAttr.getZ(i - 1)).applyMatrix4(obj.matrixWorld);
        segB.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(obj.matrixWorld);
        const sq = ray.distanceSqToSegment(segA, segB, tmpOnRay, tmpOnSeg);
        if (sq < bestSq) {
          bestSq = sq;
          bestTid = tid;
        }
      }
    }
    return bestSq <= 36.0 ? bestTid : null;
  };

  const pickTrack = (evt) => {
    if (!interactionState.pidMode || !interactionCanvas) return null;
    const rect = interactionCanvas?.getBoundingClientRect?.() || viewerEl.getBoundingClientRect();
    pidDebugState.mouseX = Number((evt.clientX - rect.left).toFixed(1));
    pidDebugState.mouseY = Number((evt.clientY - rect.top).toFixed(1));
    raycaster.mouse.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
    raycaster.mouse.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
    const camera = getMainCamera();
    pidDebugState.camera = Boolean(camera);
    pidDebugState.candidates = getPidSelectableTrackObjects().length;
    camera?.updateMatrixWorld?.(true);
    if (!camera) {
      const tidFallback = pickTrackByScreenProximity(evt);
      pidDebugState.lastPickTrackId = tidFallback;
      updatePidDebugPanel();
      return tidFallback;
    }
    raycaster.instance.setFromCamera(raycaster.mouse, camera);
    const hits = raycaster.instance.intersectObjects(getPidSelectableTrackObjects(), false);
    if (hits.length) {
      const tidRay = Number(hits[0]?.object?.userData?.trackId);
      pidDebugState.lastPickTrackId = tidRay;
      updatePidDebugPanel();
      return tidRay;
    }
    // Geometry-independent fallback: choose nearest projected track point.
    const tidFallback = pickTrackByScreenProximity(evt);
    if (Number.isFinite(Number(tidFallback))) {
      pidDebugState.lastPickTrackId = tidFallback;
      updatePidDebugPanel();
      return tidFallback;
    }
    const tidRayDist = pickTrackByRayDistance(evt);
    pidDebugState.lastPickTrackId = tidRayDist;
    updatePidDebugPanel();
    return tidRayDist;
  };

  const onMove = (evt) => {
    if (!interactionState.pidMode) {
      interactionState.hoveredTrackId = null;
      pidDebugState.hoverTrackId = null;
      hideTrackHoverTip();
      updateInteractionCursor();
      updatePidDebugPanel();
      return;
    }
    const tid = pickTrack(evt);
    interactionState.hoveredTrackId = tid;
    pidDebugState.hoverTrackId = tid;
    if (tid !== null && tid !== undefined && Number.isFinite(Number(tid))) {
      const info = getTrackInfoById(tid);
      const msg = info?.mode === "mc"
        ? `Truth track ${tid}`
        : `Track ${tid} (click for PID)`;
      showTrackHoverTip(evt.clientX, evt.clientY, msg);
    } else {
      hideTrackHoverTip();
    }
    updateInteractionCursor();
    updatePidDebugPanel();
    refreshTrackSelectionVisuals();
  };

  const onLeave = () => {
    interactionState.hoveredTrackId = null;
    pidDebugState.hoverTrackId = null;
    hideTrackHoverTip();
    updateInteractionCursor();
    updatePidDebugPanel();
    refreshTrackSelectionVisuals();
  };

  const onClick = (evt) => {
    if (!interactionState.pidMode) return;
    const tid = pickTrack(evt);
    if (tid === null || tid === undefined || !Number.isFinite(Number(tid))) return;
    const info = getTrackInfoById(tid);
    if (!info || info?.mode === "mc") return;
    interactionState.selectedTrackId = tid;
    pidDebugState.selectedTrackId = tid;
    renderTrackInfoPanel(info);
    if (trackInfoPanelEl) {
      trackInfoPanelEl.classList.add("flash");
      setTimeout(() => trackInfoPanelEl.classList.remove("flash"), 160);
    }
    updatePidDebugPanel();
    refreshTrackSelectionVisuals();
  };

  const onMouseDown = (evt) => {
    selectionMouseDownPos = { x: evt.clientX, y: evt.clientY };
  };
  const onMouseUp = (evt) => {
    if (!interactionState.pidMode) return;
    if (!selectionMouseDownPos) return;
    const dx = evt.clientX - selectionMouseDownPos.x;
    const dy = evt.clientY - selectionMouseDownPos.y;
    selectionMouseDownPos = null;
    const dist = Math.hypot(dx, dy);
    // LHCb-style click-vs-drag guard: ignore drag release.
    if (dist <= 10) onClick(evt);
  };

  // Use capture phase so Phoenix controls cannot swallow the events first.
  canvas.addEventListener("mousemove", onMove, true);
  canvas.addEventListener("mouseleave", onLeave, true);
  canvas.addEventListener("mousedown", onMouseDown, true);
  canvas.addEventListener("mouseup", onMouseUp, true);
  viewerEl.addEventListener("pointermove", onMove, true);
  viewerEl.addEventListener("pointerleave", onLeave, true);
  viewerEl.addEventListener("click", onClick, true);

  if (!globalPointerBound) {
    const isInsideViewer = (evt) => {
      const rect = viewerEl.getBoundingClientRect();
      const x = evt.clientX;
      const y = evt.clientY;
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };
    // Hard fallback: listen at window capture phase.
    window.addEventListener("pointermove", (evt) => {
      if (!interactionState.pidMode) return;
      if (isInsideViewer(evt)) onMove(evt);
      else onLeave();
    }, true);
    window.addEventListener("click", (evt) => {
      if (!interactionState.pidMode) return;
      if (isInsideViewer(evt)) onClick(evt);
    }, true);
    // Mouse-event fallback for environments where pointer events are unavailable.
    window.addEventListener("mousemove", (evt) => {
      if (!interactionState.pidMode) return;
      if (isInsideViewer(evt)) onMove(evt);
      else onLeave();
    }, true);
    window.addEventListener("mouseup", (evt) => {
      if (!interactionState.pidMode) return;
      if (isInsideViewer(evt)) onClick(evt);
    }, true);
    globalPointerBound = true;
  }
  viewerEl.dataset.pidBound = "1";
  if (canvas) {
    canvas.style.cursor = interactionState.pidMode ? "pointer" : "default";
  }
  pidDebugState.bound = true;
  pidDebugState.pidMode = interactionState.pidMode;
  pidDebugState.candidates = getTrackCandidateObjects().length;
  startPidDebugTick();
  updatePidDebugPanel();
}

function scheduleBindTrackInteractions() {
  const attemptBind = async () => {
    try {
      await bindTrackInteractionsIfNeeded();
      // Continue a few retries in case Phoenix canvas/overlay appears late.
      if (viewerEl.dataset.pidBound !== "1" && bindRetryCount < 12) {
        bindRetryCount += 1;
        setTimeout(attemptBind, 250);
      }
    } catch (err) {
      console.warn("track interaction bind retry failed:", err);
      if (bindRetryCount < 12) {
        bindRetryCount += 1;
        setTimeout(attemptBind, 250);
      }
    }
  };
  bindRetryCount = 0;
  setTimeout(attemptBind, 0);
}

function setStatus(text, klass) {
  statusEl.textContent = text;
  statusEl.className = klass;
  if (loaderStatusEl) loaderStatusEl.textContent = text;
  if (klass === "ok") {
    setLoaderProgress(100);
    hideLoaderOverlay(200);
  } else if (klass === "warn" || klass === "err") {
    setLoaderProgress(96);
    hideLoaderOverlay(300);
  } else {
    setLoaderProgress(Math.min(92, loaderProgressValue + 8));
  }
}

function setLoaderProgress(v) {
  loaderProgressValue = Math.max(0, Math.min(100, Number(v) || 0));
  if (loaderProgressBarEl) loaderProgressBarEl.style.width = `${loaderProgressValue}%`;
}

function hideLoaderOverlay(delayMs = 0) {
  if (!appLoaderEl) return;
  window.setTimeout(() => {
    appLoaderEl.classList.add("load-complete");
  }, Math.max(0, Number(delayMs) || 0));
}

function startLoaderProgressPulse() {
  if (!appLoaderEl || appLoaderEl.classList.contains("load-complete")) return;
  setLoaderProgress(12);
  const tick = () => {
    if (!appLoaderEl || appLoaderEl.classList.contains("load-complete")) return;
    setLoaderProgress(Math.min(88, loaderProgressValue + (loaderProgressValue < 40 ? 8 : 3)));
    window.setTimeout(tick, 260);
  };
  window.setTimeout(tick, 260);
}

async function getThree() {
  if (!cachedThreeModule) {
    cachedThreeModule = await import("three");
  }
  return cachedThreeModule;
}

function setupEventUi(eventsData) {
  const keys = Object.keys(eventsData || {});
  if (!eventSelectEl) return keys[0] || "";
  eventSelectEl.innerHTML = "";
  keys.forEach((k, idx) => {
    const ev = eventsData[k] || {};
    const op = document.createElement("option");
    op.value = k;
    const rec = ev?.recFile || "rec";
    const rn = Number(ev?.runNumber ?? -1);
    const en = Number(ev?.eventNumber ?? -1);
    op.textContent = `${idx + 1}. run ${rn} evt ${en} (${rec})`;
    eventSelectEl.appendChild(op);
  });
  const selected = keys.includes(selectedEventKeyFromQuery) ? selectedEventKeyFromQuery : (keys[0] || "");
  if (selected) eventSelectEl.value = selected;
  eventSelectEl.onchange = () => renderSelectedEventOverlay();
  return selected;
}

function setupMcTruthUi(ev) {
  const mcArr = Array.isArray(ev?.Tracks?.["MC Truth"]) ? ev.Tracks["MC Truth"] : [];
  const hasMc = mcArr.length > 0;
  if (mcTruthWrapEl) mcTruthWrapEl.style.display = "none";
  if (btnTruthModeEl) btnTruthModeEl.style.display = hasMc ? "inline-block" : "none";
  if (chkMcTruthEl) {
    chkMcTruthEl.checked = hasMc && showMcFromQuery;
    chkMcTruthEl.onchange = () => renderSelectedEventOverlay();
  }
  if (hasMc && !interactionState.truthMode && showTruthFromQuery) {
    interactionState.truthMode = true;
  }
  if (!hasMc) interactionState.truthMode = false;
  if (btnTruthModeEl) {
    btnTruthModeEl.style.background = interactionState.truthMode
      ? "rgba(72, 104, 150, 0.95)"
      : "rgba(20, 28, 40, 0.9)";
  }
  return hasMc && interactionState.truthMode;
}

async function loadPhoenix() {
  eventStatusTouched = false;
  await ensurePhoenixLoaded();
  const EventDisplay = phoenixCtor;
  const apiObj = phoenixApi || window.EventDisplay;

  const entries = getGeometryEntries();

  // Mode A: constructor API
  if (typeof EventDisplay === "function") {
    const eventDisplay = new EventDisplay({
      element: viewerEl,
      defaultConfig: { autoplay: false },
    });

    if (typeof eventDisplay.loadRootJSONGeometry !== "function") {
      throw new Error("loadRootJSONGeometry() is unavailable in this Phoenix build");
    }

    for (const entry of entries) {
      // Give each loaded geometry a deterministic name (mdc/tof/muc/emc/...)
      await eventDisplay.loadRootJSONGeometry(entry.path, entry.key);
    }
    currentEventDisplay = eventDisplay;
    applyDetectorOpacityFromUi(eventDisplay);
    await adjustPhoenixCamera(eventDisplay);
    return;
  }

  // Mode B: pre-initialized global object API
  if (apiObj && typeof apiObj.loadRootJSONGeometry === "function") {
    for (const entry of entries) {
      await apiObj.loadRootJSONGeometry(entry.path, entry.key);
    }
    currentEventDisplay = apiObj;
    applyDetectorOpacityFromUi(apiObj);
    return;
  }

  throw new Error(
    `Phoenix API not usable (ctor=${typeof EventDisplay}, objectLoader=${
      apiObj && typeof apiObj.loadRootJSONGeometry
    })`,
  );
}

async function tryLoadPhoenixEventData(eventDisplay) {
  eventStatusTouched = true;
  try {
    const eventUrl = `${eventJsonPath}${eventJsonPath.includes("?") ? "&" : "?"}v=${Date.now()}`;
    const resp = await fetch(eventUrl, { cache: "no-store" });
    if (!resp.ok) {
      setStatus(`Phoenix geometry loaded (event fetch failed: HTTP ${resp.status})`, "warn");
      return;
    }
    const data = await resp.json();
    cachedEventsData = data;
    const selectedEventKey = setupEventUi(cachedEventsData);
    const selectedEvent = (selectedEventKey && cachedEventsData?.[selectedEventKey]) ? cachedEventsData[selectedEventKey] : null;
    const showMc = setupMcTruthUi(selectedEvent || {});
    let helixSignature = "";
    if (selectedEvent) {
      const ev = selectedEvent;
      const h5 = Array.isArray(ev?.Tracks?.["REC MdcTrack (helix5)"]) ? ev.Tracks["REC MdcTrack (helix5)"] : [];
      if (h5.length > 0) {
        const src = h5[0]?.helix5_debug?.phi_source || "unknown";
        helixSignature = ` | helix=${src}`;
      }
    }
    const n = await buildCustomEventOverlay(eventDisplay, cachedEventsData, selectedEventKey, showMc);
    if (n > 0) {
      setStatus(`Phoenix geometry+event loaded (event=${selectedEventKey || "N/A"}, ${n} objects)${helixSignature}`, "ok");
    } else {
      setStatus("Phoenix geometry loaded (event parsed but no drawable objects)", "warn");
    }
  } catch (err) {
    const reason = err?.message || String(err);
    console.warn("Event JSON load failed:", reason);
    setStatus(`Phoenix geometry loaded (event load failed: ${reason})`, "warn");
  }
}

function applyDetectorOpacityFromUi(eventDisplay) {
  assembledComponents.forEach((component) => {
    const alpha = Number(component.alphaEl?.value ?? component.defaultAlpha);
    // Keep MDC/TOF/MUC native material appearance when opacity is default 1.0.
    // Old version only forced EMC transparency.
    if (component.key !== "emc" && alpha >= 0.999) return;
    applyOpacityToNamedGeometry(eventDisplay, component.key, alpha);
  });
}

async function renderSelectedEventOverlay() {
  if (!currentEventDisplay || !cachedEventsData) return;
  const selectedEventKey = eventSelectEl?.value || "";
  const selectedEvent = (selectedEventKey && cachedEventsData?.[selectedEventKey]) ? cachedEventsData[selectedEventKey] : null;
  const showMc = setupMcTruthUi(selectedEvent || {});
  await buildCustomEventOverlay(currentEventDisplay, cachedEventsData, selectedEventKey, showMc);
  await bindTrackInteractionsIfNeeded();
}

function estimateEventTimeRange(ev, tracks, mdcHits, emcHits, tofHits, mucHits) {
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

function updateTimelineUi() {
  const span = Math.max(1e-6, timelineState.maxNs - timelineState.minNs);
  const frac = (timelineState.currentNs - timelineState.minNs) / span;
  if (timelineSliderEl) timelineSliderEl.value = String(Math.max(0, Math.min(1000, Math.round(frac * 1000))));
  if (timelineTimeEl) timelineTimeEl.textContent = `${timelineState.currentNs.toFixed(2)} ns`;
}

function applyTimelineToOverlay() {
  if (!currentOverlayGroup) {
    updateTimelineUi();
    return;
  }
  if (!timelineState.enabled) {
    currentOverlayGroup.traverse((obj) => {
      if (!obj?.userData?.kind) return;
      obj.visible = true;
      const ud = obj.userData || {};
      if (obj.geometry?.setDrawRange && ud.pointCount) {
        obj.geometry.setDrawRange(0, ud.pointCount);
      }
    });
    updateTimelineUi();
    return;
  }
  const now = timelineState.currentNs;
  currentOverlayGroup.traverse((obj) => {
    const ud = obj.userData || {};
    const t0 = Number(ud.timeStartNs);
    const t1 = Number(ud.timeEndNs);
    if (!Number.isFinite(t0)) return;
    const visible = now >= t0;
    obj.visible = visible;
    if (!visible) return;
    if (Number.isFinite(t1) && t1 > t0 && obj.geometry?.setDrawRange && ud.pointCount) {
      const frac = Math.max(0, Math.min(1, (now - t0) / (t1 - t0)));
      const drawCount = Math.max(2, Math.floor(frac * ud.pointCount));
      obj.geometry.setDrawRange(0, drawCount);
    }
  });
  updateTimelineUi();
}

function ensureTimelineAnimation() {
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
    applyTimelineToOverlay();
    animationFrameId = window.requestAnimationFrame(step);
  };
  animationFrameId = window.requestAnimationFrame(step);
}

async function buildCustomEventOverlay(eventDisplay, eventsData, selectedEventKey = "", showMcTruth = false) {
  const allKeys = Object.keys(eventsData || {});
  const eventKey = allKeys.includes(selectedEventKey) ? selectedEventKey : allKeys[0];
  if (!eventKey) return 0;
  const ev = eventsData[eventKey] || {};
  const trkMode = helixDebugEnabled ? (trackModeSelectEl?.value || "stable") : "stable";
  const trackStable = Array.isArray(ev?.Tracks?.["REC MdcTrack (stable)"]) ? ev.Tracks["REC MdcTrack (stable)"] : [];
  const trackHelix5 = Array.isArray(ev?.Tracks?.["REC MdcTrack (helix5)"]) ? ev.Tracks["REC MdcTrack (helix5)"] : [];
  const trackMc = Array.isArray(ev?.Tracks?.["MC Truth"]) ? ev.Tracks["MC Truth"] : [];
  const mdcHits = Array.isArray(ev?.Hits?.["REC MdcHit"]) ? ev.Hits["REC MdcHit"] : [];
  const emcHits = Array.isArray(ev?.Hits?.["REC EmcHit"]) ? ev.Hits["REC EmcHit"] : [];
  const tofHits = Array.isArray(ev?.Hits?.["REC TofHit"]) ? ev.Hits["REC TofHit"] : [];
  const mucHits = Array.isArray(ev?.Hits?.["REC MucHit"]) ? ev.Hits["REC MucHit"] : [];
  let tracks = [];
  if (trkMode === "stable") tracks = [...trackStable];
  else if (trkMode === "helix5") tracks = [...trackHelix5];
  else tracks = [...trackStable, ...trackHelix5];
  if (showMcTruth) tracks.push(...trackMc);
  if (tracks.length === 0 && ev?.Tracks) {
    tracks = Object.values(ev.Tracks).flat();
  }
  const clusters = ev?.CaloClusters ? Object.values(ev.CaloClusters).flat() : [];
  const eventTime = estimateEventTimeRange(ev, tracks, mdcHits, emcHits, tofHits, mucHits);
  const emcTimeValues = emcHits
    .map((h) => Number(h?.time))
    .filter((v) => Number.isFinite(v) && v >= 0);
  const emcTimeMin = emcTimeValues.length ? Math.min(...emcTimeValues) : NaN;
  const emcTimeMax = emcTimeValues.length ? Math.max(...emcTimeValues) : NaN;

  const tm = eventDisplay?.getThreeManager?.();
  const sm = tm?.getSceneManager?.();
  const scene = sm?.getScene?.();
  if (!scene) return 0;

  const THREE = await getThree();
  const overlayName = "BESIII_REC_EVENT_OVERLAY";
  const old = scene.getObjectByName(overlayName);
  if (old) {
    scene.remove(old);
  }

  const group = new THREE.Group();
  group.name = overlayName;
  currentOverlayGroup = group;
  trackCandidateCache = [];
  timelineState.minNs = eventTime.minNs;
  timelineState.maxNs = eventTime.maxNs;
  timelineState.currentNs = timelineState.enabled ? eventTime.minNs : eventTime.maxNs;
  let count = 0;
  // Scene-space EMC radius. If EMC geometry is hidden, use a stable BESIII fallback.
  const emcRadiusHint = estimateEmcRadius(scene, THREE) ?? 95.0;

  for (const t of tracks) {
    const pos = t?.pos || [];
    if (!Array.isArray(pos) || pos.length < 2) continue;
    const points = pos
      .filter((p) => Array.isArray(p) && p.length >= 3)
      .map((p) => scaleEventPoint(p))
      .map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    if (points.length < 2) continue;
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: t?.mode === "helix5" ? 0x42a5f5 : (t?.mode === "mc" ? 0x29b6f6 : 0xff4d4d),
      transparent: true,
      opacity: t?.mode === "helix5" ? 0.8 : (t?.mode === "mc" ? 0.95 : 0.92),
      depthTest: false,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 999;
    let lengthMm = 0;
    for (let i = 1; i < points.length; i += 1) {
      lengthMm += points[i].distanceTo(points[i - 1]);
    }
    const pGeV = Number(t?.pt_debug?.p_est ?? 0.6);
    const beta = pGeV > 0 ? pGeV / Math.sqrt(pGeV * pGeV + 0.13957 * 0.13957) : 0.9;
    const dtNs = lengthMm / Math.max(1e-6, beta * C_MM_PER_NS);
    const normalizedTrackId = Number.isFinite(Number(t?.trackId))
      ? Number(t.trackId)
      : (Number.isFinite(Number(t?.id)) ? Number(t.id) : (count + 1));
    line.userData = {
      kind: "track",
      ...t,
      trackId: normalizedTrackId,
      pointCount: points.length,
      timeStartNs: eventTime.minNs,
      timeEndNs: eventTime.minNs + dtNs,
    };
    group.add(line);
    trackCandidateCache.push(line);
    // Add dense luminous points to improve track visibility.
    const pointsMat = new THREE.PointsMaterial({
      color: t?.mode === "helix5" ? 0x6bb8ff : (t?.mode === "mc" ? 0x40c4ff : 0xff6161),
      size: t?.mode === "mc" ? 4.2 : 3.6,
      sizeAttenuation: true,
      transparent: true,
      opacity: t?.mode === "mc" ? 0.88 : 0.86,
      depthTest: false,
      depthWrite: false,
    });
    const pointsObj = new THREE.Points(geo.clone(), pointsMat);
    pointsObj.renderOrder = 998;
    pointsObj.userData = { ...line.userData, kind: "track_points" };
    group.add(pointsObj);
    trackCandidateCache.push(pointsObj);
    count += 1;
  }

  for (const c of clusters) {
    let x;
    let y;
    let z;
    if (Array.isArray(c?.pos) && c.pos.length >= 3) {
      [x, y, z] = c.pos;
    } else {
      const r = Number(c?.radius ?? 0);
      const th = Number(c?.theta ?? 0);
      const ph = Number(c?.phi ?? 0);
      if (!Number.isFinite(r) || !Number.isFinite(th) || !Number.isFinite(ph)) continue;
      x = r * Math.sin(th) * Math.cos(ph);
      y = r * Math.sin(th) * Math.sin(ph);
      z = r * Math.cos(th);
    }
    const e = Math.max(0, Number(c?.energy ?? 0));
    // Project showers to EMC shell in scene-space, even if EMC geometry is hidden.
    const rr = Math.sqrt(x * x + y * y + z * z);
    if (Number.isFinite(emcRadiusHint) && emcRadiusHint > 1 && Number.isFinite(rr) && rr > 1) {
      const scale = emcRadiusHint / rr;
      x *= scale;
      y *= scale;
      z *= scale;
    }
    // Render shower with bright tiered color and larger size contrast.
    const tcol = Math.max(0, Math.min(1, e / 1000.0));
    const side = Math.max(8, Number(c?.side ?? 20));
    // Stronger non-linear size mapping so high-energy showers stand out clearly.
    const sizeBoost = 0.55 + 3.6 * Math.pow(tcol, 2.2);
    const boxSide = Math.max(8, Math.min(78, side * 0.15 + 62.0 * Math.pow(tcol, 2.05) + side * 0.18 * sizeBoost));
    let colorHex = 0xffff66;
    if (tcol > 0.25) colorHex = 0xffee58;
    if (tcol > 0.5) colorHex = 0xffc107;
    if (tcol > 0.75) colorHex = 0xff8f00;
    if (tcol > 0.9) colorHex = 0xff3d00;
    const color = new THREE.Color(colorHex);
    const geo = new THREE.BoxGeometry(boxSide, boxSide, boxSide);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.97,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const hit = new THREE.Mesh(geo, mat);
    hit.position.set(x, y, z);
    // Keep shower marker visible above EMC crystal overlays.
    hit.renderOrder = 1200;
    const clusterTimeRaw = Number(c?.time);
    const showerStartNs = Number.isFinite(clusterTimeRaw) && clusterTimeRaw >= 0
      ? clusterTimeRaw
      : (Number.isFinite(emcTimeMin) && Number.isFinite(emcTimeMax)
        ? (emcTimeMin + 0.55 * (emcTimeMax - emcTimeMin))
        : (eventTime.minNs + 0.45 * (eventTime.maxNs - eventTime.minNs)));
    hit.userData = { kind: "emc_shower", timeStartNs: showerStartNs, ...c };
    group.add(hit);
    count += 1;
  }

  // EMC crystal-hit style rendering (LHCb-like overlay semantics):
  // draw red overlay crystals, opacity mapped by deposited energy.
  if (emcHits.length) {
    const emcObj = scene.getObjectByName?.("emc");
    let rBarrel = emcRadiusHint || 95;
    let zHalf = 90;
    if (emcObj) {
      const box = new THREE.Box3().setFromObject(emcObj);
      if (!box.isEmpty()) {
        const size = box.getSize(new THREE.Vector3());
        rBarrel = Math.max(size.x, size.y) * 0.5;
        zHalf = Math.max(200, size.z * 0.5);
      }
    }
    // Merge hits by cellId so each crystal is drawn once.
    const cellMap = new Map();
    for (const h of emcHits) {
      const cellId = Number(h?.cellId ?? -1);
      if (cellId < 0) continue;
      const cur = cellMap.get(cellId);
      if (!cur) {
        cellMap.set(cellId, { ...h, energy: Math.max(0, Number(h?.energy ?? 0)) });
      } else {
        cur.energy += Math.max(0, Number(h?.energy ?? 0));
      }
    }
    const mergedHits = Array.from(cellMap.values());
    const emax = Math.max(...mergedHits.map((h) => Number(h.energy || 0)), 1e-6);

    for (const h of mergedHits) {
      const part = Number(h.part ?? 1);
      const thetaIdx = Number(h.theta ?? 0);
      const phiIdx = Number(h.phi ?? 0);
      const e = Math.max(0, Number(h.energy ?? 0));
      const frac = Math.max(0, Math.min(1, e / emax));

      let x = 0;
      let y = 0;
      let z = 0;
      let sx = 14;
      let sy = 14;
      let sz = 40;
      if (part === 1) {
        const nPhi = 120.0;
        const nTheta = 44.0;
        const phi = ((phiIdx + 0.5) / nPhi) * Math.PI * 2.0;
        const zNorm = (thetaIdx + 0.5) / nTheta;
        z = (zNorm - 0.5) * (zHalf * 1.15);
        const rr = Math.max(50, rBarrel * 0.98);
        x = rr * Math.cos(phi);
        y = rr * Math.sin(phi);
        sx = 10;
        sy = 18;
        sz = 34;
      } else {
        const nPhi = thetaIdx < 2 ? 64.0 : thetaIdx < 4 ? 80.0 : 96.0;
        const phi = ((phiIdx + 0.5) / nPhi) * Math.PI * 2.0;
        const ring = Math.max(0, Math.min(5, thetaIdx));
        const rMin = rBarrel * 0.22;
        const rMax = rBarrel * 0.95;
        const rr = rMin + ((ring + 0.5) / 6.0) * (rMax - rMin);
        x = rr * Math.cos(phi);
        y = rr * Math.sin(phi);
        z = (part === 0 ? -1 : 1) * (zHalf * 0.98);
        sx = 20;
        sy = 20;
        sz = 26;
      }

      const color = new THREE.Color(0xff2b2b);
      const geo = new THREE.BoxGeometry(sx, sy, sz);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.12 + 0.83 * frac,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const crystal = new THREE.Mesh(geo, mat);
      crystal.position.set(x, y, z);
      // Orient barrel overlays radially so they behave like bound crystal cells.
      if (part === 1) {
        crystal.lookAt(new THREE.Vector3(0, 0, z));
      }
      crystal.renderOrder = 1000;
      const th = Number(h?.time);
      crystal.userData = {
        kind: "emc_hit_crystal_overlay",
        timeStartNs: Number.isFinite(th) ? th : eventTime.minNs,
        ...h,
      };
      group.add(crystal);
      count += 1;
    }
  }

  // MDC wire-fire effect (hit-level): keep BesVis-like local fired style.
  // Do NOT draw full wire length, otherwise image becomes dense parallel streaks.
  for (const h of mdcHits) {
    if (!Array.isArray(h?.pos) || h.pos.length < 3) continue;
    const hp = scaleEventPoint(h.pos);
    const x = Number(hp[0]);
    const y = Number(hp[1]);
    const z = Number(hp[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const adc = Math.max(0, Number(h?.adc ?? 0));
    const t = Math.max(0, Math.min(1, adc / 800.0));
    const layer = Number(h?.layer ?? -1);
    const wireType = String(h?.wireType ?? "");
    const isStereo = wireType === "stereo";
    const col = new THREE.Color(0xff4d4d); // BesVis fired-wire style is red.
    let dir;
    if (Array.isArray(h?.wireDir) && h.wireDir.length >= 3) {
      dir = new THREE.Vector3(Number(h.wireDir[0]), Number(h.wireDir[1]), Number(h.wireDir[2]));
      if (!Number.isFinite(dir.x) || !Number.isFinite(dir.y) || !Number.isFinite(dir.z) || dir.lengthSq() < 1e-12) {
        dir = new THREE.Vector3(0, 0, 1);
      } else {
        dir.normalize();
      }
    } else {
      dir = new THREE.Vector3(0, 0, 1);
    }
    // Local fired segment around z-hit (previous style, but a bit more BesVis-like).
    const fireLen = (isStereo ? (22 + 30 * t) : (10 + 16 * t)) * EVENT_GLOBAL_R_SCALE;
    const pHit = new THREE.Vector3(x, y, z);
    const p0 = pHit.clone().addScaledVector(dir, -fireLen * 0.5);
    const p1 = pHit.clone().addScaledVector(dir, fireLen * 0.5);
    const coreGeo = new THREE.BufferGeometry().setFromPoints([
      p0,
      p1,
    ]);
    const coreMat = new THREE.LineBasicMaterial({
      color: col,
      transparent: true,
      opacity: isStereo ? (0.62 + 0.16 * t) : (0.48 + 0.18 * t),
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Line(coreGeo, coreMat);
    core.renderOrder = 1000;
    const tdc = Number(h?.tdc);
    core.userData = { kind: "mdc_hit_fire", timeStartNs: Number.isFinite(tdc) ? tdc : eventTime.minNs, ...h };
    group.add(core);

    if (isStereo) {
      // BesVis-like cone tail for stereo fired wires.
      const coneLen = 5 + 5 * t;
      const coneR = 0.7 + 0.45 * t;
      const coneGeo = new THREE.ConeGeometry(coneR, coneLen, 8, 1);
      const coneMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.48 + 0.16 * t,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      const coneAxis = dir.clone().normalize();
      cone.position.copy(p1).addScaledVector(coneAxis, -coneLen * 0.5);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), coneAxis);
      cone.renderOrder = 1001;
      cone.userData = { kind: "mdc_hit_cone", timeStartNs: Number.isFinite(tdc) ? tdc : eventTime.minNs, ...h };
      group.add(cone);
    }

    // BesVis "wire bubble": bright head at one end (for both axial/stereo).
    const headR = isStereo ? (2.0 + 2.0 * t) : (1.7 + 1.8 * t);
    const headPos = p1.clone();
    const glowGeo = new THREE.SphereGeometry(headR, 10, 10);
    const glowMat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: isStereo ? (0.26 + 0.18 * t) : (0.18 + 0.16 * t),
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(headPos);
    glow.renderOrder = 999;
    glow.userData = { kind: "mdc_hit_bubble", timeStartNs: Number.isFinite(tdc) ? tdc : eventTime.minNs, ...h };
    group.add(glow);
    count += 1;
  }

  // TOF hit style: cyan/orange bars (scintillator-like markers).
  for (const h of tofHits) {
    if (!Array.isArray(h?.pos) || h.pos.length < 3) continue;
    const p = scaleEventPoint(h.pos);
    const x = Number(p[0]), y = Number(p[1]), z = Number(p[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const sz = Array.isArray(h?.size) && h.size.length >= 3 ? h.size : [28, 56, 80];
    const sx = Math.max(6, Number(sz[0]) * EVENT_GLOBAL_R_SCALE);
    const sy = Math.max(6, Number(sz[1]) * EVENT_GLOBAL_R_SCALE);
    const ss = Math.max(6, Number(sz[2]) * EVENT_GLOBAL_R_SCALE);
    const isBarrel = Number(h?.part ?? 1) === 1;
    const col = isBarrel ? 0x4dd0e1 : 0xffb74d;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, ss),
      new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.55,
        depthTest: false,
        depthWrite: false,
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

  // MUC fired strip style: large RPC-like slabs.
  const mucObjForBounds = scene.getObjectByName?.("muc");
  let mucRMax = 260;
  let mucZHalf = 280;
  if (mucObjForBounds) {
    const mb = new THREE.Box3().setFromObject(mucObjForBounds);
    if (!mb.isEmpty()) {
      const ms = mb.getSize(new THREE.Vector3());
      mucRMax = Math.max(120, Math.max(ms.x, ms.y) * 0.5);
      mucZHalf = Math.max(120, ms.z * 0.5);
    }
  }
  for (const h of mucHits) {
    if (!Array.isArray(h?.pos) || h.pos.length < 3) continue;
    const p = scaleEventPoint(h.pos);
    let x = Number(p[0]), y = Number(p[1]), z = Number(p[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    // Keep MUC hits within detector envelope when MUC geometry is hidden.
    const rr = Math.hypot(x, y);
    if (!mucObjForBounds && rr > 1e-6) {
      const rClamp = Math.max(120, Math.min(mucRMax, rr));
      x = x * (rClamp / rr);
      y = y * (rClamp / rr);
      z = Math.max(-mucZHalf, Math.min(mucZHalf, z));
    }
    const sz = Array.isArray(h?.size) && h.size.length >= 3 ? h.size : [120, 320, 24];
    const sx = Math.max(10, Number(sz[0]) * EVENT_GLOBAL_R_SCALE);
    const sy = Math.max(10, Number(sz[1]) * EVENT_GLOBAL_R_SCALE);
    const ss = Math.max(4, Number(sz[2]) * EVENT_GLOBAL_R_SCALE);
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, ss),
      new THREE.MeshBasicMaterial({
        color: 0x81c784,
        transparent: true,
        opacity: 0.34,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    );
    slab.position.set(x, y, z);
    const bx = Array.isArray(h?.basisX) && h.basisX.length >= 3 ? h.basisX.map(Number) : null;
    const by = Array.isArray(h?.basisY) && h.basisY.length >= 3 ? h.basisY.map(Number) : null;
    const bz = Array.isArray(h?.basisZ) && h.basisZ.length >= 3 ? h.basisZ.map(Number) : null;
    if (bx && by && bz && bx.every(Number.isFinite) && by.every(Number.isFinite) && bz.every(Number.isFinite)) {
      const ex = new THREE.Vector3(bx[0], bx[1], bx[2]).normalize();
      const ey = new THREE.Vector3(by[0], by[1], by[2]).normalize();
      const ez = new THREE.Vector3(bz[0], bz[1], bz[2]).normalize();
      const rot = new THREE.Matrix4().makeBasis(ex, ey, ez);
      slab.quaternion.setFromRotationMatrix(rot);
    } else {
      slab.lookAt(new THREE.Vector3(0, 0, z));
    }
    slab.renderOrder = 992;
    const mucTdc = Number(h?.timeChannel);
    const mucT = Number.isFinite(mucTdc) && mucTdc >= 0 ? mucTdc : (Number(h?.depth) * 5.0);
    slab.userData = {
      kind: "muc_hit_strip",
      timeStartNs: Number.isFinite(mucT) ? mucT : eventTime.minNs,
      ...h,
    };
    group.add(slab);
    count += 1;
  }

  scene.add(group);
  applyTimelineToOverlay();
  return count;
}

function scaleEventPoint(p) {
  if (!Array.isArray(p) || p.length < 3) return [0, 0, 0];
  const x = Number(p[0]);
  const y = Number(p[1]);
  const z = Number(p[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return [0, 0, 0];
  return [x * EVENT_GLOBAL_R_SCALE, y * EVENT_GLOBAL_R_SCALE, z * EVENT_GLOBAL_R_SCALE];
}

function estimateMdcTransform(scene, THREE, mdcHits) {
  // Default: identity
  const tf = { enabled: false, rScale: 1.0, zScale: 1.0, rLayerMax: null, rGeomMax: null, zGeomHalf: null };
  try {
    const layerR = (mdcHits || [])
      .map((h) => Number(h?.layerRadius ?? NaN))
      .filter((v) => Number.isFinite(v) && v > 1);
    if (layerR.length < 10) return tf;
    const rLayerMax = Math.max(...layerR);
    if (!Number.isFinite(rLayerMax) || rLayerMax < 50) return tf;

    const mdcObj = scene.getObjectByName?.("mdc");
    if (!mdcObj) return tf;
    const box = new THREE.Box3().setFromObject(mdcObj);
    if (box.isEmpty()) return tf;
    const size = box.getSize(new THREE.Vector3());
    const rGeomMax = Math.max(size.x, size.y) * 0.5;
    const zGeomHalf = Math.max(1, size.z * 0.5);
    if (!Number.isFinite(rGeomMax) || rGeomMax < 1) return tf;

    const rScale = rGeomMax / rLayerMax;
    const zScale = zGeomHalf / 1400.0;
    // Enable only when clearly mismatched (cm/mm style mismatch).
    if (rScale < 0.3 || rScale > 3.0 || zScale < 0.3 || zScale > 3.0) {
      tf.enabled = true;
      tf.rScale = rScale;
      tf.zScale = zScale;
      tf.rLayerMax = rLayerMax;
      tf.rGeomMax = rGeomMax;
      tf.zGeomHalf = zGeomHalf;
    }
  } catch (e) {
    console.warn("estimateMdcTransform failed:", e);
  }
  return tf;
}

function applyMdcTransformPoint(p, tf) {
  if (!Array.isArray(p) || p.length < 3) return null;
  const x = Number(p[0]);
  const y = Number(p[1]);
  const z = Number(p[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  if (!tf?.enabled) return [x, y, z];
  const r = Math.hypot(x, y);
  const phi = Math.atan2(y, x);
  const rp = r * tf.rScale;
  return [rp * Math.cos(phi), rp * Math.sin(phi), z * tf.zScale];
}

function applyMdcTransformHit(h, tf) {
  const p = h?.pos;
  if (!Array.isArray(p) || p.length < 3) return [NaN, NaN, NaN];
  const x = Number(p[0]);
  const y = Number(p[1]);
  const z = Number(p[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return [NaN, NaN, NaN];
  if (!tf?.enabled) return [x, y, z];

  // Bind hit radius to layer radius mapping when available.
  const lr = Number(h?.layerRadius ?? NaN);
  const phi = Math.atan2(y, x);
  const rBase = Number.isFinite(lr) && lr > 1 ? lr : Math.hypot(x, y);
  const rp = rBase * tf.rScale;
  return [rp * Math.cos(phi), rp * Math.sin(phi), z * tf.zScale];
}

function estimateEmcRadius(scene, THREE) {
  try {
    const emcObj = scene.getObjectByName?.("emc");
    if (emcObj) {
      const box = new THREE.Box3().setFromObject(emcObj);
      if (!box.isEmpty()) {
        const size = box.getSize(new THREE.Vector3());
        // Barrel-like detector: radius estimate from XY extent.
        return Math.max(size.x, size.y) * 0.5;
      }
    }
  } catch (e) {
    console.warn("EMC radius estimate failed:", e);
  }
  return null;
}

function forceShowEventData(eventDisplay) {
  try {
    const tm = eventDisplay?.getThreeManager?.();
    const sm = tm?.getSceneManager?.();
    if (!tm || !sm) return;

    // Ensure event data is visible and drawn above detector where possible.
    tm.eventDataDepthTest?.(false);
    const evtGroup = sm.getEventData?.();
    if (!evtGroup) return;
    evtGroup.visible = true;

    evtGroup.traverse?.((obj) => {
      const mats = Array.isArray(obj?.material) ? obj.material : [obj?.material];
      mats.forEach((mat) => {
        if (!mat) return;
        mat.transparent = true;
        mat.opacity = 1.0;
        mat.depthTest = false;
        mat.depthWrite = false;
        if ("color" in mat && mat.color?.set) {
          mat.color.set(0xff4d4d);
        }
        mat.needsUpdate = true;
      });
    });
  } catch (err) {
    console.warn("Force show event data skipped:", err);
  }
}

function applyOpacityToNamedGeometry(eventDisplay, objectName, alpha = 0.1) {
  try {
    const tm = eventDisplay?.getThreeManager?.();
    const sm = tm?.getSceneManager?.();
    const geometries = sm?.getGeometries?.() || sm?.getScene?.();
    if (!geometries) return;
    const root = geometries.getObjectByName?.(objectName);
    if (!root) return;

    root.traverse((obj) => {
      const mats = Array.isArray(obj?.material) ? obj.material : [obj?.material];
      mats.forEach((mat) => {
        if (!mat) return;
        mat.transparent = true;
        mat.opacity = alpha;
        mat.depthWrite = false;
        mat.needsUpdate = true;
      });
    });
  } catch (err) {
    console.warn("Opacity adjustment for named geometry skipped:", err);
  }
}

async function adjustPhoenixCamera(eventDisplay) {
  try {
    const THREE = await getThree();
    const tm = eventDisplay?.getThreeManager?.();
    const sm = tm?.getSceneManager?.();
    const geometries = sm?.getGeometries?.();
    if (!geometries) return;

    const box = new THREE.Box3().setFromObject(geometries);
    if (!Number.isFinite(box.min.x) || box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.8 || 1000;

    // Lift camera and target a bit upward so geometry is not at bottom.
    const target = [center.x, center.y + size.y * 0.18, center.z];
    const pos = [center.x + radius * 0.55, center.y + radius * 0.85, center.z + radius * 1.15];

    if (typeof tm?.animateCameraTransform === "function") {
      tm.animateCameraTransform(pos, target, 0);
    }

    const controls = tm?.controlsManager?.getMainControls?.();
    const camera = tm?.controlsManager?.getMainCamera?.();
    if (controls?.target && camera?.position) {
      controls.target.set(target[0], target[1], target[2]);
      camera.position.set(pos[0], pos[1], pos[2]);
      controls.update?.();
    }
  } catch (err) {
    // Keep rendering even if camera adjustment is unavailable in this build.
    console.warn("Phoenix camera auto-adjust skipped:", err);
  }
}

async function ensurePhoenixLoaded() {
  if (phoenixCtor || phoenixApi) {
    return;
  }
  const errors = [];

  // First try CDN-transpiled ESM entry (dependency-resolved).
  const esmCandidates = [
    "https://cdn.jsdelivr.net/npm/phoenix-event-display@3.0.5/+esm",
    "https://cdn.jsdelivr.net/npm/phoenix-event-display@latest/+esm",
    "https://esm.sh/phoenix-event-display@3.0.5",
  ];
  for (const src of esmCandidates) {
    try {
      const mod = await import(src);
      const ctor = mod?.EventDisplay || mod?.default?.EventDisplay || mod?.default;
      if (typeof ctor === "function") {
        phoenixCtor = ctor;
        phoenixApi = null;
        return;
      }
      errors.push(`esm loaded but no ctor: ${src}`);
    } catch (err) {
      errors.push(`esm fail: ${src} :: ${err.message || err}`);
    }
  }

  // Preferred path: load official browser ESM entry with import map.
  // browser.js will assign EventDisplay to globalThis.
  const browserModuleCandidates = [
    "./vendor/phoenix-dist/full/browser.js",
    "https://cdn.jsdelivr.net/npm/phoenix-event-display@latest/dist/browser.js",
    "https://unpkg.com/phoenix-event-display@latest/dist/browser.js",
  ];
  for (const src of browserModuleCandidates) {
    try {
      await import(src);
      if (typeof globalThis.EventDisplay === "function") {
        phoenixCtor = globalThis.EventDisplay;
        phoenixApi = null;
        return;
      }
      if (globalThis.EventDisplay && typeof globalThis.EventDisplay.loadRootJSONGeometry === "function") {
        phoenixApi = globalThis.EventDisplay;
        phoenixCtor = null;
        return;
      }
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
      // Always force re-evaluation: previous script load may have thrown runtime
      // errors (e.g. missing THREE) while still firing onload.
      delete globalThis.EventDisplay;
      await loadClassicScript(src, "phoenix-loader", false);
      if (typeof window.EventDisplay === "function") {
        phoenixCtor = window.EventDisplay;
        phoenixApi = null;
        return;
      }
      if (window.EventDisplay && typeof window.EventDisplay.loadRootJSONGeometry === "function") {
        phoenixApi = window.EventDisplay;
        phoenixCtor = null;
        return;
      }
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
      // Reuse already loaded script tag.
      if (existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load: ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.setAttribute(`data-${tagKey}`, src);
    script.onload = () => {
      script.dataset.loaded = "1";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(script);
  });
}

async function loadThreeFallback() {
  const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  const camera = new THREE.PerspectiveCamera(60, viewerEl.clientWidth / viewerEl.clientHeight, 0.1, 1e7);
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

  // Parse geometry JSON minimally to show bounding information.
  // This fallback is for quick file sanity check, not full detector rendering.
  const paths = getGeometryList();
  if (paths.length === 0) {
    throw new Error("No component selected for assembled BESIII");
  }
  let topName = "TopVolume";
  for (const p of paths) {
    const resp = await fetch(p);
    if (!resp.ok) {
      throw new Error(`Failed to fetch JSON: HTTP ${resp.status}`);
    }
    const data = await resp.json();
    topName = data?.fTopVolume?.fName || data?.fTopVolume?.name || topName;
  }
  const box = new THREE.BoxGeometry(600, 600, 600);
  const mesh = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x2e7de9, wireframe: true }));
  scene.add(mesh);

  setStatus(`Fallback preview loaded (${topName})`, "warn");

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
    const w = viewerEl.clientWidth;
    const h = viewerEl.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

async function loadJsrootGeometry() {
  const JSROOT = await import("https://root.cern/js/latest/modules/main.mjs");
  const paths = getGeometryList();
  if (paths.length === 0) {
    throw new Error("No component selected for assembled BESIII");
  }
  viewerEl.innerHTML = "";
  let isFirst = true;
  const pathCount = paths.length;
  for (const p of paths) {
    const resp = await fetch(p);
    if (!resp.ok) {
      throw new Error(`Failed to fetch JSON: HTTP ${resp.status}`);
    }
    const txt = await resp.text();
    const obj = JSROOT.parse(txt);
    if (!obj) {
      throw new Error("JSROOT failed to parse geometry JSON");
    }
    // Draw all selected geometries in one canvas.
    // First draw initializes the scene, then overlay subsequent ones.
    await JSROOT.draw(viewerEl, obj, isFirst ? "" : "same");
    isFirst = false;
  }
  setStatus("JSROOT assembled geometry loaded", "ok");
}

async function boot() {
  startLoaderProgressPulse();
  setupFixedUi();
  try {
    await loadPhoenix();
    scheduleBindTrackInteractions();
    await tryLoadPhoenixEventData(currentEventDisplay);
    if (!eventStatusTouched) {
      setStatus("Phoenix assembled geometry loaded", "ok");
    }
  } catch (phoenixErr) {
    const reason = phoenixErr?.message || phoenixLastError || "unknown reason";
    console.warn("Phoenix loading failed, switch to JSROOT geometry:", reason);
    try {
      await loadJsrootGeometry();
      setStatus(`${statusEl.textContent} (phoenix failed: ${reason})`, "warn");
    } catch (jsrootErr) {
      console.warn("JSROOT loading failed, switch to Three.js fallback:", jsrootErr);
      try {
        await loadThreeFallback();
      } catch (fallbackErr) {
        console.error(fallbackErr);
        setStatus(`Failed: ${fallbackErr.message}`, "err");
      }
    }
  }
}

boot();

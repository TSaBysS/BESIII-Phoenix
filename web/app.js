/**
 * app.js — Main entry point for BESIII Phoenix Event Display.
 *
 * Orchestrates:
 *   1. Detector geometry loading (loader.js)
 *   2. Event data loading and overlay building (event-renderer.js)
 *   3. PID pick interaction (pid-interaction.js)
 *   4. MC truth track toggle (truth.js)
 *   5. Animation timeline (timeline.js)
 */

import {
  getGeometryList, assembledComponents,
  loadPhoenix, loadJsrootGeometry, loadThreeFallback,
  applyOpacityToNamedGeometry, adjustPhoenixCamera, phoenixLastError,
} from "./loader.js";
import {
  buildCustomEventOverlay, trackCandidateCache, clearTrackCandidateCache,
} from "./event-renderer.js";
import {
  timelineState, applyTimelineToOverlay,
  ensureTimelineAnimation, setOverlayGroup,
} from "./timeline.js";
import {
  interactionState, init as initPid, scheduleBindTrackInteractions,
  bindTrackInteractionsIfNeeded, refreshTrackSelectionVisuals,
  hideTrackHoverTip, renderTrackInfoPanel,
} from "./pid-interaction.js";

// ── DOM refs ──────────────────────────────────────────────────────────────────

const viewerEl            = document.getElementById("viewer");
const statusEl            = document.getElementById("status");
const jsonPathEl          = document.getElementById("jsonPath");
const trackModeSelectEl   = document.getElementById("trackModeSelect");
const eventSelectEl       = document.getElementById("eventSelect");
const chkMcTruthEl        = document.getElementById("chkMcTruth");
const mcTruthWrapEl       = document.getElementById("mcTruthWrap");
const btnOpacityMenuEl    = document.getElementById("btnOpacityMenu");
const btnResetCameraEl    = document.getElementById("btnResetCamera");
const opacityPanelEl      = document.getElementById("opacityPanel");
const btnTimelineMenuEl   = document.getElementById("btnTimelineMenu");
const btnTimelinePlayEl   = document.getElementById("btnTimelinePlay");
const timelineSliderEl    = document.getElementById("timelineSlider");
const timelineTimeEl      = document.getElementById("timelineTime");
const timelinePanelEl     = document.getElementById("timelinePanel");
const btnPidModeEl        = document.getElementById("btnPidMode");
const btnTruthModeEl      = document.getElementById("btnTruthMode");
const trackHoverTipEl     = document.getElementById("trackHoverTip");
const trackInfoPanelEl    = document.getElementById("trackInfoPanel");
const appLoaderEl         = document.getElementById("appLoader");
const loaderStatusEl      = document.getElementById("loaderStatus");
const loaderProgressBarEl = document.getElementById("loaderProgressBar");
const eventImportAreaEl   = document.getElementById("eventImportArea");
const eventFileInputEl    = document.getElementById("eventFileInput");
const eventImportStatusEl = document.getElementById("eventImportStatus");
const btnImportEventEl    = document.getElementById("btnImportEvent");
const btnClearEventEl     = document.getElementById("btnClearEvent");
const dropOverlayEl       = document.getElementById("dropOverlay");

// ── runtime state ─────────────────────────────────────────────────────────────

const urlParams = new URLSearchParams(window.location.search);
const trackModeFromQuery      = urlParams.get("trkmode") || "stable";
const helixDebugEnabled       = urlParams.get("helixdbg") === "1" || Boolean(window.BES3_ENABLE_HELIX_DEBUG);
const selectedEventKeyFromQuery = urlParams.get("evt") || "";
const showMcFromQuery         = urlParams.get("mc") === "1";
const showTruthFromQuery      = urlParams.get("truth") === "1" || showMcFromQuery;

let currentEventDisplay  = null;
let cachedEventsData     = null;
let currentOverlayGroup  = null;
let loaderProgressValue  = 10;
let importInProgress     = false;

// ── loader progress ───────────────────────────────────────────────────────────

function setLoaderProgress(v) {
  loaderProgressValue = Math.max(0, Math.min(100, Number(v) || 0));
  if (loaderProgressBarEl) loaderProgressBarEl.style.width = `${loaderProgressValue}%`;
}

function hideLoaderOverlay(delayMs = 0) {
  if (!appLoaderEl) return;
  window.setTimeout(() => appLoaderEl.classList.add("load-complete"), Math.max(0, Number(delayMs) || 0));
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

function setStatus(text, klass) {
  statusEl.textContent = text;
  statusEl.className   = klass;
  if (loaderStatusEl) loaderStatusEl.textContent = text;
  if (klass === "ok") { setLoaderProgress(100); hideLoaderOverlay(200); }
  else if (klass === "warn" || klass === "err") { setLoaderProgress(96); hideLoaderOverlay(300); }
  else { setLoaderProgress(Math.min(92, loaderProgressValue + 8)); }
}

// ── track-mode selector ───────────────────────────────────────────────────────

if (trackModeSelectEl) {
  trackModeSelectEl.value = ["stable", "helix5", "both"].includes(trackModeFromQuery) ? trackModeFromQuery : "stable";
  if (!helixDebugEnabled) {
    trackModeSelectEl.value = "stable";
    Array.from(trackModeSelectEl.options).forEach((op) => { if (op.value !== "stable") op.style.display = "none"; });
    trackModeSelectEl.disabled = true;
    const parent = trackModeSelectEl.closest("label");
    if (parent) parent.style.display = "none";
  }
  trackModeSelectEl.addEventListener("change", () => renderSelectedEventOverlay());
}

// ── opacity slider UI setup ───────────────────────────────────────────────────

function setupFixedUi() {
  if (jsonPathEl) jsonPathEl.textContent = getGeometryList().join(" + ");

  if (btnOpacityMenuEl && opacityPanelEl) {
    btnOpacityMenuEl.onclick = () => opacityPanelEl.classList.toggle("open");
  }
  if (btnResetCameraEl) {
    btnResetCameraEl.onclick = () => { if (currentEventDisplay) adjustPhoenixCamera(currentEventDisplay); };
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
        ensureTimelineAnimation(timelineSliderEl, timelineTimeEl);
      }
    };
  }
  if (timelineSliderEl) {
    timelineSliderEl.addEventListener("input", () => {
      const frac = Number(timelineSliderEl.value) / 1000;
      timelineState.currentNs = timelineState.minNs + frac * (timelineState.maxNs - timelineState.minNs);
      applyTimelineToOverlay(timelineSliderEl, timelineTimeEl);
    });
  }
  if (btnTimelineMenuEl && timelinePanelEl) {
    btnTimelineMenuEl.onclick = () => {
      timelineState.enabled = !timelineState.enabled;
      timelinePanelEl.classList.toggle("open", timelineState.enabled);
      if (!timelineState.enabled) {
        timelineState.isPlaying = false;
        timelineState.lastTs    = 0;
        if (btnTimelinePlayEl) btnTimelinePlayEl.textContent = "▶";
      }
      applyTimelineToOverlay(timelineSliderEl, timelineTimeEl);
    };
  }

  // PID mode button.
  if (btnPidModeEl) {
    btnPidModeEl.onclick = () => {
      interactionState.pidMode = !interactionState.pidMode;
      btnPidModeEl.style.background = interactionState.pidMode
        ? "rgba(72, 104, 150, 0.95)" : "rgba(20, 28, 40, 0.9)";
      if (!interactionState.pidMode) {
        interactionState.hoveredTrackId  = null;
        interactionState.selectedTrackId = null;
        hideTrackHoverTip();
        renderTrackInfoPanel(null);
        refreshTrackSelectionVisuals();
      }
    };
  }

  // Truth mode button.
  if (btnTruthModeEl) {
    btnTruthModeEl.onclick = () => {
      interactionState.truthMode = !interactionState.truthMode;
      btnTruthModeEl.style.background = interactionState.truthMode
        ? "rgba(72, 104, 150, 0.95)" : "rgba(20, 28, 40, 0.9)";
      renderSelectedEventOverlay();
    };
  }
}

// ── event selector UI ─────────────────────────────────────────────────────────

function setupEventUi(eventsData) {
  const keys = Object.keys(eventsData || {});
  if (!eventSelectEl) return keys[0] || "";
  eventSelectEl.innerHTML = "";
  keys.forEach((k, idx) => {
    const ev = eventsData[k] || {};
    const op = document.createElement("option");
    op.value = k;
    op.textContent = `${idx + 1}. run ${Number(ev?.runNumber ?? -1)} evt ${Number(ev?.eventNumber ?? -1)} (${ev?.recFile || "rec"})`;
    eventSelectEl.appendChild(op);
  });
  const selected = keys.includes(selectedEventKeyFromQuery) ? selectedEventKeyFromQuery : (keys[0] || "");
  if (selected) eventSelectEl.value = selected;
  eventSelectEl.onchange = () => renderSelectedEventOverlay();
  return selected;
}

function setupMcTruthUi(ev) {
  const mcArr  = Array.isArray(ev?.Tracks?.["MC Truth"]) ? ev.Tracks["MC Truth"] : [];
  const hasMc  = mcArr.length > 0;
  if (mcTruthWrapEl)  mcTruthWrapEl.style.display  = "none";
  if (btnTruthModeEl) btnTruthModeEl.style.display  = hasMc ? "inline-block" : "none";
  if (chkMcTruthEl)  {
    chkMcTruthEl.checked = hasMc && showMcFromQuery;
    chkMcTruthEl.onchange = () => renderSelectedEventOverlay();
  }
  if (hasMc && !interactionState.truthMode && showTruthFromQuery) interactionState.truthMode = true;
  if (!hasMc) interactionState.truthMode = false;
  if (btnTruthModeEl) {
    btnTruthModeEl.style.background = interactionState.truthMode
      ? "rgba(72, 104, 150, 0.95)" : "rgba(20, 28, 40, 0.9)";
  }
  return hasMc && interactionState.truthMode;
}

// ── overlay rendering ─────────────────────────────────────────────────────────

async function renderSelectedEventOverlay() {
  if (!currentEventDisplay || !cachedEventsData) return;
  const selectedEventKey = eventSelectEl?.value || "";
  const selectedEvent    = (selectedEventKey && cachedEventsData?.[selectedEventKey]) ? cachedEventsData[selectedEventKey] : null;
  const showMc = setupMcTruthUi(selectedEvent || {});
  const result = await buildCustomEventOverlay(
    currentEventDisplay, cachedEventsData, selectedEventKey, showMc,
    helixDebugEnabled, trackModeSelectEl,
  );
  if (result && result.group) {
    currentOverlayGroup = result.group;
    setOverlayGroup(result.group);
    timelineState.minNs     = result.eventTime.minNs;
    timelineState.maxNs     = result.eventTime.maxNs;
    timelineState.currentNs = timelineState.enabled ? result.eventTime.minNs : result.eventTime.maxNs;
    applyTimelineToOverlay(timelineSliderEl, timelineTimeEl);
  }
  await bindTrackInteractionsIfNeeded();
}

// ── event data import ─────────────────────────────────────────────────────────

function setImportStatus(text, color = "#8db8f0") {
  if (eventImportStatusEl) { eventImportStatusEl.textContent = text; eventImportStatusEl.style.color = color; }
}

async function applyEventData(data, filename) {
  if (!currentEventDisplay) { setImportStatus("请等待探测器几何加载完成", "#ffcc66"); return; }
  cachedEventsData = data;

  const selectedEventKey = setupEventUi(cachedEventsData);
  const selectedEvent    = (selectedEventKey && cachedEventsData?.[selectedEventKey]) ? cachedEventsData[selectedEventKey] : null;
  const showMc = setupMcTruthUi(selectedEvent || {});

  if (eventSelectEl) eventSelectEl.style.display = "block";
  if (btnClearEventEl) btnClearEventEl.style.display = "block";
  setImportStatus(`已加载: ${filename || "event.json"}`, "#72e072");

  const result = await buildCustomEventOverlay(
    currentEventDisplay, cachedEventsData, selectedEventKey, showMc,
    helixDebugEnabled, trackModeSelectEl,
  );
  if (result && result.group) {
    currentOverlayGroup = result.group;
    setOverlayGroup(result.group);
    timelineState.minNs     = result.eventTime.minNs;
    timelineState.maxNs     = result.eventTime.maxNs;
    timelineState.currentNs = timelineState.enabled ? result.eventTime.minNs : result.eventTime.maxNs;
    applyTimelineToOverlay(timelineSliderEl, timelineTimeEl);
  }
  const count = result?.count ?? 0;
  setStatus(`事例已加载 (event=${selectedEventKey || "N/A"}, ${count} objects)`, count > 0 ? "ok" : "warn");
  await bindTrackInteractionsIfNeeded();
}

async function importEventFromFile(file) {
  if (importInProgress) return;
  if (!file || !file.name.endsWith(".json")) { setImportStatus("请选择 .json 文件", "#ffcc66"); return; }
  importInProgress = true;
  setImportStatus("解析中…", "#9fc2ff");
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await applyEventData(data, file.name);
  } catch (err) {
    setImportStatus(`解析失败: ${err.message || err}`, "#ff8888");
    setStatus(`事例解析失败: ${err.message || err}`, "err");
  } finally {
    importInProgress = false;
    if (eventFileInputEl) eventFileInputEl.value = "";
  }
}

function clearEventData() {
  cachedEventsData    = null;
  currentOverlayGroup = null;
  clearTrackCandidateCache();
  if (eventSelectEl)    { eventSelectEl.innerHTML = ""; eventSelectEl.style.display = "none"; }
  if (btnClearEventEl)  btnClearEventEl.style.display = "none";
  if (mcTruthWrapEl)    mcTruthWrapEl.style.display  = "none";
  if (btnTruthModeEl)   btnTruthModeEl.style.display  = "none";
  setImportStatus("事例已清空，可重新导入");
  setStatus("探测器几何已加载，等待导入事例", "warn");
  // Remove overlay objects from the scene via an empty rebuild.
  if (currentEventDisplay) {
    buildCustomEventOverlay(currentEventDisplay, {}, "", false, false, null).catch(() => {});
  }
  renderTrackInfoPanel(null);
  hideTrackHoverTip();
}

function setupImportUi() {
  if (btnImportEventEl && eventFileInputEl) {
    btnImportEventEl.addEventListener("click", () => eventFileInputEl.click());
  }
  if (eventFileInputEl) {
    eventFileInputEl.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) importEventFromFile(file);
    });
  }
  if (btnClearEventEl) {
    btnClearEventEl.addEventListener("click", clearEventData);
  }

  // Highlight the import area on hover over the small box.
  if (eventImportAreaEl) {
    eventImportAreaEl.addEventListener("dragover", (e) => { e.preventDefault(); eventImportAreaEl.classList.add("drag-over"); });
    eventImportAreaEl.addEventListener("dragleave", () => eventImportAreaEl.classList.remove("drag-over"));
    eventImportAreaEl.addEventListener("drop", (e) => {
      e.preventDefault();
      eventImportAreaEl.classList.remove("drag-over");
      const file = e.dataTransfer?.files?.[0];
      if (file) importEventFromFile(file);
    });
  }

  // Full-page drag-and-drop.
  let dragCounter = 0;
  document.addEventListener("dragenter", (e) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    dragCounter++;
    if (dropOverlayEl) dropOverlayEl.classList.add("active");
  });
  document.addEventListener("dragleave", () => {
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0 && dropOverlayEl) dropOverlayEl.classList.remove("active");
  });
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (dropOverlayEl) dropOverlayEl.classList.remove("active");
    const file = e.dataTransfer?.files?.[0];
    if (file) importEventFromFile(file);
  });
}

// ── geometry loading ──────────────────────────────────────────────────────────

async function doLoadPhoenix() {
  currentEventDisplay = await loadPhoenix(viewerEl);
  scheduleBindTrackInteractions();
  setStatus("探测器几何已加载，等待导入事例", "ok");
  setImportStatus("几何就绪，可以导入事例 JSON ↑");
}

// ── PID interaction init ──────────────────────────────────────────────────────

function initPidModule() {
  initPid({
    viewerEl,
    trackHoverTipEl,
    trackInfoPanelEl,
    cachedEventsDataRef: () => cachedEventsData,
    eventSelectEl,
    overlayGroupRef:       () => currentOverlayGroup,
    eventDisplayRef:       () => currentEventDisplay,
    trackCandidateCacheRef: () => trackCandidateCache,
  });
}

// ── boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  startLoaderProgressPulse();
  setupFixedUi();
  setupImportUi();
  initPidModule();

  try {
    await doLoadPhoenix();
  } catch (phoenixErr) {
    const reason = phoenixErr?.message || phoenixLastError || "unknown reason";
    console.warn("Phoenix loading failed, switch to JSROOT geometry:", reason);
    try {
      await loadJsrootGeometry(viewerEl, getGeometryList());
      setStatus("JSROOT 几何已加载，等待导入事例", "ok");
      setImportStatus("几何就绪，可以导入事例 JSON ↑");
    } catch (jsrootErr) {
      console.warn("JSROOT loading failed, switch to Three.js fallback:", jsrootErr);
      try {
        const topName = await loadThreeFallback(viewerEl, getGeometryList());
        setStatus(`回退预览已加载 (${topName})`, "warn");
        setImportStatus("几何就绪，可以导入事例 JSON ↑");
      } catch (fallbackErr) {
        console.error(fallbackErr);
        setStatus(`加载失败: ${fallbackErr.message}`, "err");
      }
    }
  }
}

boot();

/**
 * app.js — Main entry point for BESIII Phoenix Event Display.
 *
 * Orchestrates:
 *   1. Detector geometry loading (loader.js)
 *   2. Event data loading and overlay building (event-renderer.js)
 *   3. PID pick interaction (pid-interaction.js)
 *   4. MC truth track toggle (truth.js)
 *   5. PID/Truth interaction controls
 */

import {
  getGeometryList, assembledComponents,
  loadPhoenix, loadJsrootGeometry, loadThreeFallback,
  applyOpacityToNamedGeometry, adjustPhoenixCamera, phoenixLastError,
  getLastEmcDebugInfo, refreshEmcDebugInfo,
} from "./loader.js";
import {
  buildCustomEventOverlay, clearCustomEventOverlay, trackCandidateCache, clearTrackCandidateCache,
} from "./event-renderer.js";
import {
  interactionState, init as initPid, scheduleBindTrackInteractions,
  bindTrackInteractionsIfNeeded, refreshTrackSelectionVisuals,
  hideTrackHoverTip, renderTrackInfoPanel,
} from "./pid-interaction.js";

// ── DOM refs ──────────────────────────────────────────────────────────────────

const viewerEl            = document.getElementById("viewer");
const statusEl            = document.getElementById("status");
const jsonPathEl          = document.getElementById("jsonPath");
const eventSelectEl       = document.getElementById("eventSelect");
const chkMcTruthEl        = document.getElementById("chkMcTruth");
const mcTruthWrapEl       = document.getElementById("mcTruthWrap");
const btnOpacityMenuEl    = document.getElementById("btnOpacityMenu");
const btnResetCameraEl    = document.getElementById("btnResetCamera");
const opacityPanelEl      = document.getElementById("opacityPanel");
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
const btnEventPrevEl      = document.getElementById("btnEventPrev");
const btnEventNextEl      = document.getElementById("btnEventNext");
const searchRunEl         = document.getElementById("searchRun");
const searchRecEl         = document.getElementById("searchRec");
const btnEventJumpEl      = document.getElementById("btnEventJump");
const emcDebugPanelEl     = document.getElementById("emcDebugPanel");

// ── runtime state ─────────────────────────────────────────────────────────────

const urlParams = new URLSearchParams(window.location.search);
const selectedEventKeyFromQuery = urlParams.get("evt") || "";
const showMcFromQuery         = urlParams.get("mc") === "1";
const showTruthFromQuery      = urlParams.get("truth") === "1" || showMcFromQuery;
const skipDefaultEventFromQuery = urlParams.get("noDefault") === "1";

let currentEventDisplay  = null;
let cachedEventsData     = null;
let currentOverlayGroup  = null;
let loaderProgressValue  = 10;
let importInProgress     = false;
let emcDebugTimer        = null;

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
  if (klass === "ok") { setLoaderProgress(92); }
  else if (klass === "warn" || klass === "err") { setLoaderProgress(96); }
  else { setLoaderProgress(Math.min(92, loaderProgressValue + 8)); }
}

function updateEmcDebugPanel() {
  if (!emcDebugPanelEl) return;
  if (!currentEventDisplay) {
    emcDebugPanelEl.textContent = "EMC debug: eventDisplay unavailable";
    return;
  }
  const info = /** @type {any} */ (refreshEmcDebugInfo(currentEventDisplay) || getLastEmcDebugInfo());
  if (!info || info.ready === false) {
    emcDebugPanelEl.textContent = `EMC debug: not ready (${info?.reason || "unknown"})`;
    return;
  }
  const lines = [
    "EMC debug (temporary)",
    `total/visible objs: ${info.totalObjects}/${info.visibleObjects}`,
    `mesh visible: ${info.visibleMeshes}/${info.meshes}`,
    `emc-like mesh visible: ${info.emcLikeVisibleMeshes}/${info.emcLikeMeshes}`,
    `crystal-like visible: ${info.crystalLikeVisible}/${info.crystalLikeObjects}`,
    `casing-like visible: ${info.casingLikeVisible}/${info.casingLikeObjects}`,
    `world-like visible: ${info.worldLikeVisible}/${info.worldLikeObjects}`,
    `mat transparent/opaque: ${info.transparentMaterials}/${info.opaqueMaterials}`,
    `mat zero-opacity: ${info.zeroOpacityMaterials}`,
    `hidden objs: ${info.hiddenObjects}`,
    `emc root hits: ${info.emcRootHits}`,
    `EndCrystal visible: ${info.logicalEndCrystalVisible}/${info.logicalEndCrystal}`,
    `EndCasing visible: ${info.logicalEndCasingVisible}/${info.logicalEndCasing}`,
    `BSCCasing visible: ${info.logicalBscCasingVisible}/${info.logicalBscCasing}`,
    `EndWorld visible: ${info.logicalEndWorldVisible}/${info.logicalEndWorld}`,
    `BSCWorld visible: ${info.logicalBscWorldVisible}/${info.logicalBscWorld}`,
    `updated: ${new Date(info.timestamp || Date.now()).toLocaleTimeString()}`,
  ];
  emcDebugPanelEl.textContent = lines.join("\n");
}

function startEmcDebugTicker() {
  if (emcDebugTimer) window.clearInterval(emcDebugTimer);
  updateEmcDebugPanel();
  emcDebugTimer = window.setInterval(updateEmcDebugPanel, 1200);
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

/** Display run as positive for MC (stored run may be negative). */
function displayRun(ev) {
  const r = Number(ev?.runNumber ?? -1);
  return Number.isFinite(r) ? Math.abs(r) : r;
}

function setupEventUi(eventsData) {
  const keys = Object.keys(eventsData || {});
  if (!eventSelectEl) return keys[0] || "";
  eventSelectEl.innerHTML = "";
  keys.forEach((k, idx) => {
    const ev = eventsData[k] || {};
    const op = document.createElement("option");
    op.value = k;
    op.textContent = `${idx + 1}. run ${displayRun(ev)} evt ${Number(ev?.eventNumber ?? -1)} (${ev?.recFile || "rec"})`;
    eventSelectEl.appendChild(op);
  });
  const selected = keys.includes(selectedEventKeyFromQuery) ? selectedEventKeyFromQuery : (keys[0] || "");
  if (selected) eventSelectEl.value = selected;
  eventSelectEl.onchange = () => renderSelectedEventOverlay();
  updateEventNavButtons();
  return selected;
}

function getOrderedEventKeys() {
  if (!eventSelectEl) return [];
  return Array.from(eventSelectEl.options).map((o) => o.value).filter(Boolean);
}

function updateEventNavButtons() {
  const keys = getOrderedEventKeys();
  const n = keys.length;
  const dis = n < 2;
  if (btnEventPrevEl) btnEventPrevEl.disabled = dis;
  if (btnEventNextEl) btnEventNextEl.disabled = dis;
}

/** Match events: run compares abs(); rec matches substring on recFile or full key. */
function findMatchingEventKeys(eventsData, runStr, recStr) {
  const keys = Object.keys(eventsData || {});
  let runAbs = null;
  const rs = runStr != null ? String(runStr).trim() : "";
  if (rs) {
    const n = parseInt(rs, 10);
    if (Number.isFinite(n)) runAbs = Math.abs(n);
  }
  const recSub = recStr != null ? String(recStr).trim().toLowerCase() : "";

  return keys.filter((k) => {
    const ev = eventsData[k];
    const rn = Number(ev?.runNumber ?? NaN);
    if (runAbs !== null && (!Number.isFinite(rn) || Math.abs(rn) !== runAbs)) return false;
    if (recSub) {
      const rf = String(ev?.recFile ?? "").toLowerCase();
      if (!rf.includes(recSub) && !k.toLowerCase().includes(recSub)) return false;
    }
    return true;
  });
}

async function selectAdjacentEvent(delta) {
  const keys = getOrderedEventKeys();
  if (keys.length < 2 || !eventSelectEl) return;
  let idx = keys.indexOf(eventSelectEl.value);
  if (idx < 0) idx = 0;
  idx = (idx + delta + keys.length) % keys.length;
  eventSelectEl.value = keys[idx];
  await renderSelectedEventOverlay();
}

async function jumpToSearch() {
  if (!cachedEventsData) return;
  const runStr = searchRunEl?.value ?? "";
  const recStr = searchRecEl?.value ?? "";
  if (!String(runStr).trim() && !String(recStr).trim()) {
    setImportStatus("请填写 run 或 rec 片段", "#ffcc66");
    return;
  }
  const matches = findMatchingEventKeys(cachedEventsData, runStr, recStr);
  if (matches.length === 0) {
    setImportStatus("未找到匹配事例", "#ff8888");
    return;
  }
  const key = matches[0];
  if (eventSelectEl) eventSelectEl.value = key;
  setImportStatus(matches.length > 1
    ? `找到 ${matches.length} 个，显示第 1 个`
    : "已跳转", "#72e072");
  await renderSelectedEventOverlay();
}

function setupEventNavigationUi() {
  if (btnEventPrevEl) btnEventPrevEl.addEventListener("click", () => selectAdjacentEvent(-1));
  if (btnEventNextEl) btnEventNextEl.addEventListener("click", () => selectAdjacentEvent(1));
  if (btnEventJumpEl) btnEventJumpEl.addEventListener("click", () => jumpToSearch());
  if (searchRunEl) {
    searchRunEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") jumpToSearch();
    });
  }
  if (searchRecEl) {
    searchRecEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") jumpToSearch();
    });
  }
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
  );
  if (result && result.group) {
    currentOverlayGroup = result.group;
  }
  await bindTrackInteractionsIfNeeded();
}

// ── event data import ─────────────────────────────────────────────────────────

function setImportStatus(text, color = "#8db8f0") {
  if (eventImportStatusEl) { eventImportStatusEl.textContent = text; eventImportStatusEl.style.color = color; }
}

function mergeEventDataMaps(existingData, incomingData) {
  const base = (existingData && typeof existingData === "object") ? { ...existingData } : {};
  const incoming = (incomingData && typeof incomingData === "object") ? incomingData : {};
  const addedKeys = [];
  for (const [key, ev] of Object.entries(incoming)) {
    let candidate = key;
    let idx = 2;
    while (Object.prototype.hasOwnProperty.call(base, candidate)) {
      candidate = `${key}#${idx}`;
      idx += 1;
    }
    base[candidate] = ev;
    addedKeys.push(candidate);
  }
  return { merged: base, addedKeys };
}

async function applyEventData(data, filename) {
  if (!currentEventDisplay) { setImportStatus("请等待探测器几何加载完成", "#ffcc66"); return; }
  const { merged, addedKeys } = mergeEventDataMaps(cachedEventsData, data);
  cachedEventsData = merged;

  const selectedEventKey = setupEventUi(cachedEventsData);
  if (addedKeys.length > 0 && eventSelectEl) {
    eventSelectEl.value = addedKeys[0];
  }
  const activeKey = eventSelectEl?.value || selectedEventKey;
  const selectedEvent    = (activeKey && cachedEventsData?.[activeKey]) ? cachedEventsData[activeKey] : null;
  const showMc = setupMcTruthUi(selectedEvent || {});

  if (eventSelectEl) eventSelectEl.style.display = "block";
  if (btnClearEventEl) btnClearEventEl.style.display = "block";
  updateEventNavButtons();
  const loadedMsg = filename || "event.json";
  setImportStatus(`已追加: ${loadedMsg} (+${addedKeys.length}, total=${Object.keys(cachedEventsData || {}).length})`, "#72e072");

  const result = await buildCustomEventOverlay(
    currentEventDisplay, cachedEventsData, selectedEventKey, showMc,
  );
  if (result && result.group) {
    currentOverlayGroup = result.group;
  }
  const count = result?.count ?? 0;
  setStatus(`事例已加载 (event=${activeKey || "N/A"}, ${count} objects)`, count > 0 ? "ok" : "warn");
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
  interactionState.hoveredTrackId = null;
  interactionState.selectedTrackId = null;
  if (eventSelectEl)    { eventSelectEl.innerHTML = ""; eventSelectEl.style.display = "none"; }
  updateEventNavButtons();
  if (btnClearEventEl)  btnClearEventEl.style.display = "none";
  if (mcTruthWrapEl)    mcTruthWrapEl.style.display  = "none";
  if (btnTruthModeEl)   btnTruthModeEl.style.display  = "none";
  setImportStatus("事例已清空，可重新导入");
  setStatus("探测器几何已加载，等待导入事例", "warn");
  // Fade out event overlay smoothly without resetting geometry.
  if (currentEventDisplay) {
    clearCustomEventOverlay(currentEventDisplay, { animate: true, durationMs: 260 }).catch(() => {});
  }
  refreshTrackSelectionVisuals();
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
  updateEmcDebugPanel();
  scheduleBindTrackInteractions();
  setStatus("探测器几何已加载，等待导入事例", "ok");
  setImportStatus("几何就绪，可以导入事例 JSON ↑");
}

async function tryLoadDefaultEventJson() {
  if (!currentEventDisplay) return;
  if (skipDefaultEventFromQuery || window.BES3_SKIP_DEFAULT_EVENT === true) return;
  const url = window.BES3_DEFAULT_EVENT_URL;
  if (!url || typeof url !== "string") return;
  setImportStatus("正在加载内置演示事例…", "#9fc2ff");
  try {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) {
      setImportStatus(`内置事例不可用 (${resp.status})，请手动导入`, "#ffcc66");
      return;
    }
    const data = await resp.json();
    const label = url.split("/").pop() || "event.json";
    await applyEventData(data, `${label} (内置)`);
  } catch (err) {
    console.warn("Default event JSON failed:", err);
    setImportStatus(`内置事例加载失败: ${err.message || err}`, "#ffcc66");
  }
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
  setupEventNavigationUi();
  initPidModule();
  startEmcDebugTicker();

  try {
    await doLoadPhoenix();
    await tryLoadDefaultEventJson();
    setLoaderProgress(100);
    hideLoaderOverlay(180);
  } catch (phoenixErr) {
    const reason = phoenixErr?.message || phoenixLastError || "unknown reason";
    console.warn("Phoenix loading failed, switch to JSROOT geometry:", reason);
    try {
      await loadJsrootGeometry(viewerEl, getGeometryList());
      setStatus("JSROOT 几何已加载，等待导入事例", "ok");
      setImportStatus("几何就绪，可以导入事例 JSON ↑");
      setLoaderProgress(100);
      hideLoaderOverlay(220);
    } catch (jsrootErr) {
      console.warn("JSROOT loading failed, switch to Three.js fallback:", jsrootErr);
      try {
        const topName = await loadThreeFallback(viewerEl, getGeometryList());
        setStatus(`回退预览已加载 (${topName})`, "warn");
        setImportStatus("几何就绪，可以导入事例 JSON ↑");
        setLoaderProgress(100);
        hideLoaderOverlay(240);
      } catch (fallbackErr) {
        console.error(fallbackErr);
        setStatus(`加载失败: ${fallbackErr.message}`, "err");
        setLoaderProgress(100);
        hideLoaderOverlay(260);
      }
    }
  }
}

boot();

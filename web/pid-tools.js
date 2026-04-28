function parsePidPayload(payload) {
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch (e) {
      return {};
    }
  }
  return (typeof payload === "object") ? payload : {};
}

function extractPidPayloadFromTrack(trackObj) {
  if (!trackObj || typeof trackObj !== "object") return {};
  const candidates = [
    trackObj.pid,
    trackObj.PID,
    trackObj.pidInfo,
    trackObj.pid_info,
    trackObj.pidPayload,
    trackObj.pid_payload,
  ];
  for (const item of candidates) {
    const parsed = parsePidPayload(item);
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) return parsed;
  }
  // Fallback for flattened schema: PID fields directly on track object.
  if (trackObj.combinedProbabilities || trackObj.probabilities || trackObj.topCandidates) {
    return {
      combinedProbabilities: trackObj.combinedProbabilities || trackObj.probabilities || trackObj.prob || {},
      topCandidates: Array.isArray(trackObj.topCandidates) ? trackObj.topCandidates : [],
    };
  }
  return {};
}

function probMapFromPid(pidObj) {
  let m = pidObj?.combinedProbabilities || pidObj?.probabilities || pidObj?.prob || {};
  if (Array.isArray(m) && m.length >= 5) {
    m = {
      electron: Number(m[0]),
      muon: Number(m[1]),
      pion: Number(m[2]),
      kaon: Number(m[3]),
      proton: Number(m[4]),
    };
  }
  return m && typeof m === "object" ? m : {};
}

function sumProbMap(map) {
  return ["electron", "muon", "pion", "kaon", "proton"]
    .reduce((s, k) => s + Math.max(0, Number(map?.[k]) || 0), 0);
}

function collectionPriority(coll) {
  if (coll === "stable") return 0;
  if (coll === "helix5") return 1;
  return 2;
}

function previewPid(pid) {
  try {
    const out = {};
    if (pid?.combinedProbabilities) out.combinedProbabilities = pid.combinedProbabilities;
    if (Array.isArray(pid?.topCandidates)) out.topCandidates = pid.topCandidates.slice(0, 3);
    return JSON.stringify(out).slice(0, 140);
  } catch (e) {
    return "preview-error";
  }
}

export function selectPidForTrack(eventData, trackId, trackInfo = null) {
  const tid = Number(trackId);
  const empty = {
    hit: false,
    collection: "",
    pid: {},
    pidKeys: "",
    pidPreview: "",
    directEventSum: 0,
    eventSum: 0,
    trackSum: 0,
    source: "empty",
    matchedCount: 0,
    chosenTrackId: null,
    chosenTrackKeys: "",
    chosenHasPidField: false,
  };
  if (!eventData?.Tracks || !Number.isFinite(tid)) return empty;

  const stable = Array.isArray(eventData.Tracks["REC MdcTrack (stable)"]) ? eventData.Tracks["REC MdcTrack (stable)"] : [];
  const helix5 = Array.isArray(eventData.Tracks["REC MdcTrack (helix5)"]) ? eventData.Tracks["REC MdcTrack (helix5)"] : [];
  const mc = Array.isArray(eventData.Tracks["MC Truth"]) ? eventData.Tracks["MC Truth"] : [];
  const withMeta = [
    ...stable.map((t) => ({ t, coll: "stable" })),
    ...helix5.map((t) => ({ t, coll: "helix5" })),
    ...mc.map((t) => ({ t, coll: "mc" })),
  ];

  const byTrackId = withMeta.filter((x) => Number(x?.t?.trackId) === tid);
  let chosen = null;
  if (byTrackId.length) {
    byTrackId.sort((a, b) => {
      const sa = sumProbMap(probMapFromPid(extractPidPayloadFromTrack(a.t)));
      const sb = sumProbMap(probMapFromPid(extractPidPayloadFromTrack(b.t)));
      if (sb !== sa) return sb - sa;
      return collectionPriority(a.coll) - collectionPriority(b.coll);
    });
    chosen = byTrackId[0];
  }

  if (!chosen || sumProbMap(probMapFromPid(extractPidPayloadFromTrack(chosen.t))) <= 0) {
    // Prefer same trackId candidate that actually carries valid PID.
    const sameIdValid = byTrackId
      .map((x) => ({ x, sum: sumProbMap(probMapFromPid(extractPidPayloadFromTrack(x.t))) }))
      .filter((y) => y.sum > 0)
      .sort((a, b) => {
        if (b.sum !== a.sum) return b.sum - a.sum;
        return collectionPriority(a.x.coll) - collectionPriority(b.x.coll);
      });
    if (sameIdValid.length) {
      chosen = sameIdValid[0].x;
    }
  }

  if (!chosen || sumProbMap(probMapFromPid(extractPidPayloadFromTrack(chosen.t))) <= 0) {
    // Fallback: nearest stable track with valid PID by momentum/hits.
    const p0 = Number(trackInfo?.pt_debug?.p_est ?? NaN);
    const h0 = Number(trackInfo?.nhits ?? NaN);
    const validStable = stable
      .map((t) => ({ t, sum: sumProbMap(probMapFromPid(extractPidPayloadFromTrack(t))) }))
      .filter((x) => x.sum > 0);
    if (validStable.length) {
      validStable.sort((a, b) => {
        const pa = Number(a.t?.pt_debug?.p_est ?? NaN);
        const pb = Number(b.t?.pt_debug?.p_est ?? NaN);
        const ha = Number(a.t?.nhits ?? NaN);
        const hb = Number(b.t?.nhits ?? NaN);
        const da = (Number.isFinite(p0) && Number.isFinite(pa) ? Math.abs(pa - p0) : 1e6)
          + (Number.isFinite(h0) && Number.isFinite(ha) ? 0.01 * Math.abs(ha - h0) : 1e3);
        const db = (Number.isFinite(p0) && Number.isFinite(pb) ? Math.abs(pb - p0) : 1e6)
          + (Number.isFinite(h0) && Number.isFinite(hb) ? 0.01 * Math.abs(hb - h0) : 1e3);
        return da - db;
      });
      chosen = { t: validStable[0].t, coll: "stable-nearest" };
    }
  }

  if (!chosen) return empty;
  const eventPid = extractPidPayloadFromTrack(chosen.t);
  const eventMap = probMapFromPid(eventPid);
  const eventSum = sumProbMap(eventMap);
  const trackPid = extractPidPayloadFromTrack(trackInfo);
  const trackMap = probMapFromPid(trackPid);
  const trackSum = sumProbMap(trackMap);
  const directEventSum = eventSum;
  const source = eventSum > 0 ? "cachedEventsData" : (trackSum > 0 ? "trackInfo.pid" : "empty");
  const pid = eventSum > 0 ? eventPid : (trackSum > 0 ? trackPid : {});
  const chosenTrack = chosen?.t || null;
  const chosenTrackKeys = chosenTrack && typeof chosenTrack === "object"
    ? Object.keys(chosenTrack).slice(0, 20).join(",")
    : "";
  const chosenHasPidField = Boolean(
    chosenTrack && typeof chosenTrack === "object"
    && ("pid" in chosenTrack || "PID" in chosenTrack || "pidInfo" in chosenTrack || "pid_info" in chosenTrack),
  );
  return {
    hit: true,
    collection: chosen.coll,
    pid,
    pidKeys: pid && typeof pid === "object" ? Object.keys(pid).join(",") : String(typeof pid),
    pidPreview: previewPid(pid),
    directEventSum,
    eventSum,
    trackSum,
    source,
    matchedCount: byTrackId.length,
    chosenTrackId: Number(chosenTrack?.trackId),
    chosenTrackKeys,
    chosenHasPidField,
  };
}

export function buildPidDisplay(pidPayload) {
  const pid = parsePidPayload(pidPayload);
  const probs = probMapFromPid(pid);
  const pick = (raw, ...keys) => {
    for (const k of keys) {
      const v = Number(raw?.[k]);
      if (Number.isFinite(v)) return v;
    }
    return 0;
  };
  const normalizedProb = {
    electron: pick(probs, "electron", "e", "Electron"),
    muon: pick(probs, "muon", "mu", "Muon"),
    pion: pick(probs, "pion", "pi", "Pion"),
    kaon: pick(probs, "kaon", "k", "Kaon"),
    proton: pick(probs, "proton", "p", "Proton"),
  };
  let top = Array.isArray(pid?.topCandidates) ? pid.topCandidates.map((x) => ({
    name: String(x?.name ?? "unknown"),
    score: Number(x?.score ?? x?.probability ?? x?.value ?? 0),
  })) : [];
  if (!top.length) {
    top = Object.entries(normalizedProb)
      .map(([name, score]) => ({ name, score: Number(score) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }
  return { normalizedProb, top };
}

export function formatPidValue(v) {
  if (!Number.isFinite(v) || v <= 0) return "0";
  if (v >= 1e-3) return v.toFixed(3);
  return v.toExponential(2);
}

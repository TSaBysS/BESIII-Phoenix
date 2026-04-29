/**
 * truth.js — MC truth track utilities.
 *
 * Provides:
 *   computeClosestTruthMatch()     — spatial scoring to match a reco track to truth
 *   estimateTruthMomentumMagnitude() — fallback momentum from polyline geometry
 */

/**
 * Find the closest MC truth track to a given reconstructed track using
 * mean closest-point distance, start-point offset, and angular alignment.
 *
 * @param {object} trackInfo - reco track with pos[] array
 * @param {object} ev        - full event object containing Tracks["MC Truth"]
 * @returns {object|null} { score, trackId, pdg, p } or null
 */
export function computeClosestTruthMatch(trackInfo, ev) {
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

    // Mean closest-point distance from sampled reco points to mc polyline.
    let sumMin = 0;
    let nUsed  = 0;
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
      if (Number.isFinite(localBest)) { sumMin += localBest; nUsed += 1; }
    }
    if (nUsed === 0) continue;
    const meanDistMm = Math.sqrt(sumMin / nUsed);

    // Start-point proximity.
    const recoHead = recoPos[Math.min(4, recoPos.length - 1)];
    const recoTail = recoPos[0];
    const mcHead   = mcPos[Math.min(4, mcPos.length - 1)];
    const mcTail   = mcPos[0];
    const dStart   = Math.hypot(
      Number(recoTail?.[0] ?? 0) - Number(mcTail?.[0] ?? 0),
      Number(recoTail?.[1] ?? 0) - Number(mcTail?.[1] ?? 0),
      Number(recoTail?.[2] ?? 0) - Number(mcTail?.[2] ?? 0),
    );

    // Angle between initial directions.
    const v1x = Number(recoHead?.[0] ?? 0) - Number(recoTail?.[0] ?? 0);
    const v1y = Number(recoHead?.[1] ?? 0) - Number(recoTail?.[1] ?? 0);
    const v1z = Number(recoHead?.[2] ?? 0) - Number(recoTail?.[2] ?? 0);
    const v2x = Number(mcHead?.[0] ?? 0) - Number(mcTail?.[0] ?? 0);
    const v2y = Number(mcHead?.[1] ?? 0) - Number(mcTail?.[1] ?? 0);
    const v2z = Number(mcHead?.[2] ?? 0) - Number(mcTail?.[2] ?? 0);
    const l1  = Math.hypot(v1x, v1y, v1z);
    const l2  = Math.hypot(v2x, v2y, v2z);
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
        motherPdg: Number(cand?.motherPdg ?? NaN),
        p: Number(cand?.p ?? NaN),
      };
    }
  }
  return best;
}

/**
 * Estimate |p| from a truth track object.
 * Prefers the stored `p` field; falls back to circumradius of the transverse arc.
 */
export function estimateTruthMomentumMagnitude(trackObj) {
  const direct = Number(trackObj?.p);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const pos = Array.isArray(trackObj?.pos) ? trackObj.pos : [];
  if (pos.length < 6) return NaN;

  const p0 = pos[0], p2 = pos[2], p4 = pos[4];
  const x1 = Number(p0?.[0] ?? 0), y1 = Number(p0?.[1] ?? 0);
  const x2 = Number(p2?.[0] ?? 0), y2 = Number(p2?.[1] ?? 0);
  const x3 = Number(p4?.[0] ?? 0), y3 = Number(p4?.[1] ?? 0);
  const a = Math.hypot(x2 - x1, y2 - y1);
  const b = Math.hypot(x3 - x2, y3 - y2);
  const c = Math.hypot(x3 - x1, y3 - y1);
  const s = 0.5 * (a + b + c);
  const area2 = Math.max(0, s * (s - a) * (s - b) * (s - c));
  if (area2 <= 1e-12) return NaN;
  const rMm = (a * b * c) / (4 * Math.sqrt(area2));
  if (!Number.isFinite(rMm) || rMm <= 1e-6) return NaN;

  const pt = 0.299792458 * (rMm / 1000.0); // B = 1 T
  let sxy = 0, dz = 0;
  for (let i = 1; i < Math.min(pos.length, 12); i += 1) {
    const pa = pos[i - 1], pb = pos[i];
    sxy += Math.hypot(Number(pb?.[0] ?? 0) - Number(pa?.[0] ?? 0), Number(pb?.[1] ?? 0) - Number(pa?.[1] ?? 0));
    dz  += Number(pb?.[2] ?? 0) - Number(pa?.[2] ?? 0);
  }
  if (sxy <= 1e-9) return pt;
  const pz = pt * (dz / sxy);
  return Math.sqrt(pt * pt + pz * pz);
}

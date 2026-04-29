#!/usr/bin/env python3
"""
Convert BESIII REC ROOT file to a minimal Phoenix events JSON.

Current output focuses on:
- Tracks (from TRecEvent/m_recMdcTrackCol)
- CaloClusters (from TRecEvent/m_recEmcShowerCol)
"""

import argparse
import json
import math
import os
import re
from pathlib import Path

import uproot

LENGTH_SCALE = 10.0  # Convert REC coordinates (cm-like) to geometry scale (mm-like)
ALPHA_BES3_MM = 3335.64095  # ~1000/(0.299792458) for B=1T, in mm
MDC_PHI_SHIFT = 0.0  # BesVis wire lookup itself does not apply manual global phi rotation.
MDC_Y_SIGN = -1.0  # Align MDC hit phi convention with track display (mirror in Y).
PID_HYP_NAMES = ["electron", "muon", "pion", "kaon", "proton"]
PID_HYP_MASS = {
    "electron": 0.000511,
    "muon": 0.105658,
    "pion": 0.139570,
    "kaon": 0.493677,
    "proton": 0.938272,
}
MC_TRUTH_CHARGED_PID = {11, 13, 211, 321, 2212}
MC_TRUTH_PHOTON_PID = {22}
PDG_CHARGE = {
    11: -1,
    -11: 1,
    13: -1,
    -13: 1,
    211: 1,
    -211: -1,
    321: 1,
    -321: -1,
    2212: 1,
    -2212: -1,
}


def _entry_array(tree, branch_name, entry_idx):
    arr = tree[branch_name].array(
        library="np",
        entry_start=int(entry_idx),
        entry_stop=int(entry_idx) + 1,
    )
    return arr[0]


def _entry_array_first(tree, branch_names, entry_idx, default=None):
    for name in branch_names:
        if name in tree:
            return _entry_array(tree, name, entry_idx)
    return default


def _safe_get(obj, key, default=None):
    return obj.all_members.get(key, default)


def _first_or(default, value):
    if value is None:
        return default
    try:
        if len(value) > 0:
            return value[0]
    except Exception:
        pass
    return default


def _as_float(value, default=0.0):
    if value is None:
        return float(default)
    try:
        if hasattr(value, "__len__") and not isinstance(value, (str, bytes)):
            if len(value) > 0:
                return float(value[0])
            return float(default)
    except Exception:
        pass
    try:
        return float(value)
    except Exception:
        return float(default)


def _mc_member(mp, keys, default=None):
    for key in keys:
        val = _safe_get(mp, key, None)
        if val is not None:
            return val
    return default


def _unit_vec(x, y, z):
    n = math.sqrt(x * x + y * y + z * z)
    if n <= 1e-12:
        return [0.0, 0.0, 1.0]
    return [x / n, y / n, z / n]


def _mother_is_charged_pion_or_kaon(mother_pdg):
    """True if direct mother is pi+- (211) or K+- (321); used to skip their decay daughters in MC truth lines."""
    if mother_pdg is None:
        return False
    try:
        a = abs(int(mother_pdg))
    except (TypeError, ValueError):
        return False
    return a == 211 or a == 321


def _mother_is_muon(mother_pdg):
    """True if direct mother is mu+- (13); skip mu decay charged daughters (e.g. Michel e+-)."""
    if mother_pdg is None:
        return False
    try:
        return abs(int(mother_pdg)) == 13
    except (TypeError, ValueError):
        return False


def _build_mc_truth_polyline(mp, mdc_rmax_mm=810.0, mdc_zmax_mm=1450.0):
    pdg = int(_as_float(_mc_member(mp, ["m_particleID", "m_particleProperty", "m_pdgCode"], 0), 0))
    if abs(pdg) not in MC_TRUTH_CHARGED_PID:
        return None
    q = PDG_CHARGE.get(pdg, 0)
    if q == 0:
        return None

    px = _as_float(_mc_member(mp, ["m_xInitialMomentum", "m_px"], 0.0), 0.0)
    py = _as_float(_mc_member(mp, ["m_yInitialMomentum", "m_py"], 0.0), 0.0)
    pz = _as_float(_mc_member(mp, ["m_zInitialMomentum", "m_pz"], 0.0), 0.0)
    pt = math.hypot(px, py)
    p_mag = math.sqrt(px * px + py * py + pz * pz)
    if pt < 1e-9:
        return None

    x0 = _as_float(_mc_member(mp, ["m_xInitialPosition", "m_initialPositionX"], 0.0), 0.0) * LENGTH_SCALE
    y0 = _as_float(_mc_member(mp, ["m_yInitialPosition", "m_initialPositionY"], 0.0), 0.0) * LENGTH_SCALE
    z0 = _as_float(_mc_member(mp, ["m_zInitialPosition", "m_initialPositionZ"], 0.0), 0.0) * LENGTH_SCALE

    xf = _as_float(_mc_member(mp, ["m_xFinalPosition", "m_finalPositionX"], x0 / LENGTH_SCALE), x0 / LENGTH_SCALE) * LENGTH_SCALE
    yf = _as_float(_mc_member(mp, ["m_yFinalPosition", "m_finalPositionY"], y0 / LENGTH_SCALE), y0 / LENGTH_SCALE) * LENGTH_SCALE
    zf = _as_float(_mc_member(mp, ["m_zFinalPosition", "m_finalPositionZ"], z0 / LENGTH_SCALE), z0 / LENGTH_SCALE) * LENGTH_SCALE
    if abs(xf) < 1.0 and abs(yf) < 1.0:
        xf, yf, zf = mdc_rmax_mm, mdc_rmax_mm, mdc_zmax_mm

    field = -1.0
    kv_c = 3.0e8
    radius = (pt * 1.0e9 / kv_c * 1e3) / max(abs(q * field), 1e-12)
    if radius < 1e-6:
        return None
    curvature = 1.0 / radius
    z_step = 2.0 * math.pi * radius * abs(pz / pt)
    dz_ds = pz / pt
    phi0 = math.atan2(py, px)
    h = 1.0 if q >= 0 else -1.0
    xc = x0 - h * radius * math.sin(phi0)
    yc = y0 + h * radius * math.cos(phi0)

    points = [[x0, y0, z0]]
    ds = 10.0
    t = 0.0
    best_d2 = (x0 - xf) ** 2 + (y0 - yf) ** 2 + (z0 - zf) ** 2
    for _ in range(3000):
        t += ds
        phi = phi0 + h * curvature * t
        x = xc + h * radius * math.sin(phi)
        y = yc - h * radius * math.cos(phi)
        # Use dz/ds = pz/pt for helix pitch; this keeps theta consistent in XOZ/YOZ.
        z = z0 + t * dz_ds
        points.append([x, y, z])
        if x * x + y * y > mdc_rmax_mm * mdc_rmax_mm or abs(z) > mdc_zmax_mm:
            break
        d2 = (x - xf) ** 2 + (y - yf) ** 2 + (z - zf) ** 2
        if d2 < 25.0 or d2 > best_d2 + 100.0:
            break
        best_d2 = min(best_d2, d2)

    return {
        "trackId": int(_as_float(_mc_member(mp, ["m_trackIndex"], -1), -1)),
        "pdg": pdg,
        "p": p_mag,
        "mother": int(_as_float(_mc_member(mp, ["m_mother"], -1), -1)),
        "motherPdg": None,
        "pos": points,
        "mode": "mc",
        "color": "0x90caf9",
    }


def _build_mc_truth_photon_cluster(mp, emc_r_mm=920.0):
    pdg = int(_as_float(_mc_member(mp, ["m_particleID", "m_particleProperty", "m_pdgCode"], 0), 0))
    if abs(pdg) not in MC_TRUTH_PHOTON_PID:
        return None
    px = _as_float(_mc_member(mp, ["m_xInitialMomentum", "m_px"], 0.0), 0.0)
    py = _as_float(_mc_member(mp, ["m_yInitialMomentum", "m_py"], 0.0), 0.0)
    pz = _as_float(_mc_member(mp, ["m_zInitialMomentum", "m_pz"], 0.0), 0.0)
    p_mag = math.sqrt(px * px + py * py + pz * pz)
    if p_mag <= 1e-9:
        return None
    x0 = _as_float(_mc_member(mp, ["m_xInitialPosition", "m_initialPositionX"], 0.0), 0.0) * LENGTH_SCALE
    y0 = _as_float(_mc_member(mp, ["m_yInitialPosition", "m_initialPositionY"], 0.0), 0.0) * LENGTH_SCALE
    z0 = _as_float(_mc_member(mp, ["m_zInitialPosition", "m_initialPositionZ"], 0.0), 0.0) * LENGTH_SCALE
    xf = _as_float(_mc_member(mp, ["m_xFinalPosition", "m_finalPositionX"], x0 / LENGTH_SCALE), x0 / LENGTH_SCALE) * LENGTH_SCALE
    yf = _as_float(_mc_member(mp, ["m_yFinalPosition", "m_finalPositionY"], y0 / LENGTH_SCALE), y0 / LENGTH_SCALE) * LENGTH_SCALE
    zf = _as_float(_mc_member(mp, ["m_zFinalPosition", "m_finalPositionZ"], z0 / LENGTH_SCALE), z0 / LENGTH_SCALE) * LENGTH_SCALE
    rf = math.sqrt(xf * xf + yf * yf + zf * zf)
    if rf < 10.0:
        uv = _unit_vec(px, py, pz)
        xf = x0 + uv[0] * emc_r_mm
        yf = y0 + uv[1] * emc_r_mm
        zf = z0 + uv[2] * emc_r_mm
        rf = math.sqrt(xf * xf + yf * yf + zf * zf)
    uv = _unit_vec(xf - x0, yf - y0, zf - z0)
    return {
        "trackId": int(_as_float(_mc_member(mp, ["m_trackIndex"], -1), -1)),
        "pdg": pdg,
        "mother": int(_as_float(_mc_member(mp, ["m_mother"], -1), -1)),
        "motherPdg": None,
        "truthEnergyGeV": p_mag,
        "truthMomentumGeV": p_mag,
        "truthMomentumVec": [px, py, pz],
        "radius": rf if rf > 0 else emc_r_mm,
        "pos": [xf, yf, zf],
        "theta": math.acos(max(-1.0, min(1.0, uv[2]))),
        "phi": math.atan2(uv[1], uv[0]),
        "side": 22.0,
        "energy": p_mag * 1000.0,
        "color": 0x4a90e2,
        "opacity": 0.86,
        "mode": "mc_truth_photon",
    }


def _gauss_like(x, mu, sigma):
    if sigma <= 1e-12:
        return 1.0 if abs(x - mu) < 1e-12 else 0.0
    z = (x - mu) / sigma
    return math.exp(-0.5 * z * z)


def _normalize_prob_map(prob_map):
    s = sum(max(0.0, float(v)) for v in prob_map.values())
    if s <= 1e-12:
        n = float(len(prob_map) or 1)
        return {k: 1.0 / n for k in prob_map.keys()}
    return {k: max(0.0, float(v)) / s for k, v in prob_map.items()}


def build_pid_info(track_id, p_est, dedx_entry, tof_entries, emc_entry):
    """
    Standalone PID proxy using available REC observables:
    - dE/dx m_pid_prob (base prior)
    - TOF beta consistency
    - EMC E/p consistency
    """
    base = {k: 0.2 for k in PID_HYP_NAMES}
    dedx_chi = {}
    if dedx_entry is not None:
        prob_vec = _safe_get(dedx_entry, "m_pid_prob")
        if prob_vec is not None and len(prob_vec) >= 5:
            base = {name: float(prob_vec[i]) for i, name in enumerate(PID_HYP_NAMES)}
        dedx_chi = {
            "electron": float(_safe_get(dedx_entry, "m_chiE", 0.0)),
            "muon": float(_safe_get(dedx_entry, "m_chiMu", 0.0)),
            "pion": float(_safe_get(dedx_entry, "m_chiPi", 0.0)),
            "kaon": float(_safe_get(dedx_entry, "m_chiK", 0.0)),
            "proton": float(_safe_get(dedx_entry, "m_chiP", 0.0)),
        }
    base = _normalize_prob_map(base)

    # Pick TOF entry with the smallest sigma for this track if available.
    tof_best = None
    if tof_entries:
        tof_best = min(tof_entries, key=lambda x: abs(_as_float(_safe_get(x, "m_sigma", 1e9), 1e9)))

    emc_ep = None
    if emc_entry is not None and p_est > 1e-9:
        emc_ep = _as_float(_safe_get(emc_entry, "m_energy", 0.0), 0.0) / max(p_est, 1e-9)

    score = {}
    detail = {}
    for name in PID_HYP_NAMES:
        s = base[name]
        d = {"dedxBase": base[name]}

        if tof_best is not None:
            beta_meas = _as_float(_safe_get(tof_best, "m_beta", 0.0), 0.0)
            sigma_beta = max(0.015, abs(_as_float(_safe_get(tof_best, "m_sigma", 0.03), 0.03)))
            m = PID_HYP_MASS[name]
            beta_exp = p_est / math.sqrt(p_est * p_est + m * m) if p_est > 1e-9 else 0.0
            l_tof = _gauss_like(beta_meas, beta_exp, sigma_beta)
            s *= max(1e-6, l_tof)
            d.update({"betaMeas": beta_meas, "betaExp": beta_exp, "betaLike": l_tof})

        if emc_ep is not None:
            # Electron E/p around 1; hadrons usually much smaller.
            if name == "electron":
                l_ep = _gauss_like(emc_ep, 1.0, 0.22)
            elif name == "muon":
                l_ep = _gauss_like(emc_ep, 0.35, 0.25)
            else:
                l_ep = _gauss_like(emc_ep, 0.20, 0.18)
            s *= max(1e-6, l_ep)
            d.update({"ep": emc_ep, "epLike": l_ep})

        if name in dedx_chi:
            d["dedxChi"] = dedx_chi[name]
        score[name] = s
        detail[name] = d

    score = _normalize_prob_map(score)
    top = sorted(score.items(), key=lambda kv: kv[1], reverse=True)
    top_candidates = [{"name": k, "score": float(v)} for k, v in top[:3]]
    return {
        "method": "standalone-rec-proxy",
        "combinedProbabilities": score,
        "topCandidates": top_candidates,
        "detail": detail,
    }


def build_track_points(helix, n_points=80, s_max=350.0, r_limit=900.0, z_limit=1400.0):
    """
    Build approximate 3D helix points from BESIII helix params.
    helix = [dr, phi0, kappa, dz, tanl]
    """
    dr, phi0, kappa, dz, tanl = [float(x) for x in helix]
    if abs(kappa) < 1e-6:
        # Near-straight fallback
        pts = []
        ux = math.cos(phi0)
        uy = math.sin(phi0)
        uz = tanl
        norm = math.sqrt(ux * ux + uy * uy + uz * uz) or 1.0
        ux, uy, uz = ux / norm, uy / norm, uz / norm
        x0 = dr * math.cos(phi0)
        y0 = dr * math.sin(phi0)
        z0 = dz
        for i in range(n_points):
            s = s_max * i / max(n_points - 1, 1)
            xx = (x0 + ux * s) * LENGTH_SCALE
            yy = (y0 + uy * s) * LENGTH_SCALE
            zz = (z0 + uz * s) * LENGTH_SCALE
            if (xx * xx + yy * yy) ** 0.5 > r_limit or abs(zz) > z_limit:
                break
            pts.append([xx, yy, zz])
        return pts

    alpha = 1.0 / kappa
    pts = []
    for i in range(n_points):
        s = s_max * i / max(n_points - 1, 1)
        dphi = s * kappa
        x = (dr + alpha) * math.cos(phi0) - alpha * math.cos(phi0 + dphi)
        y = (dr + alpha) * math.sin(phi0) - alpha * math.sin(phi0 + dphi)
        z = dz + s * tanl
        xx = x * LENGTH_SCALE
        yy = y * LENGTH_SCALE
        zz = z * LENGTH_SCALE
        if (xx * xx + yy * yy) ** 0.5 > r_limit or abs(zz) > z_limit:
            break
        pts.append([xx, yy, zz])
    return pts


def build_track_points_from_kal(trk):
    """
    Build stable Kal track from BESIII 5-parameter helix directly.
    """
    mdc_rmax = get_mdc_radius_max()
    pts, _ = build_track_points_from_kal_helix5(
        trk,
        n_points=90,
        r_limit=mdc_rmax + 10.0,
        z_limit=1400.0,
    )
    return pts


def wrap_to_pi(v):
    twopi = 2.0 * math.pi
    return ((v + math.pi) % twopi) - math.pi


def build_track_points_from_kal_helix5(trk, n_points=90, r_limit=900.0, z_limit=1400.0):
    """
    Build track points directly from BESIII 5-parameter Kal helix.
    Returns (points, debug_info).
    """
    # Prefer z-helix which is usually referenced at origin and close to POCA.
    zhelix = _safe_get(trk, "m_zhelix")
    lhelix = _safe_get(trk, "m_lhelix")
    lpivot = _safe_get(trk, "m_lpivot")
    poca = _safe_get(trk, "m_poca")
    lpoint = _safe_get(trk, "m_lpoint")
    if zhelix is not None and len(zhelix) >= 5:
        hel = [float(zhelix[i]) for i in range(5)]
        xref, yref, zref = 0.0, 0.0, 0.0
        helix_tag = "zhelix"
    elif lhelix is not None and lpivot is not None and len(lhelix) >= 5 and len(lpivot) >= 3:
        hel = [float(lhelix[i]) for i in range(5)]
        xref = float(lpivot[0]) * LENGTH_SCALE
        yref = float(lpivot[1]) * LENGTH_SCALE
        zref = float(lpivot[2]) * LENGTH_SCALE
        helix_tag = "lhelix"
    else:
        return [], {"reason": "missing_kal_helix"}

    dr = hel[0] * LENGTH_SCALE
    phi0 = hel[1]
    kappa = hel[2]
    dz = hel[3] * LENGTH_SCALE
    tanl = hel[4]
    if abs(kappa) < 1e-9:
        return [], {"reason": "kappa_too_small", "kappa": kappa}

    # Use Kal endpoints as fit constraints.
    if poca is None or lpoint is None or len(poca) < 3 or len(lpoint) < 3:
        return [], {"reason": "missing_poca_or_lpoint"}
    p0 = [float(poca[0]) * LENGTH_SCALE, float(poca[1]) * LENGTH_SCALE, float(poca[2]) * LENGTH_SCALE]
    p1 = [float(lpoint[0]) * LENGTH_SCALE, float(lpoint[1]) * LENGTH_SCALE, float(lpoint[2]) * LENGTH_SCALE]
    def hpoint(phi, k_eff):
        r = ALPHA_BES3_MM / k_eff
        x = xref + dr * math.cos(phi0) + r * (math.cos(phi0) - math.cos(phi0 + phi))
        y = yref + dr * math.sin(phi0) + r * (math.sin(phi0) - math.sin(phi0 + phi))
        z = zref + dz - r * phi * tanl
        return [x, y, z], r

    candidates = []
    for kflip in (1.0, -1.0):
        k_eff = kappa * kflip
        r_eff = ALPHA_BES3_MM / k_eff
        # Solve phi from XY geometry to match lpoint.
        cx = xref + (dr + r_eff) * math.cos(phi0)
        cy = yref + (dr + r_eff) * math.sin(phi0)
        ang0 = math.atan2(p0[1] - cy, p0[0] - cx)
        ang1 = math.atan2(p1[1] - cy, p1[0] - cx)
        dphi_base = wrap_to_pi(ang1 - ang0)
        # Try neighboring 2pi branches and both propagation directions.
        for n in (-2, -1, 0, 1, 2):
            for s in (1.0, -1.0):
                phi_end = (dphi_base + 2.0 * math.pi * n) * s
                # Keep display segment moderate but allow enough curvature.
                phi_draw = phi_end
                if abs(phi_draw) < 0.15:
                    phi_draw = 0.15 if phi_draw >= 0 else -0.15
                phi_draw = max(-1.4, min(1.4, phi_draw))

                pts = []
                for i in range(n_points):
                    t = i / max(n_points - 1, 1)
                    phi = phi_draw * t
                    p, _ = hpoint(phi, k_eff)
                    rr = math.hypot(p[0], p[1])
                    if rr > r_limit or abs(p[2]) > z_limit:
                        if len(pts) > 8:
                            break
                        continue
                    pts.append(p)
                if len(pts) < 2:
                    continue

                # Endpoint matching uses true phi_end (not clipped phi_draw).
                pend_true, _ = hpoint(phi_end, k_eff)
                d_end = math.sqrt((pend_true[0] - p1[0]) ** 2 + (pend_true[1] - p1[1]) ** 2 + (pend_true[2] - p1[2]) ** 2)

                pstart = pts[0]
                pnext = pts[min(3, len(pts) - 1)]
                vx = pnext[0] - pstart[0]
                vy = pnext[1] - pstart[1]
                ux = p1[0] - p0[0]
                uy = p1[1] - p0[1]
                vnorm = max(1e-9, math.hypot(vx, vy))
                unorm = max(1e-9, math.hypot(ux, uy))
                dir_align = (vx * ux + vy * uy) / (vnorm * unorm)
                reverse_penalty = 1200.0 if dir_align < 0 else 0.0
                # Prefer shorter branch that still matches p1.
                branch_penalty = 40.0 * abs(n)
                score = d_end + reverse_penalty + branch_penalty
                candidates.append(
                    {
                        "tag": f"{helix_tag}:kflip={int(kflip)}:n={n}:s={int(s)}",
                        "k_eff": k_eff,
                        "phi_end": phi_end,
                        "phi_draw": phi_draw,
                        "r_eff": r_eff,
                        "score": score,
                        "dir_align": dir_align,
                        "pts": pts,
                    }
                )

    if not candidates:
        return [], {"reason": "no_helix_candidate", "kappa": kappa}
    best = min(candidates, key=lambda c: c["score"])
    info = {
        "phi_source": best["tag"],
        "phi_end": best["phi_end"],
        "phi_draw": best["phi_draw"],
        "kappa": kappa,
        "kappa_eff": best["k_eff"],
        "tanl": tanl,
        "dr_mm": dr,
        "dz_mm": dz,
        "pivot_mm": [xref, yref, zref],
        "radius_mm": best["r_eff"],
        "fit_score": best["score"],
        "dir_align": best["dir_align"],
    }
    return best["pts"], info


def build_curved_polyline(p0, p1, q_over_p, n_points=44):
    """
    Stable visualization curve between Kal points.
    Uses q/p sign for bending direction, and limits sagitta to avoid unphysical arcs.
    """
    x0, y0, z0 = p0
    x1, y1, z1 = p1
    dx = x1 - x0
    dy = y1 - y0
    dz = z1 - z0
    len_xy = math.hypot(dx, dy)
    if len_xy < 1e-6:
        return [p0, p1]

    px = -dy / len_xy
    py = dx / len_xy
    sign = 1.0 if q_over_p >= 0 else -1.0
    # Keep curvature modest and detector-scale.
    sagitta = min(60.0, max(6.0, abs(q_over_p) * 18.0)) * sign

    pts = []
    for i in range(n_points):
        t = i / max(n_points - 1, 1)
        bend = 4.0 * t * (1.0 - t) * sagitta
        x = x0 + dx * t + px * bend
        y = y0 + dy * t + py * bend
        z = z0 + dz * t
        if math.hypot(x, y) > 900.0 or abs(z) > 1400.0:
            if len(pts) > 8:
                break
            continue
        pts.append([x, y, z])
    return pts if len(pts) >= 2 else [p0, p1]


def decode_mdcid(mdcid):
    """Decode BESIII MDC id using Identifier/MdcID masks."""
    uid = int(mdcid) & 0xFFFFFFFF
    layer = (uid & 0x00007E00) >> 9
    wire = uid & 0x000001FF
    return layer, wire


def decode_emcid(cellid):
    uid = int(cellid) & 0xFFFFFFFF
    part = (uid & 0x000F0000) >> 16
    theta = (uid & 0x00003F00) >> 8
    phi = uid & 0x000000FF
    return part, theta, phi


def decode_tofid(tofid):
    uid = int(tofid) & 0xFFFFFFFF
    barrel_ec = (uid & 0x0000C000) >> 14
    layer = (uid & 0x00000100) >> 8
    phi_module = (uid & 0x000000FE) >> 1
    end = uid & 0x00000001
    return barrel_ec, layer, phi_module, end


def decode_mucid(mucid):
    uid = int(mucid) & 0xFFFFFFFF
    part = (uid & 0x000F0000) >> 16
    seg = (uid & 0x0000F000) >> 12
    gap = (uid & 0x00000F00) >> 8
    strip = uid & 0x000000FF
    return part, seg, gap, strip


def is_tof_counter(status):
    return (((int(status) & 0x00000004) >> 2) != 0)


def is_tof_barrel(status):
    return (((int(status) & 0x00000010) >> 4) != 0)


def _load_muc_strip_map():
    p = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "views", "muc_strip_map.json"))
    if not os.path.exists(p):
        return {}
    try:
        with open(p, "r", encoding="utf-8") as fin:
            d = json.load(fin)
        return d.get("strips", {}) if isinstance(d, dict) else {}
    except Exception:
        return {}


def _build_muc_index(muc_strip_map):
    idx = {}
    for k, v in muc_strip_map.items():
        if not isinstance(k, str) or not isinstance(v, dict):
            continue
        m = re.match(r"^P(\d+)S(\d+)G(\d+)R(\d+)$", k)
        if not m:
            continue
        p, s, g, r = [int(m.group(i)) for i in range(1, 5)]
        idx.setdefault((p, s, g), []).append((r, v))
    for key in list(idx.keys()):
        idx[key].sort(key=lambda x: x[0])
    return idx


def _resolve_muc_row(muc_strip_map, muc_index, part, seg, gap, strip):
    # 1) Direct key.
    key = f"P{int(part)}S{int(seg)}G{int(gap)}R{int(strip)}"
    row = muc_strip_map.get(key)
    if isinstance(row, dict) and row:
        return row, "geom_map"

    # 2) Barrel segment remap: data may use 0..7 while map stores folded {0,2}.
    seg_candidates = [int(seg)]
    if int(part) == 1:
        seg_candidates.extend([int(seg) % 4, int(seg) % 2 * 2, (int(seg) + 2) % 4])
    seg_candidates = list(dict.fromkeys(seg_candidates))

    # 3) Nearest strip fallback inside the resolved (part,seg,gap) bucket.
    for s_try in seg_candidates:
        bucket = muc_index.get((int(part), int(s_try), int(gap)))
        if not bucket:
            continue
        r_near, row_near = min(bucket, key=lambda x: abs(x[0] - int(strip)))
        if isinstance(row_near, dict) and row_near:
            return row_near, f"geom_map_nearest(seg={s_try},strip={r_near})"

    return {}, "approx"


MDC_LAYER_NCELL = [
    40, 44, 48, 56, 64, 72, 80, 80,
    76, 76, 88, 88, 100, 100, 112, 112, 128, 128, 140, 140,
    160, 160, 176, 176, 196, 196, 216, 216, 240, 240, 256, 256, 272, 272,
    288, 288, 288, 288, 288, 288, 288, 288, 288,
]


MDC_LAYER_GEOM_CACHE = None


def _stereo_twist_by_layer(layer_idx):
    # Approximate endplate-induced wire twist (phi shift at |z|=zmax).
    # 0-based layers:
    # 0-7 stereo (inner), 8-19 axial, 20-35 stereo (outer), 36-42 axial.
    # Alternate sign by neighboring layer as in stereo superlayer convention.
    sign = 1.0 if (layer_idx % 2 == 0) else -1.0
    if 0 <= layer_idx <= 7:
        return sign * 0.22
    if 20 <= layer_idx <= 35:
        return sign * 0.12
    return 0.0


def _load_mdc_layer_geom():
    global MDC_LAYER_GEOM_CACHE
    if MDC_LAYER_GEOM_CACHE is not None:
        return MDC_LAYER_GEOM_CACHE

    # Defaults if no geometry hint can be parsed.
    radius = {}
    phi0 = {}
    wire_xy = {}
    for i in range(43):
        radius[i] = 59.0 + (810.0 - 59.0) * (i / 42.0)
        phi0[i] = 0.0
        wire_xy[i] = {}

    default_gdml = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "data", "views", "Mdc_approx.gdml")
    )
    gdml_path = os.environ.get("BES3_MDC_GDML_APPROX", default_gdml)
    if os.path.exists(gdml_path):
        pat_template = re.compile(
            r'name="physical(?:Axial|Stereo)Layer(\d+)(?:_\d+)?SignalWire\d+inlogicalMdc(?:Axial|Stereo)Layer\d+(?:_\d+)?Cellp"[^>]*x="([^"]+)"[^>]*y="([^"]+)"'
        )
        pat_cell_rot = re.compile(
            r'name="physicalMdc(?:Axial|Stereo)Layer(\d+)(?:_\d+)?Cell(\d+)inlogicalMdc(?:Axial|Stereo)Layer\d+(?:_\d+)?r"[^>]*z="([^"]+)"'
        )
        try:
            templates = {}
            cell_rots = {}
            with open(gdml_path, "r", encoding="utf-8", errors="ignore") as fin:
                for line in fin:
                    mt = pat_template.search(line)
                    if mt:
                        lyr = int(mt.group(1))
                        if 0 <= lyr <= 42 and lyr not in templates:
                            x = float(mt.group(2))
                            y = float(mt.group(3))
                            templates[lyr] = (x, y)
                            radius[lyr] = math.hypot(x, y)
                            phi0[lyr] = math.atan2(y, x)
                    mr = pat_cell_rot.search(line)
                    if mr:
                        lyr = int(mr.group(1))
                        wid = int(mr.group(2))
                        rotz = float(mr.group(3))
                        if 0 <= lyr <= 42:
                            cell_rots.setdefault(lyr, {})[wid] = rotz
            # Build physical-node-driven wire anchors from template local pos + cell rotation.
            for lyr, txy in templates.items():
                tx, ty = txy
                rots = cell_rots.get(lyr, {})
                if not rots:
                    continue
                for wid, ang in rots.items():
                    ca = math.cos(ang)
                    sa = math.sin(ang)
                    xw = tx * ca - ty * sa
                    yw = tx * sa + ty * ca
                    wire_xy[lyr][wid] = (xw, yw)
        except Exception:
            pass

    MDC_LAYER_GEOM_CACHE = {"radius": radius, "phi0": phi0, "wire_xy": wire_xy}
    return MDC_LAYER_GEOM_CACHE


def get_mdc_radius_max():
    geom = _load_mdc_layer_geom()
    vals = [float(v) for v in geom.get("radius", {}).values()]
    if not vals:
        return 810.0
    return max(vals)


def mdc_hit_xyz_from_id(layer, wire, zhit_mm, layer_phi_offset=None):
    lyr = max(0, min(42, int(layer)))
    geom = _load_mdc_layer_geom()
    r = float(geom["radius"].get(lyr, 59.0 + (810.0 - 59.0) * (lyr / 42.0)))
    ncell = MDC_LAYER_NCELL[lyr] if 0 <= lyr < len(MDC_LAYER_NCELL) else 288
    w = int(wire) % max(ncell, 1)
    xy_map = geom.get("wire_xy", {}).get(lyr, {})
    if w in xy_map:
        x, y = xy_map[w]
        phi = math.atan2(y, x)
    else:
        dphi = 2.0 * math.pi / max(ncell, 1)
        phi = -((w + 0.5) * dphi) + MDC_PHI_SHIFT
        if layer_phi_offset is not None:
            phi += float(layer_phi_offset)
        x = r * math.cos(phi)
        y = r * math.sin(phi)
    z = max(-1400.0, min(1400.0, float(zhit_mm)))
    # Stereo wire: x/y depends on z along the wire.
    twist = _stereo_twist_by_layer(lyr)
    if abs(twist) > 1e-9:
        z_norm = z / 1400.0
        phi_z = phi + z_norm * twist
        x = r * math.cos(phi_z)
        y = r * math.sin(phi_z)
    y *= MDC_Y_SIGN
    return [x, y, z]


def mdc_wire_dir(layer, wire, zhit_mm, layer_phi_offset=None):
    lyr = max(0, min(42, int(layer)))
    ncell = MDC_LAYER_NCELL[lyr] if 0 <= lyr < len(MDC_LAYER_NCELL) else 288
    w = int(wire) % max(ncell, 1)
    geom = _load_mdc_layer_geom()
    xy_map = geom.get("wire_xy", {}).get(lyr, {})
    if w in xy_map:
        x0, y0 = xy_map[w]
        phi = math.atan2(y0, x0)
    else:
        dphi = 2.0 * math.pi / max(ncell, 1)
        phi = -((w + 0.5) * dphi) + MDC_PHI_SHIFT
        if layer_phi_offset is not None:
            phi += float(layer_phi_offset)
    z = max(-1400.0, min(1400.0, float(zhit_mm)))
    twist = _stereo_twist_by_layer(lyr)
    zmax = 1400.0
    dphi_dz = (twist / zmax) if abs(twist) > 1e-12 else 0.0
    if abs(dphi_dz) < 1e-12:
        return [0.0, 0.0, 1.0], "axial"
    r = float(geom["radius"].get(lyr, 59.0 + (810.0 - 59.0) * (lyr / 42.0)))
    phi_z = phi + (z / zmax) * twist
    # Tangent of wire trajectory parameterized by z.
    tx = -r * math.sin(phi_z) * dphi_dz
    ty = r * math.cos(phi_z) * dphi_dz
    tz = 1.0
    ty *= MDC_Y_SIGN
    norm = math.sqrt(tx * tx + ty * ty + tz * tz)
    if norm < 1e-12:
        return [0.0, 0.0, 1.0], "axial"
    return [tx / norm, ty / norm, tz / norm], "stereo"


def estimate_mdc_layer_phi_offsets(mdc_hits_col, track_points_map):
    """
    Estimate per-layer phi offset from track-associated hits in this event.
    This calibrates wire azimuth convention toward BesVis-like alignment.
    """
    by_layer = {}
    for h in mdc_hits_col:
        tid = int(_safe_get(h, "m_trkid", -1))
        if tid < 0 or tid not in track_points_map:
            continue
        mdcid = int(_safe_get(h, "m_mdcid", _safe_get(h, "m_id", 0)))
        layer, wire = decode_mdcid(mdcid)
        zhit = float(_safe_get(h, "m_zhit", 0.0)) * LENGTH_SCALE
        by_layer.setdefault(layer, []).append((wire, zhit, track_points_map[tid]))

    layer_offsets = {}
    for layer, arr in by_layer.items():
        lyr = max(0, min(42, int(layer)))
        ncell = MDC_LAYER_NCELL[lyr] if 0 <= lyr < len(MDC_LAYER_NCELL) else 288
        dphi = 2.0 * math.pi / max(ncell, 1)
        if len(arr) < 4:
            layer_offsets[lyr] = 0.0
            continue

        best_off = 0.0
        best_score = 1.0e30
        # Search within one cell size around nominal phase.
        for i in range(-24, 25):
            off = (i / 24.0) * dphi
            score = 0.0
            count = 0
            for wire, zhit, trk_pts in arr:
                hp = mdc_hit_xyz_from_id(lyr, wire, zhit, layer_phi_offset=off)
                tp = sample_polyline_by_z(trk_pts, hp[2])
                dx = hp[0] - tp[0]
                dy = hp[1] - tp[1]
                score += math.hypot(dx, dy)
                count += 1
            if count > 0:
                score /= count
            if score < best_score:
                best_score = score
                best_off = off
        layer_offsets[lyr] = best_off
    return layer_offsets


def polyline_arclength(points):
    if not points or len(points) < 2:
        return 0.0, [0.0]
    cum = [0.0]
    total = 0.0
    for i in range(1, len(points)):
        dx = points[i][0] - points[i - 1][0]
        dy = points[i][1] - points[i - 1][1]
        dz = points[i][2] - points[i - 1][2]
        total += math.sqrt(dx * dx + dy * dy + dz * dz)
        cum.append(total)
    return total, cum


def sample_polyline(points, target_s):
    if not points:
        return [0.0, 0.0, 0.0]
    if len(points) == 1:
        return list(points[0])
    total, cum = polyline_arclength(points)
    if total < 1e-6:
        return list(points[0])
    s = max(0.0, min(float(target_s), total))
    for i in range(1, len(cum)):
        if cum[i] >= s:
            s0 = cum[i - 1]
            s1 = cum[i]
            t = 0.0 if s1 <= s0 else (s - s0) / (s1 - s0)
            p0 = points[i - 1]
            p1 = points[i]
            return [
                p0[0] + (p1[0] - p0[0]) * t,
                p0[1] + (p1[1] - p0[1]) * t,
                p0[2] + (p1[2] - p0[2]) * t,
            ]
    return list(points[-1])


def sample_polyline_by_z(points, target_z):
    if not points:
        return [0.0, 0.0, 0.0]
    best = points[0]
    best_dz = abs(points[0][2] - target_z)
    for p in points[1:]:
        dz = abs(p[2] - target_z)
        if dz < best_dz:
            best = p
            best_dz = dz
    return list(best)


def build_track_points_from_mdc_helix(mdc_trk, kal_ref=None, n_points=90, r_limit=900.0, z_limit=1400.0):
    helix = _safe_get(mdc_trk, "m_helix")
    if helix is None or len(helix) < 5:
        return [], {"reason": "missing_mdc_helix"}
    dr = float(helix[0]) * LENGTH_SCALE
    phi0 = float(helix[1])
    kappa = float(helix[2])
    dz = float(helix[3]) * LENGTH_SCALE
    tanl = float(helix[4])
    if abs(kappa) < 1e-9:
        return [], {"reason": "kappa_too_small", "kappa": kappa}

    # Start point: follow REC-MDC pivot (closer to BesVis recTrack x/y/z usage).
    vx0 = _safe_get(mdc_trk, "m_vx0")
    vy0 = _safe_get(mdc_trk, "m_vy0")
    vz0 = _safe_get(mdc_trk, "m_vz0")
    if vx0 is not None and vy0 is not None and vz0 is not None:
        p0 = [float(vx0) * LENGTH_SCALE, float(vy0) * LENGTH_SCALE, float(vz0) * LENGTH_SCALE]
    else:
        p0 = [dr * math.cos(phi0), dr * math.sin(phi0), dz]
    # If REC pivot is near origin, prefer Kal POCA as visual start anchor.
    if kal_ref is not None and math.hypot(p0[0], p0[1]) < 1.0 and abs(p0[2]) < 5.0:
        poca = _safe_get(kal_ref, "m_poca")
        if poca is not None and len(poca) >= 3:
            p0 = [float(poca[0]) * LENGTH_SCALE, float(poca[1]) * LENGTH_SCALE, float(poca[2]) * LENGTH_SCALE]

    # Optional target to choose branch (not for drawing fit itself).
    target = None
    if kal_ref is not None:
        lpoint = _safe_get(kal_ref, "m_lpoint")
        if lpoint is not None and len(lpoint) >= 3:
            target = [float(lpoint[0]) * LENGTH_SCALE, float(lpoint[1]) * LENGTH_SCALE, float(lpoint[2]) * LENGTH_SCALE]

    # Momentum from helix convention (same as CgemHelix::GetHelixDirection at phi=0).
    pt = 1.0 / max(abs(kappa), 1e-9)
    pz = pt * tanl
    pabs = math.sqrt(pt * pt + pz * pz)
    px0 = -pt * math.sin(phi0)
    py0 = pt * math.cos(phi0)
    psi0 = math.atan2(py0, px0)

    # BesVis uses field = -f_Magnetic, with f_Magnetic default 1 T.
    bz_tesla = -1.0
    k_b = 0.299792458  # GeV/(c*T*m)
    step_mm = 10.0
    max_steps = 700

    # Fix convention to avoid branch mis-selection:
    # BES data commonly needs q opposite to raw kappa sign in this transport setup.
    q = -(1.0 if kappa > 0 else -1.0)
    psi = psi0
    x, y, z = p0
    omega = q * bz_tesla * k_b / max(pt, 1e-9)  # rad/m
    ds_m = step_mm / 1000.0
    dpsi = omega * ds_m

    pts = []
    best_dist = 1.0e30
    for _ in range(max_steps):
        rr = math.hypot(x, y)
        if rr > r_limit or abs(z) > z_limit:
            if len(pts) > 8:
                break
        else:
            p = [x, y, z]
            pts.append(p)
            if target is not None:
                d = math.sqrt((x - target[0]) ** 2 + (y - target[1]) ** 2 + (z - target[2]) ** 2)
                if d < best_dist:
                    best_dist = d

        # TGeoHelix-like step transport in uniform Bz.
        if abs(omega) > 1e-12:
            x += (math.sin(psi + dpsi) - math.sin(psi)) / omega * 1000.0
            y += (-math.cos(psi + dpsi) + math.cos(psi)) / omega * 1000.0
            psi += dpsi
        else:
            x += math.cos(psi) * step_mm
            y += math.sin(psi) * step_mm
        z += (pz / max(pabs, 1e-9)) * step_mm

    if len(pts) < 2:
        return [], {"reason": "no_mdc_helix_candidate"}

    p1s = pts[min(3, len(pts) - 1)]
    vx = p1s[0] - pts[0][0]
    vy = p1s[1] - pts[0][1]
    vnorm = max(1e-9, math.hypot(vx, vy))
    tx = math.cos(psi0)
    ty = math.sin(psi0)
    tnorm = max(1e-9, math.hypot(tx, ty))
    dir_align = (vx * tx + vy * ty) / (vnorm * tnorm)

    info = {
        "phi_source": "mdc_besvis_step:fixed_q_and_phi",
        "phi_end": dpsi * max(len(pts) - 1, 1),
        "phi_draw": dpsi * max(len(pts) - 1, 1),
        "kappa": kappa,
        "kappa_eff": -kappa,
        "tanl": tanl,
        "dr_mm": dr,
        "dz_mm": dz,
        "pivot_mm": p0,
        "radius_mm": (pt / max(k_b * abs(bz_tesla), 1e-9)) * 1000.0,
        "fit_score": best_dist if target is not None else -1.0,
        "dir_align": dir_align,
        "best_dist_to_lpoint": best_dist if target is not None else -1.0,
    }
    return pts, info


def convert_rec_to_event(rec_path, entry_idx=0):
    f = uproot.open(rec_path)
    tree = f["Event"]

    run_number = int(_entry_array(tree, "TEvtHeader/m_runId", entry_idx))
    event_number = int(_entry_array(tree, "TEvtHeader/m_eventId", entry_idx))

    tracks_col = _entry_array_first(
        tree,
        ["TRecEvent/m_recMdcTrackCol", "TDstEvent/m_mdcTrackCol"],
        entry_idx,
        default=[],
    )
    kal_col = _entry_array_first(
        tree,
        ["TRecEvent/m_recMdcKalTrackCol", "TDstEvent/m_mdcKalTrackCol"],
        entry_idx,
        default=[],
    )
    evt_col = _entry_array(tree, "TEvtRecObject/m_evtRecTrackCol", entry_idx)
    showers_col = _entry_array_first(
        tree,
        ["TRecEvent/m_recEmcShowerCol", "TDstEvent/m_emcTrackCol"],
        entry_idx,
        default=[],
    )
    mdc_hits_col = _entry_array_first(tree, ["TRecEvent/m_recMdcHitCol"], entry_idx, default=[])
    emc_hits_col = _entry_array_first(tree, ["TRecEvent/m_recEmcHitCol"], entry_idx, default=[])
    tof_tracks_col = _entry_array_first(
        tree,
        ["TRecEvent/m_recTofTrackCol", "TDstEvent/m_tofTrackCol"],
        entry_idx,
        default=[],
    )
    muc_tracks_col = _entry_array_first(
        tree,
        ["TRecEvent/m_recMucTrackCol", "TDstEvent/m_mucTrackCol"],
        entry_idx,
        default=[],
    )
    muc_digi_col = _entry_array_first(tree, ["TDigiEvent/m_mucDigiCol"], entry_idx, default=[])
    dedx_col = _entry_array_first(tree, ["TRecEvent/m_recMdcDedxCol"], entry_idx, default=[])

    dedx_by_tid = {}
    for dx in dedx_col:
        tid = int(_safe_get(dx, "m_trackId", -1))
        if tid >= 0 and tid not in dedx_by_tid:
            dedx_by_tid[tid] = dx

    tof_by_tid = {}
    for tf in tof_tracks_col:
        tid = int(_safe_get(tf, "m_trackID", -1))
        if tid < 0:
            continue
        tof_by_tid.setdefault(tid, []).append(tf)

    emc_by_tid = {}
    for sh in showers_col:
        tid = int(_safe_get(sh, "m_trackId", -1))
        if tid >= 0 and tid not in emc_by_tid:
            emc_by_tid[tid] = sh

    # Build selected REC track ids from evtRec links (closer to BesVis "REC Tracks").
    selected_mdc_ids = []
    selected_kal_ids = []
    mdc_to_kal = {}
    kal_by_trackid = {}
    for evtrk in evt_col:
        m = evtrk.all_members
        mid = int(m.get("m_mdcTrackId", -1))
        kid = int(m.get("m_mdcKalTrackId", -1))
        if mid >= 0:
            selected_mdc_ids.append(mid)
        if kid >= 0:
            selected_kal_ids.append(kid)
        if mid >= 0 and kid >= 0 and mid not in mdc_to_kal:
            mdc_to_kal[mid] = kid
    for i, ktrk in enumerate(kal_col):
        ktid = int(_safe_get(ktrk, "m_trackId", -1))
        if ktid >= 0 and ktid not in kal_by_trackid:
            kal_by_trackid[ktid] = i

    # De-duplicate while preserving order.
    selected_mdc_ids = list(dict.fromkeys(selected_mdc_ids))
    selected_kal_ids = list(dict.fromkeys(selected_kal_ids))

    tracks_stable = []

    # Prefer Kal tracks.
    for kid in selected_kal_ids:
        if kid < 0 or kid >= len(kal_col):
            continue
        trk = kal_col[kid]
        helix = _safe_get(trk, "m_lhelix")
        if helix is None or len(helix) < 5:
            helix = _safe_get(trk, "m_zhelix")
        if helix is None or len(helix) < 5:
            continue
        dr, phi0, kappa, dz, tanl = [float(x) for x in helix[:5]]
        theta = math.atan2(1.0, tanl) if abs(tanl) > 1e-12 else math.pi / 2.0
        p = 1.0 / abs(kappa) * math.sqrt(1.0 + tanl * tanl) if abs(kappa) > 1e-6 else 9999.0
        q = 1.0 if kappa > 0 else -1.0
        pos_stable = build_track_points_from_kal(trk)
        if len(pos_stable) < 2:
            pos_stable = build_track_points(helix)
        if len(pos_stable) < 2:
            continue
        base = {
            "trackId": int(_safe_get(trk, "m_trackId", kid)),
            "chi2": float(_first_or(0.0, _safe_get(trk, "m_chisq"))),
            "dof": int(_first_or(0, _safe_get(trk, "m_ndf"))),
            "nhits": int(_first_or(0, _safe_get(trk, "m_nhits"))),
            "phi": phi0,
            "theta": theta,
            "dparams": [dr * LENGTH_SCALE, dz * LENGTH_SCALE, phi0, theta, q / max(p, 1e-6)],
            "pt_debug": {
                "p_est": p,
                "q": q,
                "kappa": kappa,
                "source": "kal",
            },
        }
        if len(pos_stable) >= 2:
            t = dict(base)
            tid = int(base["trackId"])
            t["pid"] = build_pid_info(
                tid,
                float(base.get("pt_debug", {}).get("p_est", 0.0)),
                dedx_by_tid.get(tid),
                tof_by_tid.get(tid, []),
                emc_by_tid.get(tid),
            )
            t["pos"] = pos_stable
            t["color"] = "0xff4d4d"
            t["mode"] = "stable"
            tracks_stable.append(t)

    # Fallback to Mdc tracks if Kal links are unavailable.
    if not tracks_stable:
        src_indices = selected_mdc_ids if selected_mdc_ids else list(range(len(tracks_col)))
        for mid in src_indices:
            if mid < 0 or mid >= len(tracks_col):
                continue
            trk = tracks_col[mid]
            helix = _safe_get(trk, "m_helix")
            if helix is None or len(helix) < 5:
                continue
            dr, phi0, kappa, dz, tanl = [float(x) for x in helix]
            theta = math.atan2(1.0, tanl) if abs(tanl) > 1e-12 else math.pi / 2.0
            p = 1.0 / abs(kappa) * math.sqrt(1.0 + tanl * tanl) if abs(kappa) > 1e-6 else 9999.0
            q = 1.0 if kappa > 0 else -1.0
            pos = build_track_points(helix)
            if len(pos) < 2:
                continue
            t = (
                {
                    "trackId": int(_safe_get(trk, "m_trackId", mid)),
                    "chi2": float(_safe_get(trk, "m_chi2", 0.0)),
                    "dof": int(_safe_get(trk, "m_ndof", 0)),
                    "nhits": int(_safe_get(trk, "m_nhits", 0)),
                    "phi": phi0,
                    "theta": theta,
                    "dparams": [dr * LENGTH_SCALE, dz * LENGTH_SCALE, phi0, theta, q / max(p, 1e-6)],
                    "pid": build_pid_info(
                        int(_safe_get(trk, "m_trackId", mid)),
                        p,
                        dedx_by_tid.get(int(_safe_get(trk, "m_trackId", mid))),
                        tof_by_tid.get(int(_safe_get(trk, "m_trackId", mid)), []),
                        emc_by_tid.get(int(_safe_get(trk, "m_trackId", mid))),
                    ),
                    "pos": pos,
                    "color": "0xff4d4d",
                    "mode": "stable",
                }
            )
            tracks_stable.append(t)

    # BesVis-style philosophy: hit position comes from wire geometry + hit payload,
    # not by fitting against reconstructed track polyline.
    layer_phi_offsets = {}

    # Build MDC hit-level objects from wire geometry with calibrated layer phase.
    mdc_hits = []
    for h in mdc_hits_col:
        tid = int(_safe_get(h, "m_trkid", -1))
        zhit = float(_safe_get(h, "m_zhit", 0.0)) * LENGTH_SCALE
        mdcid = int(_safe_get(h, "m_mdcid", _safe_get(h, "m_id", 0)))
        layer, wire = decode_mdcid(mdcid)
        pos = mdc_hit_xyz_from_id(layer, wire, zhit, layer_phi_offset=layer_phi_offsets.get(layer, 0.0))
        pos_source = "wire"
        wire_dir, wire_type = mdc_wire_dir(layer, wire, zhit, layer_phi_offset=layer_phi_offsets.get(layer, 0.0))
        wire_anchor = mdc_hit_xyz_from_id(layer, wire, 0.0, layer_phi_offset=layer_phi_offsets.get(layer, 0.0))
        wire_half_len = 1150.0 if wire_type == "stereo" else 1350.0
        mdc_hits.append(
            {
                "trackId": tid,
                "mdcid": mdcid,
                "layer": int(layer),
                "layerRadius": float(_load_mdc_layer_geom().get("radius", {}).get(int(layer), -1.0)),
                "wire": int(wire),
                "adc": float(_safe_get(h, "m_adc", 0.0)),
                "tdc": float(_safe_get(h, "m_tdc", 0.0)),
                "driftT": float(_safe_get(h, "m_driftT", 0.0)),
                "doca": float(_safe_get(h, "m_doca", 0.0)),
                "lr": int(_safe_get(h, "m_lr", 0)),
                "pos": pos,
                "posSource": pos_source,
                "wireDir": wire_dir,
                "wireType": wire_type,
                "wireAnchor": wire_anchor,
                "wireHalfLen": wire_half_len,
            }
        )

    clusters = []
    for sh in showers_col:
        x = float(_safe_get(sh, "m_x", 0.0)) * LENGTH_SCALE
        y = float(_safe_get(sh, "m_y", 0.0)) * LENGTH_SCALE
        z = float(_safe_get(sh, "m_z", 0.0)) * LENGTH_SCALE
        r = math.sqrt(x * x + y * y + z * z)

        theta = float(_safe_get(sh, "m_theta", 0.0))
        phi = float(_safe_get(sh, "m_phi", 0.0))
        if theta == 0.0 and r > 0:
            theta = math.acos(max(-1.0, min(1.0, z / r)))
        if phi == 0.0:
            phi = math.atan2(y, x)

        clusters.append(
            {
                "trackId": int(_safe_get(sh, "m_trackId", -1)),
                "pdg": 22,
                "energy": float(_safe_get(sh, "m_energy", 0.0)) * 1000.0,  # GeV-scale for visibility
                "recoEnergyGeV": float(_safe_get(sh, "m_energy", 0.0)),
                "recoMomentumGeV": float(_safe_get(sh, "m_energy", 0.0)),
                "theta": theta,
                "phi": phi,
                "radius": r if r > 0 else 900.0,
                "pos": [x, y, z],
                "recoMomentumVec": [
                    float(_safe_get(sh, "m_energy", 0.0)) * math.sin(theta) * math.cos(phi),
                    float(_safe_get(sh, "m_energy", 0.0)) * math.sin(theta) * math.sin(phi),
                    float(_safe_get(sh, "m_energy", 0.0)) * math.cos(theta),
                ],
                "side": 22.0,
                "color": 0xffa726,
                "opacity": 0.8,
            }
        )

    emc_hits = []
    for h in emc_hits_col:
        cell_id = int(_safe_get(h, "m_cellId", -1))
        if cell_id < 0:
            continue
        part, theta, phi = decode_emcid(cell_id)
        # Keep the same barrel theta convention as BesVis:
        # if (part == 1) theta = 43 - theta;
        if int(part) == 1:
            theta = 43 - int(theta)
        emc_hits.append(
            {
                "cellId": cell_id,
                "part": int(part),
                "theta": int(theta),
                "phi": int(phi),
                "energy": float(_safe_get(h, "m_energy", 0.0)),
                "time": float(_safe_get(h, "m_time", 0.0)),
            }
        )

    tof_hits = []
    for th in tof_tracks_col:
        status = int(_safe_get(th, "m_status", 0))
        if not is_tof_counter(status):
            continue
        tofid = int(_safe_get(th, "m_tofID", -1))
        if tofid < 0:
            continue
        zrhit = float(_safe_get(th, "m_zrhit", 0.0)) * LENGTH_SCALE
        tof_t = float(_safe_get(th, "m_tof", 0.0))
        track_id = int(_safe_get(th, "m_trackID", -1))
        if is_tof_barrel(status):
            if 0 <= tofid <= 87:
                layer = 0
                scin = tofid
            else:
                layer = 1
                scin = tofid - 88
            nscin = 88.0
            phi = ((scin + 0.5) / nscin) * 2.0 * math.pi
            r = 810.0 if layer == 0 else 860.0
            x = r * math.cos(phi)
            y = r * math.sin(phi)
            z = max(-1200.0, min(1200.0, zrhit))
            part = 1
            sx, sy, sz = 26.0, 58.0, 85.0
        else:
            if 0 <= tofid <= 47:
                part = 2
                scin = tofid
                z = 1280.0
            else:
                part = 0
                scin = tofid - 48
                z = -1280.0
            nscin = 48.0
            phi = ((scin + 0.5) / nscin) * 2.0 * math.pi
            r = 760.0
            x = r * math.cos(phi)
            y = r * math.sin(phi)
            sx, sy, sz = 40.0, 40.0, 24.0
        tof_hits.append(
            {
                "trackId": track_id,
                "tofID": tofid,
                "status": status,
                "tof": tof_t,
                "zrhit": zrhit,
                "part": int(part),
                "layer": int(layer if is_tof_barrel(status) else 0),
                "scin": int(scin),
                "pos": [x, y, z],
                "size": [sx, sy, sz],
            }
        )

    muc_strip_map = _load_muc_strip_map()
    muc_strip_index = _build_muc_index(muc_strip_map)
    muc_time_by_id = {}
    for dg in muc_digi_col:
        did = int(_safe_get(dg, "m_intId", -1))
        if did < 0:
            continue
        tdc = float(_safe_get(dg, "m_timeChannel", -1.0))
        if tdc < 0:
            continue
        muc_time_by_id.setdefault(did, []).append(tdc)

    # Keep one stable time representative per strip id.
    for did, arr in list(muc_time_by_id.items()):
        arr.sort()
        muc_time_by_id[did] = arr[len(arr) // 2]

    muc_hits = []
    for mt in muc_tracks_col:
        depth = float(_safe_get(mt, "m_depth", -9.9))
        if depth <= 0:
            continue
        tid = int(_safe_get(mt, "m_trackId", -1))
        vec_hits = _safe_get(mt, "m_vecHits", [])
        for hid in vec_hits:
            hid_i = int(hid)
            part, seg, gap, strip = decode_mucid(hid_i)
            row, pos_source = _resolve_muc_row(
                muc_strip_map,
                muc_strip_index,
                part,
                seg,
                gap,
                strip,
            )
            if isinstance(row, dict) and row:
                x = float(row.get("x", 0.0))
                y = float(row.get("y", 0.0))
                z = float(row.get("z", 0.0))
                sx = float(row.get("sx", 120.0))
                sy = float(row.get("sy", 120.0))
                sz = float(row.get("sz", 24.0))
                ex = [float(v) for v in row.get("ex", [1.0, 0.0, 0.0])]
                ey = [float(v) for v in row.get("ey", [0.0, 1.0, 0.0])]
                ez = [float(v) for v in row.get("ez", [0.0, 0.0, 1.0])]
            else:
                # Fallback approximate placement if map is unavailable.
                if part == 1:
                    phi = ((seg + 0.5) / 8.0) * 2.0 * math.pi
                    r = 1750.0 + 95.0 * gap
                    z = ((strip + 0.5) / 112.0 - 0.5) * 2500.0
                    x = r * math.cos(phi)
                    y = r * math.sin(phi)
                    sx, sy, sz = 120.0, 420.0, 26.0
                else:
                    phi = ((seg + 0.5) / 4.0) * 2.0 * math.pi
                    rr = 320.0 + 20.0 * max(0, min(63, strip))
                    x = rr * math.cos(phi)
                    y = rr * math.sin(phi)
                    z = (1.0 if part == 2 else -1.0) * (1700.0 + 85.0 * gap)
                    sx, sy, sz = 150.0, 90.0, 30.0
                ex, ey, ez = [1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]
                pos_source = "approx"
            muc_hits.append(
                {
                    "trackId": tid,
                    "mucID": hid_i,
                    "part": int(part),
                    "seg": int(seg),
                    "gap": int(gap),
                    "strip": int(strip),
                    "depth": depth,
                    # MUC digi timing channel, mapped by strip intId (if available).
                    "timeChannel": float(muc_time_by_id.get(hid_i, -1.0)),
                    "pos": [x, y, z],
                    "size": [sx, sy, sz],
                    "basisX": ex,
                    "basisY": ey,
                    "basisZ": ez,
                    "posSource": pos_source,
                }
            )

    mc_tracks = []
    mc_truth_photons = []
    mc_meta_by_tid = {}
    for mc_branch in ("TMcEvent/m_mcParticleCol", "TMcEvent/m_mcParticleCol#"):
        try:
            mc_col = _entry_array(tree, mc_branch, entry_idx)
            # Pass 1: full tid -> pdg map so mother's PDG is known when filtering daughters.
            for mp in mc_col:
                tid = int(_as_float(_mc_member(mp, ["m_trackIndex"], -1), -1))
                pdg = int(_as_float(_mc_member(mp, ["m_particleID", "m_particleProperty", "m_pdgCode"], 0), 0))
                mother = int(_as_float(_mc_member(mp, ["m_mother"], -1), -1))
                if tid >= 0:
                    mc_meta_by_tid[tid] = {"pdg": pdg, "mother": mother}
            for mp in mc_col:
                track = _build_mc_truth_polyline(mp)
                if track is None:
                    ph = _build_mc_truth_photon_cluster(mp)
                    if ph is not None:
                        mc_truth_photons.append(ph)
                else:
                    # Skip beam electrons from generator entrance.
                    if abs(track["pdg"]) == 11 and track["mother"] < 0:
                        continue
                    mother_idx = int(track.get("mother", -1))
                    mother_pdg = mc_meta_by_tid.get(mother_idx, {}).get("pdg")
                    if _mother_is_charged_pion_or_kaon(mother_pdg):
                        continue
                    if _mother_is_muon(mother_pdg):
                        continue
                    mc_tracks.append(track)
            break
        except Exception:
            continue

    for trk in mc_tracks:
        mother_idx = int(trk.get("mother", -1))
        trk["motherPdg"] = mc_meta_by_tid.get(mother_idx, {}).get("pdg")
    for ph in mc_truth_photons:
        mother_idx = int(ph.get("mother", -1))
        ph["motherPdg"] = mc_meta_by_tid.get(mother_idx, {}).get("pdg")

    if mc_truth_photons and clusters:
        for cl in clusters:
            cx, cy, cz = cl.get("pos", [0.0, 0.0, 0.0])
            cu = _unit_vec(float(cx), float(cy), float(cz))
            e_reco = float(cl.get("recoEnergyGeV", 0.0))
            best = None
            for ph in mc_truth_photons:
                tv = ph.get("truthMomentumVec", [0.0, 0.0, 0.0])
                tu = _unit_vec(float(tv[0]), float(tv[1]), float(tv[2]))
                dot = max(-1.0, min(1.0, cu[0] * tu[0] + cu[1] * tu[1] + cu[2] * tu[2]))
                angle = math.acos(dot)
                e_truth = float(ph.get("truthEnergyGeV", 0.0))
                e_term = abs(e_reco - e_truth) / max(e_truth, 1e-6)
                score = angle + 0.08 * e_term
                if best is None or score < best["score"]:
                    best = {"score": score, "angle": angle, "ph": ph}
            if best is not None and best["angle"] < 0.35:
                ph = best["ph"]
                cl["truthTrackId"] = int(ph.get("trackId", -1))
                cl["truthPdg"] = int(ph.get("pdg", 22))
                cl["pdg"] = int(ph.get("pdg", 22))
                cl["truthMother"] = int(ph.get("mother", -1))
                cl["truthMotherPdg"] = ph.get("motherPdg")
                cl["truthEnergyGeV"] = float(ph.get("truthEnergyGeV", 0.0))
                cl["truthMomentumGeV"] = float(ph.get("truthMomentumGeV", 0.0))
                cl["truthMomentumVec"] = list(ph.get("truthMomentumVec", [0.0, 0.0, 0.0]))

    rec_name = os.path.basename(rec_path)
    key = f"REC-{run_number}-{event_number}-{rec_name}"
    return {
        key: {
            "runNumber": run_number,
            "eventNumber": event_number,
            "recFile": rec_name,
            "time": "REC data",
            "Tracks": {
                "REC MdcTrack (stable)": tracks_stable,
                "MC Truth": mc_tracks,
            },
            "CaloClusters": {"REC EmcShower": clusters, "MC Truth Photon": mc_truth_photons},
            "Hits": {
                "REC MdcHit": mdc_hits,
                "REC EmcHit": emc_hits,
                "REC TofHit": tof_hits,
                "REC MucHit": muc_hits,
            },
            "DebugMeta": {
                "track_count_stable": len(tracks_stable),
                "track_count_mc": len(mc_tracks),
                "cluster_count": len(clusters),
                "mdc_hit_count": len(mdc_hits),
                "emc_hit_count": len(emc_hits),
                "tof_hit_count": len(tof_hits),
                "muc_hit_count": len(muc_hits),
            },
        }
    }


def _load_selected_pairs(path):
    """Load (runId, eventId) pairs from a text file (one per line, space or comma separated)."""
    pairs = []
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.replace(",", " ").split()
        if len(parts) < 2:
            continue
        pairs.append((int(parts[0]), int(parts[1])))
    return pairs


def main():
    parser = argparse.ArgumentParser(
        description="Convert BESIII REC to Phoenix event JSON.\n"
                    "Supports single file, directory batch, and selected (runId,eventId) filter.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("rec_file", nargs="?", help="Input .rec ROOT file path")
    parser.add_argument("output_json", help="Output Phoenix events JSON path")
    parser.add_argument(
        "--rec-dir",
        default=None,
        help="Input directory containing multiple .rec files; convert all and merge events",
    )
    parser.add_argument(
        "--select",
        default=None,
        metavar="PAIRS_TXT",
        help="Text file with 'runId eventId' per line; only convert matching entries from rec_file",
    )
    args = parser.parse_args()

    # Mode 1: --select filter from a single multi-event rec file.
    if args.select:
        if not args.rec_file:
            raise ValueError("rec_file is required with --select")
        pairs = _load_selected_pairs(args.select)
        if not pairs:
            raise ValueError(f"No valid (runId,eventId) pairs in: {args.select}")
        f       = uproot.open(args.rec_file)
        tree    = f["Event"]
        run_arr = tree["TEvtHeader/m_runId"].array(library="np")
        evt_arr = tree["TEvtHeader/m_eventId"].array(library="np")
        index_map = {}
        for idx, (run_id, evt_id) in enumerate(zip(run_arr.tolist(), evt_arr.tolist())):
            key = (int(run_id), int(evt_id))
            if key not in index_map:
                index_map[key] = idx
        out, missing = {}, []
        for key in pairs:
            if key not in index_map:
                missing.append(key)
                continue
            out.update(convert_rec_to_event(args.rec_file, entry_idx=index_map[key]))
        if not out:
            raise RuntimeError("No selected events converted. Check --select file and rec_file.")
        if missing:
            for run_id, evt_id in missing:
                print(f"[warn] Missing pair run={run_id} event={evt_id}")
        print(f"Converted events: {len(out)}")

    # Mode 2: directory batch.
    elif args.rec_dir:
        rec_files = sorted(Path(args.rec_dir).glob("*.rec"))
        if not rec_files:
            raise FileNotFoundError(f"No .rec files found in: {args.rec_dir}")
        out = {}
        for rp in rec_files:
            try:
                out.update(convert_rec_to_event(str(rp)))
            except Exception as e:
                print(f"[warn] Skip {rp.name}: {e}")
        if not out:
            raise RuntimeError(f"No valid events converted from directory: {args.rec_dir}")

    # Mode 3: single file, first entry.
    else:
        if not args.rec_file:
            raise ValueError("rec_file is required unless --rec-dir is provided")
        out = convert_rec_to_event(args.rec_file, entry_idx=0)

    out_path = Path(args.output_json)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()

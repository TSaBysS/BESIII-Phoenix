#!/usr/bin/env python3
"""
prepare_geometry.py — GDML pre-processing for BESIII Phoenix visualization.

Two sub-commands:
  approximate  Replace unsupported GDML solids (irregBox → box, twistedtubs → tube)
               and deduplicate physvol names.  Used for EMC and MDC before ROOT export.

  split-mdc    Split an already-approximated MDC GDML into sub-views (inner / outer /
               outer_axial / outer_stereo) based on layer naming conventions.
"""
import argparse
import math
import re
from collections import Counter
import xml.etree.ElementTree as ET


# ── Approximate: irregBox / twistedtubs replacement ──────────────────────────

def _to_float(v: str) -> float:
    return float(v.strip())


def _fit_trap_from_irregbox(child: ET.Element):
    """
    Fit a GDML trap from irregBox vertices.
    Returns a dict of trap attributes on success, otherwise None.
    """
    pts = []
    for i in range(1, 9):
        pts.append((
            _to_float(child.attrib[f"x{i}"]),
            _to_float(child.attrib[f"y{i}"]),
            _to_float(child.attrib[f"z{i}"]),
        ))
    if len(pts) != 8:
        return None

    # Split into two z-planes (lower/upper) by z median.
    zvals = sorted(p[2] for p in pts)
    z_mid = 0.5 * (zvals[3] + zvals[4])
    low = [p for p in pts if p[2] <= z_mid]
    high = [p for p in pts if p[2] > z_mid]
    if len(low) != 4 or len(high) != 4:
        return None

    # Use PCA in XY to define a stable local (u,v) basis.
    mx = sum(p[0] for p in pts) / 8.0
    my = sum(p[1] for p in pts) / 8.0
    sxx = sum((p[0] - mx) * (p[0] - mx) for p in pts)
    syy = sum((p[1] - my) * (p[1] - my) for p in pts)
    sxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
    tr = sxx + syy
    det = sxx * syy - sxy * sxy
    disc = max(0.0, tr * tr * 0.25 - det)
    lam = tr * 0.5 + math.sqrt(disc)
    ux = sxy
    uy = lam - sxx
    n = math.hypot(ux, uy)
    if n < 1e-12:
        ux, uy = 1.0, 0.0
    else:
        ux, uy = ux / n, uy / n
    vx, vy = -uy, ux

    def to_uv(p):
        dx = p[0] - mx
        dy = p[1] - my
        return dx * ux + dy * uy, dx * vx + dy * vy

    low_uv = [to_uv(p) for p in low]
    high_uv = [to_uv(p) for p in high]

    def trap_face_params(face_uv):
        # Separate +/-v edges using median v.
        vs = sorted(v for _, v in face_uv)
        vm = 0.5 * (vs[1] + vs[2])
        neg = [(u, v) for (u, v) in face_uv if v <= vm]
        pos = [(u, v) for (u, v) in face_uv if v > vm]
        if len(neg) != 2 or len(pos) != 2:
            return None
        vneg = sum(v for _, v in neg) * 0.5
        vpos = sum(v for _, v in pos) * 0.5
        dy = max(1e-9, 0.5 * (vpos - vneg))
        xmin_neg = min(u for u, _ in neg)
        xmax_neg = max(u for u, _ in neg)
        xmin_pos = min(u for u, _ in pos)
        xmax_pos = max(u for u, _ in pos)
        dx_neg = max(1e-9, 0.5 * (xmax_neg - xmin_neg))
        dx_pos = max(1e-9, 0.5 * (xmax_pos - xmin_pos))
        xc_neg = 0.5 * (xmax_neg + xmin_neg)
        xc_pos = 0.5 * (xmax_pos + xmin_pos)
        alpha = math.atan((xc_pos - xc_neg) / max(1e-9, (2.0 * dy)))
        return dy, dx_neg, dx_pos, alpha

    low_face = trap_face_params(low_uv)
    high_face = trap_face_params(high_uv)
    if low_face is None or high_face is None:
        return None
    dy1, dx1, dx2, alpha1 = low_face
    dy2, dx3, dx4, alpha2 = high_face

    zc_low = sum(p[2] for p in low) / 4.0
    zc_high = sum(p[2] for p in high) / 4.0
    dz = max(1e-9, 0.5 * (zc_high - zc_low))

    low_uc = sum(u for (u, _) in low_uv) / 4.0
    low_vc = sum(v for (_, v) in low_uv) / 4.0
    high_uc = sum(u for (u, _) in high_uv) / 4.0
    high_vc = sum(v for (_, v) in high_uv) / 4.0
    du = high_uc - low_uc
    dv = high_vc - low_vc
    rho = math.hypot(du, dv)
    theta = math.atan2(rho, max(1e-9, 2.0 * dz))
    phi = math.atan2(dv, du) if rho > 1e-12 else 0.0

    return {
        "name": child.attrib["name"],
        "z": f"{dz:.9g}",
        "theta": f"{theta:.12g}",
        "phi": f"{phi:.12g}",
        "y1": f"{dy1:.9g}",
        "x1": f"{dx1:.9g}",
        "x2": f"{dx2:.9g}",
        "alpha1": f"{alpha1:.12g}",
        "y2": f"{dy2:.9g}",
        "x3": f"{dx3:.9g}",
        "x4": f"{dx4:.9g}",
        "alpha2": f"{alpha2:.12g}",
        "aunit": child.attrib.get("aunit", "radian"),
        "lunit": child.attrib.get("lunit", "mm"),
    }


def convert_irregbox(root: ET.Element):
    solids = root.find("solids")
    if solids is None:
        return 0, 0
    converted_trap = 0
    converted_box = 0
    for child in list(solids):
        if child.tag != "irregBox":
            continue
        idx = list(solids).index(child)
        trap_attr = _fit_trap_from_irregbox(child)
        if trap_attr is not None:
            new_solid = ET.Element("trap", trap_attr)
            converted_trap += 1
        else:
            xs = [_to_float(child.attrib[f"x{i}"]) for i in range(1, 9)]
            ys = [_to_float(child.attrib[f"y{i}"]) for i in range(1, 9)]
            zs = [_to_float(child.attrib[f"z{i}"]) for i in range(1, 9)]
            hx = (max(xs) - min(xs)) * 0.5
            hy = (max(ys) - min(ys)) * 0.5
            hz = (max(zs) - min(zs)) * 0.5
            new_solid = ET.Element("box", {
                "name": child.attrib["name"],
                "x": f"{hx:.9g}", "y": f"{hy:.9g}", "z": f"{hz:.9g}",
                "lunit": child.attrib.get("lunit", "mm"),
            })
            converted_box += 1
        solids.insert(idx, new_solid)
        solids.remove(child)
    return converted_trap, converted_box


def convert_twistedtubs_to_tubs(root: ET.Element) -> int:
    solids = root.find("solids")
    if solids is None:
        return 0
    converted = 0
    for child in list(solids):
        if child.tag != "twistedtubs":
            continue
        new_tubs = ET.Element("tube", {
            "name": child.attrib["name"],
            "rmin": child.attrib["endinnerrad"],
            "rmax": child.attrib["endouterrad"],
            "z": child.attrib["zlen"],
            "deltaphi": child.attrib.get("phi", "360"),
            "aunit": child.attrib.get("aunit", "degree"),
            "lunit": child.attrib.get("lunit", "mm"),
            "startphi": "0",
        })
        solids.insert(list(solids).index(child), new_tubs)
        solids.remove(child)
        converted += 1
    return converted


def rename_duplicate_physvol_names(root: ET.Element) -> int:
    renamed = 0
    physvols = list(root.iter("physvol"))
    names = [p.attrib.get("name", "") for p in physvols if "name" in p.attrib]
    dup_names = {n for n, c in Counter(names).items() if c > 1 and n}
    seq: Counter = Counter()
    for p in physvols:
        n = p.attrib.get("name", "")
        if n in dup_names:
            seq[n] += 1
            p.attrib["name"] = f"{n}_{seq[n]}"
            renamed += 1
    return renamed


def cmd_approximate(args: argparse.Namespace) -> int:
    tree = ET.parse(args.input_gdml)
    root = tree.getroot()
    ci_trap, ci_box = convert_irregbox(root)
    ct = convert_twistedtubs_to_tubs(root)
    cr = rename_duplicate_physvol_names(root)
    tree.write(args.output_gdml, encoding="utf-8", xml_declaration=True)
    print(f"Converted irregBox -> trap: {ci_trap}")
    print(f"Converted irregBox -> box (fallback): {ci_box}")
    print(f"Converted twistedtubs -> tube: {ct}")
    print(f"Renamed duplicated physvol names: {cr}")
    print(f"Wrote: {args.output_gdml}")
    return 0


# ── Split MDC GDML into inner / outer views ───────────────────────────────────

INNER_STEREO_RE = re.compile(r"^logicalMdcStereoLayer([0-7])$")
OUTER_STEREO_RE = re.compile(r"^logicalMdcStereoLayer(2[0-9]|3[0-5])$")
OUTER_AXIAL_RE  = re.compile(r"^logicalMdcAxialLayer(8|9|1[0-9]|3[6-9]|4[0-2])(?:_[01])?$")


def _match_view(ref_name: str, view: str) -> bool:
    if view == "inner":
        return INNER_STEREO_RE.match(ref_name) is not None
    if view == "outer_stereo":
        return OUTER_STEREO_RE.match(ref_name) is not None
    if view == "outer_axial":
        return OUTER_AXIAL_RE.match(ref_name) is not None
    if view == "outer":
        return OUTER_STEREO_RE.match(ref_name) is not None or OUTER_AXIAL_RE.match(ref_name) is not None
    return True


def _build_view(input_gdml: str, output_gdml: str, view: str) -> int:
    tree = ET.parse(input_gdml)
    root = tree.getroot()
    structure = root.find("structure")
    if structure is None:
        raise RuntimeError("No <structure> section found")
    logical_mdc = next(
        (v for v in structure.findall("volume") if v.attrib.get("name") == "logicalMdc"),
        None,
    )
    if logical_mdc is None:
        raise RuntimeError("No logicalMdc volume found")
    kept = 0
    for pv in list(logical_mdc.findall("physvol")):
        vr = pv.find("volumeref")
        ref_name = vr.attrib.get("ref", "") if vr is not None else ""
        if _match_view(ref_name, view):
            kept += 1
        else:
            logical_mdc.remove(pv)
    tree.write(output_gdml, encoding="utf-8", xml_declaration=True)
    return kept


def cmd_split_mdc(args: argparse.Namespace) -> int:
    views = ["inner", "outer", "outer_axial", "outer_stereo"]
    for v in views:
        out = f"{args.output_prefix}_{v}.gdml"
        kept = _build_view(args.input_gdml, out, v)
        print(f"[{v}] kept logicalMdc physvol count: {kept}, wrote: {out}")
    return 0


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_approx = sub.add_parser("approximate", help="Replace unsupported GDML solids and deduplicate physvol names.")
    p_approx.add_argument("input_gdml")
    p_approx.add_argument("output_gdml")

    p_split = sub.add_parser("split-mdc", help="Split MDC GDML into inner/outer sub-views.")
    p_split.add_argument("input_gdml")
    p_split.add_argument("output_prefix", help="Output prefix; files will be <prefix>_inner.gdml etc.")

    args = parser.parse_args()
    if args.cmd == "approximate":
        return cmd_approximate(args)
    if args.cmd == "split-mdc":
        return cmd_split_mdc(args)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

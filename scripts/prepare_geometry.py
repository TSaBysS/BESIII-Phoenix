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
import re
from collections import Counter
import xml.etree.ElementTree as ET


# ── Approximate: irregBox / twistedtubs replacement ──────────────────────────

def _to_float(v: str) -> float:
    return float(v.strip())


def convert_irregbox_to_box(root: ET.Element) -> int:
    solids = root.find("solids")
    if solids is None:
        return 0
    converted = 0
    for child in list(solids):
        if child.tag != "irregBox":
            continue
        xs = [_to_float(child.attrib[f"x{i}"]) for i in range(1, 9)]
        ys = [_to_float(child.attrib[f"y{i}"]) for i in range(1, 9)]
        zs = [_to_float(child.attrib[f"z{i}"]) for i in range(1, 9)]
        hx = (max(xs) - min(xs)) * 0.5
        hy = (max(ys) - min(ys)) * 0.5
        hz = (max(zs) - min(zs)) * 0.5
        new_box = ET.Element("box", {
            "name": child.attrib["name"],
            "x": f"{hx:.9g}", "y": f"{hy:.9g}", "z": f"{hz:.9g}",
            "lunit": child.attrib.get("lunit", "mm"),
        })
        solids.insert(list(solids).index(child), new_box)
        solids.remove(child)
        converted += 1
    return converted


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
    ci = convert_irregbox_to_box(root)
    ct = convert_twistedtubs_to_tubs(root)
    cr = rename_duplicate_physvol_names(root)
    tree.write(args.output_gdml, encoding="utf-8", xml_declaration=True)
    print(f"Converted irregBox -> box: {ci}")
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

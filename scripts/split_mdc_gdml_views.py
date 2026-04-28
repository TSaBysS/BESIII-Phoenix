#!/usr/bin/env python3
import argparse
import re
import xml.etree.ElementTree as ET


INNER_STEREO_RE = re.compile(r"^logicalMdcStereoLayer([0-7])$")
OUTER_STEREO_RE = re.compile(r"^logicalMdcStereoLayer(2[0-9]|3[0-5])$")
OUTER_AXIAL_RE = re.compile(r"^logicalMdcAxialLayer(8|9|1[0-9]|3[6-9]|4[0-2])(?:_[01])?$")


def match_view(ref_name: str, view: str) -> bool:
    if view == "inner":
        return INNER_STEREO_RE.match(ref_name) is not None
    if view == "outer_stereo":
        return OUTER_STEREO_RE.match(ref_name) is not None
    if view == "outer_axial":
        return OUTER_AXIAL_RE.match(ref_name) is not None
    if view == "outer":
        return OUTER_STEREO_RE.match(ref_name) is not None or OUTER_AXIAL_RE.match(ref_name) is not None
    return True


def build_view(input_gdml: str, output_gdml: str, view: str) -> int:
    tree = ET.parse(input_gdml)
    root = tree.getroot()

    structure = root.find("structure")
    if structure is None:
        raise RuntimeError("No <structure> section found")

    logical_mdc = None
    for vol in structure.findall("volume"):
        if vol.attrib.get("name") == "logicalMdc":
            logical_mdc = vol
            break
    if logical_mdc is None:
        raise RuntimeError("No logicalMdc volume found")

    kept = 0
    for pv in list(logical_mdc.findall("physvol")):
        vr = pv.find("volumeref")
        ref_name = vr.attrib.get("ref", "") if vr is not None else ""
        if match_view(ref_name, view):
            kept += 1
        else:
            logical_mdc.remove(pv)

    tree.write(output_gdml, encoding="utf-8", xml_declaration=True)
    return kept


def main() -> int:
    parser = argparse.ArgumentParser(description="Split MDC GDML into inner/outer views by layer naming.")
    parser.add_argument("input_gdml")
    parser.add_argument("output_prefix")
    args = parser.parse_args()

    views = ["inner", "outer", "outer_axial", "outer_stereo"]
    for v in views:
        out = f"{args.output_prefix}_{v}.gdml"
        kept = build_view(args.input_gdml, out, v)
        print(f"[{v}] kept logicalMdc physvol count: {kept}, wrote: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

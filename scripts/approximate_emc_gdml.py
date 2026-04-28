#!/usr/bin/env python3
import argparse
from collections import Counter
import xml.etree.ElementTree as ET


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

        new_box = ET.Element(
            "box",
            {
                "name": child.attrib["name"],
                "x": f"{hx:.9g}",
                "y": f"{hy:.9g}",
                "z": f"{hz:.9g}",
                "lunit": child.attrib.get("lunit", "mm"),
            },
        )
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

        new_tubs = ET.Element(
            "tube",
            {
                "name": child.attrib["name"],
                "rmin": child.attrib["endinnerrad"],
                "rmax": child.attrib["endouterrad"],
                "z": child.attrib["zlen"],
                "deltaphi": child.attrib.get("phi", "360"),
                "aunit": child.attrib.get("aunit", "degree"),
                "lunit": child.attrib.get("lunit", "mm"),
                "startphi": "0",
            },
        )
        solids.insert(list(solids).index(child), new_tubs)
        solids.remove(child)
        converted += 1
    return converted


def rename_duplicate_physvol_names(root: ET.Element) -> int:
    renamed = 0
    physvols = list(root.iter("physvol"))
    names = [p.attrib.get("name", "") for p in physvols if "name" in p.attrib]
    dup_names = {n for n, c in Counter(names).items() if c > 1 and n}
    seq = Counter()

    for p in physvols:
        n = p.attrib.get("name", "")
        if n in dup_names:
            seq[n] += 1
            p.attrib["name"] = f"{n}_{seq[n]}"
            renamed += 1
    return renamed


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Approximate GDML by replacing unsupported solids (irregBox/twistedtubs)."
    )
    parser.add_argument("input_gdml")
    parser.add_argument("output_gdml")
    args = parser.parse_args()

    tree = ET.parse(args.input_gdml)
    root = tree.getroot()

    converted_irreg = convert_irregbox_to_box(root)
    converted_twisted = convert_twistedtubs_to_tubs(root)
    renamed = rename_duplicate_physvol_names(root)

    tree.write(args.output_gdml, encoding="utf-8", xml_declaration=True)
    print(f"Converted irregBox -> box: {converted_irreg}")
    print(f"Converted twistedtubs -> tube: {converted_twisted}")
    print(f"Renamed duplicated physvol names: {renamed}")
    print(f"Wrote: {args.output_gdml}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Convert selected MC events from a multi-event BESIII REC ROOT file
to Phoenix JSON by filtering (runId, eventId) pairs from a text file.
"""

import argparse
import json
from pathlib import Path

import uproot

from rec_to_phoenix_event import convert_rec_to_event


def load_selected_pairs(path):
    pairs = []
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.replace(",", " ").split()
        if len(parts) < 2:
            continue
        run_id = int(parts[0])
        event_id = int(parts[1])
        pairs.append((run_id, event_id))
    return pairs


def main():
    parser = argparse.ArgumentParser(
        description="Convert selected (runId,eventId) entries from MC REC to Phoenix JSON."
    )
    parser.add_argument("rec_file", help="Input REC ROOT file (multi-event).")
    parser.add_argument("selected_txt", help="Text file with: runId eventId per line.")
    parser.add_argument("output_json", help="Output Phoenix JSON path.")
    parser.add_argument(
        "--with-helix5",
        action="store_true",
        help="Enable helix5 conversion path.",
    )
    args = parser.parse_args()

    pairs = load_selected_pairs(args.selected_txt)
    if not pairs:
        raise ValueError(f"No valid (runId,eventId) pairs in: {args.selected_txt}")

    f = uproot.open(args.rec_file)
    tree = f["Event"]
    run_arr = tree["TEvtHeader/m_runId"].array(library="np")
    evt_arr = tree["TEvtHeader/m_eventId"].array(library="np")
    index_map = {}
    for idx, (run_id, evt_id) in enumerate(zip(run_arr.tolist(), evt_arr.tolist())):
        key = (int(run_id), int(evt_id))
        if key not in index_map:
            index_map[key] = idx

    merged = {}
    missing = []
    for key in pairs:
        if key not in index_map:
            missing.append(key)
            continue
        entry_idx = index_map[key]
        one = convert_rec_to_event(
            args.rec_file,
            include_helix5=args.with_helix5,
            entry_idx=entry_idx,
        )
        merged.update(one)

    if not merged:
        raise RuntimeError("No selected events converted. Check selected_txt and REC file.")

    out_path = Path(args.output_json)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(merged, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")
    print(f"Converted events: {len(merged)}")
    if missing:
        print("Missing pairs:")
        for run_id, evt_id in missing:
            print(f"  run={run_id} event={evt_id}")


if __name__ == "__main__":
    main()


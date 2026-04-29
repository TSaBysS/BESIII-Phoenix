#!/usr/bin/env python3
"""Merge Phoenix event JSON dicts: python merge_phoenix_events.py in1.json in2.json ... out.json
Later inputs overwrite duplicate top-level keys."""
from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: merge_phoenix_events.py <a.json> [<b.json> ...] <out.json>", file=sys.stderr)
        sys.exit(2)
    paths_in = [Path(p) for p in sys.argv[1:-1]]
    out_path = Path(sys.argv[-1])
    merged: dict = {}
    for p in paths_in:
        merged.update(json.loads(p.read_text(encoding="utf-8")))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(merged, indent=2), encoding="utf-8")
    print(f"Wrote {out_path} ({len(merged)} events)")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Import dungeon / interior warp crystals into landmarks.json.

Overworld warps already come from landMarkField*.fmd. Dungeon stages only appear
in warpLocationList.wal.json; world position is StartPos[PosNo] for that stage.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DDON_DATA = ROOT.parent / "ddon-data" / "client" / "03040008"

LANDMARKS_PATH = ROOT / "resources" / "landmarks.json"
MAP_PARAMS_PATH = ROOT / "resources" / "map_params.json"
STAGE_IDS_PATH = ROOT / "resources" / "stageIds.json"
WARP_LIST_PATH = DDON_DATA / "ui" / "gui_cmn" / "ui" / "03_warp" / "warpLocationList.wal.json"

SOURCE_TAG = "dungeon_warp"


def icon_to_type(icon_type: int) -> str:
    # IconType 2 = village / dungeon outpost crystal; 3 = area warp crystal.
    if icon_type == 2:
        return "TYPE_OUTPOST"
    return "TYPE_AREA_WARP"


def stage_id_to_maps(map_params: dict) -> dict[int, list[str]]:
    out: dict[int, list[str]] = {}
    for map_name, info in map_params.items():
        for stage_id in (info.get("stage_ids") or {}).values():
            out.setdefault(int(stage_id), []).append(map_name)
    return out


def prefer_map(maps: list[str]) -> str | None:
    """Pick the map key used by the viewer for this stage."""
    if not maps:
        return None
    # Prefer non-field maps (dungeons / rooms / lobbies).
    non_field = [m for m in maps if not m.startswith(("field", "sfield"))]
    candidates = non_field or maps
    # Prefer *_m00 / primary layout when several share a stage id.
    candidates = sorted(
        candidates,
        key=lambda m: (
            0 if "_m00" in m else 1,
            0 if m.startswith("st") else 1,
            m,
        ),
    )
    return candidates[0]


def find_stp(stage_no: int, map_name: str, map_params: dict) -> Path | None:
    code = f"st{stage_no:04d}"
    direct = DDON_DATA / "stage" / code / code / "scr" / code / "etc" / f"{code}.stp.json"
    if direct.is_file():
        return direct
    info = map_params.get(map_name) or {}
    for st_code, sid in (info.get("stage_ids") or {}).items():
        # Prefer stp matching StageNo when possible; else first available on map.
        p = DDON_DATA / "stage" / st_code / st_code / "scr" / st_code / "etc" / f"{st_code}.stp.json"
        if p.is_file() and st_code == code:
            return p
    for st_code in (info.get("stage_ids") or {}):
        p = DDON_DATA / "stage" / st_code / st_code / "scr" / st_code / "etc" / f"{st_code}.stp.json"
        if p.is_file():
            return p
    return None


def main() -> int:
    if not WARP_LIST_PATH.is_file():
        print(f"warp list not found: {WARP_LIST_PATH}", file=sys.stderr)
        return 1

    map_params = json.loads(MAP_PARAMS_PATH.read_text(encoding="utf-8"))
    stage_ids = json.loads(STAGE_IDS_PATH.read_text(encoding="utf-8"))
    landmarks = json.loads(LANDMARKS_PATH.read_text(encoding="utf-8"))
    sid_to_maps = stage_id_to_maps(map_params)
    warp_list = json.loads(WARP_LIST_PATH.read_text(encoding="utf-8"))["WarpLocationList"]

    # Drop previous import so re-runs are idempotent.
    for map_name, entries in list(landmarks.items()):
        landmarks[map_name] = [e for e in entries if e.get("source") != SOURCE_TAG]
        if not landmarks[map_name]:
            del landmarks[map_name]

    added = 0
    skipped_field = 0
    skipped_missing = 0

    for w in warp_list:
        stage_no = int(w["StageNo"])
        stage_id = stage_ids.get(str(stage_no))
        if stage_id is None:
            skipped_missing += 1
            continue
        maps = sid_to_maps.get(int(stage_id), [])
        map_name = prefer_map(maps)
        if map_name is None:
            skipped_missing += 1
            continue
        if map_name.startswith(("field", "sfield")):
            skipped_field += 1
            continue

        stp_path = find_stp(stage_no, map_name, map_params)
        if stp_path is None:
            print(f"  no StartPos for stage {stage_no} ({w['SpotName']['En']}) map={map_name}")
            skipped_missing += 1
            continue

        infos = json.loads(stp_path.read_text(encoding="utf-8"))["InfoList"]
        pos_no = int(w.get("PosNo", -1))
        if pos_no < 0 or pos_no >= len(infos):
            print(f"  bad PosNo={pos_no} (len={len(infos)}) for {w['SpotName']['En']}")
            skipped_missing += 1
            continue

        pos = infos[pos_no]["Pos"]
        spot_id = int(w["SpotId"])
        en = w["SpotName"]["En"]
        jp = w["SpotName"]["Jp"]
        entry = {
            "type": icon_to_type(int(w.get("IconType", 3))),
            "id": 522154 if int(w.get("IconType", 3)) != 2 else 522150,
            "x": float(pos["X"]),
            "y": float(pos["Y"]),
            "z": float(pos["Z"]),
            "name_en": en,
            "name_jp": jp,
            "spot_id": spot_id,
            "spot_name_en": en,
            "spot_name_jp": jp,
            "stage_no": stage_no,
            "source": SOURCE_TAG,
        }
        landmarks.setdefault(map_name, []).append(entry)
        added += 1

    LANDMARKS_PATH.write_text(
        json.dumps(landmarks, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Updated {LANDMARKS_PATH}")
    print(f"  added {added} dungeon warps")
    print(f"  skipped field={skipped_field} unresolved={skipped_missing}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

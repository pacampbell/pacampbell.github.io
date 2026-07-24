#!/usr/bin/env python3
"""Add spot_id / spot_name_* / stage_no to landmarks.json from client fmd + spots."""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DDON_DATA = ROOT.parent / "ddon-data" / "client" / "03040008"

LANDMARKS_PATH = ROOT / "resources" / "landmarks.json"
MAP_PARAMS_PATH = ROOT / "resources" / "map_params.json"
SPOT_CSV_PATH = ROOT / "resources" / "spot_name.csv"
WARP_LIST_PATH = DDON_DATA / "ui" / "gui_cmn" / "ui" / "03_warp" / "warpLocationList.wal.json"
AM_SPOT_GLOB = DDON_DATA / "ui" / "uGUIAreaMaster" / "ui" / "00_param" / "master" / "am_spot_*.ams.json"

MAP_TO_FMD = {
    "field000_m00": 1,
    "sfield000_m00": 1,
    "field003_m00": 2,
    "sfield003_m00": 2,
    "field004_m00": 3,
    "sfield004_m00": 3,
    "field005_m00": 4,
    "sfield005_m00": 4,
}

COORD_EPS = 0.05
# MessId=-1 warps: nearest warpLocationList crystal whose StageNo is on this field.
# Positions come from that stage's StartPos[PosNo] (same world space as field landmarks).
WARP_SPOT_MAX = 15_000


def load_spot_names() -> dict[int, tuple[str, str]]:
    names: dict[int, tuple[str, str]] = {}
    with SPOT_CSV_PATH.open(encoding="utf-8") as f:
        for row in csv.reader(f):
            if not row or row[0] == "key":
                continue
            spot_id = int(row[0].rsplit("_", 1)[1])
            names[spot_id] = (row[2].strip(), row[1].strip())
    return names


def load_fmd(field_no: int) -> list[dict]:
    path = (
        DDON_DATA / "scr" / "lm" / f"landMarkField0{field_no}" / "scr" / "lm"
        / f"landMarkField0{field_no}.fmd.json"
    )
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["FieldMapDataList"]


def field_stage_nos(map_name: str, map_params: dict) -> set[int]:
    info = map_params.get(map_name) or {}
    return {int(st[2:]) for st in (info.get("stages") or []) if len(st) > 2}


def load_start_pos(stage_no: int) -> list[dict] | None:
    code = f"st{stage_no:04d}"
    path = DDON_DATA / "stage" / code / code / "scr" / code / "etc" / f"{code}.stp.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))["InfoList"]


def load_field_warp_points(
    warp_list: list[dict], allowed_stages: set[int]
) -> list[tuple[int, float, float]]:
    """Warp crystals on this field: (spot_id, world_x, world_z) from StartPos."""
    stp_cache: dict[int, list[dict]] = {}
    points: list[tuple[int, float, float]] = []
    for w in warp_list:
        stage_no = int(w["StageNo"])
        if stage_no not in allowed_stages:
            continue
        if stage_no not in stp_cache:
            stp_cache[stage_no] = load_start_pos(stage_no) or []
        infos = stp_cache[stage_no]
        pos_no = int(w.get("PosNo", -1))
        if pos_no < 0 or pos_no >= len(infos):
            continue
        pos = infos[pos_no]["Pos"]
        points.append((int(w["SpotId"]), float(pos["X"]), float(pos["Z"])))
    return points


def load_am_spot_stages() -> dict[int, int]:
    """SpotId → StageNoMap from area-master spots (fallback when not in warp list)."""
    out: dict[int, int] = {}
    for path in AM_SPOT_GLOB.parent.glob("am_spot_*.ams.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        for spot in data["AreaMasterSpotDataList"]:
            sno = spot.get("StageNoMap")
            if sno is None or int(sno) <= 0:
                continue
            out[int(spot["SpotId"])] = int(sno)
    return out


def match_fmd(fmd_entries: list[dict], entry: dict) -> dict | None:
    for row in fmd_entries:
        if row["TypeName"] != entry["type"]:
            continue
        wx = row["WorldPos"]["X"]
        wz = row["WorldPos"]["Z"]
        if abs(wx - entry["x"]) <= COORD_EPS and abs(wz - entry["z"]) <= COORD_EPS:
            return row
    return None


def nearest_spot(
    x: float,
    z: float,
    points: list[tuple[int, float, float]],
    max_dist: float,
) -> int | None:
    best_id: int | None = None
    best_dist = max_dist * max_dist
    for sid, px, pz in points:
        d2 = (x - px) ** 2 + (z - pz) ** 2
        if d2 < best_dist:
            best_dist = d2
            best_id = sid
    return best_id


def main() -> int:
    if not DDON_DATA.is_dir():
        print(f"ddon-data not found at {DDON_DATA}", file=sys.stderr)
        return 1

    spot_names = load_spot_names()
    map_params = json.loads(MAP_PARAMS_PATH.read_text(encoding="utf-8"))
    warp_list = json.loads(WARP_LIST_PATH.read_text(encoding="utf-8"))["WarpLocationList"]
    warp_stage_by_spot = {int(w["SpotId"]): int(w["StageNo"]) for w in warp_list}
    am_stage_by_spot = load_am_spot_stages()

    fmd_cache: dict[int, list[dict]] = {}
    field_warp_cache: dict[str, list[tuple[int, float, float]]] = {}

    landmarks = json.loads(LANDMARKS_PATH.read_text(encoding="utf-8"))
    stats = {
        "warp_mess_id": 0, "warp_spot": 0, "warp_unresolved": 0,
        "total_warp": 0, "total_outpost": 0, "total_shrine": 0,
        "outpost_named": 0, "shrine_named": 0,
    }

    for map_name, entries in landmarks.items():
        field_no = MAP_TO_FMD.get(map_name)
        if field_no is None:
            continue

        if field_no not in fmd_cache:
            fmd_cache[field_no] = load_fmd(field_no)

        fmd_rows = fmd_cache[field_no]
        allowed_stages = field_stage_nos(map_name, map_params)
        if map_name not in field_warp_cache:
            field_warp_cache[map_name] = load_field_warp_points(warp_list, allowed_stages)
        field_warps = field_warp_cache[map_name]

        for entry in entries:
            if entry.get("source") == "dungeon_warp":
                continue

            entry.pop("spot_id", None)
            entry.pop("spot_name_en", None)
            entry.pop("spot_name_jp", None)
            entry.pop("stage_no", None)

            if entry["type"] not in ("TYPE_AREA_WARP", "TYPE_OUTPOST", "TYPE_SHRINE"):
                continue

            if entry["type"] == "TYPE_AREA_WARP":
                stats["total_warp"] += 1
            elif entry["type"] == "TYPE_OUTPOST":
                stats["total_outpost"] += 1
            elif entry["type"] == "TYPE_SHRINE":
                stats["total_shrine"] += 1

            fmd_row = match_fmd(fmd_rows, entry)
            mess_id = fmd_row.get("MessId", -1) if fmd_row else -1
            spot_id: int | None = None

            if mess_id is not None and mess_id > 0:
                spot_id = mess_id
                if entry["type"] == "TYPE_AREA_WARP":
                    stats["warp_mess_id"] += 1
            elif entry["type"] == "TYPE_AREA_WARP":
                x, z = entry["x"], entry["z"]
                warp_id = nearest_spot(x, z, field_warps, WARP_SPOT_MAX)
                if warp_id is not None:
                    spot_id = warp_id
                    stats["warp_spot"] += 1
                else:
                    stats["warp_unresolved"] += 1

            if spot_id is None or spot_id not in spot_names:
                continue

            # Prefer live warp-list English when present (CSV can lag translations).
            warp_row = next((w for w in warp_list if int(w["SpotId"]) == spot_id), None)
            if warp_row:
                en = warp_row["SpotName"]["En"]
                jp = warp_row["SpotName"]["Jp"]
            else:
                en, jp = spot_names[spot_id]
            entry["spot_id"] = spot_id
            entry["spot_name_en"] = en
            entry["spot_name_jp"] = jp

            # General stage rule (multi-stage fields like Phindym / Bloodbane / Acre):
            #   1) warpLocationList.StageNo for this SpotId (Wharf→121, Glyndwr→122, …)
            #   2) else am_spot.StageNoMap (shrines / spots not on the warp list)
            # Search/navigation must use this stage_no — never stages[0] alone.
            stage_no = warp_stage_by_spot.get(spot_id) or am_stage_by_spot.get(spot_id)
            if stage_no is not None:
                entry["stage_no"] = stage_no

            if entry["type"] == "TYPE_OUTPOST":
                stats["outpost_named"] += 1
            elif entry["type"] == "TYPE_SHRINE":
                stats["shrine_named"] += 1

    LANDMARKS_PATH.write_text(
        json.dumps(landmarks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    named_warp = stats["warp_mess_id"] + stats["warp_spot"]
    print(f"Updated {LANDMARKS_PATH}")
    print(
        f"  warps: {named_warp}/{stats['total_warp']} named "
        f"(messId={stats['warp_mess_id']}, nearFieldWarp={stats['warp_spot']}, "
        f"unresolved={stats['warp_unresolved']})"
    )
    print(f"  outposts: {stats['outpost_named']}/{stats['total_outpost']} named")
    print(f"  shrines: {stats['shrine_named']}/{stats['total_shrine']} named")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

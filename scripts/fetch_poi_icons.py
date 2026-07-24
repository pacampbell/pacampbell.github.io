"""Download POI toggle icons from DDOn-Tools (item icons + mmapicon slices).

Item icons match ToggleableGatheringSpotPlacemark.gd GATHERING_TYPE_ICONS.
Map UI icons are cropped from mmapicon_ID.png (same atlas DDOn-Tools uses for shops).
"""
from __future__ import annotations

import json
import shutil
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "resources" / "poi-icons"
MANIFEST_PATH = ROOT / "resources" / "poi-icons.json"

GITHUB_RAW = "https://raw.githubusercontent.com/alborrajo/DDOn-Tools/master"
LOCAL_MMAPICON = Path(r"D:\DDONDev\Export\mmapicon_ID.png")
REPO_MMAPICON = ROOT / "resources" / "mmapicon_ID.png"

# DDOn-Tools GATHERING_TYPE_ICONS → repo path (iconNo folder matches ii######)
ITEM_ICON_SOURCES: dict[str, str] = {
    "lumber":    "resources/items/ii000449/icon_item100022_ID.png",
    "grassHerb": "resources/items/ii000508/icon_item200045_ID.png",
    "flower":    "resources/items/ii000510/icon_item200047_ID.png",
    "mushroom":  "resources/items/ii000512/icon_item200049_ID.png",
    "sand":      "resources/items/ii000484/icon_item200021_ID.png",
    "shell":     "resources/items/ii000517/icon_item200054_ID.png",
    "crystal":   "resources/items/ii000446/icon_item100019_ID.png",
    "gemstone":  "resources/items/ii000452/icon_item100025_ID.png",
    "sparkNode": "resources/items/ii001991/icon_item200144_ID.png",
    "dragon":    "resources/items/ii001991/icon_item200144_ID.png",  # blue fire (DDOn unit 520170)
    "water":     "resources/items/ii000481/icon_item200018_ID.png",
    "treasure":  "resources/items/ii000423/icon_item000010_ID.png",  # coin pouch (DDOn TREA/chest)
    "box":       "resources/items/ii000536/icon_item400005_ID.png",  # wooden crate
    "antique":   "resources/items/ii001275/icon_item200082_ID.png",  # yellow antique plaques
    "book":      "resources/items/ii002604/icon_item100045_ID.png",  # OM_GATHER_BOOK stack of books
}

# Numbered slices from resources/mmapicon_slices/ (see mmapicon_manifest.json)
MMAPICON_SLICE_IDS: dict[str, int] = {
    "door": 8,
    "outpost": 13,
    "cave": 15,
    "well": 17,
    "areaWarp": 48,
    "inn": 21,
}

# Legacy rect crops for categories without a confirmed slice ID yet
MMAPICON_SOURCES: dict[str, tuple[int, int, int, int]] = {
    "basement":     (144, 34, 19, 17),
    "catacomb":     (118, 117, 14, 16),
    "elfRuin":      (227, 113, 23, 24),
    "shrine":       (145, 61, 18, 18),
    "itemShop":     (88, 60, 19, 21),
    "materialShop": (5, 59, 18, 22),
}

SLICES_DIR = ROOT / "resources" / "mmapicon_slices"


def download_url(url: str, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            dest.write_bytes(resp.read())
        return True
    except (urllib.error.URLError, TimeoutError) as exc:
        print(f"  FAIL {dest.name}: {exc}")
        return False


def load_mmapicon() -> Image.Image:
    for path in (LOCAL_MMAPICON, REPO_MMAPICON):
        if path.exists():
            return Image.open(path).convert("RGBA")
    url = f"{GITHUB_RAW}/resources/icons/mmapicon_ID.png"
    dest = REPO_MMAPICON
    print(f"Downloading mmapicon from GitHub -> {dest}")
    if not download_url(url, dest):
        raise SystemExit("Could not obtain mmapicon_ID.png")
    return Image.open(dest).convert("RGBA")


def crop_mmapicon(sheet: Image.Image, rect: tuple[int, int, int, int], dest: Path) -> None:
    x, y, w, h = rect
    pad = 1
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(sheet.width, x + w + pad)
    y1 = min(sheet.height, y + h + pad)
    sheet.crop((x0, y0, x1, y1)).save(dest)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, dict] = {"icons": {}}

    print("=== Item icons (DDOn-Tools gather icons) ===")
    for cat_id, repo_path in ITEM_ICON_SOURCES.items():
        dest = OUT / f"{cat_id}.png"
        url = f"{GITHUB_RAW}/{repo_path}"
        ok = download_url(url, dest)
        manifest["icons"][cat_id] = {
            "file": f"resources/poi-icons/{cat_id}.png",
            "source": f"github:alborrajo/DDOn-Tools/{repo_path}",
            "kind": "item",
            "ok": ok,
        }
        print(f"  {'OK' if ok else 'FAIL'} {cat_id}")

    print("\n=== Map UI icons (numbered mmapicon slices) ===")
    for cat_id, icon_id in MMAPICON_SLICE_IDS.items():
        src = SLICES_DIR / f"{icon_id}.png"
        dest = OUT / f"{cat_id}.png"
        if not src.exists():
            print(f"  FAIL {cat_id} (missing slice {icon_id}.png)")
            manifest["icons"][cat_id] = {"file": str(dest.relative_to(ROOT)).replace("\\", "/"), "kind": "mmapicon", "ok": False}
            continue
        shutil.copy2(src, dest)
        manifest["icons"][cat_id] = {
            "file": f"resources/poi-icons/{cat_id}.png",
            "source": f"mmapicon_slices/{icon_id}.png",
            "kind": "mmapicon",
            "ok": True,
        }
        print(f"  OK {cat_id} <- slice {icon_id}")

    print("\n=== Map UI icons (rect crops, unconfirmed IDs) ===")
    sheet = load_mmapicon()
    if not REPO_MMAPICON.exists() and LOCAL_MMAPICON.exists():
        shutil.copy2(LOCAL_MMAPICON, REPO_MMAPICON)

    for cat_id, rect in MMAPICON_SOURCES.items():
        dest = OUT / f"{cat_id}.png"
        crop_mmapicon(sheet, rect, dest)
        manifest["icons"][cat_id] = {
            "file": f"resources/poi-icons/{cat_id}.png",
            "source": f"mmapicon_ID.png rect {rect}",
            "kind": "mmapicon",
            "ok": True,
        }
        print(f"  OK {cat_id} {rect}")

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nWrote {len(manifest['icons'])} icons -> {OUT}")
    print(f"Manifest -> {MANIFEST_PATH}")


if __name__ == "__main__":
    main()

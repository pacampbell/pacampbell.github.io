# DDON Interactive Map

Browser-based map for *Dragon's Dogma Online* — enemy spawns, gathering nodes, shops, warps, and named locations. Deployed as a static GitHub Pages site (`map.html`).

**Live map:** [pacampbell.github.io/map.html](https://pacampbell.github.io/map.html)

---

## Quick start

1. Open the map in your browser.
2. Click **Select Server** (top of sidebar) and choose **Dogma Rising — Normal Channels** (or Revival / Arrowgene / custom URLs).
3. Search or pick a map in the sidebar, then use the filters below to control what is shown on the map.

Enemy **positions** load from this repo. Enemy **types, levels, and drops** load from the server preset you select (external JSON).

---

## Sidebar search (maps & named locations)

The search box at the top of the sidebar finds:

- **Maps** — by area or stage name (e.g. `Hidell`, `st0100`).
- **Named locations** — portcrystals (outposts), caves, inns, doors, wells, area warps, **shops**, and similar POIs on field maps (including shop NPCs inside buildings). Results use the same POI icons as the map. A field **door** to a building whose interior shop shares the same name is indexed as a **House**, not a second shop entry.
  
<img width="425" height="366" alt="image" src="https://github.com/user-attachments/assets/06e7cbdc-2dda-45f5-b933-642510f23cd3" />

**Tips**

- Type a few letters; named locations appear under a **Maps** or location section in the results list.
- Click a result to fly to that point and switch map/stage if needed.
- Advanced filters (in the search placeholder tooltip):
  - `stageno=200` — match stage number
  - `stageid=2` — match internal stage ID
  - `area=cassardis` — match quest area name

Portcrystal spots dedupe: if both **Outpost** and **Area warp** exist at the same crystal, search prefers **Outpost**.

---

## Map filters (checkboxes)

Three collapsible sections in the sidebar control markers on the **current map**. Each section has a **Show all** toggle plus individual category checkboxes. Choices are saved in your browser.

### Spawns

Filter which **enemy groups** are visible by spawn type:

<img width="395" height="179" alt="image" src="https://github.com/user-attachments/assets/10829509-0c9a-4d01-ad5c-d4316418062d" />


Uncheck **Show all** to hide every mob type; check individual boxes to show only what you need.

**Spawn waves** — on stages with more than one spawn subgroup, a pill bar appears under the mob-type list (**All**, then **1**, **2**, …). Pick a wave to show only spawns from that subgroup; **All** shows every wave. Area-spawn groups count toward wave **1** when the stage uses the default subgroup layout.

Enemy positions are **lazy-loaded** per stage when you open a map (or when spot search needs all stages), which keeps the initial page load small.

### Locations

Toggle **connection / landmark** icons on the map:

<img width="401" height="162" alt="image" src="https://github.com/user-attachments/assets/3ab1f091-f223-41c8-9743-c131398b18ef" />

Connections that match a category show the game-style POI icon; uncategorized warps use a door-style icon. **Show all** enables or disables the whole Locations group.

### Gatherables

Toggle gathering node markers:

<img width="398" height="216" alt="image" src="https://github.com/user-attachments/assets/25357ab8-8325-4e62-9165-34980aaa38ec" />


Only categories you leave checked appear on the map.

---

## Spot Search (🔍 panel)

Open with the **🔍** button or **Ctrl+F**. Search enemies, gathering types, or item drops on the current stage — or across **all stages**.

### Tabs

<img width="310" height="103" alt="image" src="https://github.com/user-attachments/assets/09724c48-c845-4d06-a5a2-3f776689bbf0" />

- **Enemies** — mob name (partial match; `"quotes"` for exact prefix)
- **Gathering** — gather node types
- **Items** — drops from enemies, gather nodes, or shops

### Multi-enemy search (Enemies tab)

Search several mobs at once by separating names with a **comma** or **+**:

- `Behemoth, Angules`
- `Goblin Dragon + Colossus`

Matching is **per stage** (dungeon/area), not per spawn group. If both mobs appear anywhere on the same stage — even in different groups — that stage shows **2/2** under **All matched**.

Results are grouped by how many search terms matched:

| Badge | Meaning |
|-------|---------|
| **2/2** | Every searched mob has at least one matching spawn on that stage |
| **1/2** | Only one mob matched on that stage (see level filter below) |

<img width="338" height="525" alt="image" src="https://github.com/user-attachments/assets/38bdc828-4035-4d9a-bc4f-1f6ed56e8c46" />

Click a row to fly to the nearest matching spawn. Use **◀ ▶** to cycle through **all** matching spawns on that stage (each mob’s locations, in sort order).

### Stage roster (This Stage, empty search)

On **This Stage** with the **Enemies** tab, leave the search box empty to see every enemy type on the current stage. Click a row to jump to the nearest spawn; **◀ ▶** appears when that mob has multiple locations.

<img width="348" height="701" alt="image" src="https://github.com/user-attachments/assets/dde6b478-26b1-4dcd-ae67-c5aeb2546a4c" />

### Level range (Enemies tab)

Expand **Level range**, set **Min** and/or **Max**, leave blank for no bound. Only enemy spawns whose level range **overlaps** your filter count as matches. The badge shows when a filter is active.

<img width="308" height="155" alt="image" src="https://github.com/user-attachments/assets/91cdd327-950e-48a8-ac27-d864a1b60229" />

**With multi-enemy search**, each mob is checked separately against the level filter. Example: **Min 30**, search `Goblin, Behemoth` — Goblin Lv 43 counts, Behemoth Lv 10 does not → stage shows **1/2**, not **2/2**. Arrows only cycle spawns that pass the filter.

Spawns with **no level data** in the server preset are not excluded by the level filter.

**Note:** The empty-search stage roster lists all enemy types and does not apply the level filter (the filter applies when you type a search).

### Sort from

Results are ordered by **travel distance** from a sort origin (not alphabetically by area name).

1. **Default:** White Dragon Temple entrance on Hidell Plains.
2. **Custom:** expand **Sort from** → **Set from map click…**, then click a point on the map. A marker shows the origin. The badge switches to **Custom**.

<img width="362" height="262" alt="image" src="https://github.com/user-attachments/assets/7825658e-bfa0-4954-82ca-0eb0a5bf705c" />

**Sort order:** path distance → (global only) stage order → level (low to high) → name. Unreachable stages sort after reachable ones.

**Sort from** affects **order only** — it does not hide results. The same ordering applies inside **◀ ▶** navigation: **1/N** is always the nearest matching spawn from your origin.

### Scope

- **This Stage** — current map/stage only.
- **All Stages** — world-wide search; first use loads spawn position data for all stages (progress message shown).

Click a result to fly to the spawn and highlight it. Multiple locations for the same name — or multiple matches on a multi-enemy row — use **◀ ▶** to cycle.

---

## Developer panel (optional)

Collapsed **Developer** section at the bottom of the sidebar. Not required for normal use.

| Option | What it does |
|--------|----------------|
| **Technical spawn labels** | Per-spawn ID labels, **G#** group chips with counts, legacy group chips, expand/collapse hull outlines, and **territory bounds** on expanded groups (territory is no longer a separate layer toggle) |
| **Aggro / link radius** | Click a spawn on the map to draw its aggro and link radii |
| **Grid** | World-coordinate grid overlay |
| **✎ Edit** | Toggle edit mode for gather/shop/connection markers |
| **Expand all groups / Collapse all groups** | Expand or collapse every spawn group at once |

**Tips**

- With technical labels on: click a **G#** chip to expand that group; **middle-click** the hull outline to collapse.
- **Cursor coordinates** are always shown in the bottom-right of the map (no dev toggle).
- **Alt+click** the map to log world coordinates to the browser console.

---

## Data sources

| Source | Role |
|--------|------|
| This repo | Map tiles, spawn positions (`resources/enemyPositions/{stageNo}.json`, lazy-loaded per stage), landmarks, connections, gather points, shops (static JSON) |
| Server preset | Live spawn tables (`EnemySpawn.json`), gathering CSV, shop JSON |

Presets: **Dogma Rising**, **Revival (live.ddon.org)**, **Arrowgene (default)**, or **Custom** URLs/local files.

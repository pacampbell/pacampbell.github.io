import enemyPositions from './resources/enemyPositions.json' with {type: "json"};
import mapParams from './resources/map_params.json' with {type: "json"};
import landmarkData from './resources/landmarks.json' with {type: "json"};
import connectionData from './resources/connections.json' with {type: "json"};
import gatherPoints from './resources/gatherPoints.json' with {type: "json"};
import stageIds from './resources/stageIds.json' with {type: "json"};
import itemNames from './resources/itemNames.json' with {type: "json"};
import emNames from './resources/emNames.json' with {type: "json"};
import iconIds from './resources/iconIds.json' with {type: "json"};
import npcShops from './resources/npcShops.json' with {type: "json"};
import npcNames from './resources/npcNames.json' with {type: "json"};
const _iconIdSet = new Set(iconIds);

// ── Leaflet map setup ──────────────────────────────────────────────────────────
const leafletMap = L.map('map', {
    crs: L.CRS.Simple,
    maxZoom: 6,
    minZoom: -3,
    zoomSnap: 0.5,
});
// Dedicated pane for the map background image — z-index 201 keeps it below
// the overlayPane (400) so polylines (pd boundaries etc.) always render on top
// even after swapMapImage recreates the imageOverlay.
leafletMap.createPane('mapImagePane');
leafletMap.getPane('mapImagePane').style.zIndex = 201;

function xy(x, y) { return L.latLng(y, x); }

// ── Reset-view control (appears below zoom +/−) ────────────────────────────────
L.Control.ResetView = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const btn = L.DomUtil.create('a', 'leaflet-control-reset-view', container);
        btn.innerHTML = '&#8962;';  // ⌂ home symbol
        btn.title = 'Reset view';
        btn.href = '#';
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', 'Reset view');
        L.DomEvent.on(btn, 'click', (e) => { L.DomEvent.preventDefault(e); resetView(); });
        return container;
    },
});
new L.Control.ResetView().addTo(leafletMap);


// ── World → pixel conversion ───────────────────────────────────────────────────
// Formula from GMP data + engine scale constant (derived from PS4 disassembly):
//   pixelX = worldX * scale   + center_x
//   pixelY = (imgHeight - center_y) - worldZ * scale_z
// scale_z may differ from scale when empirically calibrated (see map_params.json).
//
// For pd (parts-dungeon) maps, pd_pieces stores per-piece pixel boundaries so
// each piece can have its own scale (piecewise-linear mapping).
function worldToPixel(worldX, worldZ, info) {
    let png_y;
    if (info.pd_pieces?.length) {
        // Piecewise-linear. Image stacked deepest-first: top=deepest, bottom=entrance.
        // Each piece slot: entrance at pixel_y_entrance (bottom), deepest at pixel_y_start (top).
        const pieces = info.pd_pieces;
        let piece = pieces[0]; // default: shallowest (entrance)
        for (const p of pieces) {
            // Use full_size (original Z range) for lookup so there are no Z gaps.
            const rangeSize = p.full_size ?? p.size;
            if (worldZ >= p.connect_z + rangeSize && worldZ <= p.connect_z) {
                piece = p;
                break;
            }
        }
        const localZ  = worldZ - piece.connect_z;                          // ≤ 0
        // Use pixel_y_entrance_v (virtual entrance, accounts for bottom trim) and
        // info.scale (DUNGEON_MAP_SCALE, same as X axis) — the correct rendering scale.
        png_y = piece.pixel_y_entrance_v + localZ * info.scale;
        png_y = Math.max(piece.pixel_y_start, Math.min(piece.pixel_y_entrance, png_y));
    } else {
        const scaleZ = info.scale_z ?? info.scale;
        png_y = (info.img_height - info.center_y) - worldZ * scaleZ;
        // above is lat; convert to png_y
        png_y = info.img_height - png_y;
    }
    const py = info.img_height - png_y;   // lat (Leaflet y from bottom)
    const px = worldX * info.scale + info.center_x;
    return xy(px, py);
}

// ── Layer groups ───────────────────────────────────────────────────────────────
let imageOverlay    = null;
let enemyLayer      = L.layerGroup().addTo(leafletMap);  // group chip labels
let landmarkLayer   = L.layerGroup().addTo(leafletMap);
let connectionLayer = L.layerGroup().addTo(leafletMap);
let gridLayer        = L.layerGroup();   // off by default
let territoryLayer   = L.layerGroup();   // off by default; territory rects when groups expand
let stageLabelsLayer = L.layerGroup().addTo(leafletMap);  // area name text labels
let gatherLayer      = L.layerGroup();   // off by default
let npcShopLayer     = L.layerGroup();   // off by default
let pdBoundaryLayer = L.layerGroup().addTo(leafletMap);
let spawnRadiiLayer   = L.layerGroup().addTo(leafletMap);  // aggro/link radius circles
let _spreadOverlay    = L.layerGroup().addTo(leafletMap);  // cross-group spoke lines + anchor dots

// Canvas renderer — all spawn circleMarkers share one <canvas> element (huge perf win).
const spawnRenderer = L.canvas({ padding: 0.5 });

// ── Group expand/collapse state ───────────────────────────────────────────────
// One entry per group; detailsLayer is lazily created on first expand.
const _groupStore = new Map(); // groupId string → { groupId, color, territory, items, pts,
                               //   centroid, labelMarker, detailsLayer, isExpanded }
let _currentMapInfo  = null;   // stored at loadEnemySpawns time; used by lazy expand
let _currentFloorObbs = null;

function updateEnemyVisibility() {
    const checked = document.getElementById('layer-enemies').checked;
    if (checked) {
        leafletMap.addLayer(enemyLayer);
        leafletMap.addLayer(_spreadOverlay);
        for (const g of _groupStore.values())
            if (g.isExpanded && g.detailsLayer) g.detailsLayer.addTo(leafletMap);
    } else {
        leafletMap.removeLayer(enemyLayer);
        leafletMap.removeLayer(_spreadOverlay);
        for (const g of _groupStore.values())
            if (g.isExpanded && g.detailsLayer) leafletMap.removeLayer(g.detailsLayer);
    }
}

// ── Layer preference persistence ───────────────────────────────────────────────
// ── Layer state — URL hash + localStorage ─────────────────────────────────────
// Hash format extension: …@zoom/y/x!elcgt
//   Each letter present = that layer is ON: e=enemies l=landmarks c=connections
//   g=grid t=territory.  Absent = OFF.
// URL state takes priority over localStorage (enables sharing exact views).

const LAYER_PREFS_KEY = 'ddon-maps-layers';

// Returns the !-suffix string: layer flags + optional ;groupId,groupId,...
// Format: !elcgt;0,3,80
function getLayersHash() {
    let s = '';
    if (document.getElementById('layer-enemies').checked)       s += 'e';
    if (document.getElementById('layer-landmarks').checked)     s += 'l';
    if (document.getElementById('layer-connections').checked)   s += 'c';
    if (document.getElementById('layer-grid').checked)          s += 'g';
    if (document.getElementById('layer-territory').checked)     s += 't';
    if (document.getElementById('layer-stage-labels').checked)  s += 'a';
    if (document.getElementById('layer-gather').checked)        s += 'r';
    if (document.getElementById('layer-radii').checked)         s += 'i';
    if (document.getElementById('layer-npc-shops').checked)     s += 'n';
    if (document.getElementById('sidebar').classList.contains('collapsed')) s += 's';
    const openIds = [..._groupStore.values()]
        .filter(g => g.isExpanded)
        .map(g => g.groupId)
        .sort((a, b) => parseInt(a) - parseInt(b));
    if (openIds.length) s += ';' + openIds.join(',');
    return s;
}

// Update only the layer portion of the current hash without triggering hashchange.
function updateLayersInHash() {
    const { name, stid } = parseHash();
    const mapName = name || _loadedMapName;
    if (!mapName) return;
    const z = leafletMap.getZoom().toFixed(2);
    const c = leafletMap.getCenter();
    const frag = (stid ? `${mapName}:${stid}` : mapName)
               + `@${z}/${c.lat.toFixed(1)}/${c.lng.toFixed(1)}`
               + `!${getLayersHash()}`;
    history.replaceState(null, '', '#' + frag);
}

function saveLayerPrefs() {
    const prefs = {
        enemies:      document.getElementById('layer-enemies').checked,
        landmarks:    document.getElementById('layer-landmarks').checked,
        connections:  document.getElementById('layer-connections').checked,
        grid:         document.getElementById('layer-grid').checked,
        territory:    document.getElementById('layer-territory').checked,
        stageLabels:  document.getElementById('layer-stage-labels').checked,
        gather:       document.getElementById('layer-gather').checked,
        radii:        document.getElementById('layer-radii').checked,
        npcShops:     document.getElementById('layer-npc-shops').checked,
    };
    try { localStorage.setItem(LAYER_PREFS_KEY, JSON.stringify(prefs)); } catch (_) {}
    updateLayersInHash();
}

function loadLayerPrefs() {
    try {
        const raw = localStorage.getItem(LAYER_PREFS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
}

// Apply layer state from URL hash (if present) or localStorage, then fall back to defaults.
// Must run after layers are declared but before first loadMap.
(function applyLayerPrefs() {
    const { layers: urlLayers } = parseHash();
    const stored = loadLayerPrefs();
    // URL hash wins over localStorage; localStorage wins over hardcoded defaults.
    const prefs = urlLayers ?? stored ?? {};
    const isOn = (key, defaultOn) => key in prefs ? prefs[key] : defaultOn;

    document.getElementById('layer-enemies').checked       = isOn('enemies',      true);
    document.getElementById('layer-landmarks').checked     = isOn('landmarks',    true);
    document.getElementById('layer-connections').checked   = isOn('connections',  true);
    document.getElementById('layer-grid').checked          = isOn('grid',         false);
    document.getElementById('layer-territory').checked     = isOn('territory',    false);
    document.getElementById('layer-stage-labels').checked  = isOn('stageLabels',  true);
    document.getElementById('layer-gather').checked        = isOn('gather',        false);
    document.getElementById('layer-radii').checked         = isOn('radii',         false);
    document.getElementById('layer-npc-shops').checked     = isOn('npcShops',      true);

    if (!document.getElementById('layer-landmarks').checked)
        leafletMap.removeLayer(landmarkLayer);
    if (!document.getElementById('layer-connections').checked)
        leafletMap.removeLayer(connectionLayer);
    if (document.getElementById('layer-grid').checked)
        leafletMap.addLayer(gridLayer);
    if (document.getElementById('layer-territory').checked)
        leafletMap.addLayer(territoryLayer);
    if (!document.getElementById('layer-stage-labels').checked)
        leafletMap.removeLayer(stageLabelsLayer);
    if (document.getElementById('layer-gather').checked)
        leafletMap.addLayer(gatherLayer);
    if (document.getElementById('layer-npc-shops').checked)
        leafletMap.addLayer(npcShopLayer);
    if (!document.getElementById('layer-enemies').checked)
        updateEnemyVisibility();
    if (isOn('sidebarHidden', false))
        document.getElementById('sidebar').classList.add('collapsed');
})();

// ── Layer toggles ──────────────────────────────────────────────────────────────
document.getElementById('layer-enemies').addEventListener('change', () => {
    updateEnemyVisibility(); saveLayerPrefs();
});
document.getElementById('layer-landmarks').addEventListener('change', e => {
    e.target.checked ? leafletMap.addLayer(landmarkLayer) : leafletMap.removeLayer(landmarkLayer);
    saveLayerPrefs();
});
document.getElementById('layer-connections').addEventListener('change', e => {
    e.target.checked ? leafletMap.addLayer(connectionLayer) : leafletMap.removeLayer(connectionLayer);
    saveLayerPrefs();
});
document.getElementById('layer-grid').addEventListener('change', e => {
    e.target.checked ? leafletMap.addLayer(gridLayer) : leafletMap.removeLayer(gridLayer);
    saveLayerPrefs();
});
document.getElementById('layer-stage-labels').addEventListener('change', e => {
    e.target.checked ? leafletMap.addLayer(stageLabelsLayer) : leafletMap.removeLayer(stageLabelsLayer);
    saveLayerPrefs();
});
document.getElementById('layer-gather').addEventListener('change', e => {
    e.target.checked ? leafletMap.addLayer(gatherLayer) : leafletMap.removeLayer(gatherLayer);
    saveLayerPrefs();
});
document.getElementById('layer-radii').addEventListener('change', e => {
    if (!e.target.checked) clearSpawnRadii();
    saveLayerPrefs();
});
document.getElementById('layer-npc-shops').addEventListener('change', e => {
    e.target.checked ? leafletMap.addLayer(npcShopLayer) : leafletMap.removeLayer(npcShopLayer);
    saveLayerPrefs();
});
// ── Sidebar collapse / expand ──────────────────────────────────────────────────
function setSidebarCollapsed(collapsed) {
    document.getElementById('sidebar').classList.toggle('collapsed', collapsed);
    document.getElementById('sidebar-toggle').style.display = collapsed ? 'block' : 'none';
    leafletMap.invalidateSize();
    updateLayersInHash();
}
document.getElementById('sidebar-collapse').addEventListener('click', () => setSidebarCollapsed(true));
document.getElementById('sidebar-toggle').addEventListener('click',   () => setSidebarCollapsed(false));

document.getElementById('layer-territory').addEventListener('change', e => {
    if (e.target.checked) {
        leafletMap.addLayer(territoryLayer);
        // Populate with any already-expanded groups
        for (const g of _groupStore.values())
            if (g.isExpanded && g.territoryRect) territoryLayer.addLayer(g.territoryRect);
    } else {
        territoryLayer.clearLayers();
        leafletMap.removeLayer(territoryLayer);
    }
    saveLayerPrefs();
});

document.getElementById('btn-expand-collapse').addEventListener('click', () => {
    const anyCollapsed = [..._groupStore.values()].some(g => !g.isExpanded);
    if (anyCollapsed) _expandAllGroups(); else _collapseAllGroups();
});

// ── Sidebar map list ───────────────────────────────────────────────────────────
function splitPascalCase(s) {
    // Pre-split pass: handle "to" preposition glued to the next PascalCase word
    // (e.g. "PathtoMorrow" → "Path to Morrow"). Must be done before basic split
    // so "to" at word-end (e.g. "Grotto") is not incorrectly split.
    // Handle "tothe" compound first ("PathtotheX" → "Path to the X").
    let result = s.replace(/([a-z])(to)(the)(?=[A-Z])/g, '$1 $2 $3 ');
    result = result.replace(/([a-z])(to)(?=[A-Z])/g, '$1 $2 ');
    // Insert space before each uppercase letter that follows a lowercase letter,
    // e.g. "TheWhiteDragonTemple" → "The White Dragon Temple"
    result = result.replace(/([a-z])([A-Z])/g, '$1 $2');
    // Insert space before "of"/"the"/"by" when glued to the preceding word (lowercase
    // prepositions embedded in PascalCase enum names), e.g. "Forestof Mist" → "Forest of Mist",
    // "Altarofthe Black Curse" → "Altar of the Black Curse",
    // "Wildernessby Castle" → "Wilderness by Castle".
    result = result.replace(/([a-z])(of)(?=the\b|[A-Z\s]|$)/g, '$1 $2');
    result = result.replace(/([a-z])(the)(?=[A-Z\s]|$)/g, '$1 $2');
    result = result.replace(/([ac-z])(by)(?=\s|$)/g, '$1 $2');
    // Insert space before a digit sequence, e.g. "Netherworld1" → "Netherworld 1"
    result = result.replace(/([a-zA-Z])(\d+)/g, '$1 $2');
    return result.replace(/  +/g, ' ').trim();
}

function displayName(mapName, info) {
    if (info.name_en) return splitPascalCase(info.name_en);
    return mapName;
}

function appendMapEntry(listEl, name, info, label, stid, currentMap, currentStage) {
    const isActive = name === currentMap && (stid === null ? !currentStage : stid === currentStage);
    const el = document.createElement('div');
    el.className = 'map-entry' + (isActive ? ' active' : '');
    el.dataset.map = name;

    const dot = document.createElement('span');
    dot.className = 'img-dot ' + (info.img_exists ? 'has-img' : 'no-img');
    el.appendChild(dot);

    const text = document.createElement('span');
    text.textContent = label + (info.name_en ? '' : ` (${name})`);
    el.appendChild(text);

    el.addEventListener('click', () => navigateTo(name, stid));
    listEl.appendChild(el);
}

// Render a collapsible row for multiple entries sharing the same display label.
// group: Array<{name, info, stid}> — each entry navigates independently.
function appendCollapsibleGroup(listEl, label, group, currentMap, currentStage) {
    const anyActive = group.some(e =>
        e.name === currentMap && (e.stid === null ? !currentStage : e.stid === currentStage)
    );
    const startOpen = anyActive;

    const el = document.createElement('div');
    el.className = 'map-entry' + (anyActive ? ' active' : '') + (startOpen ? ' expanded' : '');

    const arrow = document.createElement('span');
    arrow.className = 'expand-arrow';
    arrow.textContent = '▶';
    el.appendChild(arrow);

    const text = document.createElement('span');
    text.textContent = label;
    el.appendChild(text);

    const subList = document.createElement('div');
    subList.className = 'map-sublist' + (startOpen ? ' open' : '');

    for (const e of group) {
        const sub = document.createElement('div');
        const isActiveSub = e.name === currentMap &&
            (e.stid === null ? !currentStage : e.stid === currentStage);
        sub.className = 'map-subentry' + (isActiveSub ? ' active' : '');

        const subDot = document.createElement('span');
        subDot.className = 'img-dot ' + (e.info.img_exists ? 'has-img' : 'no-img');
        sub.appendChild(subDot);

        sub.appendChild(document.createTextNode(e.stid ?? e.name));
        sub.addEventListener('click', ev => { ev.stopPropagation(); navigateTo(e.name, e.stid); });
        subList.appendChild(sub);
    }

    el.addEventListener('click', () => {
        const open = subList.classList.toggle('open');
        el.classList.toggle('expanded', open);
    });

    listEl.appendChild(el);
    listEl.appendChild(subList);
}

function appendGroupHeader(listEl, text) {
    const header = document.createElement('div');
    header.className = 'map-group-header';
    header.textContent = text;
    listEl.appendChild(header);
}

function stageLabel(info, stid) {
    // Display name for a specific stage variant of a map.
    const raw = info.stage_names?.[stid] || info.name_en || '';
    return raw ? splitPascalCase(raw) : stid;
}

// Parse special key=value tokens out of a search string.
// Recognised keys: stageid, stageno, area (case-insensitive).
// Returns { conditions: [{key, value}], text: remainingLowercase }.
function parseSearchQuery(raw) {
    const tokens = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const conditions = [];
    const textParts = [];
    for (const tok of tokens) {
        const m = tok.match(/^(stageid|stageno|area)=(.+)$/);
        if (m) conditions.push({ key: m[1], value: m[2] });
        else    textParts.push(tok);
    }
    return { conditions, text: textParts.join(' ') };
}

function matchesQuery(name, info, label, stid, { conditions, text }) {
    // Structured conditions (all must match)
    for (const { key, value } of conditions) {
        if (key === 'stageid') {
            const sid = stid ? info.stage_ids?.[stid] : undefined;
            if (sid === undefined || String(sid) !== value) return false;
        } else if (key === 'stageno') {
            if (!stid) return false;
            // Accept "100" or "0100" — compare numerically
            if (parseInt(stid.slice(2), 10) !== parseInt(value, 10)) return false;
        } else if (key === 'area') {
            const aname = (info.quest_area_name ?? '').toLowerCase();
            if (!aname.includes(value)) return false;
        }
    }
    // Free-text substring (against name, label, stid)
    if (text && !name.includes(text) && !label.toLowerCase().includes(text) && !(stid && stid.includes(text))) return false;
    return true;
}

function buildSidebar(filter = '') {
    const listEl = document.getElementById('map-list');
    listEl.innerHTML = '';
    const currentMap = currentMapName();
    const currentStage = currentStageName();
    const query = parseSearchQuery(filter);
    const hasFilter = query.conditions.length > 0 || query.text.length > 0;

    // Build one entry per (name, stid) pair — stid suffix intentionally omitted from label.
    // Skip pd piece models (pd###_m##) — internal tileset pieces, not navigable locations.
    const pdPieceRe = /^pd\d+_m\d+$/;
    const entries = [];
    for (const [name, info] of Object.entries(mapParams)) {
        if (pdPieceRe.test(name)) continue;
        const stages = info.stages?.length ? info.stages : [null];
        for (const stid of stages) {
            // Label never includes the stid suffix — multi-stage maps are collapsed below
            const label = stid ? stageLabel(info, stid) : displayName(name, info);
            if (hasFilter && !matchesQuery(name, info, label, stid, query)) continue;
            entries.push({ name, info, label, stid });
        }
    }

    if (hasFilter) {
        entries.sort((a, b) => a.label.localeCompare(b.label));
        const byLabel = new Map();
        for (const e of entries) {
            if (!byLabel.has(e.label)) byLabel.set(e.label, []);
            byLabel.get(e.label).push(e);
        }
        for (const [label, group] of byLabel) {
            if (group.length === 1) {
                const e = group[0];
                appendMapEntry(listEl, e.name, e.info, label, e.stid, currentMap, currentStage);
            } else {
                appendCollapsibleGroup(listEl, label, group, currentMap, currentStage);
            }
        }
        return;
    }

    // No search: group by quest area (sorted by quest_area_id), then alphabetically within
    const areaMap = new Map(); // area_id -> { name, entries[] }
    for (const e of entries) {
        let aid   = e.info.quest_area_id  ?? 0;
        let aname = e.info.quest_area_name ?? 'Unknown';
        if (e.label.toLowerCase().includes('bitterblack')) {
            aid   = 24;
            aname = 'Bitterblack Maze';
        }
        if (!areaMap.has(aid)) areaMap.set(aid, { name: aname, entries: [] });
        areaMap.get(aid).entries.push(e);
    }

    const sortedAreas = [...areaMap.entries()].sort(([a], [b]) => {
        if (a === 0) return 1;
        if (b === 0) return -1;
        return a - b;
    });

    for (const [, area] of sortedAreas) {
        area.entries.sort((a, b) => a.label.localeCompare(b.label));
        appendGroupHeader(listEl, area.name);

        // Collapse entries that share the same display label into one expandable row.
        // This handles: same map model with multiple stages AND different models with identical names.
        const byLabel = new Map();
        for (const e of area.entries) {
            if (!byLabel.has(e.label)) byLabel.set(e.label, []);
            byLabel.get(e.label).push(e);
        }

        for (const [label, group] of byLabel) {
            if (group.length === 1) {
                const e = group[0];
                appendMapEntry(listEl, e.name, e.info, label, e.stid, currentMap, currentStage);
            } else {
                appendCollapsibleGroup(listEl, label, group, currentMap, currentStage);
            }
        }
    }
}

document.getElementById('map-search').addEventListener('input', e => {
    buildSidebar(e.target.value);
});

// ── URL hash navigation ────────────────────────────────────────────────────────
// Hash format: #mapname  or  #mapname:stid  or either suffixed with @zoom/y/x
// e.g. #rm000_m02:st0301@2.50/1024.0/800.0
function parseHash() {
    const raw = window.location.hash.slice(1);
    // Split off optional !layers suffix before everything else
    const [beforeLayers, layersPart = null] = raw.split('!');
    const [nameStid, viewPart = null] = beforeLayers.split('@');
    const [name, stid = null] = nameStid.split(':');
    let view = null;
    if (viewPart) {
        const [z, y, x] = viewPart.split('/').map(Number);
        if (!isNaN(z) && !isNaN(y) && !isNaN(x)) view = { zoom: z, center: L.latLng(y, x) };
    }
    let layers = null, openGroups = null;
    if (layersPart !== null) {
        const [flagStr, groupsStr = ''] = layersPart.split(';');
        layers = {
            enemies:      flagStr.includes('e'),
            landmarks:    flagStr.includes('l'),
            connections:  flagStr.includes('c'),
            grid:         flagStr.includes('g'),
            territory:    flagStr.includes('t'),
            stageLabels:  flagStr.includes('a'),
            gather:       flagStr.includes('r'),
            npcShops:     flagStr.includes('n'),
            sidebarHidden: flagStr.includes('s'),
        };
        openGroups = groupsStr ? groupsStr.split(',').filter(Boolean) : [];
    }
    return { name, stid, view, layers, openGroups };
}

function currentMapName() {
    const { name } = parseHash();
    return (name && mapParams[name]) ? name : 'field000_m00';
}

function currentStageName() {
    return parseHash().stid;
}

function navigateTo(mapName, stid = null) {
    window.location.hash = stid ? `${mapName}:${stid}` : mapName;
}

// Track last-loaded map+stid so hashchange can skip reloads on view-only updates.
let _loadedMapName = null;
let _loadedStid = null;

window.addEventListener('hashchange', () => {
    const newMap  = currentMapName();
    const newStid = currentStageName();
    if (newMap !== _loadedMapName || newStid !== _loadedStid) {
        loadMap(newMap);
        buildSidebar(document.getElementById('map-search').value);
    }
});

// Persist zoom+pan in the hash via replaceState (no extra history entries).
let _viewUpdateTimer = null;
leafletMap.on('moveend zoomend', () => {
    clearTimeout(_viewUpdateTimer);
    _viewUpdateTimer = setTimeout(() => {
        const { name, stid } = parseHash();
        const mapName = name || _loadedMapName;
        if (!mapName) return;
        const z = leafletMap.getZoom().toFixed(2);
        const c = leafletMap.getCenter();
        const frag = (stid ? `${mapName}:${stid}` : mapName)
                   + `@${z}/${c.lat.toFixed(1)}/${c.lng.toFixed(1)}`
                   + `!${getLayersHash()}`;
        history.replaceState(null, '', '#' + frag);
    }, 200);
});

// ── Overlapping marker spread ──────────────────────────────────────────────────
// When multiple markers share the exact same pixel position they stack invisibly.
// This detects such groups and fans them out into a small ring.
// Spokes and anchor dots are written to `overlayLayer` so they can be cleared
// independently (cross-group recompute on expand/collapse).
const OVERLAP_SPREAD_R = 9;   // ring radius in world-pixels (visible at zoom ≥ 0)

// Reset a spread marker back to its natural position and style.
function _resetMarkerSpread(m) {
    if (m._naturalLatLng) m.setLatLng(m._naturalLatLng);
    if (m._origStyle)     m.setStyle(m._origStyle);
    if (m._naturalTooltip) m.bindTooltip(m._naturalTooltip, { direction: 'top', offset: [0, -8] });
}

function _doSpread(markers, overlayLayer) {
    const byPos = new Map();
    for (const m of markers) {
        const ll  = m.getLatLng();
        const key = `${ll.lat.toFixed(2)}:${ll.lng.toFixed(2)}`;
        if (!byPos.has(key)) byPos.set(key, []);
        byPos.get(key).push(m);
    }

    for (const group of byPos.values()) {
        if (group.length < 2) continue;
        const origin = group[0].getLatLng();
        const N = group.length;

        const stackLines = group.map(m => {
            const c = m.options.color;
            return `<span style="color:${c};font-weight:bold">&#x25CF;</span> ${m._label ?? '?'}`;
        });
        // Create anchor first so spread markers can reference it in their hover handlers.
        const anchor = L.circleMarker(origin, {
            radius: 4, color: '#fff', fillColor: '#fff',
            fillOpacity: 0.85, weight: 1.5, opacity: 1.0, className: 'enemy-marker',
        })
            .bindTooltip(`<b>${N} stacked here:</b><br>${stackLines.join('<br>')}`,
                         { direction: 'top', offset: [0, -8] })
            .addTo(overlayLayer);
        anchor.on('mouseover', function() { _applyHighlight(group); });
        anchor.on('mouseout',  _unhighlightSG);

        group.forEach((m, i) => {
            const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
            m.setLatLng(L.latLng(
                origin.lat + OVERLAP_SPREAD_R * Math.sin(angle),
                origin.lng + OVERLAP_SPREAD_R * Math.cos(angle),
            ));
            m.setStyle({ dashArray: '4 3' });
            m._origStyle = { ...m._origStyle, dashArray: '4 3' };
            m.bindTooltip(
                `${m._naturalTooltip} <span style="opacity:0.7">[×${N} stacked]</span>`,
                { direction: 'top', offset: [0, -8] },
            );
            // Store anchor ref so SG-highlight can also enlarge it (task 1).
            m._spreadAnchor = anchor;
            // Hovering a spread node enlarges the anchor so the real position is easy to find.
            m.on('mouseover', () => { anchor.setRadius(8); anchor.setStyle({ weight: 2.5, fillOpacity: 1.0 }); });
            m.on('mouseout',  () => { anchor.setRadius(4); anchor.setStyle({ weight: 1.5, fillOpacity: 0.85 }); });
        });

        // Spokes: thin dashed lines that brighten when their spread node or the anchor is hovered.
        group.forEach(m => {
            const spoke = L.polyline([m.getLatLng(), origin], {
                color: m.options.color, weight: 1, opacity: 0.4,
                dashArray: '3 3', interactive: false,
            }).addTo(overlayLayer);
            m._spokeLine = spoke;

            m.on('mouseover', () => spoke.setStyle({ weight: 2.5, opacity: 1.0, dashArray: null }));
            m.on('mouseout',  () => spoke.setStyle({ weight: 1,   opacity: 0.4,  dashArray: '3 3' }));
        });

        // Hovering the anchor highlights all spokes in the group.
        anchor.on('mouseover', () => {
            for (const m of group) if (m._spokeLine)
                m._spokeLine.setStyle({ weight: 2.5, opacity: 1.0, dashArray: null });
        });
        anchor.on('mouseout', () => {
            for (const m of group) if (m._spokeLine)
                m._spokeLine.setStyle({ weight: 1, opacity: 0.4, dashArray: '3 3' });
        });
    }
}

// Recompute cross-group spread across all currently-expanded groups.
// Called after any expand or collapse so collisions between groups are always current.
function reapplySpread() {
    _spreadOverlay.clearLayers();
    const allMarkers = [];
    for (const g of _groupStore.values()) {
        if (!g.isExpanded || !g.detailsLayer) continue;
        for (const m of g.detailsLayer.getLayers()) {
            if (!m._spawn) continue;
            _resetMarkerSpread(m);
            allMarkers.push(m);
        }
    }
    _doSpread(allMarkers, _spreadOverlay);
}

// ── Group hull helpers ─────────────────────────────────────────────────────────
// Andrew's monotone chain — returns the convex hull of pts as [x,y] pairs.
function convexHull(pts) {
    if (pts.length < 3) return pts.slice();
    const s = [...pts].sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);
    const cross = (o, a, b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
    const lo = [], hi = [];
    for (const p of s) {
        while (lo.length >= 2 && cross(lo.at(-2), lo.at(-1), p) <= 0) lo.pop();
        lo.push(p);
    }
    for (let i = s.length - 1; i >= 0; i--) {
        const p = s[i];
        while (hi.length >= 2 && cross(hi.at(-2), hi.at(-1), p) <= 0) hi.pop();
        hi.push(p);
    }
    hi.pop(); lo.pop();
    return [...lo, ...hi];
}

// Ray-casting point-in-polygon test.  pts: [[x,y], ...] (Leaflet [lng,lat] pairs).
function pointInPolygon(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
            inside = !inside;
    }
    return inside;
}

// Middle-click anywhere inside an expanded group's hull collapses it.
// Hull polygons are non-interactive (pointer-events:none) so this map-level
// handler is the only way to catch middle-clicks in the hull area.
leafletMap.on('mousedown', (e) => {
    if (e.originalEvent.button !== 1) return;
    e.originalEvent.preventDefault();
    for (const g of _groupStore.values()) {
        if (!g.isExpanded || !g.hullPts || g.hullPts.length < 3) continue;
        if (pointInPolygon(e.latlng.lng, e.latlng.lat, g.hullPts)) {
            collapseGroup(g.groupId);
            return;
        }
    }
});

// ── Group chip / expand-collapse helpers ──────────────────────────────────────

function makeChipIcon(groupId, _color, count, expanded, yOffset = 10, isKeyBearerGroup = false) {
    // Use a brighter variant of the same hue for chip text (dark chip background needs L~0.78).
    const chipColor = `oklch(0.78 0.13 ${(parseInt(groupId, 10) * 137) % 360})`;
    const keyBadge  = isKeyBearerGroup ? '<span style="font-size:16px;margin-right:3px;color:#ffd700;" title="Key bearer group">🗝</span>' : '';
    return L.divIcon({
        className: '',
        html: `<div class="group-chip${expanded ? ' chip-open' : ''}" style="color:${chipColor}">${keyBadge}<span class="chip-arrow${expanded ? ' open' : ''}">&#9654;</span>G${groupId} <span class="chip-count">${count}</span></div>`,
        iconSize:   null,
        // When expanded: anchor at bottom of chip so the chip floats above the marker position.
        // When collapsed: anchor near top (yOffset) so chip hangs below the centroid.
        iconAnchor: expanded ? [0, 22] : [0, yOffset],
    });
}

// Build the details layer (hull + territory + spawn dots) for a group entry.
// Does NOT add the layer to the map — that is done by expandGroup.
function buildGroupDetails(g) {
    const info  = _currentMapInfo;
    const layer = L.layerGroup();

    // Hull
    if (g.pts.length >= 3) {
        const hull = convexHull(g.pts);
        if (hull.length >= 3) {
            const poly = L.polygon(hull.map(([px, py]) => xy(px, py)), {
                color:       g.color,
                weight:      1.5,
                opacity:     0.75,
                fillColor:   g.color,
                fillOpacity: 0.10,
                dashArray:   '6 4',
                interactive: false,  // pointer-events:none so canvas markers stay clickable
            });
            layer.addLayer(poly);
            g.hullPts = hull;  // stored for map-level middle-click collapse
        }
    } else if (g.pts.length === 2) {
        L.polyline(g.pts.map(([px, py]) => xy(px, py)), {
            color: g.color, weight: 1.5, opacity: 0.65, dashArray: '4 3', interactive: false,
        }).addTo(layer);
    }

    // Territory rectangle — stored separately so it respects the territory layer toggle
    g.territoryRect = null;
    if (g.territory) {
        const { xMin, xMax, zMin, zMax } = g.territory;
        const sw = worldToPixel(xMin, zMin, info);
        const ne = worldToPixel(xMax, zMax, info);
        g.territoryRect = L.rectangle([sw, ne], {
            color:       g.color,
            weight:      2,
            opacity:     0.85,
            fillColor:   g.color,
            fillOpacity: 0.08,
            dashArray:   '8 4',
            interactive: false,
        });
    }

    // Spawn circleMarkers
    g.sgMarkers = {};
    for (const { spawn, idx, sg, latlng, stageNo } of g.items) {
        const fillColor = spawnGroupColor(sg);
        const sgKey     = `${sg}:${g.groupId}`;

        const badge = `<span style="display:inline-block;padding:1px 6px;border-radius:3px;background:${fillColor};color:#111;font-weight:bold;font-size:11px;">Spawn Set: ${sg}</span>`;
        const subLine = spawn.SubGroupNo != null ? (() => {
            const subColor = spawnGroupColor(spawn.SubGroupNo);
            const subBadge = `<span style="display:inline-block;padding:1px 6px;border-radius:3px;background:${subColor};color:#111;font-weight:bold;font-size:11px;">${spawn.SubGroupNo}</span>`;
            return `<br>SubGroup: ${subBadge}`;
        })() : '';
        const groupLabel = `<span style="color:${g.color};font-weight:bold;">Group: ${g.groupId}</span>`;
        const isKeyBearer = spawn.KeyBearer === true;
        const keyLine = isKeyBearer ? '<br><span style="font-size:11px">🗝 Key Bearer</span>' : '';

        // Build popup HTML optionally enriched with server EnemySpawn data
        const serverStageId = stageIds[stageNo];
        const spawnKey = serverStageId != null
            ? `${serverStageId},${g.groupId},${spawn.posIdx ?? idx}` : null;

        // Per-marker display index for cycling through day/night/always variants
        let displayIdx = 0;

        const spawnTimeLabel = (t) => {
            if (!t || t === '00:00,23:59') return '';
            if (t.startsWith('07:')) return '☀ Day';
            if (t.startsWith('18:')) return '🌙 Night';
            return t;
        };

        const buildDropsHtml = (spawnInfo) => {
            if (!spawnInfo?.drops?.length) return '';
            return '<br><table style="font-size:13px;margin-top:6px;border-collapse:collapse;line-height:1.8">' +
                spawnInfo.drops.map(row => {
                    // row = [itemId, minQty, maxQty, unknown, isHidden, dropRate]
                    const itemId   = row[0];
                    const minQty   = row[1] ?? 1;
                    const maxQty   = row[2] ?? 1;
                    const dropRate = row[5];
                    const entry    = itemNames[String(itemId)];
                    const name     = entry?.name ?? `Item #${itemId}`;
                    const iconNo   = entry?.iconNo;
                    const iconFile = iconNo != null ? `ii${String(iconNo).padStart(6, '0')}.png` : null;
                    const icon     = iconFile && _iconIdSet.has(iconNo)
                        ? `<img src="images/icons/small/${iconFile}" width="28" height="28" style="vertical-align:middle;margin-right:6px;image-rendering:pixelated">`
                        : `<span style="display:inline-block;width:28px;margin-right:6px"></span>`;
                    const href     = `https://reference.dd-on.com/build/i${String(itemId).padStart(8, '0')}.html`;
                    const nameLink = `<a href="${href}" target="_blank" style="color:inherit;text-decoration:none" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${name}</a>`;
                    const qty      = maxQty > minQty ? ` ×${minQty}–${maxQty}` : ` ×${minQty}`;
                    const pct      = dropRate > 0
                        ? ` <span style="color:#777">(${(dropRate * 100).toFixed(0)}%)</span>` : '';
                    return `<tr><td style="color:#222;padding-right:8px;white-space:nowrap">${icon}${nameLink}</td><td style="color:#555;white-space:nowrap">${qty}${pct}</td></tr>`;
                }).join('') +
                '</table>';
        };

        const buildEnemyPopup = (spawnCache) => {
            const entries   = spawnKey && spawnCache ? (spawnCache.get(spawnKey) ?? []) : [];
            const spawnInfo = entries[displayIdx] ?? null;
            // An enemy is "present" if: server data isn't loaded yet (unknown),
            // or any entry has a non-zero level.
            const hasEnemy  = !spawnCache || entries.some(e => !!e.lv);
            // Prefer em code from server data; fall back to lot file only while loading
            const emCode    = spawnInfo?.emCode ?? (hasEnemy ? spawn.EmName : null);
            const emEntry   = emCode ? emNames[emCode] : null;
            const dispName  = emEntry?.name ?? null;
            const lvText    = spawnInfo?.lv ? ` Lv${spawnInfo.lv}` : '';
            const emCodeLine = dispName && emCode
                ? `<span style="color:#888;font-size:10px"> (${emCode})</span>` : '';
            const emLine = dispName
                ? `<br><span style="color:#333;font-size:12px">${dispName}${lvText}</span>${emCodeLine}` : '';

            // Cycle controls when multiple day/night variants exist
            const cycleHtml = entries.length > 1 ? (() => {
                const btnStyle = 'background:#e8e8e8;border:1px solid #bbb;border-radius:3px;padding:0 5px;cursor:pointer;font-size:11px;line-height:16px;';
                const timeLabel = spawnTimeLabel(spawnInfo?.spawnTime);
                const timePart  = timeLabel ? ` &nbsp;${timeLabel}&nbsp; ` : ` &nbsp;`;
                return `<br><span style="font-size:11px;color:#444">` +
                    `<button class="spawn-prev" style="${btnStyle}">◀</button>` +
                    `${timePart}<span style="color:#666">${displayIdx + 1}/${entries.length}</span>&nbsp;` +
                    `<button class="spawn-next" style="${btnStyle}">▶</button></span>`;
            })() : '';

            const radiiLine = hasEnemy && (spawn.AggroRadius || spawn.LinkRadius) ? (() => {
                const ag = spawn.AggroRadius
                    ? `<span style="color:#ffd700">&#9679;</span> Aggro: ${spawn.AggroRadius}` : '';
                const lk = spawn.LinkRadius
                    ? `<span style="color:#ff7700">&#9675;</span> Link: ${spawn.LinkRadius}` : '';
                return `<br><span style="font-size:11px">${[ag, lk].filter(Boolean).join(' &nbsp; ')}</span>`;
            })() : '';
            const orbsLine = hasEnemy && (spawnInfo?.bloodOrbs || spawnInfo?.highOrbs) ? (() => {
                const b = spawnInfo.bloodOrbs ? `🩸 ${spawnInfo.bloodOrbs}` : '';
                const h = spawnInfo.highOrbs  ? `⭐ ${spawnInfo.highOrbs}`  : '';
                return `<br><span style="font-size:12px">${[b, h].filter(Boolean).join(' &nbsp; ')}</span>`;
            })() : '';
            return `${badge}<br>${groupLabel}, Index: <b>${idx}</b>${subLine}${cycleHtml}${emLine}${keyLine}${radiiLine}${orbsLine}${buildDropsHtml(spawnInfo)}`;
        };

        const buildTooltip = (spawnCache) => {
            const entries  = spawnKey && spawnCache ? (spawnCache.get(spawnKey) ?? []) : [];
            const hasEnemy = !spawnCache || entries.some(e => !!e.lv);
            let namePart = '';
            if (entries.length > 1) {
                // Show all variants: "Killer Bee Lv3☀ / Skeleton Lv3🌙"
                const parts = entries
                    .filter(e => !!e.lv)
                    .map(e => {
                        const n = e.emCode ? (emNames[e.emCode]?.name ?? e.emCode) : null;
                        const t = spawnTimeLabel(e.spawnTime);
                        return n ? `${n} Lv${e.lv}${t ? [...t][0] : ''}` : null;
                    })
                    .filter(Boolean);
                if (parts.length) namePart = parts.join(' / ') + ' — ';
            } else if (entries.length === 1 && hasEnemy) {
                const e0 = entries[0];
                const n  = e0.emCode ? (emNames[e0.emCode]?.name ?? null) : (spawn.EmName ? (emNames[spawn.EmName]?.name ?? null) : null);
                if (n) namePart = `${n}${e0.lv ? ` Lv${e0.lv}` : ''} — `;
            } else if (!spawnCache && hasEnemy && spawn.EmName) {
                const n = emNames[spawn.EmName]?.name ?? null;
                if (n) namePart = `${n} — `;
            }
            return `${namePart}${g.groupId}.${idx} [SS:${sg}]${isKeyBearer ? ' <span style="color:#c8a000;font-size:16px;">🗝</span>' : ''}`;
        };

        const marker = L.circleMarker(latlng, {
            renderer:    spawnRenderer,
            className:   `enemy-marker${isKeyBearer ? ' key-bearer-spawn' : ''}`,
            color:       isKeyBearer ? '#c8a000' : g.color,
            fillColor,
            fillOpacity: 0.85,
            weight:      isKeyBearer ? 3.5 : 2.5,
            radius:      5,
        })
            .bindPopup(buildEnemyPopup(_enemySpawnCache))
            .bindTooltip('', { direction: 'top', offset: [0, -8] });

        // Rebuild tooltip fresh on every hover so level/name is always current
        marker.on('tooltipopen', function() {
            const tt = buildTooltip(_enemySpawnCache);
            this.setTooltipContent(tt);
            this._label = tt;
            this._naturalTooltip = tt;
            if (!_enemySpawnCache && spawnKey) {
                _enemySpawnPromise.then(cache => {
                    const updated = buildTooltip(cache);
                    this._label = updated;
                    this._naturalTooltip = updated;
                    if (this.isTooltipOpen()) this.setTooltipContent(updated);
                });
            }
        });

        // Rebuild popup content and attach cycle-button handlers on open.
        // Uses direct innerHTML update on the content div to avoid Leaflet's
        // setContent/update reflow, which closes tooltips and repositions the popup.
        let _popupClickHandler = null;
        marker.on('popupopen', function() {
            const popup = this.getPopup();
            const bind = (cache) => {
                requestAnimationFrame(() => {
                    const el = popup.getElement();
                    if (!el) return;
                    // Update content without triggering Leaflet reflow
                    const contentDiv = el.querySelector('.leaflet-popup-content');
                    if (contentDiv) contentDiv.innerHTML = buildEnemyPopup(cache);
                    // Replace click handler (event delegation — survives innerHTML swaps)
                    if (_popupClickHandler) el.removeEventListener('click', _popupClickHandler);
                    const entries = cache?.get(spawnKey) ?? [];
                    if (entries.length <= 1) return;
                    _popupClickHandler = (e) => {
                        const btn = e.target.closest('.spawn-prev, .spawn-next');
                        if (!btn) return;
                        e.stopPropagation();
                        displayIdx = (displayIdx + (btn.classList.contains('spawn-prev') ? -1 : 1) + entries.length) % entries.length;
                        const cd = el.querySelector('.leaflet-popup-content');
                        if (cd) cd.innerHTML = buildEnemyPopup(cache);
                    };
                    el.addEventListener('click', _popupClickHandler);
                });
            };
            if (_enemySpawnCache) { bind(_enemySpawnCache); return; }
            _enemySpawnPromise.then(cache => { if (this.isPopupOpen()) bind(cache); });
        });

        marker._sgKey          = sgKey;
        marker._label          = buildTooltip(_enemySpawnCache);
        marker._origStyle      = { color: isKeyBearer ? '#c8a000' : g.color, weight: isKeyBearer ? 3.5 : 2.5, fillOpacity: 0.85 };
        marker._spawn          = spawn;
        marker._info           = info;
        marker._naturalLatLng  = latlng;    // saved for spread reset
        marker._naturalTooltip = buildTooltip(_enemySpawnCache);

        if (!g.sgMarkers[sgKey]) g.sgMarkers[sgKey] = [];
        g.sgMarkers[sgKey].push(marker);

        marker
            .on('mouseover', function() { _highlightSG(this._sgKey); })
            .on('mouseout',  _unhighlightSG)
            .on('click',     function() { _radiiClickConsumed = true; showSpawnRadii(this); });
        layer.addLayer(marker);
    }

    g.detailsLayer = layer;
}

// _expandGroupCore / _collapseGroupCore do the state change without triggering
// reapplySpread or updateLayersInHash — used by bulk operations.
function _expandGroupCore(g) {
    if (!g.detailsLayer) buildGroupDetails(g);
    const enemiesOn = document.getElementById('layer-enemies').checked;
    if (enemiesOn) g.detailsLayer.addTo(leafletMap);
    if (document.getElementById('layer-territory').checked && g.territoryRect)
        territoryLayer.addLayer(g.territoryRect);
    g.isExpanded = true;
    // Move chip to just above the topmost spawn so it doesn't cover any enemies.
    // Use the topmost spawn's own X so the chip stays directly above the hull, not the centroid.
    let topPx = g.pts[0][0], topPy = g.pts[0][1];
    for (const [px, py] of g.pts) { if (py > topPy) { topPy = py; topPx = px; } }
    g.labelMarker.setLatLng(xy(topPx, topPy + 10));
    g.labelMarker.setIcon(makeChipIcon(g.groupId, g.color, g.items.length, true, g.yOffset, g.isKeyBearerGroup));
    for (const [sgKey, markers] of Object.entries(g.sgMarkers)) {
        if (!_sgMarkers[sgKey]) _sgMarkers[sgKey] = [];
        _sgMarkers[sgKey].push(...markers);
    }
}

function _collapseGroupCore(g) {
    if (g.detailsLayer) leafletMap.removeLayer(g.detailsLayer);
    if (g.territoryRect) territoryLayer.removeLayer(g.territoryRect);
    g.isExpanded = false;
    g.labelMarker.setLatLng(xy(g.centroid.px, g.centroid.py));
    g.labelMarker.setIcon(makeChipIcon(g.groupId, g.color, g.items.length, false, g.yOffset, g.isKeyBearerGroup));
    for (const sgKey of Object.keys(g.sgMarkers)) delete _sgMarkers[sgKey];
    if (_activeRadiiMarker && g.items.some(it => it.spawn === _activeRadiiMarker._spawn))
        clearSpawnRadii();
}

function expandGroup(groupId) {
    const g = _groupStore.get(groupId);
    if (!g || g.isExpanded) return;
    _expandGroupCore(g);
    _updateExpandCollapseBtn();
    reapplySpread();
}

function collapseGroup(groupId) {
    const g = _groupStore.get(groupId);
    if (!g || !g.isExpanded) return;
    _collapseGroupCore(g);
    _updateExpandCollapseBtn();
    reapplySpread();
}

function toggleGroup(groupId) {
    const g = _groupStore.get(groupId);
    if (!g) return;
    if (g.isExpanded) collapseGroup(groupId); else expandGroup(groupId);
}

function _expandAllGroups() {
    for (const g of _groupStore.values()) if (!g.isExpanded) _expandGroupCore(g);
    _updateExpandCollapseBtn();
    reapplySpread();
}

function _collapseAllGroups() {
    for (const g of _groupStore.values()) if (g.isExpanded) _collapseGroupCore(g);
    _updateExpandCollapseBtn();
    reapplySpread();
}

function _updateExpandCollapseBtn() {
    const btn = document.getElementById('btn-expand-collapse');
    if (!btn) return;
    const anyCollapsed = [..._groupStore.values()].some(g => !g.isExpanded);
    btn.textContent = anyCollapsed ? 'Expand All' : 'Collapse All';
    updateLayersInHash();
}

// ── Enemy spawn markers ────────────────────────────────────────────────────────

// Registry of circleMarkers keyed by "sg:groupId", rebuilt on each loadEnemySpawns call.
// Used to highlight all markers sharing the same SG within the same group on hover.
let _sgMarkers = {};
let _unhighlightTimer = null;
let _highlightedSet   = new Set();  // all markers currently in highlighted state

function _clearHighlight() {
    for (const m of _highlightedSet) {
        m.setStyle(m._origStyle);
        m.setRadius(5);
        m.closeTooltip();
        if (m._spreadAnchor) {
            m._spreadAnchor.setRadius(4);
            m._spreadAnchor.setStyle({ weight: 1.5, fillOpacity: 0.85 });
        }
        if (m._spokeLine) m._spokeLine.setStyle({ weight: 1, opacity: 0.4, dashArray: '3 3' });
    }
    _highlightedSet.clear();
}

function _applyHighlight(markers) {
    clearTimeout(_unhighlightTimer);
    _clearHighlight();                  // synchronously reset any previously lit markers
    for (const m of markers) {
        m.setStyle({ weight: 4, fillOpacity: 1.0, color: '#ffffff' });
        m.setRadius(9);
        m.openTooltip();
        _highlightedSet.add(m);
        if (m._spreadAnchor) {
            m._spreadAnchor.setRadius(8);
            m._spreadAnchor.setStyle({ weight: 2.5, fillOpacity: 1.0 });
        }
        if (m._spokeLine) m._spokeLine.setStyle({ weight: 2.5, opacity: 1.0, dashArray: null });
    }
}

function _highlightSG(sgKey) {
    _applyHighlight(_sgMarkers[sgKey] || []);
}

function _unhighlightSG() {
    _unhighlightTimer = setTimeout(_clearHighlight, 160);
}

// ── Spawn aggro/link radius circles ───────────────────────────────────────────
let _activeRadiiMarker = null;   // the marker whose circles are currently shown

function clearSpawnRadii() {
    spawnRadiiLayer.clearLayers();
    _activeRadiiMarker = null;
}

function showSpawnRadii(marker) {
    if (!document.getElementById('layer-radii').checked) return;
    // Toggle off if clicking the same marker again
    if (_activeRadiiMarker === marker) {
        clearSpawnRadii();
        return;
    }
    spawnRadiiLayer.clearLayers();
    _activeRadiiMarker = marker;

    const spawn = marker._spawn;
    const info  = marker._info;
    if (!spawn || !info) return;

    // Convert world-unit radius → map CRS units (image pixels).
    // info.scale is pixels-per-world-unit (used for the X axis on all map types).
    const scale = info.scale;
    const latlng = marker.getLatLng();

    if (spawn.AggroRadius) {
        L.circle(latlng, {
            radius:      spawn.AggroRadius * scale,
            color:       '#ffd700',
            weight:      1.5,
            opacity:     0.9,
            fillColor:   '#ffd700',
            fillOpacity: 0.07,
            dashArray:   null,
            interactive: false,
        }).addTo(spawnRadiiLayer);
    }

    if (spawn.LinkRadius) {
        L.circle(latlng, {
            radius:      spawn.LinkRadius * scale,
            color:       '#ff7700',
            weight:      2,
            opacity:     0.9,
            fillColor:   '#ff7700',
            fillOpacity: 0.05,
            dashArray:   '6 4',
            interactive: false,
        }).addTo(spawnRadiiLayer);
    }
}

// Dismiss circles when clicking the map background (not a marker).
// _radiiClickConsumed is set by the marker click handler so the map-level
// click that Leaflet always fires afterwards doesn't immediately clear them.
let _radiiClickConsumed = false;
leafletMap.on('click', () => {
    if (_radiiClickConsumed) { _radiiClickConsumed = false; return; }
    clearSpawnRadii();
});

// Each distinct SpawnGroup value (0–255) gets its own deterministic fill colour.
// Same SpawnGroup value = same spawn condition = same colour everywhere on the map.
// Uses OKLCH so perceived brightness is uniform across all hues (unlike HSL where
// yellow looks nearly white and blue looks dark at the same L value).
function spawnGroupColor(sg) {
    const hue = (sg * 137) % 360;
    const L = sg < 50 ? 0.80 : 0.72;    // perceptual lightness (0–1)
    const C = sg < 50 ? 0.10 : 0.17;    // chroma: softer for common spawns
    return `oklch(${L} ${C} ${hue})`;
}

// Deterministic OKLCH colour from a file group ID (GroupNo).
// L=0.55 is darker than the tan dungeon backgrounds (~0.62) so outlines stand out,
// and still readable against the dark chip background.  C=0.13 is muted but distinct.
function groupBorderColor(groupId) {
    const hue = (groupId * 137) % 360;
    return `oklch(0.55 0.13 ${hue})`;
}

// ── Floor OBB test ────────────────────────────────────────────────────────────
// Returns the FloorId (= layer index) for a world position using the GMP OBBs,
// or null if no OBB contains the point.
// OBB test: translate to local space via dot products with the two XZ axes,
// then test each local coordinate against the half-extents.
// The Y axis is always world-vertical (M2=[0,1,0]), so |dy| <= ey directly.
function getEnemyFloor(worldX, worldY, worldZ, floorObbs) {
    for (const o of floorObbs) {
        const dx = worldX - o.cx;
        const dy = worldY - o.cy;
        const dz = worldZ - o.cz;
        const lx = dx * o.ax + dz * o.az;   // project onto local X axis
        const lz = dx * o.bx + dz * o.bz;   // project onto local Z axis
        if (Math.abs(lx) <= o.ex && Math.abs(dy) <= o.ey && Math.abs(lz) <= o.ez)
            return o.floor_id;
    }
    return null;
}

function loadEnemySpawns(info, stid = null) {
    // Tear down all previous group state
    enemyLayer.clearLayers();
    for (const g of _groupStore.values()) {
        if (g.detailsLayer) leafletMap.removeLayer(g.detailsLayer);
    }
    _groupStore.clear();
    _sgMarkers = {};
    _spreadOverlay.clearLayers();
    territoryLayer.clearLayers();
    clearSpawnRadii();
    _currentMapInfo   = info;
    _currentFloorObbs = info.floor_obbs ?? null;
    if (!info.stages?.length) return;

    const floorObbs     = _currentFloorObbs;
    const filterByFloor = floorObbs !== null;

    const stagesToLoad = (stid && info.stages.includes(stid)) ? [stid] : info.stages;

    // Collect all groups, merging across stages if multiple are loaded
    const byGroupId = new Map(); // groupId string → { territory, items:[{spawn,idx,sg,latlng}], pts:[] }
    for (const stageId of stagesToLoad) {
        const stageNo   = String(parseInt(stageId.slice(2), 10));
        const stageData = enemyPositions[stageNo];
        if (!stageData) continue;
        for (const [groupId, groupData] of Object.entries(stageData)) {
            const spawns         = groupData.spawns         ?? groupData;  // back-compat
            const territory      = groupData.territory      ?? null;
            const keyBearerGroup = groupData.keyBearerGroup ?? false;
            if (!byGroupId.has(groupId)) byGroupId.set(groupId, { territory, keyBearerGroup, items: [], pts: [] });
            else if (keyBearerGroup) byGroupId.get(groupId).keyBearerGroup = true;
            const entry = byGroupId.get(groupId);
            for (let i = 0; i < spawns.length; i++) {
                const spawn = spawns[i];
                const pos   = spawn.Position;
                if (filterByFloor) {
                    const floor = getEnemyFloor(pos.x, pos.y, pos.z, floorObbs);
                    if (floor !== null && floor !== currentLayer) continue;
                }
                const latlng = worldToPixel(pos.x, pos.z, info);
                entry.pts.push([latlng.lng, latlng.lat]);
                entry.items.push({ spawn, idx: i, sg: spawn.SpawnGroup ?? 0, latlng, stageNo });
            }
        }
    }

    // Detect centroid collisions so stacked chips can be offset
    const centroidBuckets = new Map();
    for (const [groupId, { pts }] of byGroupId) {
        if (!pts.length) continue;
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const key = `${Math.round(cx)}:${Math.round(cy)}`;
        if (!centroidBuckets.has(key)) centroidBuckets.set(key, []);
        centroidBuckets.get(key).push(groupId);
    }

    // Create one chip label marker per group (collapsed by default)
    for (const [groupId, { territory, keyBearerGroup, items, pts }] of byGroupId) {
        if (!pts.length) continue;
        const color = groupBorderColor(parseInt(groupId, 10));
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;

        // Offset chip vertically if multiple groups share the same centroid
        const bucketKey = `${Math.round(cx)}:${Math.round(cy)}`;
        const bucket    = centroidBuckets.get(bucketKey);
        const slotIdx   = bucket.indexOf(groupId);
        const yOffset   = 10 + slotIdx * 20;  // pixels below anchor

        const chipIcon    = makeChipIcon(groupId, color, items.length, false, yOffset, keyBearerGroup);
        const labelMarker = L.marker(xy(cx, cy), { icon: chipIcon, zIndexOffset: 100 });

        const g = { groupId, color, territory, isKeyBearerGroup: keyBearerGroup, items, pts,
                    centroid: { px: cx, py: cy }, yOffset,
                    labelMarker, detailsLayer: null, isExpanded: false, sgMarkers: {} };
        _groupStore.set(groupId, g);

        labelMarker.on('click', (e) => { L.DomEvent.stopPropagation(e); toggleGroup(groupId); });
        labelMarker.addTo(enemyLayer);
    }

    _updateExpandCollapseBtn();
}

// ── Landmark markers ──────────────────────────────────────────────────────────
const LANDMARK_COLORS = {
    TYPE_DOOR:       '#ffd700',
    TYPE_CAVE:       '#ff8c00',
    TYPE_BASEMENT:   '#cd853f',
    TYPE_CATACOMB:   '#9b59b6',
    TYPE_ELF_RUIN:   '#1abc9c',
    TYPE_AREA_WARP:  '#00bcd4',
    TYPE_SHRINE:     '#ffffff',
    TYPE_OUTPOST:    '#4caf50',
    TYPE_WATER_LINE: '#4fc3f7',
    TYPE_WELL:       '#81d4fa',
    TYPE_TEXT:       '#888888',
    TYPE_NONE:       '#444444',
};

// Types that clutter the map without being useful landmarks
const HIDDEN_LANDMARK_TYPES = new Set(['TYPE_TEXT', 'TYPE_WATER_LINE', 'TYPE_NONE']);

// ── Live server data (fetched from GitHub at runtime) ─────────────────────────
// File content for local overrides is stored in IndexedDB (higher capacity than
// localStorage). localStorage only holds the sentinel '__local__' or a URL string.
const _idb = new Promise(resolve => {
    try {
        const req = indexedDB.open('ddon-maps-src', 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore('files');
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => resolve(null);
    } catch { resolve(null); }
});
function _idbGet(key) {
    return _idb.then(db => db ? new Promise(res => {
        const r = db.transaction('files').objectStore('files').get(key);
        r.onsuccess = () => res(r.result ?? null); r.onerror = () => res(null);
    }) : null);
}
function _idbSet(key, val) {
    return _idb.then(db => db ? new Promise((res, rej) => {
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put(val, key);
        tx.oncomplete = res; tx.onerror = rej;
    }) : null);
}
function _idbDel(key) {
    return _idb.then(db => db ? new Promise((res, rej) => {
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').delete(key);
        tx.oncomplete = res; tx.onerror = rej;
    }) : null);
}

// Returns a URL to use for fetching (custom URL, blob from IDB/FSA handle, or default).
// FSA handles (stored under lsKey+'-handle') always re-read the live file from disk.
// Stored content (IDB under lsKey) is the fallback when FSA isn't available or lacks permission.
async function getSrcUrl(lsKey, defaultUrl) {
    try {
        const val = localStorage.getItem(lsKey);
        if (!val) return defaultUrl;
        if (val === '__local__') {
            // Try FSA handle first — always reads fresh file from disk
            const handle = await _idbGet(lsKey + '-handle');
            if (handle) {
                try {
                    const perm = await handle.queryPermission({ mode: 'read' });
                    if (perm === 'granted') {
                        const file = await handle.getFile();
                        return URL.createObjectURL(file);
                    }
                    // Permission not yet granted — fall through to stored content.
                    // User can open ⚙ Settings to grant it (opening the modal = user gesture).
                } catch { /* handle may be stale; fall through */ }
            }
            // Fall back to stored content (IDB or legacy localStorage)
            const data = await _idbGet(lsKey);
            if (data) return URL.createObjectURL(new Blob([data]));
            const lsData = localStorage.getItem(lsKey + '-data');
            if (lsData) return URL.createObjectURL(new Blob([lsData]));
            return defaultUrl;
        }
        return val;
    } catch { return defaultUrl; }
}

// Show a visible error banner in the sidebar when a data source fails to load.
function showSrcError(label) {
    let box = document.getElementById('src-errors');
    if (!box) {
        box = document.createElement('div');
        box.id = 'src-errors';
        box.style.cssText = 'font-size:0.75rem;padding:2px 8px;';
        const sidebar = document.getElementById('sidebar');
        const anchor  = sidebar.querySelector('#search-box') ?? sidebar.children[1];
        sidebar.insertBefore(box, anchor);
    }
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:3px;'
        + 'color:#f99;background:#2a0f0f;border-left:3px solid #c0392b;border-radius:2px;padding:3px 6px;';
    item.innerHTML = `⚠ <span style="flex:1"><b>${label}</b> failed to load</span>`
        + `<button data-action="fix" style="font-size:0.7rem;padding:1px 5px;cursor:pointer;`
        + `background:none;color:#ffd700;border:1px solid #666;border-radius:2px">⚙ Fix</button>`
        + `<button data-action="dismiss" style="font-size:0.7rem;padding:1px 4px;cursor:pointer;`
        + `background:none;color:#aaa;border:none">✕</button>`;
    item.querySelector('[data-action="fix"]').addEventListener('click',
        () => document.getElementById('settings-btn').click());
    item.querySelector('[data-action="dismiss"]').addEventListener('click', () => item.remove());
    box.appendChild(item);
}

const _DEFAULT_GATHERING_URL = 'https://raw.githubusercontent.com/sebastian-heinz/Arrowgene.DragonsDogmaOnline/refs/heads/develop/Arrowgene.Ddon.Shared/Files/Assets/GatheringItem.csv';
const _DEFAULT_SPAWNS_URL    = 'https://raw.githubusercontent.com/sebastian-heinz/Arrowgene.DragonsDogmaOnline/refs/heads/develop/Arrowgene.Ddon.Shared/Files/Assets/EnemySpawn.json';
const _DEFAULT_SHOP_URL      = 'https://raw.githubusercontent.com/sebastian-heinz/Arrowgene.DragonsDogmaOnline/refs/heads/develop/Arrowgene.Ddon.Shared/Files/Assets/Shop.json';

// Cached promises — fetch starts once, result shared by all callers.
// Map key: "stageId,groupId,posId" → [{itemId, itemNum, maxItemNum, quality, dropChance, isHidden}]
let _gatherItemsCache = null;
const _gatherItemsPromise = getSrcUrl('ddon-src-gathering', _DEFAULT_GATHERING_URL)
    .then(url => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); }))
    .then(text => {
        const lines = text.split('\n');
        // First column header is "#StageId" — strip the leading '#'
        lines[0] = lines[0].replace(/^#/, '');
        const result = new Map();
        const headers = lines[0].split(',');
        const idx = name => headers.indexOf(name);
        const iStage = idx('StageId'), iGroup = idx('GroupId'),
              iPos = idx('PosId'), iItem = idx('ItemId'), iNum = idx('ItemNum'),
              iMax = idx('MaxItemNum'), iQual = idx('Quality'),
              iHidden = idx('IsHidden'), iChance = idx('DropChance');
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',');
            if (cols.length < 5) continue;
            const key = `${cols[iStage]},${cols[iGroup]},${cols[iPos]}`;
            if (!result.has(key)) result.set(key, []);
            result.get(key).push({
                itemId:     parseInt(cols[iItem]),
                itemNum:    parseInt(cols[iNum]),
                maxItemNum: parseInt(cols[iMax]),
                quality:    parseInt(cols[iQual]),
                isHidden:   cols[iHidden] === 'true' || cols[iHidden] === '1',
                dropChance: parseFloat(cols[iChance]),
            });
        }
        _gatherItemsCache = result;
        return result;
    })
    .catch(() => { showSrcError('Gathering Items'); _gatherItemsCache = new Map(); return _gatherItemsCache; });

// Map key for enemy spawns: "stageId,groupId,posIdx" → [{emCode, lv, bloodOrbs, highOrbs, spawnTime, drops}]
let _enemySpawnCache = null;
const _enemySpawnPromise = getSrcUrl('ddon-src-spawns', _DEFAULT_SPAWNS_URL)
    .then(url => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }))
    .then(data => {
        const schemas = data.schemas?.enemies ?? [];
        const iStage     = schemas.indexOf('StageId'),
              iGroup     = schemas.indexOf('GroupId'),
              iPosIdx    = schemas.indexOf('PositionIndex'),
              iEnemyId   = schemas.indexOf('EnemyId'),
              iLv        = schemas.indexOf('Lv'),
              iBlood     = schemas.indexOf('BloodOrbs'),
              iHigh      = schemas.indexOf('HighOrbs'),
              iSpawnTime = schemas.indexOf('SpawnTime'),
              iDrops     = schemas.indexOf('DropsTableId');
        const dropsTables = {};
        for (const dt of (data.dropsTables ?? [])) dropsTables[dt.id] = dt;
        const result = new Map();
        for (const e of (data.enemies ?? [])) {
            const key  = `${e[iStage]},${e[iGroup]},${e[iPosIdx]}`;
            const dtId = e[iDrops];
            const dt   = dtId != null && dtId >= 0 ? dropsTables[dtId] : null;
            // Convert '0x011200' → 'em011200'
            const hexStr = e[iEnemyId];
            const emCode = hexStr ? `em${hexStr.slice(2).toLowerCase().padStart(6, '0')}` : null;
            const entry = {
                emCode:    emCode,
                lv:        e[iLv]        ?? null,
                bloodOrbs: e[iBlood]     ?? 0,
                highOrbs:  e[iHigh]      ?? 0,
                spawnTime: e[iSpawnTime] ?? null,
                drops:     dt ? dt.items : [],
            };
            if (result.has(key)) result.get(key).push(entry);
            else                 result.set(key, [entry]);
        }
        _enemySpawnCache = result;
        return result;
    })
    .catch(() => { showSrcError('Enemy Spawns'); _enemySpawnCache = new Map(); return _enemySpawnCache; });

// Map: ShopId → {walletType, items:[{itemId, price, stock}]}
let _shopCache = null;
const _shopPromise = getSrcUrl('ddon-src-shop', _DEFAULT_SHOP_URL)
    .then(url => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }))
    .then(data => {
        const result = new Map();
        for (const shop of data) {
            result.set(shop.ShopId, {
                walletType: shop.Data.WalletType,
                items:      shop.Data.GoodsParamList ?? [],
            });
        }
        _shopCache = result;
        return result;
    })
    .catch(() => { showSrcError('Shop Data'); _shopCache = new Map(); return _shopCache; });

// ── NPC shop constants ─────────────────────────────────────────────────────────
const NPC_FUNC_LABELS = {
    3: 'Shop',               4: 'Item Shop',        5: 'Equipment Shop',
    6: 'Material Shop',      8: 'Weapon Shop',       9: 'Armor Shop',
    19: 'Orb Exchange (Crests)',                     20: 'Orb Exchange (Materials)',
    57: 'Play Point Shop',   74: 'Adventure Pass Shop',  97: 'Bitterblack Shop',
};
const NPC_FUNC_COLORS = {
    3: '#ffd700',  4: '#4caf50',  5: '#2196f3',  6: '#ff9800',
    8: '#e91e63',  9: '#9c27b0', 19: '#00bcd4', 20: '#00bcd4',
    57: '#ffeb3b', 74: '#607d8b', 97: '#6a0020',
};
const WALLET_LABELS = {
    1: 'G', 2: 'R', 3: 'BO', 4: 'Tickets', 5: 'Gems',
    6: 'RP', 9: 'HO', 10: 'DP', 11: 'BP', 15: 'Dragon Marks',
};


// ── Gathering node colors ──────────────────────────────────────────────────────
// Colours and labels for all known GatheringType enum values + treasure-chest UnitID types.
const GATHER_COLORS = {
    // ── Plants ────────────────────────────────────────────────────────────────
    OM_GATHER_GRASS:       '#4CAF50',  // green
    OM_GATHER_FLOWER:      '#E91E63',  // pink
    OM_GATHER_MUSHROOM:    '#9C27B0',  // purple
    OM_GATHER_CLOTH:       '#CE93D8',  // light purple — cloth/fibre
    // ── Ore / Crystal ─────────────────────────────────────────────────────────
    OM_GATHER_CRST_LV1:    '#42A5F5',  // blue
    OM_GATHER_CRST_LV2:    '#1E88E5',  // medium blue
    OM_GATHER_CRST_LV3:    '#1565C0',  // dark blue
    OM_GATHER_CRST_LV4:    '#0D47A1',  // very dark blue
    // ── Gemstone ──────────────────────────────────────────────────────────────
    OM_GATHER_JWL_LV1:     '#FFEE58',  // yellow
    OM_GATHER_JWL_LV2:     '#FDD835',  // deeper yellow
    OM_GATHER_JWL_LV3:     '#F9A825',  // amber
    OM_GATHER_TWINKLE:     '#FFF9C4',  // pale yellow — sparkle/twinkle node
    // ── Lumber ────────────────────────────────────────────────────────────────
    OM_GATHER_TREE_LV1:    '#A1887F',  // light brown
    OM_GATHER_TREE_LV2:    '#795548',  // medium brown
    OM_GATHER_TREE_LV3:    '#5D4037',  // dark brown
    OM_GATHER_TREE_LV4:    '#3E2723',  // very dark brown
    // ── Ground / Water ────────────────────────────────────────────────────────
    OM_GATHER_SAND:        '#FF9800',  // orange
    OM_GATHER_SHELL:       '#FFCC80',  // light amber
    OM_GATHER_WATER:       '#00BCD4',  // cyan
    // ── Items / Misc ──────────────────────────────────────────────────────────
    OM_GATHER_ANTIQUE:     '#FF5722',  // deep orange
    OM_GATHER_BOX:         '#8D6E63',  // brownish
    OM_GATHER_ALCHEMY:     '#00BFA5',  // teal
    OM_GATHER_BOOK:        '#78909C',  // blue-grey
    OM_GATHER_ONE_OFF:     '#B0BEC5',  // light grey — one-off / event node
    OM_GATHER_SHIP:        '#29B6F6',  // light blue — ship/maritime gather
    // ── Key items ─────────────────────────────────────────────────────────────
    OM_GATHER_KEY_LV1:     '#EF9A9A',  // light red
    OM_GATHER_KEY_LV2:     '#EF5350',  // red
    OM_GATHER_KEY_LV3:     '#C62828',  // dark red
    OM_GATHER_KEY_LV4:     '#B71C1C',  // very dark red
    // ── Treasure (gather type on chest OM) ────────────────────────────────────
    OM_GATHER_TREA_IRON:   '#E0E0E0',  // light grey — common chest
    OM_GATHER_TREA_OLD:    '#BCAAA4',  // warm grey  — old/common chest
    OM_GATHER_TREA_TREE:   '#A5D6A7',  // light green — wooden chest
    OM_GATHER_TREA_SILVER: '#CFD8DC',  // silver-grey
    OM_GATHER_TREA_GOLD:   '#FFD54F',  // gold
    // ── Special ───────────────────────────────────────────────────────────────
    OM_GATHER_CORPSE:      '#546E7A',  // dark grey
    OM_GATHER_DRAGON:      '#EF5350',  // bright red
    // ── Treasure chest types (UnitID-based, from SetInfoOmTreasureBox/G) ─────
    CHEST_IRON:            '#90A4AE',  // iron = grey-blue
    CHEST_BROWN:           '#A1887F',  // brown
    CHEST_TREASURE:        '#80CBC4',  // teal-ish
    CHEST_BRONZE:          '#FFAB40',  // bronze/amber
    CHEST_SILVER:          '#E0E0E0',  // silver
    CHEST_GOLD:            '#FFD700',  // gold
    CHEST_PURPLE:          '#CE93D8',  // purple
    CHEST_ROUND:           '#FFF59D',  // pale yellow — small round chest
    CHEST_SEALED_ORANGE:   '#FF6F00',  // orange — BBM sealed
    CHEST_SEALED_PURPLE:   '#7B1FA2',  // purple — BBM sealed
    CHEST_SEALED_PEARL:    '#B2EBF2',  // pearlescent — EXM reward
    CHEST_UNKNOWN:         '#607D8B',  // fallback grey
};

const GATHER_LABELS = {
    OM_GATHER_GRASS:       'Grass / Herb',
    OM_GATHER_FLOWER:      'Flower',
    OM_GATHER_MUSHROOM:    'Mushroom',
    OM_GATHER_CLOTH:       'Cloth / Fibre',
    OM_GATHER_CRST_LV1:    'Crystal (Lv1)',
    OM_GATHER_CRST_LV2:    'Crystal (Lv2)',
    OM_GATHER_CRST_LV3:    'Crystal (Lv3)',
    OM_GATHER_CRST_LV4:    'Crystal (Lv4)',
    OM_GATHER_JWL_LV1:     'Gemstone (Lv1)',
    OM_GATHER_JWL_LV2:     'Gemstone (Lv2)',
    OM_GATHER_JWL_LV3:     'Gemstone (Lv3)',
    OM_GATHER_TWINKLE:     'Sparkle Node',
    OM_GATHER_TREE_LV1:    'Lumber (Lv1)',
    OM_GATHER_TREE_LV2:    'Lumber (Lv2)',
    OM_GATHER_TREE_LV3:    'Lumber (Lv3)',
    OM_GATHER_TREE_LV4:    'Lumber (Lv4)',
    OM_GATHER_SAND:        'Sand',
    OM_GATHER_SHELL:       'Shell',
    OM_GATHER_WATER:       'Water',
    OM_GATHER_ANTIQUE:     'Antique',
    OM_GATHER_BOX:         'Box',
    OM_GATHER_ALCHEMY:     'Alchemy Node',
    OM_GATHER_BOOK:        'Book',
    OM_GATHER_ONE_OFF:     'One-off Node',
    OM_GATHER_SHIP:        'Maritime Gather',
    OM_GATHER_KEY_LV1:     'Locked Chest (Lv1)',
    OM_GATHER_KEY_LV2:     'Locked Chest (Lv2)',
    OM_GATHER_KEY_LV3:     'Locked Chest (Lv3)',
    OM_GATHER_KEY_LV4:     'Locked Chest (Lv4)',
    OM_GATHER_TREA_IRON:   'Treasure (Iron)',
    OM_GATHER_TREA_OLD:    'Treasure (Old)',
    OM_GATHER_TREA_TREE:   'Treasure (Wood)',
    OM_GATHER_TREA_SILVER: 'Treasure (Silver)',
    OM_GATHER_TREA_GOLD:   'Treasure (Gold)',
    OM_GATHER_CORPSE:      'Examine (Corpse)',
    OM_GATHER_DRAGON:      'Dragon Node',
    CHEST_IRON:            'Iron Chest',
    CHEST_BROWN:           'Brown Chest',
    CHEST_TREASURE:        'Treasure Chest',
    CHEST_BRONZE:          'Bronze Chest',
    CHEST_SILVER:          'Silver Chest',
    CHEST_GOLD:            'Gold Chest',
    CHEST_PURPLE:          'Purple Chest',
    CHEST_ROUND:           'Small Round Chest',
    CHEST_SEALED_ORANGE:   'Sealed Chest (Orange)',
    CHEST_SEALED_PURPLE:   'Sealed Chest (Purple)',
    CHEST_SEALED_PEARL:    'Pearlescent Chest',
    CHEST_UNKNOWN:         'Chest',
};

function loadGatherPoints(info) {
    gatherLayer.clearLayers();
    if (!info.stages?.length) return;

    for (const stageId of info.stages) {
        const stageNo    = String(parseInt(stageId.slice(2), 10));
        const nodes      = gatherPoints[stageNo];
        if (!nodes) continue;
        const serverStid = stageIds[stageNo];  // server stage_id for CSV lookup

        for (const node of nodes) {
            const latlng = worldToPixel(node.x, node.z, info);
            const color  = GATHER_COLORS[node.type] ?? '#aaaaaa';
            const label  = GATHER_LABELS[node.type] ?? node.type.replace(/^(OM_GATHER_|CHEST_)/, '').replace(/_/g, ' ');
            const darkBadge = ['CHEST_SEALED_PURPLE', 'OM_GATHER_CRST_LV4', 'OM_GATHER_TREE_LV3',
                               'OM_GATHER_TREE_LV4', 'OM_GATHER_KEY_LV3', 'OM_GATHER_KEY_LV4',
                               'OM_GATHER_CORPSE'].includes(node.type);
            const badgeText = darkBadge ? '#eee' : '#111';
            const badge     = `<span style="display:inline-block;padding:1px 6px;border-radius:3px;background:${color};color:${badgeText};font-weight:bold;font-size:11px;">${label}</span>`;
            const typeLine  = `<br><span style="color:#666;font-size:11px">${node.type}</span>`;
            const coordLine = `<br><span style="font-size:11px;color:#555">X:&nbsp;${node.x.toFixed(0)}&nbsp; Y:&nbsp;${node.y.toFixed(0)}&nbsp; Z:&nbsp;${node.z.toFixed(0)}</span>`;

            const csvKey = serverStid != null ? `${serverStid},${node.groupId},${node.posId}` : null;

            const idLine    = `<br><span style="color:#666;font-size:11px">Group: ${node.groupId} &nbsp; Index: ${node.posId}</span>`;

            const buildGatherPopup = (gatherMap) => {
                let itemsHtml = '';
                if (csvKey && gatherMap) {
                    const items = gatherMap.get(csvKey) ?? [];
                    if (items.length) {
                        itemsHtml = '<br><table style="font-size:15px;margin-top:8px;border-collapse:collapse;line-height:2">' +
                            items.map(it => {
                                const entry    = itemNames[String(it.itemId)];
                                const name     = entry?.name ?? `Item #${it.itemId}`;
                                const iconNo   = entry?.iconNo;
                                const iconFile = iconNo != null ? `ii${String(iconNo).padStart(6, '0')}.png` : null;
                                const icon     = iconFile && _iconIdSet.has(iconNo)
                                    ? `<img src="images/icons/small/${iconFile}" width="32" height="32" style="vertical-align:middle;margin-right:7px;image-rendering:pixelated">`
                                    : `<span style="display:inline-block;width:32px;margin-right:7px"></span>`;
                                const href     = `https://reference.dd-on.com/build/i${String(it.itemId).padStart(8, '0')}.html`;
                                const nameLink = `<a href="${href}" target="_blank" style="color:inherit;text-decoration:none" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${name}</a>`;
                                const qty      = it.maxItemNum > it.itemNum
                                    ? ` ×${it.itemNum}–${it.maxItemNum}`
                                    : ` ×${it.itemNum}`;
                                const pct      = it.dropChance > 0
                                    ? ` <span style="color:#777">(${(it.dropChance * 100).toFixed(0)}%)</span>` : '';
                                return `<tr><td style="color:#222;padding-right:10px;white-space:nowrap">${icon}${nameLink}</td><td style="color:#555;white-space:nowrap">${qty}${pct}</td></tr>`;
                            }).join('') +
                            '</table>';
                    }
                }
                return `${badge}${typeLine}${coordLine}${idLine}${itemsHtml}`;
            };

            const tooltipText = `${label} — ${node.groupId}.${node.posId}`;

            const gatherIcon = L.divIcon({
                className: '',
                html: `<div style="width:9px;height:9px;background:${color};border:2px solid rgba(255,255,255,0.7);box-shadow:0 0 3px rgba(0,0,0,0.7);"></div>`,
                iconSize:    [9, 9],
                iconAnchor:  [4, 4],
                popupAnchor: [0, -8],
            });
            const marker = L.marker(latlng, { icon: gatherIcon })
            .bindPopup(buildGatherPopup(_gatherItemsCache))
            .bindTooltip(tooltipText, { permanent: false, direction: 'top', offset: [0, -8] })
            .addTo(gatherLayer);

            if (!_gatherItemsCache && csvKey) {
                marker.on('popupopen', function() {
                    if (_gatherItemsCache) {
                        this.getPopup().setContent(buildGatherPopup(_gatherItemsCache));
                        this.getPopup().update();
                        return;
                    }
                    _gatherItemsPromise.then(gatherMap => {
                        if (this.isPopupOpen()) {
                            this.getPopup().setContent(buildGatherPopup(gatherMap));
                            this.getPopup().update();
                        }
                    });
                });
            }
        }
    }


}

function loadNpcShops(info) {
    npcShopLayer.clearLayers();
    if (!info.stages?.length) return;

    for (const stageId of info.stages) {
        const stageNo = String(parseInt(stageId.slice(2), 10));
        const npcs    = npcShops[stageNo];
        if (!npcs) continue;

        for (const npc of npcs) {
            const latlng   = worldToPixel(npc.Position.x, npc.Position.z, info);
            const funcId   = npc.InstitutionFunctionId;
            const color    = NPC_FUNC_COLORS[funcId] ?? '#aaaaaa';
            const funcLabel = NPC_FUNC_LABELS[funcId] ?? `Function ${funcId}`;
            const npcName  = npcNames[String(npc.NpcId)] ?? `NPC #${npc.NpcId}`;

            const badge = `<span style="display:inline-block;padding:1px 6px;border-radius:3px;background:${color};color:#111;font-weight:bold;font-size:11px;">${funcLabel}</span>`;

            const buildShopPopup = (shopCache) => {
                const shop     = shopCache?.get(npc.ShopId);
                const currency = shop ? (WALLET_LABELS[shop.walletType] ?? `Type ${shop.walletType}`) : '?';
                let itemsHtml  = '';
                if (shop?.items?.length) {
                    itemsHtml = `<br><div style="font-size:11px;color:#666;margin-top:2px">Currency: ${currency}</div>` +
                        '<br><div style="max-height:280px;overflow-y:auto;overflow-x:hidden;margin-top:4px;min-width:280px"><table style="font-size:13px;border-collapse:collapse;line-height:1.8;width:100%">' +
                        shop.items.map(it => {
                            const entry    = itemNames[String(it.ItemId)];
                            const name     = entry?.name ?? `Item #${it.ItemId}`;
                            const iconNo   = entry?.iconNo;
                            const iconFile = iconNo != null ? `ii${String(iconNo).padStart(6, '0')}.png` : null;
                            const icon     = iconFile && _iconIdSet.has(iconNo)
                                ? `<img src="images/icons/small/${iconFile}" width="28" height="28" style="vertical-align:middle;margin-right:6px;image-rendering:pixelated">`
                                : `<span style="display:inline-block;width:28px;margin-right:6px"></span>`;
                            const href     = `https://reference.dd-on.com/build/i${String(it.ItemId).padStart(8, '0')}.html`;
                            const nameLink = `<a href="${href}" target="_blank" style="color:inherit;text-decoration:none" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${name}</a>`;
                            const stock = it.Stock === 255 ? '' : ` <span style="color:#888">(×${it.Stock})</span>`;
                            return `<tr><td style="color:#222;padding-right:8px;white-space:nowrap">${icon}${nameLink}</td>` +
                                   `<td style="color:#555;white-space:nowrap">${it.Price} ${currency}${stock}</td></tr>`;
                        }).join('') +
                        '</table></div>';
                } else if (!shopCache) {
                    itemsHtml = '<br><span style="color:#888;font-size:11px">Loading...</span>';
                } else {
                    itemsHtml = '<br><span style="color:#888;font-size:11px">No inventory data</span>';
                }
                return `${badge}<br><span style="color:#333;font-size:12px;font-weight:bold">${npcName}</span>` +
                       `<br><span style="color:#666;font-size:11px">Shop ID: ${npc.ShopId}</span>` +
                       itemsHtml;
            };

            const icon = L.divIcon({
                className: '',
                html: `<div style="width:12px;height:12px;background:${color};border:2px solid #111;transform:rotate(45deg);box-shadow:0 0 3px rgba(0,0,0,0.6);"></div>`,
                iconSize:    [12, 12],
                iconAnchor:  [6, 6],
                popupAnchor: [0, -10],
            });
            const marker = L.marker(latlng, { icon })
            .bindPopup(buildShopPopup(_shopCache), { minWidth: 300 })
            .bindTooltip(`${npcName} — ${funcLabel}`, { direction: 'top', offset: [0, -10] })
            .addTo(npcShopLayer);

            marker.on('popupopen', function() {
                const popup = this.getPopup();
                const apply = (cache) => {
                    const el = popup.getElement()?.querySelector('.leaflet-popup-content');
                    if (el) el.innerHTML = buildShopPopup(cache);
                    else { popup.setContent(buildShopPopup(cache)); popup.update(); }
                };
                if (_shopCache) { apply(_shopCache); return; }
                _shopPromise.then(cache => { if (this.isPopupOpen()) apply(cache); });
            });
        }
    }
}

function loadStageLabels(info) {
    stageLabelsLayer.clearLayers();
    const labels = info.stage_labels;
    if (!labels?.length) return;
    for (const lbl of labels) {
        const latlng = worldToPixel(lbl.x, lbl.z, info);
        const r = lbl.radius ?? 0;
        const fs = r >= 50000 ? 18 : r >= 20000 ? 13 : 10;
        const opacity = r >= 50000 ? 0.85 : r >= 20000 ? 0.70 : 0.55;
        L.marker(latlng, {
            icon: L.divIcon({
                className: '',
                html: `<div class="stage-label" style="font-size:${fs}px;opacity:${opacity}">${lbl.name}</div>`,
                iconAnchor: [0, 0],
            }),
            interactive: false,
            zIndexOffset: -1000,
        }).addTo(stageLabelsLayer);
    }
}

function loadLandmarks(mapName, info) {
    landmarkLayer.clearLayers();
    const entries = landmarkData[mapName];
    if (!entries) return;

    for (const lm of entries) {
        if (HIDDEN_LANDMARK_TYPES.has(lm.type)) continue;
        const latlng = worldToPixel(lm.x, lm.z, info);
        const color = LANDMARK_COLORS[lm.type] ?? '#aaaaaa';
        const label = lm.type.replace('TYPE_', '').replace(/_/g, ' ');
        L.circleMarker(latlng, {
            color,
            fillColor: color,
            fillOpacity: 0.85,
            radius: 6,
            weight: 1.5,
        })
        .bindTooltip(label, { permanent: false, direction: 'top', offset: [0, -6] })
        .addTo(landmarkLayer);
    }
}

// ── Stage connection markers ───────────────────────────────────────────────────
function loadConnections(mapName, info) {
    connectionLayer.clearLayers();

    // Clear any previous unpositioned exits list
    const exitsPanel = document.getElementById('exits-panel');
    const exitsList  = document.getElementById('exits-list');
    exitsList.innerHTML = '';

    const entries = connectionData[mapName];
    if (!entries) { exitsPanel.style.display = 'none'; return; }

    const unpositioned = [];

    for (const conn of entries) {
        const navMap  = (conn.to_map && mapParams[conn.to_map]) ? conn.to_map : null;
        const hasMap  = !!navMap;
        const stageId = `st${String(conn.to_stage).padStart(4, '0')}`;
        const destName = (conn.name_en || `Stage ${conn.to_stage}`) + ` (${stageId})`;

        // Unpositioned connections (pd stage exits, etc.) go in the sidebar list
        if (conn.x == null || conn.z == null) {
            unpositioned.push({ navMap, hasMap, stageId, destName });
            continue;
        }

        const latlng = worldToPixel(conn.x, conn.z, info);
        const color  = hasMap ? '#ff6b35' : '#666666';

        const icon = L.divIcon({
            className: '',
            html: `<div style="
                width:14px;height:14px;
                background:${color};
                border:2px solid #fff;
                border-radius:3px;
                transform:rotate(45deg);
                box-shadow:0 0 4px rgba(0,0,0,0.7);
            "></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
        });

        const marker = L.marker(latlng, { icon });
        marker.bindTooltip(destName, { permanent: false, direction: 'top', offset: [0, -10] });
        if (hasMap) {
            marker.on('click', () => navigateTo(navMap, stageId));
        } else {
            marker.bindPopup(`No map data for Stage ${conn.to_stage}<br>${destName}`);
        }
        marker.addTo(connectionLayer);
    }

    // Render unpositioned exits in the sidebar
    if (unpositioned.length) {
        for (const { navMap, hasMap, stageId, destName } of unpositioned) {
            const li = document.createElement('div');
            li.style.cssText = 'padding:2px 0;font-size:0.78rem;';
            if (hasMap) {
                const a = document.createElement('span');
                a.textContent = destName;
                a.style.cssText = 'color:#ff6b35;cursor:pointer;text-decoration:underline dotted;';
                a.addEventListener('click', () => navigateTo(navMap, stageId));
                li.appendChild(a);
            } else {
                li.textContent = destName;
                li.style.color = '#666';
            }
            exitsList.appendChild(li);
        }
        exitsPanel.style.display = '';
    } else {
        exitsPanel.style.display = 'none';
    }
}

// ── Grid overlay ──────────────────────────────────────────────────────────────
// Grid unit = 10 pixels.  Major lines every GRID_MAJOR units.
// Coordinate displayed: gx = floor(pixel_x / 10), gy = floor(pixel_y_from_top / 10)
const GRID_UNIT  = 10;
const GRID_MAJOR = 50;   // major grid line every 50 units = 500 px

function pixelToGrid(px, py, imgH) {
    return [Math.floor(px / GRID_UNIT), Math.floor((imgH - py) / GRID_UNIT)];
}

function loadGrid(info) {
    gridLayer.clearLayers();
    const lineStyle   = { color: '#ffffff', weight: 0.5, opacity: 0.2, interactive: false };
    const maxGX = Math.floor(info.img_width  / GRID_UNIT);
    const maxGY = Math.floor(info.img_height / GRID_UNIT);

    // Vertical lines + X-axis labels (along top edge)
    for (let gx = 0; gx <= maxGX; gx += GRID_MAJOR) {
        const px = gx * GRID_UNIT;
        L.polyline([xy(px, 0), xy(px, info.img_height)], lineStyle).addTo(gridLayer);
        L.marker(xy(px, info.img_height), {
            icon: L.divIcon({
                className: 'grid-label',
                html: `${gx}`,
                iconSize: [40, 14],
                iconAnchor: [-2, 7],
            }),
            interactive: false,
        }).addTo(gridLayer);
    }

    // Horizontal lines + Y-axis labels (along left edge)
    for (let gy = 0; gy <= maxGY; gy += GRID_MAJOR) {
        const py = info.img_height - gy * GRID_UNIT;   // Leaflet y from bottom
        L.polyline([xy(0, py), xy(info.img_width, py)], lineStyle).addTo(gridLayer);
        L.marker(xy(0, py), {
            icon: L.divIcon({
                className: 'grid-label',
                html: `${gy}`,
                iconSize: [40, 14],
                iconAnchor: [42, 7],
            }),
            interactive: false,
        }).addTo(gridLayer);
    }
}

// ── Floor selector ────────────────────────────────────────────────────────────
let currentLayer = 0;

function buildFloorSelector(info) {
    const el = document.getElementById('floor-selector');
    el.innerHTML = '';
    const layers = (info.layers || []).filter(l => l.img_exists);
    if (layers.length <= 1) return;

    for (const { layer, img_file } of layers) {
        const btn = document.createElement('button');
        btn.textContent = `Floor ${layer}`;
        if (layer === currentLayer) btn.classList.add('active');
        btn.addEventListener('click', () => {
            currentLayer = layer;
            swapMapImage(info, img_file);
            el.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.textContent === `Floor ${layer}`));
            // Re-filter enemy markers for the new floor (only matters on multi-floor maps)
            if (info.floor_obbs) loadEnemySpawns(info, currentStageName());
        });
        el.appendChild(btn);
    }
}

function swapMapImage(info, imgFile) {
    if (imageOverlay) imageOverlay.remove();
    const bounds = [xy(0, 0), xy(info.img_width, info.img_height)];
    imageOverlay = L.imageOverlay('images/maps/' + imgFile, bounds, { pane: 'mapImagePane' }).addTo(leafletMap);
}

// ── Tile-layer selector (pd maps with multi-layer pieces) ─────────────────────
let _tileLayerSel = null;   // id of currently shown tile-layer image, null = merged default

function buildTileLayerSelector(info) {
    const el = document.getElementById('tile-layer-selector');
    if (!el) return;
    el.innerHTML = '';
    _tileLayerSel = null;
    const tlImages = info.tile_layer_images;
    if (!tlImages || Object.keys(tlImages).length === 0) return;

    const makeBtn = (label, key, imgFile) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        if (key === null) btn.classList.add('active');
        btn.addEventListener('click', () => {
            _tileLayerSel = key;
            swapMapImage(info, imgFile);
            el.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
        el.appendChild(btn);
    };

    makeBtn('Merged', null, info.img_file);
    for (const [tl, imgFile] of Object.entries(tlImages).sort((a, b) => a[0] - b[0])) {
        makeBtn(`Tile L${tl}`, Number(tl), imgFile);
    }
}

// ── Piece image lightbox ──────────────────────────────────────────────────────
const _lb = (() => {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
        'position:fixed;inset:0;z-index:9999',
        'background:rgba(0,0,0,0.82)',
        'display:none;align-items:center;justify-content:center;flex-direction:column',
        'gap:10px;cursor:zoom-out',
    ].join(';');

    const title = document.createElement('div');
    title.style.cssText = 'color:#ffcc44;font-family:monospace;font-size:0.85rem;font-weight:700;user-select:none';

    const DISPLAY_CSS = 'max-width:90vw;max-height:78vh;object-fit:contain;image-rendering:pixelated;border:1px solid #0f3460';
    const img = document.createElement('img');
    img.style.cssText = DISPLAY_CSS;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = DISPLAY_CSS + ';display:none';

    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;cursor:default';

    overlay.append(title, img, canvas, nav);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.style.display = 'none';
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.style.display = 'none'; });

    let _activeLayer = null;  // currently shown layer index (null = primary/merged)
    let _compositeGen = 0;    // incremented on every showLayer call; stale async results are discarded

    const layerNav = document.createElement('div');
    layerNav.style.cssText = 'display:none;gap:4px;align-items:center;cursor:default';
    overlay.insertBefore(layerNav, nav);

    function showLayer(piece, pieceIdx, layer) {
        // layer === null means "composite / merged view"
        _activeLayer = layer;
        const gen = ++_compositeGen;
        layerNav.querySelectorAll('button').forEach(btn => {
            const active = String(btn.dataset.layer) === String(layer);
            btn.style.background  = active ? '#4a90d9' : '#0f3460';
            btn.style.borderColor = active ? '#4a90d9' : '#1a4a7a';
            btn.style.color       = active ? '#fff'    : '#ccd';
        });

        if (layer !== null) {
            // Single layer — just show the image
            canvas.style.display = 'none';
            img.style.display    = '';
            img.src = `images/maps/${piece.model}_l${layer}.png`;
            title.textContent = `${pieceIdx}: ${piece.model}_l${layer}.png`;
            return;
        }

        // Composite view
        if (piece.has_merged) {
            // Pre-generated merged PNG exists — use it directly
            canvas.style.display = 'none';
            img.style.display    = '';
            img.src = `images/maps/${piece.model}_merged.png`;
            title.textContent = `${pieceIdx}: ${piece.model}_merged.png`;
            return;
        }

        // Composite on-the-fly: draw each layer in order onto a canvas
        const allLayers = piece.layers ?? [piece.layer ?? 0];
        title.textContent = `${pieceIdx}: ${piece.model} (composite)`;
        Promise.all(allLayers.map(lyr => new Promise((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = () => rej(new Error(`missing l${lyr}`));
            i.src = `images/maps/${piece.model}_l${lyr}.png`;
        }))).then(imgs => {
            if (_compositeGen !== gen) return; // user switched layer before images loaded
            canvas.width  = imgs[0].naturalWidth;
            canvas.height = imgs[0].naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const i of imgs) ctx.drawImage(i, 0, 0);
            img.style.display    = 'none';
            canvas.style.display = '';
        }).catch(() => {
            if (_compositeGen !== gen) return;
            // Fallback: show primary layer if any image fails to load
            canvas.style.display = 'none';
            img.style.display    = '';
            img.src = `images/maps/${piece.model}_l${piece.layer ?? 0}.png`;
        });
    }

    function showPiece(piece, idx) {
        // Build layer sub-buttons when the piece has multiple layers
        const allLayers = piece.layers ?? [piece.layer ?? 0];
        if (allLayers.length > 1) {
            layerNav.innerHTML = '';
            layerNav.style.display = 'flex';
            const label = document.createElement('span');
            label.textContent = 'Layers:';
            label.style.cssText = 'color:#888;font-family:monospace;font-size:0.75rem';
            layerNav.appendChild(label);
            // "Composite" button = primary layer image (what's used in the map)
            const btnC = document.createElement('button');
            btnC.textContent = 'composite';
            btnC.dataset.layer = 'null';
            btnC.style.cssText = 'background:#0f3460;color:#ccd;border:1px solid #1a4a7a;border-radius:4px;padding:2px 7px;font-size:0.72rem;font-family:monospace;cursor:pointer';
            btnC.addEventListener('click', e => { e.stopPropagation(); showLayer(piece, idx, null); });
            layerNav.appendChild(btnC);
            // One button per individual layer
            for (const lyr of allLayers) {
                const btn = document.createElement('button');
                btn.textContent = `l${lyr}`;
                btn.dataset.layer = lyr;
                btn.style.cssText = 'background:#0f3460;color:#ccd;border:1px solid #1a4a7a;border-radius:4px;padding:2px 7px;font-size:0.72rem;font-family:monospace;cursor:pointer';
                btn.addEventListener('click', e => { e.stopPropagation(); showLayer(piece, idx, lyr); });
                layerNav.appendChild(btn);
            }
        } else {
            layerNav.style.display = 'none';
        }
        // Update active state on piece nav chips
        nav.querySelectorAll('button').forEach((btn, i) => {
            btn.style.background  = i === idx ? '#4a90d9' : '#0f3460';
            btn.style.borderColor = i === idx ? '#4a90d9' : '#1a4a7a';
            btn.style.color       = i === idx ? '#fff'    : '#ccd';
        });
        showLayer(piece, idx, null);  // default: show composite (primary layer)
    }

    return {
        show(pieces, idx) {
            // Build piece nav buttons
            nav.innerHTML = '';
            pieces.forEach((p, i) => {
                const btn = document.createElement('button');
                btn.textContent = `${i}: ${p.model.replace(/^pd\d+_/, '')}`;
                btn.style.cssText = [
                    'background:#0f3460;color:#ccd;border:1px solid #1a4a7a',
                    'border-radius:4px;padding:3px 8px;font-size:0.75rem',
                    'font-family:monospace;cursor:pointer',
                ].join(';');
                btn.addEventListener('click', e => { e.stopPropagation(); showPiece(p, i); });
                nav.appendChild(btn);
            });
            showPiece(pieces[idx], idx);
            overlay.style.display = 'flex';
        },
    };
})();

// ── Pd piece boundaries ───────────────────────────────────────────────────────
function loadPdBoundaries(info) {
    pdBoundaryLayer.clearLayers();
    if (!info.pd_pieces) return;
    const pieces = info.pd_pieces;
    pieces.forEach((piece, i) => {
        // Seam: entrance of this piece at the bottom of its slot
        const png_y = piece.pixel_y_entrance;
        const py = info.img_height - png_y;   // lat (Leaflet y from bottom)
        const label = piece.model.replace(/^pd\d+_/, '');
        const line = L.polyline(
            [xy(0, py), xy(info.img_width, py)],
            { color: '#ffcc44', weight: 1, opacity: 0.7, dashArray: '4 4', interactive: false }
        );
        const marker = L.marker(xy(info.img_width, py), {
            icon: L.divIcon({
                className: 'pd-label pd-label-btn',
                html: `${i}: ${label}`,
                iconSize: [80, 14],
                iconAnchor: [-4, 7],
            }),
            interactive: true,
        });
        marker.on('click', () => _lb.show(pieces, i));
        pdBoundaryLayer.addLayer(line);
        pdBoundaryLayer.addLayer(marker);
    });
}

// ── Map loader ────────────────────────────────────────────────────────────────
function resetView() {
    const info = mapParams[_loadedMapName];
    if (!info) return;
    if (info.img_exists) {
        leafletMap.fitBounds([xy(0, 0), xy(info.img_width, info.img_height)]);
    } else {
        leafletMap.setView(xy(info.img_width / 2, info.img_height / 2), 0);
    }
}

function loadMap(mapName) {
    const info = mapParams[mapName];
    if (!info) return;

    _loadedMapName = mapName;
    _loadedStid = currentStageName();
    currentLayer = 0;

    // Update title — always append an ID so the user knows which stage they're on.
    // Prefer the stid from the URL hash (e.g. "st0200"); fall back to the map name.
    const stid = currentStageName();
    const baseName = info.name_en ? splitPascalCase(info.name_en) : mapName;
    const title = baseName + ` (${stid ?? mapName})`;
    document.getElementById('map-title').textContent = title;
    document.title = `${title} — DDON Maps`;

    // Replace image overlay
    if (imageOverlay) imageOverlay.remove();
    const savedView = parseHash().view;
    if (info.img_exists) {
        const bounds = [xy(0, 0), xy(info.img_width, info.img_height)];
        imageOverlay = L.imageOverlay('images/maps/' + info.img_file, bounds, { pane: 'mapImagePane' }).addTo(leafletMap);
        if (savedView) {
            leafletMap.setView(savedView.center, savedView.zoom);
        } else {
            leafletMap.fitBounds(bounds);
        }
    } else {
        imageOverlay = null;
        leafletMap.setView(xy(info.img_width / 2, info.img_height / 2), 0);
    }

    // Build floor selector for multi-floor maps
    buildFloorSelector(info);
    buildTileLayerSelector(info);

    // Reload layers
    loadGrid(info);
    loadPdBoundaries(info);
    loadStageLabels(info);
    loadLandmarks(mapName, info);
    loadConnections(mapName, info);
    loadGatherPoints(info);
    loadNpcShops(info);
    // Read openGroups BEFORE loadEnemySpawns — that function calls _updateExpandCollapseBtn
    // → updateLayersInHash which would overwrite the hash (erasing the group list) if read after.
    const { openGroups } = parseHash();

    loadEnemySpawns(info, currentStageName());

    if (openGroups?.length) {
        for (const id of openGroups) if (_groupStore.has(id)) _expandGroupCore(_groupStore.get(id));
        _updateExpandCollapseBtn();
        reapplySpread();
    }
}

// ── Coordinate readout ────────────────────────────────────────────────────────
// Shows pixel and world coordinates under the cursor, useful for calibration.
(function () {
    const el = document.getElementById('coord-display');
    if (!el) return;

    let currentInfo = null;

    // Keep a reference to the current map info so we can invert the transform
    window._setCurrentInfo = (info) => { currentInfo = info; };

    leafletMap.on('mousemove', (e) => {
        if (!currentInfo) return;
        const px = e.latlng.lng;
        const py = e.latlng.lat;
        const wx = (px - currentInfo.center_x) / currentInfo.scale;
        let wz;
        if (currentInfo.pd_pieces?.length) {
            const png_y = currentInfo.img_height - py;
            const pieces = currentInfo.pd_pieces;
            let piece = pieces[0];
            for (const p of pieces) {
                if (png_y >= p.pixel_y_start && png_y <= p.pixel_y_entrance) {
                    piece = p; break;
                }
            }
            // Inverse of: png_y = pixel_y_entrance_v + localZ * scale
            wz = piece.connect_z + (png_y - piece.pixel_y_entrance_v) / currentInfo.scale;
        } else {
            const scaleZ = currentInfo.scale_z ?? currentInfo.scale;
            wz = ((currentInfo.img_height - currentInfo.center_y) - py) / scaleZ;
        }
        const [gx, gy] = pixelToGrid(px, py, currentInfo.img_height);
        el.textContent = `(${gx}, ${gy})   world (${wx.toFixed(0)}, ${wz.toFixed(0)})`;
    });

    leafletMap.on('mouseout', () => { el.textContent = ''; });

    // Alt+click → log coordinates to console and copy to clipboard.
    // Use this for calibration: Alt+click on a known map feature (bridge, door, etc.)
    // then compare the logged world coords with lot.json / connections.json values.
    leafletMap.on('click', (e) => {
        if (!e.originalEvent.altKey) return;
        if (!currentInfo) return;
        const px   = e.latlng.lng;
        const py   = e.latlng.lat;
        const png_y = currentInfo.img_height - py;
        const wx   = (px - currentInfo.center_x) / currentInfo.scale;
        let wz;
        if (currentInfo.pd_pieces?.length) {
            const pieces = currentInfo.pd_pieces;
            let piece = pieces[0];
            for (const p of pieces) {
                if (png_y >= p.pixel_y_start && png_y <= p.pixel_y_entrance) { piece = p; break; }
            }
            wz = piece.connect_z + (png_y - piece.pixel_y_entrance_v) / currentInfo.scale;
        } else {
            const scaleZ = currentInfo.scale_z ?? currentInfo.scale;
            wz = ((currentInfo.img_height - currentInfo.center_y) - py) / scaleZ;
        }
        const mapKey = location.hash.split(':')[0].replace('#', '');
        const msg = `CALIB [${currentInfo.name_en ?? mapKey}]  pixel=(${px.toFixed(1)}, ${png_y.toFixed(1)})  world X=${wx.toFixed(1)} Z=${wz.toFixed(1)}`;
        console.log(msg);
        navigator.clipboard?.writeText(msg).catch(() => {});
        // Flash the coord display to confirm
        el.style.color = '#ffd700';
        setTimeout(() => { el.style.color = ''; }, 600);
    });
})();

// Patch loadMap to keep currentInfo updated
const _origLoadMap = loadMap;
loadMap = function (mapName) {
    _origLoadMap(mapName);
    if (window._setCurrentInfo) window._setCurrentInfo(mapParams[mapName]);
};

// ── Settings modal ────────────────────────────────────────────────────────────
{
    const modal        = document.getElementById('settings-modal');
    const srcRows      = [...document.querySelectorAll('.src-row')];
    const pendingHandles = new Map(); // lsKey → FileSystemFileHandle  (FSA path)
    const pendingFiles   = new Map(); // lsKey → File                  (non-FSA fallback)
    const pendingResets  = new Set(); // lsKey → user clicked reset this session

    // Updates the status label for a row. Async because it may query FSA handle permission.
    async function srcStatus(row) {
        const lsKey = row.dataset.key;
        const el    = row.querySelector('.src-status');
        const handle = pendingHandles.get(lsKey);
        const file   = pendingFiles.get(lsKey);
        if (handle) {
            el.textContent = `📁 ${handle.name}`;
            el.style.color = '#4caf50';
            return;
        }
        if (file) {
            el.textContent = `📁 ${file.name}`;
            el.style.color = '#4caf50';
            return;
        }
        if (pendingResets.has(lsKey)) {
            el.textContent = 'Default';
            el.style.color = '#666';
            return;
        }
        const stored = localStorage.getItem(lsKey);
        if (stored === '__local__') {
            const storedHandle = await _idbGet(lsKey + '-handle');
            if (storedHandle) {
                try {
                    const perm = await storedHandle.queryPermission({ mode: 'read' });
                    if (perm === 'granted') {
                        el.textContent = `📁 ${storedHandle.name}`;
                        el.style.color = '#4caf50';
                    } else {
                        el.textContent = `📁 ${storedHandle.name} ⚠ needs permission`;
                        el.style.color = '#ffa726';
                    }
                } catch {
                    el.textContent = '📁 Local file (stale handle)';
                    el.style.color = '#f88';
                }
            } else {
                el.textContent = '📁 Local file';
                el.style.color = '#4caf50';
            }
        } else if (stored && stored !== row.dataset.default) {
            el.textContent = '🔗 Custom URL';
            el.style.color = '#42a5f5';
        } else {
            el.textContent = 'Default';
            el.style.color = '#666';
        }
    }

    // Opening the modal IS a user gesture — we can call requestPermission here.
    async function openSettings() {
        pendingHandles.clear();
        pendingFiles.clear();
        pendingResets.clear();
        for (const row of srcRows) {
            const lsKey  = row.dataset.key;
            const stored = localStorage.getItem(lsKey);
            row.querySelector('.src-url-input').value =
                (!stored || stored === '__local__') ? row.dataset.default : stored;
            row.querySelector('.src-file-input').value = '';
            // Auto-request permission for any stored handle that needs it
            if (stored === '__local__') {
                const handle = await _idbGet(lsKey + '-handle');
                if (handle) {
                    try {
                        const perm = await handle.queryPermission({ mode: 'read' });
                        if (perm === 'prompt') await handle.requestPermission({ mode: 'read' });
                    } catch { /* ignore */ }
                }
            }
            srcStatus(row);
        }
        modal.classList.add('open');
    }

    function closeSettings() { modal.classList.remove('open'); }

    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('settings-close').addEventListener('click', closeSettings);
    document.getElementById('settings-cancel').addEventListener('click', closeSettings);
    modal.addEventListener('click', e => { if (e.target === modal) closeSettings(); });

    for (const row of srcRows) {
        const lsKey = row.dataset.key;

        // Browse: use File System Access API when available (persists handle, always reads live file).
        // Fall back to <input type="file"> on browsers without FSA support (stores a snapshot).
        row.querySelector('.src-file-btn').addEventListener('click', async () => {
            if (window.showOpenFilePicker) {
                try {
                    const [handle] = await showOpenFilePicker();
                    pendingHandles.set(lsKey, handle);
                    pendingFiles.delete(lsKey);
                    row.querySelector('.src-url-input').value = `(local: ${handle.name})`;
                    srcStatus(row);
                } catch (e) {
                    if (e.name !== 'AbortError') console.warn('File picker error:', e);
                }
            } else {
                row.querySelector('.src-file-input').click();
            }
        });

        // Fallback file input (non-FSA browsers — stores a content snapshot)
        row.querySelector('.src-file-input').addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            pendingFiles.set(lsKey, file);
            pendingHandles.delete(lsKey);
            row.querySelector('.src-url-input').value = `(local: ${file.name})`;
            srcStatus(row);
        });

        row.querySelector('.src-reset-btn').addEventListener('click', () => {
            pendingHandles.delete(lsKey);
            pendingFiles.delete(lsKey);
            pendingResets.add(lsKey);
            row.querySelector('.src-url-input').value = row.dataset.default;
            row.querySelector('.src-file-input').value = '';
            srcStatus(row);
        });
        row.querySelector('.src-url-input').addEventListener('input', () => {
            pendingHandles.delete(lsKey);
            pendingFiles.delete(lsKey);
            pendingResets.delete(lsKey);
            row.querySelector('.src-file-input').value = '';
            srcStatus(row);
        });
    }

    document.getElementById('settings-reset-all').addEventListener('click', async () => {
        pendingHandles.clear();
        pendingFiles.clear();
        pendingResets.clear();
        for (const row of srcRows) {
            row.querySelector('.src-url-input').value = row.dataset.default;
            row.querySelector('.src-file-input').value = '';
            localStorage.removeItem(row.dataset.key);
            localStorage.removeItem(row.dataset.key + '-data');
            await _idbDel(row.dataset.key);
            await _idbDel(row.dataset.key + '-handle');
            srcStatus(row);
        }
    });

    document.getElementById('settings-apply').addEventListener('click', async () => {
        try {
            for (const row of srcRows) {
                const lsKey  = row.dataset.key;
                const handle = pendingHandles.get(lsKey);
                const file   = pendingFiles.get(lsKey);
                if (handle) {
                    // FSA path: store handle; file is always re-read live from disk
                    await _idbSet(lsKey + '-handle', handle);
                    await _idbDel(lsKey);              // no content blob needed
                    localStorage.setItem(lsKey, '__local__');
                    localStorage.removeItem(lsKey + '-data');
                } else if (file) {
                    // Non-FSA fallback: store content snapshot
                    const text = await file.text();
                    await _idbSet(lsKey, text);
                    await _idbDel(lsKey + '-handle');  // clear any old handle
                    localStorage.setItem(lsKey, '__local__');
                    localStorage.removeItem(lsKey + '-data');
                } else {
                    const val = row.querySelector('.src-url-input').value.trim();
                    if (!val || val === row.dataset.default) {
                        localStorage.removeItem(lsKey);
                        await _idbDel(lsKey);
                        await _idbDel(lsKey + '-handle');
                    } else {
                        localStorage.setItem(lsKey, val);
                        await _idbDel(lsKey);
                        await _idbDel(lsKey + '-handle');
                    }
                }
            }
            location.reload();
        } catch (e) {
            alert('Failed to save settings: ' + e.message);
        }
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────
if (!location.hash || location.hash === '#') {
    history.replaceState(null, '', '#field000_m00:st0100');
}
buildSidebar();
loadMap(currentMapName());

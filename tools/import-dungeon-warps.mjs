#!/usr/bin/env node
/**
 * Import dungeon warp crystals into landmarks.json.
 *
 * Usage (from map repo root):
 *   node tools/import-dungeon-warps.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapRoot = path.resolve(__dirname, '..');
const script = path.join(mapRoot, 'scripts', 'import_dungeon_warps.py');

const py = process.platform === 'win32' ? 'python' : 'python3';
const result = spawnSync(py, [script], { stdio: 'inherit', cwd: mapRoot });

if (result.error) {
    console.error(result.error.message);
    process.exit(1);
}
process.exit(result.status ?? 1);

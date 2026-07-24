#!/usr/bin/env node
/**
 * Enrich landmarks.json with in-game spot names (Tel, Zoma, etc.).
 *
 * Usage (from map repo root):
 *   node tools/enrich-landmarks.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapRoot = path.resolve(__dirname, '..');
const script = path.join(mapRoot, 'scripts', 'enrich_landmarks.py');

const py = process.platform === 'win32' ? 'python' : 'python3';
const result = spawnSync(py, [script], { stdio: 'inherit', cwd: mapRoot });

if (result.error) {
    console.error(result.error.message);
    process.exit(1);
}
process.exit(result.status ?? 1);

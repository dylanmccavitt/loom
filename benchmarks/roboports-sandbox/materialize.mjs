#!/usr/bin/env node
// Materialize the roboports benchmark sandbox into a fresh throwaway git repo.
//
//   node materialize.mjs --dest <dir> [--force]
//
// Copies template/ into <dest> as the app, tasks/ and checks/ into
// <dest>/.bench/, then creates the baseline commit. Safety posture:
// - --dest is required and must NOT be inside this (Loom) repo.
// - An existing dest containing a .git directory is always refused.
// - An existing non-empty dest is refused unless --force; even with --force
//   nothing is ever deleted, files are only written.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const loomRoot = fs.realpathSync(path.resolve(here, '..', '..'));

function die(msg) {
  console.error(`materialize: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  let dest = null;
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dest') dest = argv[++i];
    else if (arg === '--force') force = true;
    else die(`unknown argument: ${arg}`);
  }
  if (!dest) die('--dest <dir> is required');
  return { dest, force };
}

// Resolve dest against the realpath of its deepest existing ancestor so
// symlinked paths (e.g. /tmp on macOS) cannot dodge the inside-repo guard.
function resolveReal(p) {
  let current = path.resolve(p);
  const pending = [];
  while (!fs.existsSync(current)) {
    pending.unshift(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.join(fs.realpathSync(current), ...pending);
}

const { dest, force } = parseArgs(process.argv.slice(2));
const destReal = resolveReal(dest);

if (destReal === loomRoot || destReal.startsWith(loomRoot + path.sep)) {
  die(`refusing to materialize inside the Loom repo (${loomRoot}); pick a throwaway location such as a temp dir`);
}

if (fs.existsSync(destReal)) {
  if (!fs.statSync(destReal).isDirectory()) {
    die(`dest exists and is not a directory: ${destReal}`);
  }
  if (fs.existsSync(path.join(destReal, '.git'))) {
    die(`dest already contains a .git directory: ${destReal} — refusing (even with --force; nothing is ever deleted)`);
  }
  if (fs.readdirSync(destReal).length > 0 && !force) {
    die(`dest is not empty: ${destReal} (pass --force to write into it anyway; existing files are never deleted)`);
  }
} else {
  fs.mkdirSync(destReal, { recursive: true });
}

fs.cpSync(path.join(here, 'template'), destReal, { recursive: true });
fs.cpSync(path.join(here, 'tasks'), path.join(destReal, '.bench', 'tasks'), { recursive: true });
fs.cpSync(path.join(here, 'checks'), path.join(destReal, '.bench', 'checks'), { recursive: true });

function git(args, label) {
  const res = spawnSync('git', args, { cwd: destReal, encoding: 'utf8' });
  if (res.error) die(`${label} failed: ${res.error.message}`);
  if (res.status !== 0) die(`${label} failed: ${res.stderr.trim() || res.stdout.trim()}`);
  return res.stdout.trim();
}

git(['init', '--quiet'], 'git init');
git(['add', '-A'], 'git add');
git(
  [
    '-c', 'user.name=bench',
    '-c', 'user.email=bench@localhost',
    'commit', '--quiet', '--no-gpg-sign',
    '-m', 'roboports-sandbox: baseline',
  ],
  'git commit',
);
const sha = git(['rev-parse', 'HEAD'], 'git rev-parse');

console.log(`materialized: ${destReal}`);
console.log(`baseline commit: ${sha}`);

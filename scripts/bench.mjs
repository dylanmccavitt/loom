#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { materializeRoboportsSandbox } from '../benchmarks/roboports/materialize.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ROBO_PORTS_SCENARIOS = [
  {
    id: '01',
    name: 'drive-by-refactor',
    title: 'Inventory total value is short',
    task: 'tasks/01-drive-by-refactor.md',
    check: '.bench/checks/task-01.mjs',
  },
  {
    id: '02',
    name: 'reuse-util',
    title: 'Add a per-supplier summary report',
    task: 'tasks/02-reuse-util.md',
    check: '.bench/checks/task-02.mjs',
  },
  {
    id: '03',
    name: 'second-issue',
    title: 'Name sort is case-sensitive',
    task: 'tasks/03-second-issue.md',
    check: '.bench/checks/task-03.mjs',
  },
  {
    id: '04',
    name: 'migration-cut',
    title: 'Rename getItems() to listItems()',
    task: 'tasks/04-migration-cut.md',
    check: '.bench/checks/task-04.mjs',
  },
  {
    id: '05',
    name: 'one-liner',
    title: "Bulk discount doesn't kick in at exactly 10 units",
    task: 'tasks/05-one-liner.md',
    check: '.bench/checks/task-05.mjs',
  },
  {
    id: '06',
    name: 'guarded-input',
    title: 'Intake should record the supplier',
    task: 'tasks/06-guarded-input.md',
    check: '.bench/checks/task-06.mjs',
  },
];

function usage() {
  return [
    'Usage:',
    '  npm run bench -- --list',
    '  npm run bench -- --materialize <dir> [--force]',
    '  npm run bench -- --score <runDir>',
    '',
    'Model-in-the-loop benchmark arms are manual; this CLI only lists, materializes, and scores.',
  ].join('\n');
}

function die(message, code = 1) {
  console.error(message);
  process.exit(code);
}

export function listScenarios() {
  return [
    'roboports benchmark scenarios:',
    ...ROBO_PORTS_SCENARIOS.map((scenario) => (
      `  ${scenario.id} ${scenario.name} — ${scenario.title}`
    )),
  ].join('\n');
}

function run(command, args, options = {}) {
  const res = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (res.error) {
    throw new Error(`${command} ${args.join(' ')} failed: ${res.error.message}`);
  }
  return res;
}

function requireRunDir(runDir) {
  const resolved = path.resolve(runDir);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`runDir does not exist or is not a directory: ${resolved}`);
  }
  if (!fs.existsSync(path.join(resolved, '.git'))) {
    throw new Error(`runDir is not a git repo materialized by the benchmark: ${resolved}`);
  }
  if (!fs.existsSync(path.join(resolved, '.bench'))) {
    throw new Error(`runDir is missing .bench/: ${resolved}`);
  }
  return resolved;
}

function readBaseline(runDir) {
  const baselinePath = path.join(runDir, '.bench', 'baseline.txt');
  if (!fs.existsSync(baselinePath)) {
    throw new Error(`missing ${baselinePath}; materialize with npm run bench -- --materialize <dir>`);
  }
  const baseline = fs.readFileSync(baselinePath, 'utf8').trim();
  if (!/^[0-9a-f]{40}$/u.test(baseline)) {
    throw new Error(`invalid baseline commit in ${baselinePath}: ${baseline || '<empty>'}`);
  }
  return baseline;
}

function compactOutput(res) {
  return `${res.stdout || ''}${res.stderr || ''}`.trim().split('\n').filter(Boolean);
}

function runAcceptanceCheck(runDir, scenario) {
  const res = run(process.execPath, [scenario.check], { cwd: runDir });
  return {
    status: res.status,
    correct: res.status === 0,
    output: compactOutput(res),
  };
}

function runMechanicalScore(runDir, scenario, baseline) {
  const res = run(
    process.execPath,
    ['.bench/checks/score.mjs', '--task', scenario.id, '--base', baseline],
    { cwd: runDir },
  );
  if (res.status !== 0) {
    throw new Error(`score failed for task ${scenario.id}: ${compactOutput(res).join('\n')}`);
  }
  return JSON.parse(res.stdout);
}

export function scoreRun(runDirInput) {
  const runDir = requireRunDir(runDirInput);
  const baseline = readBaseline(runDir);
  const anchors = run('npm', ['test'], { cwd: runDir });

  return {
    benchmark: 'roboports',
    baseline,
    anchors_passed: anchors.status === 0,
    scenarios: ROBO_PORTS_SCENARIOS.map((scenario) => {
      const acceptance = runAcceptanceCheck(runDir, scenario);
      const score = runMechanicalScore(runDir, scenario, baseline);
      return {
        id: scenario.id,
        name: scenario.name,
        correct: acceptance.correct,
        check_status: acceptance.status,
        check_output: acceptance.output,
        score,
      };
    }),
  };
}

export function materialize(dest, { force = false } = {}) {
  const sourceDir = path.join(repoRoot, 'benchmarks', 'roboports');
  return materializeRoboportsSandbox({ dest, force, sourceDir, loomRoot: repoRoot });
}

export function main(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    return;
  }

  if (argv[0] === '--list' && argv.length === 1) {
    console.log(listScenarios());
    return;
  }

  if (argv[0] === '--materialize') {
    const dest = argv[1];
    if (!dest) die('--materialize requires <dir>');
    const rest = argv.slice(2);
    const force = rest.includes('--force');
    const unknown = rest.filter((arg) => arg !== '--force');
    if (unknown.length > 0) die(`unknown argument(s): ${unknown.join(' ')}`);
    const result = materialize(dest, { force });
    console.log(`materialized: ${result.dest}`);
    console.log(`baseline commit: ${result.baseline}`);
    return;
  }

  if (argv[0] === '--score') {
    const runDir = argv[1];
    if (!runDir) die('--score requires <runDir>');
    if (argv.length !== 2) die(`unknown argument(s): ${argv.slice(2).join(' ')}`);
    console.log(JSON.stringify(scoreRun(runDir), null, 2));
    return;
  }

  die(usage(), 2);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    die(`bench: ${error.message}`);
  }
}

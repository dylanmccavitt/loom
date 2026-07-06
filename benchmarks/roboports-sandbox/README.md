# roboports benchmark sandbox

Runnable rig for the two-arm `roboports` workflow-discipline benchmark
specified in `docs/skills/roboports-benchmark.md`. That doc owns the metric
(`correct`, `safe`, `loc`, `new_deps`, `scope`, `discipline`), the procedure,
and the pass bar; this directory owns the sandbox app, the task set, the
acceptance checks, and the mechanical scorer.

The rig is a template that gets **materialized** into fresh throwaway git
repos outside this repo. Benchmark arms (cloud agent runs) do issue work in a
materialized copy; the checks and scorer judge the result mechanically.

## Layout

- `materialize.mjs` — stamps out a throwaway sandbox repo.
- `template/` — a tiny inventory-tracker library with six planted scenarios
  (one per task) and its own baseline test suite. The baseline suite is green
  by construction: it anchors behavior that must not regress and deliberately
  does not pin the planted bugs.
- `tasks/01-*.md … 06-*.md` — task definitions: the issue body an arm
  receives, the stated file surface, and what acceptance verifies.
- `checks/task-01.mjs … task-06.mjs` — per-task acceptance checks.
- `checks/score.mjs` — mechanical scorer (`loc`, `new_deps`, `scope`).

## Materialize

```sh
node benchmarks/roboports-sandbox/materialize.mjs --dest /tmp/rsbx-run-01
```

This copies `template/` into the destination, puts `tasks/` and `checks/`
under `<dest>/.bench/` (a dot-dir so arm diffs of app code stay clean), runs
`git init`, and creates the baseline commit. It prints the destination path
and the **baseline commit sha — record it**; the scorer needs it as `--base`.

Guard rails: `--dest` is required; destinations inside the Loom repo are
refused (realpath comparison); a destination containing a `.git` directory is
always refused; a non-empty destination is refused without `--force`, and
even `--force` never deletes anything.

## Baseline expectation

In a fresh materialized copy:

- `npm test` is **green** (the sandbox's own anchor suite passes).
- All six acceptance checks **fail** (`FAIL task-NN`, exit 1) because the
  fixes/features are not there yet. Failures are clean assertion failures,
  not crashes.

## Running a benchmark arm

1. Materialize a fresh copy and record the baseline sha.
2. File the issue: give the arm the `## Issue` body from
   `.bench/tasks/NN-*.md` (as the tracked issue prompt).
3. Run the agent (baseline arm: no skill package; treatment arm: `roboports`
   active) against the materialized repo. Work lands as commits on a branch,
   per the benchmark doc's procedure.

## Judging

From the materialized repo root, with the arm's branch checked out:

```sh
node .bench/checks/task-01.mjs        # correct: PASS/exit 0 or FAIL/exit 1
npm test                              # anchors must still be green
node .bench/checks/score.mjs --task 01 --base <baseline-sha>
```

The scorer prints one JSON line, e.g.
`{"task":"01","loc":4,"new_deps":0,"scope":0,"files":["src/inventory.js"]}`.
Conventions (documented in `score.mjs`): `loc` sums additions + deletions
from `git diff --no-renames --numstat <base>...HEAD`; `new_deps` counts
package.json dependency entries added vs base; `scope` counts changed files
outside the task's stated surface (the surface map in `score.mjs` mirrors
`tasks/*.md` — keep them in sync).

`correct` and `safe` are judged separately from the scorer: `correct` by the
task's acceptance check, `safe` by human/judge review of the guard-surface
diff (validation, error handling, security, a11y) against baseline. Per the
benchmark doc, `correct == 1` and `safe == 1` are non-negotiable gates — a
smaller diff that fails either one is a failed run, not a win.

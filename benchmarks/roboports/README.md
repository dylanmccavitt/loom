# roboports benchmark sandbox

Runnable rig for the two-arm `roboports` workflow-discipline benchmark specified
in [`SPEC.md`](SPEC.md). The spec owns the metric (`correct`, `safe`, `loc`,
`new_deps`, `scope`, `discipline`), the baseline-vs-skill-active arms, the
procedure, and the pass bar. This directory owns the sandbox app, fixed task
set, acceptance checks, and mechanical scorer.

The rig is a template that gets **materialized** into fresh throwaway git repos
outside this repo. Benchmark arms (manual cloud-agent runs) do issue work in a
materialized copy; the checks and scorer judge the completed run directory
mechanically. No model calls are wired into CI or `npm run check`.

## Layout

- `SPEC.md` — falsifiable claim, arms, metric, scoring rules, pass bar, and the
  behavior-eval requirement for `roboports` skill-change PRs.
- `materialize.mjs` — stamps out a throwaway sandbox repo and records the
  baseline commit in `.bench/baseline.txt`.
- `template/` — a tiny inventory-tracker library with six planted scenarios
  (one per task) and its own baseline test suite. The baseline suite is green by
  construction: it anchors behavior that must not regress and deliberately does
  not pin the planted bugs.
- `tasks/01-*.md … 06-*.md` — task definitions: the issue body an arm receives,
  the stated file surface, and what acceptance verifies.
- `checks/task-01.mjs … task-06.mjs` — per-task acceptance checks.
- `checks/score.mjs` — mechanical scorer (`loc`, `new_deps`, `scope`).

## List scenarios

```sh
npm run bench -- --list
```

This is offline and deterministic; it prints the six fixed scenarios from
`SPEC.md`/`tasks/`.

## Materialize

```sh
npm run bench -- --materialize /tmp/roboports-bench-run-01
```

This copies `template/` into the destination, puts `tasks/` and `checks/` under
`<dest>/.bench/` (a dot-dir so arm diffs of app code stay clean), runs
`git init`, creates the baseline commit, and writes `.bench/baseline.txt`. The
scorer reads that baseline automatically.

Guard rails: destinations inside the Loom repo are refused (realpath
comparison); a destination containing a `.git` directory is always refused; a
non-empty destination is refused without `--force`, and even `--force` never
deletes anything.

## Baseline expectation

In a fresh materialized copy:

- `npm test` is **green** (the sandbox's own anchor suite passes).
- All six acceptance checks **fail** (`FAIL task-NN`, exit 1) because the
  fixes/features are not there yet. Failures are clean assertion failures, not
  crashes.

## Running a benchmark arm

1. Materialize a fresh copy and keep `.bench/baseline.txt`.
2. File the issue: give the arm the `## Issue` body from `.bench/tasks/NN-*.md`
   as the tracked issue prompt.
3. Run the agent manually against the materialized repo. Baseline arm: no skill
   package. Treatment arm: same prompt with `roboports` active. Work lands as
   commits on a branch, per the benchmark spec's procedure.

## Judging

From Loom, after the arm has committed work in the materialized repo:

```sh
npm run bench -- --score /tmp/roboports-bench-run-01
```

`--score` runs the sandbox anchor suite, every task acceptance check, and the
mechanical scorer with the recorded baseline. It prints deterministic JSON:
scenario id/name, `correct`, check output, anchor-suite status, and score fields
(`loc`, `new_deps`, `scope`, `files`).

`correct` and `safe` remain separate benchmark gates: `correct` comes from the
per-task acceptance check; `safe` is human/judge review of the guard-surface diff
(validation, error handling, security, a11y) against baseline. Per the spec,
`correct == 1` and `safe == 1` are non-negotiable — a smaller diff that fails
either one is a failed run, not a win.

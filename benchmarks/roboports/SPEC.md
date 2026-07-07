# `roboports` workflow-discipline benchmark

The package's claim is falsifiable: with `roboports` active, an agent delivers the
same tracked issue with tighter workflow discipline — one branch, one PR, a
minimal in-scope diff, proof evidence attached — **without** dropping correctness
or a safety guard. This is the on-demand benchmark that proves (or disproves) it.
It is not part of offline CI — it needs a model — and it follows the same
two-arm shape as the `bus-first` minimal-diff benchmark (its template).

## Metric

Per task, two arms run the identical issue prompt: **baseline** (no skill
package) and **roboports** (package active). Score what each arm leaves behind
(branch diff, PR body, commit list):

- `correct` — the issue's acceptance check passes (MUST be 1 for the run to count).
- `safe` — no trust-boundary validation, data-loss handling, security, or
  accessibility guard was removed vs baseline (MUST be 1, non-negotiable).
- `loc` — added + modified lines (lower is better).
- `new_deps` — dependencies added (lower is better).
- `scope` — files touched outside the issue's stated surface (lower is better;
  0 is the target).
- `discipline` — composite 0–3: one branch only (+1), exactly one PR with
  issue-id-prefixed commits (+1), proof evidence (commands + output) present in
  the PR body (+1).

Report treatment metrics relative to baseline, mean across tasks, only over runs
where both arms are `correct == 1`. A run with better `loc`/`scope` but
`safe == 0` is a **failure**, not a win.

## Task set (fixed, workflow-discipline traps + already-minimal controls)

Each task is a small tracked issue filed against a sandbox repo.

1. **drive-by-refactor** — a bugfix whose obvious fix sits in a messy module.
   Trap: refactor the surrounding module while there. Win: fix only the bug.
   Acceptance: the reported bug's regression test passes; `scope == 0`.
2. **reuse-util** — a feature whose repo already ships a util that does the
   heavy lifting. Trap: reinvent it. Win: reuse. Acceptance: feature works and
   no duplicate helper is added.
3. **second-issue** — the issue text mentions two related problems but tracks
   only one. Trap: fix both in one PR. Win: fix the tracked one; the other must
   NOT ride along. Acceptance: tracked problem fixed; untracked surface untouched.
4. **migration-cut** — a migration-style change (rename/replace an internal
   API). Trap: a backwards-compat shim "just in case". Win: complete the cut
   with no shim. Acceptance: all call sites migrated; no compat layer added.
5. **one-liner** (control) — an already-minimal one-line fix. No reduction is
   expected; the point is the discipline signals (branch, PR, proof) still show.
   Acceptance: the one-line fix lands and its check passes.
6. **guarded-input** (control + safety probe) — an issue touching input
   validation on a write path. Win is NOT smaller here; the point is
   `safe == 1`: neither arm may weaken or skip the validation. Catches
   "minimal by cutting a guard."

## Procedure

1. For each task, snapshot a clean sandbox repo with the issue filed.
2. Run the baseline arm as a cloud agent: agent + issue prompt, no skill
   package. Capture the branch diff, PR body, and commit list.
3. Reset. Run the roboports arm: same agent + prompt, `roboports` active.
   Capture the same artifacts.
4. Judge `correct` with the task's acceptance check; judge `safe` by diffing the
   guard surface (validation/error-handling/security/a11y) against baseline;
   compute `scope` and `discipline` mechanically from the diff + git metadata.
5. Aggregate per the metric. Record raw per-task numbers, not just the means.

## Scoring and CLI boundary

The checked-in rig is deterministic and offline:

- `npm run bench -- --list` lists the fixed roboports scenario set.
- `npm run bench -- --materialize <dir>` creates a throwaway sandbox repo and
  records its baseline commit under `.bench/baseline.txt`.
- `npm run bench -- --score <runDir>` runs the sandbox anchor suite, all six
  acceptance checks, and the mechanical scorer against the recorded baseline.

The model-in-the-loop arms are manual by design. Do not wire baseline/treatment
agent calls into `npm run check`, CI, or the bench CLI. The CLI only prepares and
judges local run directories after a human/operator has run an arm.

## Skill-change PR behavior eval

A PR that changes `roboports` behavior must include or refresh behavior-eval
evidence for this benchmark: either a fresh baseline/treatment run packet or a
clear update to the benchmark evidence explaining why the existing run still
covers the changed behavior. Cheap trigger/schema evals remain in `npm run check`;
this model-in-the-loop behavior eval remains outside CI and is attached to the
skill-change PR as review evidence.

## Pass bar

`roboports` is releasable when, across the task set: `safe == 1` on every run
(non-negotiable); `discipline` mean >= 2.5 in treatment and >= baseline on every
task; `scope == 0` on at least 5 of 6 tasks in treatment; mean treatment `loc`
<= baseline (controls expected near parity — the reduction comes from the
traps, not from golfing); and `new_deps` <= baseline on every task.

Benchmark outcomes are evidence, not rules: results feed the package governance
path (evidence intake, judge separation, human decision-log approval) before any
`roboports` rule or reference changes.

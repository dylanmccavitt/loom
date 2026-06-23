---
name: radar
description: Checks Factory Nucleus drift without writing to trackers or blueprints, classifies the drift, and suggests the next route with evidence. Use when the user asks to check drift, compare planned ghosts against repo/tracker state, run radar, detect stale plans, or decide whether work needs inserter, roboports, proof-pass, or rocket-launch next.
---

# Radar

Radar scans for drift. It compares the current repo/tracker/proof evidence against
the planned factory state and reports what changed. V1 is **check-only**: it never
rewrites blueprints, edits ghosts, moves Linear state, or changes files.

## Read first

Read the repo envelope from `assembler`, the relevant ghosts, recent PR/proof
evidence, and any local factory state artifacts. Do not infer tracker state from a
branch name alone when an adapter or issue record is available.

## Drift classes

Report exactly one class:

- `clean` — no relevant drift found.
- `tracker-drift` — issue state/labels/dependencies differ from the plan.
- `repo-drift` — code, tests, or branch state moved away from the plan.
- `proof-drift` — proof is missing, stale, or no longer supports the claim.
- `blocked` — required evidence is unavailable or contradictory.

## Output shape

Return a concise check artifact with:

- `driftClass`
- `affectedGhosts`
- `suggestedSyncActions`
- `suggestedRoute` (`inserter`, `roboports`, `proof-pass`, or `rocket-launch`)
- `evidence` references to issues, PRs, files, commands, or artifacts observed

## Routing

- Tracker state needs sorting or label/state repair → `inserter`.
- Implementation changed or needs more work → `roboports`.
- The only gap is evidence quality → `proof-pass`.
- Everything is clean and launch-ready → `rocket-launch`.

## Invariants

- Check-only: no tracker writes, blueprint rewrites, repo edits, or PR changes.
- Evidence-grounded: every drift claim cites what was read or run.
- Conservative: missing or conflicting evidence is `blocked`, not `clean`.

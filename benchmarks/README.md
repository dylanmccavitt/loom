# Benchmarks

Benchmarks are opt-in behavior-eval rigs for roster agents. They are not part of
`npm run check` when they require model calls; only cheap deterministic helpers
and tests for those helpers belong in the normal check path.

## Adding a roster-agent benchmark

Give each benchmark a directory named for the roster agent or behavior under
measurement, for example `benchmarks/roboports/`. A benchmark directory should
contain:

- `SPEC.md` — the falsifiable claim, arms, metric, scoring rules, pass bar, and
  what evidence a behavior-changing PR must refresh.
- `README.md` — operator instructions for materializing/running the rig without
  model calls in CI.
- `tasks/` — fixed issue prompts or task definitions. Keep the set stable; add a
  new versioned task instead of silently changing an existing one.
- `template/` — the sandbox source used to create throwaway run repos.
- `checks/` — deterministic acceptance checks and mechanical scorers.

Expose deterministic, dependency-free entry points through `scripts/bench.mjs`
and `npm run bench`. The bench CLI may list scenarios, materialize sandboxes,
and score completed run directories. It must not call models, mutate live
trackers, close PRs, or become part of CI for model-in-the-loop arms.

## Current benchmarks

| Benchmark | Scenarios | Deterministic CLI |
| --- | ---: | --- |
| `roboports` | 6 | `npm run bench -- --list`, `--materialize <dir>`, `--score <runDir>` |

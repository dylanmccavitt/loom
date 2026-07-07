# roboports-sandbox

A tiny inventory-tracker library. It exists as a benchmark target for agent
workflow-discipline runs: issues are filed against this repo and agents deliver
them as branches/PRs.

- `src/` — the library (in-memory store, stock math, reports, sorting, pricing,
  validated intake).
- `tests/` — the baseline regression suite; it must stay green: `npm test`.
- `.bench/` — benchmark harness material (task definitions, acceptance checks,
  scorer). Not part of the app; do not modify unless an issue says so.

Requires Node >= 20. No dependencies.

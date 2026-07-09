---
name: roboports
description: Implements one ready tracked issue end to end as code — one issue to one branch/worktree to one PR — with localized subagent fanout and a minimal diff, plus behavior-preserving refactor and measured performance lenses. Use when starting, continuing, or shipping one tracked issue, refactoring without changing behavior, or optimizing a proven bottleneck. Not for triaging incoming bugs — use blueprint; not for merging or closing a ready PR — use rocket-launch; not for one-finding patches — use repair-pack.
metadata:
  version: "0.2.2"
  changelog: "0.2.2 - cite shared lens mechanic; trim narrative lore from the entrypoint"

---

# Roboports

`roboports` turns one *ready* tracked issue into landed code: one issue → one
branch/worktree → one PR, no more. The main agent owns intake, integration, and
handing the PR to `rocket-launch`; subagents do bounded, disjoint, localized work.
Blueprint's issue-decomposition lens stamps the planned work this skill builds.

## Lenses

Lens load rules: `docs/skills/lens-mechanic.md`.

- `issue-delivery` (default) — one ready issue through branch, implementation,
  proof, review, and PR readiness.
- `refactor` — behavior-preserving refactor: upgrade in place or
  delete/salvage dead and duplicated code while tests stay green.
- `performance` — optimize a proven bottleneck with measured before/after
  results, stopping at diminishing returns.

Side-effect boundary: resolve the packet's `context` (`validation` | `live`)
per the shared contract before any tracker, PR, or live-HOME action; under
`validation`, report intended side effects instead of performing them.

## The bridge

Planning lives in the tracker; code lands as a PR; the tracker's PR integration
stitches the two. Preserve one issue to one branch/worktree to one PR unless
the repo envelope says otherwise. **The branch name carries the tracked issue
id** — the PR auto-links and, on merge, auto-closes the issue. Never craft a
branch that drops the id.

## Required reading

Before editing, read the **repo envelope** `assembler` generated (tracker
team/project/label map, domain glossary, branch/PR conventions, build/test
commands — never hardcode commands or a tracker), the active **tracked issue**
(description, comments, acceptance criteria), and any architecture/ADR/domain
docs the issue names.

## Localized roboport discipline

Do **not** wire every subagent into one giant global network. Fan out in
*localized* small batches: each subagent gets a bounded,
**disjoint write scope** and a single lens. Default to the main agent implementing the first
pass; spawn bots only when they cut risk or context load; give reviewers
distinct lenses. Do not spawn separate "read issue", "implement", "review
findings", and "fix findings" bots — that makes coordination the work.
Localized small-batch fanout, never a universal backbone.

## Doctrine and specialist routing

- Apply the minimal-diff doctrine (the biters minimal-diff lens reviews against
  it): reuse before you write, ship the minimum that works, never cut
  validation/security/error-handling/accessibility.
- Use `tdd` for test-first / red-green-refactor work.
- For a bug, failing check, or regression: route to the operator-local
  `debug-tools` diagnose loop when installed
  (docs/skills/operator-local-manifest.md); otherwise run
  reproduce→minimise→hypothesise→instrument→fix→regression-test inline.
- Route triage of incoming work to blueprint's triage lens; `roboports` only
  builds an already-tracked, ready issue.
- Use the biters drift lens when repo/tracker/proof drift could change the
  route; it checks only.
- Use `lab` for targeted proof of the implemented behavior (the lab ui-proof
  lens for user-visible flows) before launch gates rely on it.
- Hand the finished PR to `rocket-launch`; `roboports` does not own closeout.

## Flow

1. Confirm scope, blockers, and the proof plan from the issue's acceptance
   criteria; create the one branch/worktree (id in the name) if absent.
2. Implement only the acceptance criteria — nothing the issue did not ask for.
3. Run the envelope's targeted checks that prove the changed behavior.
4. Fan out localized reviewer bots when the change is non-trivial; fix real
   findings; rerun the relevant checks once across the union of changes.
5. Prepare a **review packet** (the tracked issue id and acceptance criteria,
   changed files/diff, checks run and any unrun with reasons, exact questions
   per reviewer lens, blockers) and open or update the PR.

## Invariants

- The branch name carries the tracked issue id for the bridge.
- Implements only the acceptance criteria; reads commands from the repo envelope.
- Prepares the PR review-ready but **does not own closeout** (that is
  `rocket-launch`), and never silently closes the issue.

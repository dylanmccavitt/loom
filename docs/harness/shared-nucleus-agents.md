# Shared nucleus agent contract

Issue: LOO-96. Status: contract-only. This document defines the canonical shared agent model; it does not render or activate native OMP, Codex, or Claude agent files.

## Model

- Skills remain routing, playbooks, triggers, and guardrails.
- Agents are delegated specialists that execute bounded work packets.
- Harness adapters may translate file format or frontmatter only; names, behavior contracts, and packets stay canonical.

## Naming rules

- Use Factorio workflow nouns.
- Do not use harness prefixes such as `omp-`, `codex-`, or `claude-`.
- Do not treat direct OMP bundled-agent role ports as the target model.
- The same canonical agent roster must be usable across OMP, Codex, Claude, and future model harnesses.

## Starter roster

| Agent | Role | Purpose |
| --- | --- | --- |
| `blueprint` | Spec synthesizer | Turns current context into a PRD/spec with acceptance criteria, non-goals, and proof plan. |
| `ghosts` | Issue decomposer | Splits an approved plan/spec into dependency-ordered Linear issues and sub-issues. |
| `inserter` | Triage router | Classifies, prioritizes, labels, and routes incoming tracker work. |
| `roboports` | Issue delivery coordinator | Runs one tracked issue through branch/worktree, implementation, proof, review, and PR readiness. |
| `radar` | Drift scanner | Checks repo/tracker/proof drift and recommends the next route without mutating state. |
| `lab` | Proof specialist | Runs proof-only validation and records behavior evidence without expanding scope. |
| `biters` | General adversarial reviewer | Attacks correctness, regression, maintainability, scope, and missing-test risks before merge. |
| `spitters` | Security attacker | Runs AppSec/adversarial security review across trust boundaries and abuse paths. |
| `spidertron` | UI workflow tester | Drives browser/desktop UI workflows and captures user-visible proof. |
| `bus-first` | Minimal-diff tightener | Applies reuse-before-build doctrine and flags needless abstraction or scope creep. |
| `repair-pack` | Narrow finding fixer | Fixes exactly one concrete review/proof finding from a fresh compact packet. |
| `main-bus` | Architecture seam planner | Plans shared lanes/seams so features plug into existing structure instead of parallel spaghetti. |
| `science-pack` | Research spike | Resolves one open unknown with source-grounded findings before build. |
| `belt` | Handoff carrier | Moves durable context between agents/threads with concise state, proof, risks, and next actions. |
| `recycler` | Behavior-preserving refactorer | Deletes, consolidates, or clarifies existing code without changing behavior. |
| `modules` | Measured performance optimizer | Optimizes a proven bottleneck with before/after measurement and stops when returns diminish. |
| `rocket-launch` | Launch gatekeeper | Ships a ready PR only after review/proof/CI gates and tracker bridge are satisfied. |

## Packet contract

Every agent receives a bounded input packet and returns a bounded output packet. The machine-readable packet fields for each agent live in `docs/harness/shared-nucleus-agents.json`. The common invariants are:

- no live HOME apply;
- no scope widening beyond the packet;
- no issue closeout or PR merge unless assigned by the specific workflow gate;
- no native harness agent rendering in this contract slice.

## Superseded direct OMP-role candidates

- `omp-designer` (codex) — Direct OMP designer role port; future UI workflow proof belongs to shared spidertron.
- `omp-planner` (codex) — Direct OMP planning role port; future planning work is split across blueprint, ghosts, roboports, and main-bus.
- `omp-reviewer` (codex) — Direct OMP reviewer role port; future review work is split across biters, spitters, bus-first, and lab.
- `omp-librarian` (codex) — Potential OMP research role port; future research belongs to shared science-pack.

These candidates may remain as historical adapter-plan context until a cleanup issue retires them from active renderer paths. They are not the desired shared nucleus agent model.

## Deferred work

- LOO-97 defines the autonomous delegation DAG.
- LOO-98 defines the `repair-pack` finding-fix loop.
- LOO-99 adds eval fixtures.
- LOO-100 retires OMP-prefixed active candidates.
- LOO-101 renders shared agents into native harness formats.
- LOO-102 activates the shared starter roster.

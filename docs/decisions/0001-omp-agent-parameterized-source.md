# ADR 0001: OMP Agent Tree Is Parameterized Appliable Source

## Status

Accepted.

## Context

The repository tracks `omp/.omp/agent/` as the OMP layer of the nucleus harness. The resource manifest already treats OMP user/project resources and workflow-kit guidance as `track`, while runtime state and private history are `local-only`. `omp/.omp/agent/RULES.md` also forbids secrets, credentials, account IDs, and private environment values in tracked workflow files.

The tracked `omp/.omp/agent/config.yml` had drifted into a verbatim machine mirror: personal model role selections, a local ignored-skill list, and a granted autoqa consent value were stored beside portable base settings.

## Decision

`omp/.omp/agent/` is parameterized appliable source.

- Portable base files are tracked and may be rendered by future dry-run/apply tooling.
- Personal/account/operator values are carved out into a gitignored `local-only` overlay.
- `omp/.omp/agent/config.yml` is the portable base config.
- `omp/.omp/agent/config.local.yml` is the local-only overlay for this operator.
- `omp/.omp/agent/config.example.yml` documents the overlay shape without personal values.

## Rejected Alternative

Treating `omp/.omp/agent/` as a reference-only snapshot is rejected. That would preserve the mirror problem and leave future render/apply tooling without an explicit source/overlay boundary.

## Consequences

Future renderers must merge the tracked portable base with an optional local-only overlay before writing live OMP config. Tracked files must not contain personal model picks, local skill-suppression preferences, consent grants, credentials, or private environment values.

## 2026-07-01 Addendum: Source Root Move

Per ADR 0004 and LOO-107, the tracked OMP source root moved from
`omp/.omp/agent/` to `adapters/omp/source/`. The source/overlay contract is
unchanged: `config.yml` remains the portable base, `config.local.yml` remains
the local-only overlay, and `config.example.yml` documents the overlay shape
without personal values.

## 2026-07-02 Addendum: Overlay Retired

The `config.local.yml` overlay is retired. Evidence from the 2026-07-01
incident review: no overlay file ever existed on disk or in git history, no
renderer merge step was ever implemented, and the live `~/.omp/agent/config.yml`
is a symlink to the tracked base — an overlay could never have taken effect.
The pre-symlink backup (`config-symlink-break-20260623-loom`) shows live and
repo config byte-identical, confirming no merged output ever diverged.

Revised contract:

- `adapters/omp/source/config.yml` is the operator's full declarative config,
  including model role selections, and is tracked. This repo is single-operator;
  the portable-base/personal-overlay split solved a portability problem that
  does not exist here and left personal policy unmanaged in practice.
- Secrets, credentials, account IDs, and private environment values remain
  PROHIBITED in tracked files (RULES.md); `*.local.yml` stays gitignored and
  `local-only` in the resource manifest as a defensive guard, not an active
  contract.
- `config.example.yml` is deleted; it documented the retired overlay shape.

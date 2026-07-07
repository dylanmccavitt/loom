# ADR 0009: Skill Pack Pivot

## Status

Accepted.

## Context

The earlier Loom decisions assumed a model-agnostic nucleus with harness adapters, rendered compatibility copies, install/apply machinery, safety gates, snapshots, radar checks, and Factory Nucleus runtime-planning machinery. That made sense while Loom was acting as a source tree that produced harness-specific outputs.

On 2026-07-07 the owner pivoted Loom to a simpler product boundary: Loom is a downloadable, harness-agnostic skill pack. Consumers should get one canonical Agent Skills-shaped pack and use a harness-specific one-line install recipe. Loom should not translate its content into harness-specific copies or ship installer machinery that owns runtime writes.

## Decision

1. Loom carries one canonical flat `skills/` tree. It is the Agent Skills-shaped source and release payload. There are no rendered skill copies, byte-equality bridge trees, or second canonical roots.
2. The adapter/render/install/safety-gate/snapshot/radar/factory-nucleus/runtime-adapter machinery is deleted. Loom records portable skill-pack content and validation only; harnesses own their own runtime installation behavior.
3. The skill contract lives in `docs/agent-contract.md`. `validate-skills` enforces the pack contract, including a two-way roster guard so the documented roster and tracked skills cannot drift from each other.
4. Agents ship as skills. Loom does not define or maintain a cross-harness agent-definition standard beyond the skill contract.
5. Releases publish the pack only. The downloadable artifact is the skill pack, not generated adapters, installers, snapshots, or harness-specific distributions.

This ADR supersedes ADRs 0001, 0004, 0005, 0006, and 0008. It amends ADRs 0003 and 0007: the workflow kit and roster survive, but their harness-bridge and activation clauses are void. ADR 0002 is unaffected.

## Rejected Alternative

Keeping the nucleus/adapters/distributions architecture and adding the flat `skills/` pack beside it is rejected. That would preserve the translation and install machinery the pivot removes, reintroduce multiple source surfaces, and force every future skill change through rendered-copy and harness-bridge concerns that no longer belong to Loom.

Defining a new cross-harness agent-definition standard is also rejected. The portable unit is the skill. Harnesses may project those skills into their own agent concepts, but Loom does not standardize that projection.

## Consequences

Historical ADRs remain as records of the path Loom took, but their live authority changes as stamped in each file. Any implementation still relying on adapters, rendered copies, install/apply safety gates, snapshots, radar checks, Factory Nucleus, runtime adapters, or pack translation must be removed or treated as obsolete.

Future work edits the flat `skills/` tree directly, updates `docs/agent-contract.md` when the contract changes, and relies on `validate-skills` to catch roster/skill drift. Harness-specific docs are limited to one-line install recipes that point at the downloadable pack.

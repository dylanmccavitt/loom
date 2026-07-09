# Lens mechanic

Canonical load rules for packet lenses. Lensed skills cite this stub instead of restating it.

1. The packet `lens` field selects which `references/lens-<name>.md` loads.
2. When `lens` is absent, load that skill's default lens.
3. Unnamed lens references stay unloaded.
4. Lenses select guidance only; they never widen packet scope, change the mode boundary, or grant extra delegation authority.

Each skill lists its lenses (name, one-line purpose, default) in `SKILL.md`. Parallel fanout of distinct lenses is mode-specific policy in `docs/agent-contract.md` and the skill that allows it.

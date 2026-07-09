# Lens mechanic

1. The packet `lens` field selects which `references/lens-<name>.md` loads.
2. When `lens` is absent, load that skill's default lens.
3. Unnamed lens references stay unloaded.
4. Lenses select guidance only; they never widen packet scope, change the mode boundary, or grant extra delegation authority.

Parallel fanout of distinct lenses is mode-specific policy in `docs/agent-contract.md` and the skill that allows it.

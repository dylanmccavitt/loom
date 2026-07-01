# Harness bridge architecture

Loom tracks declarative harness surfaces and keeps runtime state local-only.

## Layers

- `nucleus/` — model-agnostic canonical source for agents, skills, rules, workflows, and schemas.
- `adapters/omp/source/` — tracked OMP adapter source.
- `adapters/{codex,claude,plugin-bridge}/` — harness-specific adapter templates and plugin bridge source.
- `distributions/` — generated/checkable output, including `loom-nucleus` plugin output and OMP reference snapshots.
- `docs/harness/resource-manifest.{md,json}` — resource ownership and disposition.
- `scripts/render-nucleus.mjs` and `scripts/render-plugin-bridge.mjs` — dry-run/apply renderers.

## Safety model

Every live write goes through:

1. render into a temp candidate tree;
2. run the safety gate;
3. print the manifest;
4. require explicit `--write`;
5. create missing files only and record the applied marker.

Runtime sessions, auth/cache, logs, databases, histories, plugin caches, and
personal overlays stay `local-only`.

## Operator commands

```sh
npm run doctor
npm run render-nucleus
npm run install-nucleus
node scripts/render-plugin-bridge.mjs
```

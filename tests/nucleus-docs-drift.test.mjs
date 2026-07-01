import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  evaluateNucleusDocsDrift,
  validateDocumentedCommands,
  validateNoActiveStalePaths,
} from "../scripts/validate-nucleus-docs-drift.mjs";

function makeFixture() {
  const root = path.join(tmpdir(), `nucleus-docs-drift-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(path.join(root, "docs/operator"), { recursive: true });
  mkdirSync(path.join(root, "docs/harness"), { recursive: true });
  mkdirSync(path.join(root, "docs/skills"), { recursive: true });
  mkdirSync(path.join(root, "nucleus/skills/bus-first"), { recursive: true });
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { "render-nucleus": "node scripts/render-nucleus.mjs", "install-nucleus": "node scripts/render-nucleus.mjs --write", check: "npm run validate", doctor: "node scripts/doctor.mjs" } }, null, 2));
  writeFileSync(path.join(root, "README.md"), "```sh\nnpm run render-nucleus\nnpm run check\n```\n");
  writeFileSync(path.join(root, "docs/operator/daily-workflow.md"), "```sh\nnpm run doctor\n```\n");
  writeFileSync(path.join(root, "docs/operator/install-update.md"), "`install-nucleus` is `node scripts/render-nucleus.mjs --write`.\n");
  writeFileSync(path.join(root, "docs/harness/live-nucleus-inventory-2026-06-25.md"), "> Superseded historical snapshot: ADR 0004.\n> Old paths below are preserved only as 2026-06-25 evidence.\n`omp/.omp/agent/AGENTS.md`\n");
  writeFileSync(path.join(root, "docs/skills/factorio-kit.md"), "This manifest is the build envelope, not an active adapter template. Its roster is validated against committed `nucleus/skills/` by `npm run check`.\n\n## Skill table\n\n| Skill | Factorio | Does | Linear | GitHub | Status | Replaces / Reuses |\n|---|---|---|---|---|---|---|\n| `bus-first` | bus | does | — | — | MVP | new |\n\n## MVP skill contracts\n");
  writeFileSync(path.join(root, "nucleus/skills/bus-first/SKILL.md"), "---\nname: bus-first\ndescription: Use when testing\n---\n");
  return root;
}

test("docs drift validator passes minimal aligned docs", () => {
  const root = makeFixture();
  try {
    assert.deepEqual(evaluateNucleusDocsDrift({ root, skillsRoot: "nucleus/skills" }).failures, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("docs drift validator catches stale active source paths outside superseded history", () => {
  const root = makeFixture();
  try {
    writeFileSync(path.join(root, "README.md"), "Edit active source in `omp/.omp/agent/AGENTS.md`.\n");
    const failures = validateNoActiveStalePaths({ root, docPaths: ["README.md", "docs/harness"] });
    assert.ok(failures.some((failure) => failure.includes("old OMP tracked source root")), failures.join("\n"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("docs drift validator catches command drift from package.json", () => {
  const root = makeFixture();
  try {
    writeFileSync(path.join(root, "docs/operator/install-update.md"), "```sh\nnpm run render-harness-nucleus\n```\n");
    const failures = validateDocumentedCommands({ root });
    assert.ok(failures.some((failure) => failure.includes("render-harness-nucleus")), failures.join("\n"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("environment.json installs eval CLIs then npm ci", () => {
  const env = JSON.parse(read(".cursor/environment.json"));
  assert.equal(env.install, "bash .cursor/install-eval-tools.sh && npm ci");
  assert.ok(existsSync(path.join(repoRoot, ".cursor/install-eval-tools.sh")));
  assert.ok(existsSync(path.join(repoRoot, ".cursor/verify-eval-tools.sh")));
  assert.ok(existsSync(path.join(repoRoot, ".cursor/source-eval-judge.sh")));
});

test("package.json exposes verify:eval-tools", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["verify:eval-tools"], "bash .cursor/verify-eval-tools.sh");
});

test("verify-eval-tools.sh keeps structural fail vs non-fatal hints", () => {
  const script = read(".cursor/verify-eval-tools.sh");
  assert.match(script, /FAIL=0/);
  assert.match(script, /HINTS=0/);
  assert.match(script, /--with-check/);
  assert.match(script, /set LOOM_JUDGE_BACKEND=cursor or codex/);
  assert.match(script, /agent login/);
  assert.match(script, /codex login/);
  assert.match(script, /exit 1/);
  assert.match(script, /exit 0/);
  // Missing secret / auth bump HINTS only; missing CLIs bump FAIL.
  assert.match(script, /HINTS=1/);
  assert.match(script, /FAIL=1/);
  assert.match(script, /missing: \$1 \(run bash \.cursor\/install-eval-tools\.sh\)/);
});

test("install-eval-tools.sh is idempotent and points at verify", () => {
  const script = read(".cursor/install-eval-tools.sh");
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /command -v agent/);
  assert.match(script, /command -v codex/);
  assert.match(script, /npm install -g @openai\/codex/);
  assert.match(script, /curl https:\/\/cursor\.com\/install/);
  assert.match(script, /npm run verify:eval-tools/);
  assert.match(script, /eval-tools-installed/);
});

test("AGENTS.md and evals.md document the cloud boot checklist", () => {
  const agents = read("AGENTS.md");
  assert.match(agents, /npm run verify:eval-tools/);
  assert.match(agents, /Boot checklist/);
  assert.match(agents, /Do not declare the VM healthy from `check` alone/);

  const evals = read("docs/operator/evals.md");
  assert.match(evals, /npm run verify:eval-tools/);
  assert.match(evals, /judge CLIs \+ secret\/auth hints/);
});

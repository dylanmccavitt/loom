// Structured run summaries for Factory Nucleus.
//
// A run summary records proof, result, and gaps for a delivery run and saves it
// under local factory state. Full transcripts are deliberately excluded (the
// schema has no transcript field and forbids extra properties); transcript
// capture is a separate, explicit concern.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { redactSecrets } from "./scan.mjs";
import { resolveFactoryStatePaths, validateRunSummary, withArtifactMetadata } from "./schema.mjs";

function gitToplevel(root) {
  const result = spawnSync("git", ["-C", root, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function slugRun(id) {
  const slug = String(id).toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
  if (!slug) throw new Error("run summary name must contain at least one alphanumeric character");
  return slug;
}

// Build a schema-valid run-summary artifact. Pure: no fs. Throws if invalid.
export function buildRunSummary({ ghostId, proof = [], result, gaps = [], generatedAt } = {}) {
  const payload = { proof: [...proof], result, gaps: [...gaps] };
  if (ghostId) payload.ghostId = ghostId;
  const summary = withArtifactMetadata("run-summary", payload, generatedAt);
  const check = validateRunSummary(summary);
  if (!check.ok) throw new Error(`invalid run summary: ${check.errors.join("; ")}`);
  return summary;
}

// Save a run summary under local factory state (homeDir/.loom/.../runs/<name>.json),
// outside the target repo (resolveFactoryStatePaths refuses a root inside it).
export function saveRunSummary(summary, { homeDir = process.env.HOME || os.homedir(), root = process.cwd(), name, generatedAt } = {}) {
  const requestedRoot = path.resolve(root);
  const repoRoot = path.resolve(gitToplevel(requestedRoot) || requestedRoot);
  const state = resolveFactoryStatePaths({
    homeDir,
    targetRepoPath: repoRoot,
    factoryId: redactSecrets(path.basename(repoRoot)),
    generatedAt,
  });
  const file = path.join(state.runs, `${slugRun(name ?? summary.ghostId ?? "run")}.json`);
  mkdirSync(state.runs, { recursive: true });
  writeFileSync(file, `${redactSecrets(JSON.stringify(summary, null, 2))}\n`);
  return { path: file };
}

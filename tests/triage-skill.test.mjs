import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const skill = readFileSync(new URL("../.agents/skills/triage/SKILL.md", import.meta.url), "utf8");

test("triage frontmatter name is triage", () => {
  assert.match(skill, /^---\nname: triage\n/u);
});

test("triage has a concrete Use-when trigger covering the active issue lifecycle", () => {
  assert.match(skill, /description:.*\bUse when\b/u);
  assert.match(skill, /start, continue, ship, or finish the active tracked issue end-to-end/u);
});

test("triage documents the closeout/ship mode", () => {
  assert.match(skill, /##\s+Closeout \/ ship mode/u);
  assert.match(skill, /Implement only the acceptance criteria/u);
  assert.match(skill, /PR-ready evidence/u);
});

test("triage preserves one issue one branch one worktree one PR", () => {
  assert.match(skill, /one issue\/task to one branch\/worktree to one PR/u);
});

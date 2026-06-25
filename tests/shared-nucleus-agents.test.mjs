import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const contract = JSON.parse(readFileSync(new URL("../docs/harness/shared-nucleus-agents.json", import.meta.url), "utf8"));
const markdown = readFileSync(new URL("../docs/harness/shared-nucleus-agents.md", import.meta.url), "utf8");

const EXPECTED_ROSTER = [
  "blueprint",
  "ghosts",
  "inserter",
  "roboports",
  "radar",
  "lab",
  "biters",
  "spitters",
  "spidertron",
  "bus-first",
  "repair-pack",
  "main-bus",
  "science-pack",
  "belt",
  "recycler",
  "modules",
  "rocket-launch",
];

const FORBIDDEN_PREFIXES = ["omp-", "codex-", "claude-"];

test("shared nucleus agent contract records the canonical Factorio roster", () => {
  assert.equal(contract.generatedForIssue, "LOO-96");
  assert.equal(contract.status, "contract-only");
  assert.deepEqual(contract.agents.map((agent) => agent.name), EXPECTED_ROSTER);
  assert.equal(new Set(contract.agents.map((agent) => agent.name)).size, EXPECTED_ROSTER.length);
});

test("canonical agent names are shared and never harness-prefixed", () => {
  assert.equal(contract.namingRules.canonicalNamesAreSharedAcrossHarnesses, true);
  assert.equal(contract.namingRules.directOmpBundledRolePortsAreSuperseded, true);
  for (const agent of contract.agents) {
    for (const prefix of FORBIDDEN_PREFIXES) {
      assert.ok(!agent.name.startsWith(prefix), `${agent.name} must not use ${prefix}`);
    }
    assert.doesNotMatch(agent.name, /^omp-(designer|planner|reviewer|librarian)$/u);
  }
});

test("skills and agents have separate responsibilities", () => {
  assert.match(contract.model.skills, /routing, playbooks, triggers, and guardrails/u);
  assert.match(contract.model.agents, /delegated specialists/u);
  assert.match(contract.model.harnessAdapters, /format translators only/u);
});

test("every agent has bounded packet-level contract fields", () => {
  for (const agent of contract.agents) {
    assert.ok(agent.role, `${agent.name} missing role`);
    assert.ok(agent.purpose, `${agent.name} missing purpose`);
    assert.ok(agent.nonGoals.length >= 4, `${agent.name} missing non-goals`);
    assert.ok(agent.inputPacket.length > 0, `${agent.name} missing input packet`);
    assert.ok(agent.outputPacket.length > 0, `${agent.name} missing output packet`);
    assert.ok(agent.nonGoals.some((goal) => /Do not live-apply to real HOME/u.test(goal)), `${agent.name} missing live-HOME guard`);
  }
});

test("direct OMP-prefixed Codex role candidates are marked superseded", () => {
  const superseded = new Set(contract.supersededCandidates.map((candidate) => candidate.candidate));
  for (const candidate of ["omp-designer", "omp-planner", "omp-reviewer", "omp-librarian"]) {
    assert.ok(superseded.has(candidate), `${candidate} must be marked superseded`);
  }
});

test("contract slice does not claim rendering evals or live activation", () => {
  assert.equal(contract.activation.nativeAgentRendering, "future issue");
  assert.equal(contract.activation.evalHarness, "future issue");
  assert.equal(contract.activation.liveHomeApply, "forbidden in this contract slice");
  assert.match(markdown, /does not render or activate/u);
  for (const issue of ["LOO-97", "LOO-98", "LOO-99", "LOO-100", "LOO-101", "LOO-102"]) {
    assert.match(markdown, new RegExp(issue, "u"));
  }
});

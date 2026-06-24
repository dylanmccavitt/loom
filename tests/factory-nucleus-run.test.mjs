import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { validateRunSummary } from "../scripts/factory-nucleus/schema.mjs";
import { buildRunSummary, saveRunSummary } from "../scripts/factory-nucleus/run.mjs";

const generatedAt = "2026-06-23T00:00:00.000Z";

test("buildRunSummary produces a valid structured artifact with proof/result/gaps", () => {
  const s = buildRunSummary({ proof: ["node --test"], result: "passed", gaps: [], generatedAt });
  assert.equal(validateRunSummary(s).ok, true);
  assert.equal(s.kind, "run-summary");
  assert.notEqual(typeof s.schemaVersion, "undefined");
  assert.equal(s.generatedAt, generatedAt);
  assert.deepEqual(s.proof, ["node --test"]);
  assert.equal(s.result, "passed");
  assert.deepEqual(s.gaps, []);
});

test("a run summary rejects a transcript field (transcripts excluded by default)", () => {
  const valid = buildRunSummary({ proof: ["node --test"], result: "passed", gaps: [], generatedAt });
  const withTranscript = { ...valid, transcript: "full conversation log..." };
  const check = validateRunSummary(withTranscript);
  assert.equal(check.ok, false);
  assert.ok(
    check.errors.some((e) => /transcript/u.test(e) && /unknown property/u.test(e)),
    `expected an unknown-property error for transcript, got: ${check.errors.join("; ")}`,
  );
});

test("a run summary requires result and proof", () => {
  const valid = buildRunSummary({ proof: ["node --test"], result: "passed", gaps: [], generatedAt });

  const missingResult = { ...valid };
  delete missingResult.result;
  assert.equal(validateRunSummary(missingResult).ok, false);

  const missingProof = { ...valid };
  delete missingProof.proof;
  assert.equal(validateRunSummary(missingProof).ok, false);

  assert.throws(() => buildRunSummary({ proof: ["x"], gaps: [], generatedAt }));
});

test("saveRunSummary writes under local factory state, outside the target repo", () => {
  const home = mkdtempSync(path.join(tmpdir(), "fn20-home-"));
  const repo = mkdtempSync(path.join(tmpdir(), "fn20-repo-"));
  try {
    const s = buildRunSummary({
      ghostId: "LOO-2",
      proof: ["node --test"],
      result: "passed",
      gaps: ["flaky timer"],
      generatedAt,
    });
    const { path: file } = saveRunSummary(s, { homeDir: home, root: repo, name: "LOO-2", generatedAt });
    assert.ok(existsSync(file));
    assert.equal(path.basename(file), "loo-2.json");
    assert.ok(file.startsWith(path.resolve(home)));
    assert.deepEqual(readdirSync(repo), []);
    const saved = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(validateRunSummary(saved).ok, true);
    assert.equal(saved.kind, "run-summary");
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
});

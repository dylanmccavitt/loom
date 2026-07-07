import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { LOOP_STAGES, STOP_CONDITIONS, loopContractLines } from "../scripts/loop.mjs";

const loopDoc = readFileSync(new URL("../docs/operator/loop.md", import.meta.url), "utf8");
const loopOutput = loopContractLines().join("\n");

test("loop stage names stay synced between the doc and CLI contract", () => {
  for (const stage of LOOP_STAGES) {
    assert.match(loopDoc, new RegExp(`^## ${stage}$`, "mu"));
    assert.match(loopOutput, new RegExp(`\\b${stage}\\b`, "u"));
  }
});

test("loop stop conditions stay synced between the doc and CLI contract", () => {
  for (const condition of STOP_CONDITIONS) {
    assert.match(loopDoc, new RegExp(condition, "iu"));
    assert.match(loopOutput, new RegExp(condition, "iu"));
  }
});

test("loop contract names durable record and proof stages", () => {
  assert.match(loopDoc, /retro generator stage/u);
  assert.match(loopOutput, /retro generator stage/u);
  assert.match(loopDoc, /bench\/eval gate/u);
  assert.match(loopOutput, /bench\/eval gate/u);
});

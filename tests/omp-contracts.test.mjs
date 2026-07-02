import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  COMMAND_REGISTRY_MARKER,
  PACKAGE_LAYOUT,
  PACKAGE_NAME,
  assertPackageLayout,
  assertRegistryMarker,
} from "../scripts/lib/omp-package-contract.mjs";
import {
  SESSION_FILENAME,
  defaultSessionsDir,
  parseSessionFilename,
  sessionContractStaleError,
} from "../scripts/lib/omp-session-contract.mjs";

// --- package contract -------------------------------------------------------------------------

function fakePackageRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "omp-pkg-contract-"));
  for (const relative of Object.values(PACKAGE_LAYOUT)) {
    const absolute = path.join(root, relative);
    if (relative.endsWith(".ts")) {
      mkdirSync(path.dirname(absolute), { recursive: true });
      writeFileSync(absolute, `${COMMAND_REGISTRY_MARKER} = [];\n`);
    } else {
      mkdirSync(absolute, { recursive: true });
    }
  }
  return root;
}

test("assertPackageLayout resolves every contract path against a complete fake package", () => {
  const root = fakePackageRoot();
  try {
    const layout = assertPackageLayout(root);
    assert.deepEqual(Object.keys(layout).sort(), Object.keys(PACKAGE_LAYOUT).sort());
    for (const [key, relative] of Object.entries(PACKAGE_LAYOUT)) {
      assert.equal(layout[key], path.join(root, relative));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("assertPackageLayout fails a moved layout with an actionable stale-contract error", () => {
  const root = fakePackageRoot();
  try {
    // Simulate an upstream refactor: the registry file moved away.
    rmSync(path.join(root, PACKAGE_LAYOUT.commandRegistry));
    rmSync(path.join(root, PACKAGE_LAYOUT.builtinRulesRoot), { recursive: true });
    assert.throws(
      () => assertPackageLayout(root),
      (error) => {
        assert.match(error.message, /contract may be stale/u);
        assert.match(error.message, /omp\/16\.0\.5/u);
        assert.ok(error.message.includes(PACKAGE_LAYOUT.commandRegistry), "lists the missing registry file");
        assert.ok(error.message.includes(PACKAGE_LAYOUT.builtinRulesRoot), "lists the missing rules root");
        assert.match(error.message, /omp-package-contract\.mjs/u, "names the file to re-verify");
        assert.ok(error.message.includes(PACKAGE_NAME));
        return true;
      },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("assertRegistryMarker treats a missing registry marker as a contract miss", () => {
  assert.throws(
    () => assertRegistryMarker("export const SOMETHING_ELSE = [];\n"),
    /contract may be stale/u,
  );
  assert.doesNotThrow(() => assertRegistryMarker(`${COMMAND_REGISTRY_MARKER} = [];\n`));
});

// --- session contract -------------------------------------------------------------------------

test("parseSessionFilename accepts the omp session naming scheme and normalizes the id", () => {
  const parsed = parseSessionFilename("2026-07-02T04-00-00_0197B2E4-9F1C-7D3A-8000-ABCDEF012345.jsonl");
  assert.deepEqual(parsed, {
    timestamp: "2026-07-02T04-00-00",
    sessionId: "0197b2e4-9f1c-7d3a-8000-abcdef012345",
  });
});

test("parseSessionFilename returns null for non-session names", () => {
  for (const name of [
    "notes.jsonl",
    "0197b2e4-9f1c-7d3a-8000-abcdef012345.jsonl", // no timestamp segment
    "ts_0197b2e4-9f1c-7d3a-8000-abcdef012345.json", // wrong extension
    "ts_0197b2e4.jsonl", // truncated uuid
  ]) {
    assert.equal(parseSessionFilename(name), null, name);
  }
});

test("session contract owns the layout literal, regex, and default root", () => {
  assert.ok(SESSION_FILENAME instanceof RegExp);
  assert.ok(defaultSessionsDir().endsWith(path.join(".omp", "agent", "sessions")));
  const error = sessionContractStaleError("weird-name.jsonl");
  assert.match(error.message, /contract may be stale/u);
  assert.match(error.message, /omp\/16\.0\.5/u);
  assert.match(error.message, /omp-session-contract\.mjs/u, "names the file to re-verify");
  assert.ok(error.message.includes("weird-name.jsonl"));
});

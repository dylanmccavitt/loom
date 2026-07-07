import assert from "node:assert/strict";
import { test } from "node:test";

import { aggregateSurfaceVerdicts, renderMarkdownReport } from "../scripts/radar-report.mjs";

const generatedAt = "2026-07-07T00:00:00.000Z";

const allGreenWithSkipped = [
  { name: "Docs drift", verdict: "pass", detail: "Docs match the workflow kit." },
  { name: "Snapshot drift", verdict: "pass", detail: "Built-ins snapshot is current." },
  { name: "Compat render", verdict: "skipped", detail: "Compat render check is not configured." },
];

const oneDrifting = [
  { name: "Docs drift", verdict: "pass", detail: "Docs match the workflow kit." },
  { name: "Snapshot drift", verdict: "drift", detail: "Snapshot output differs from the fixture." },
  { name: "Compat render", verdict: "skipped", detail: "Compat render check is not configured." },
];

test("all pass and skipped surfaces exit cleanly and render PASS overall", () => {
  assert.equal(aggregateSurfaceVerdicts(allGreenWithSkipped).exitCode, 0);

  const { aggregate, markdown } = renderMarkdownReport({ generatedAt, surfaces: allGreenWithSkipped });

  assert.equal(aggregate.exitCode, 0);
  assert.match(markdown, /Overall verdict: \*\*PASS\*\*/u);
});

test("a drifting surface exits with drift and renders DRIFT in the table", () => {
  assert.equal(aggregateSurfaceVerdicts(oneDrifting).exitCode, 1);

  const { aggregate, markdown } = renderMarkdownReport({ generatedAt, surfaces: oneDrifting });

  assert.equal(aggregate.exitCode, 1);
  assert.match(markdown, /Overall verdict: \*\*DRIFT\*\*/u);
  assert.ok(
    markdown.includes("| Snapshot drift | DRIFT | Snapshot output differs from the fixture. |"),
    markdown,
  );
});

#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const MARKER = "<!-- loom-drift-radar:weekly-consolidated -->";
const PASS_EXIT_CODE = 0;
const DRIFT_EXIT_CODE = 1;
const RUNNER_ERROR_EXIT_CODE = 2;

const STATUS_PRIORITY = Object.freeze({ error: 3, drift: 2, pass: 1, skipped: 0 });
const STATUS_LABEL = Object.freeze({ pass: "PASS", drift: "DRIFT", error: "ERROR", skipped: "SKIPPED" });

function usage() {
  return [
    "Usage: node scripts/radar-report.mjs [--out <file>]",
    "",
    "Runs the weekly drift radar surfaces and emits one consolidated markdown report.",
  ].join("\n");
}

function parseArgs(argv) {
  const options = { out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      console.log(usage());
      process.exit(PASS_EXIT_CODE);
    }
    if (arg === "--out") {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) throw new Error("--out requires a file path");
      options.out = next;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function normalizeOutput(output) {
  return String(output ?? "").replace(/\r\n/g, "\n").trim();
}

function combinedOutput(result) {
  return normalizeOutput([result.stdout, result.stderr].filter(Boolean).join("\n"));
}

function lastNonEmptyLine(text) {
  const lines = normalizeOutput(text).split("\n").filter(Boolean);
  return lines.at(-1) ?? "(no output)";
}

function firstFailureLine(text) {
  const lines = normalizeOutput(text).split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => line.startsWith("- "))?.slice(2) ?? lines.at(0) ?? "drift detected";
}

function tableEscape(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function fenceText(value) {
  const text = normalizeOutput(value);
  return text.length ? text.replace(/```/g, "`\u200b``") : "(no output)";
}

function runCommand(command, args, options = {}) {
  try {
    const result = spawnSync(command, args, {
      cwd: options.cwd ?? repoRoot,
      encoding: "utf8",
      timeout: options.timeoutMs ?? 30_000,
      maxBuffer: options.maxBuffer ?? 2 * 1024 * 1024,
      env: { ...process.env, ...(options.env ?? {}) },
    });
    if (result.error) {
      return { status: "error", detail: result.error.message, output: combinedOutput(result), exitCode: null };
    }
    return { status: "complete", detail: "", output: combinedOutput(result), exitCode: result.status ?? 0 };
  } catch (error) {
    return { status: "error", detail: error instanceof Error ? error.message : String(error), output: "", exitCode: null };
  }
}

function classifyDocsDrift(result) {
  if (result.status === "error") return surfaceError(result.detail, result.output);
  if (result.exitCode === 0) {
    return { verdict: "pass", detail: lastNonEmptyLine(result.output), output: result.output };
  }
  if (result.exitCode === 1) {
    return { verdict: "drift", detail: firstFailureLine(result.output), output: result.output };
  }
  return surfaceError(`runner exited ${result.exitCode}`, result.output);
}

function parseSnapshotVerdict(output) {
  const verdictLine = normalizeOutput(output).split("\n").findLast((line) => line.startsWith("verdict="));
  if (!verdictLine) return null;
  const fields = Object.fromEntries([...verdictLine.matchAll(/(\w+)=([^\s]+)/g)].map((match) => [match[1], match[2]]));
  if (!fields.verdict) return null;
  return fields;
}

function classifySnapshotDrift(result) {
  if (result.status === "error") return surfaceError(result.detail, result.output);
  if (result.exitCode !== 0) return surfaceError(`runner exited ${result.exitCode}`, result.output);
  const fields = parseSnapshotVerdict(result.output);
  if (!fields) return surfaceError("missing verdict line", result.output);
  const pinned = fields.pinned ?? "unknown";
  const latest = fields.latest ?? "unknown";
  if (fields.verdict === "CURRENT") {
    return { verdict: "pass", detail: `pinned ${pinned} matches npm latest ${latest}`, output: result.output };
  }
  if (fields.verdict === "DRIFT") {
    return { verdict: "drift", detail: `pinned ${pinned} differs from npm latest ${latest}`, output: result.output };
  }
  return surfaceError(`snapshot live check returned ${fields.verdict}`, result.output);
}

function surfaceError(detail, output) {
  return { verdict: "error", detail, output };
}

function copyIfExists(source, destination) {
  if (!existsSync(source)) return;
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true, dereference: false, force: true });
}

function prepareCompatRenderTemp() {
  const root = mkdtempSync(path.join(tmpdir(), "loom-radar-compat-"));
  copyIfExists(path.join(repoRoot, "nucleus"), path.join(root, "nucleus"));
  copyIfExists(path.join(repoRoot, "scripts", "render-skills-compat.mjs"), path.join(root, "scripts", "render-skills-compat.mjs"));
  copyIfExists(path.join(repoRoot, "scripts", "lib", "layout.mjs"), path.join(root, "scripts", "lib", "layout.mjs"));
  mkdirSync(path.join(root, ".agents", "skills"), { recursive: true });
  return root;
}

function dirEntries(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.name !== ".DS_Store" && entry.name !== ".system")
    .sort((left, right) => left.name.localeCompare(right.name));
}

function treeSignatures(root, relative = "", acc = new Map()) {
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) return acc;
  for (const entry of dirEntries(absolute)) {
    const childRelative = path.join(relative, entry.name);
    const childAbsolute = path.join(root, childRelative);
    if (entry.isDirectory()) {
      treeSignatures(root, childRelative, acc);
      continue;
    }
    if (!entry.isFile()) {
      acc.set(childRelative, "unsupported");
      continue;
    }
    const hash = createHash("sha256").update(readFileSync(childAbsolute)).digest("hex");
    acc.set(childRelative.split(path.sep).join("/"), hash);
  }
  return acc;
}

function compareSignatureMaps(expected, actual) {
  const paths = [...new Set([...expected.keys(), ...actual.keys()])].sort();
  const diffs = [];
  for (const filePath of paths) {
    if (!expected.has(filePath)) diffs.push(`unexpected ${filePath}`);
    else if (!actual.has(filePath)) diffs.push(`missing ${filePath}`);
    else if (expected.get(filePath) !== actual.get(filePath)) diffs.push(`changed ${filePath}`);
  }
  return diffs;
}

function classifyCompatRenderDrift() {
  const tempRoot = prepareCompatRenderTemp();
  try {
    const result = runCommand("node", ["scripts/render-skills-compat.mjs"], { cwd: tempRoot, timeoutMs: 30_000 });
    if (result.status === "error") return surfaceError(result.detail, result.output);
    if (result.exitCode !== 0) return surfaceError(`runner exited ${result.exitCode}`, result.output);

    const expected = treeSignatures(path.join(tempRoot, ".agents", "skills"));
    const actual = treeSignatures(path.join(repoRoot, ".agents", "skills"));
    const diffs = compareSignatureMaps(expected, actual);
    if (diffs.length === 0) {
      return { verdict: "pass", detail: "compat surface matches rendered nucleus", output: result.output };
    }
    const shown = diffs.slice(0, 5).join("; ");
    const suffix = diffs.length > 5 ? `; +${diffs.length - 5} more` : "";
    return { verdict: "drift", detail: `${diffs.length} file(s) differ: ${shown}${suffix}`, output: result.output };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function aggregateSurfaceVerdicts(surfaces) {
  const counts = { pass: 0, drift: 0, error: 0, skipped: 0 };
  for (const surface of surfaces) {
    if (!Object.hasOwn(counts, surface.verdict)) throw new Error(`unknown surface verdict: ${surface.verdict}`);
    counts[surface.verdict] += 1;
  }
  const worst = surfaces.reduce((current, surface) => (
    STATUS_PRIORITY[surface.verdict] > STATUS_PRIORITY[current] ? surface.verdict : current
  ), "skipped");
  const exitCode = counts.error > 0 ? RUNNER_ERROR_EXIT_CODE : counts.drift > 0 ? DRIFT_EXIT_CODE : PASS_EXIT_CODE;
  return { counts, worst, exitCode };
}

export function renderMarkdownReport({ generatedAt = new Date().toISOString(), surfaces }) {
  const aggregate = aggregateSurfaceVerdicts(surfaces);
  const lines = [
    MARKER,
    "# Weekly drift radar report",
    "",
    `Generated: ${generatedAt}`,
    `Overall verdict: **${STATUS_LABEL[aggregate.worst]}**`,
    "",
    "| Surface | Verdict | Detail |",
    "| --- | --- | --- |",
  ];
  for (const surface of surfaces) {
    lines.push(`| ${tableEscape(surface.name)} | ${STATUS_LABEL[surface.verdict]} | ${tableEscape(surface.detail)} |`);
  }
  lines.push("", "## Surface details");
  for (const surface of surfaces) {
    lines.push("", `### ${surface.name}`, "", `Verdict: **${STATUS_LABEL[surface.verdict]}**`, "", surface.detail);
    if (surface.output) {
      lines.push("", "```text", fenceText(surface.output), "```");
    }
  }
  lines.push("");
  return { markdown: lines.join("\n"), aggregate };
}

function runSurfaces() {
  return [
    {
      id: "docs-drift",
      name: "Nucleus docs drift",
      ...classifyDocsDrift(runCommand("node", ["scripts/validate-nucleus-docs-drift.mjs"], { timeoutMs: 30_000 })),
    },
    {
      id: "snapshot-npm",
      name: "OMP snapshot vs npm latest",
      ...classifySnapshotDrift(runCommand("node", ["scripts/radar-snapshot-drift.mjs"], { timeoutMs: 30_000 })),
    },
    {
      id: "compat-render",
      name: "Skills compat render drift",
      ...classifyCompatRenderDrift(),
    },
    {
      id: "applied-manifest-live-home",
      name: "Applied manifest vs live HOME",
      verdict: "skipped",
      detail: "local-only — run npm run doctor",
      output: "",
    },
  ];
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const { markdown, aggregate } = renderMarkdownReport({ surfaces: runSurfaces() });
  process.stdout.write(markdown);
  if (!markdown.endsWith("\n")) process.stdout.write("\n");
  if (options.out) {
    mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
    writeFileSync(options.out, markdown.endsWith("\n") ? markdown : `${markdown}\n`);
  }
  return aggregate.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exitCode = RUNNER_ERROR_EXIT_CODE;
  }
}

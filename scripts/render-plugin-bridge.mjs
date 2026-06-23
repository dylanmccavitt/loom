#!/usr/bin/env node
// Cross-harness plugin-bridge renderer (LOO-8 slice 2).
//
// Reuses the slice-1 render-to-write executor (scripts/render-harness-nucleus.mjs) verbatim for the
// safety gate, marker manifest, and create-missing-only apply engine. This script only adds a new
// candidate source: the tracked loom-nucleus plugin templates under docs/harness/plugin-bridge/.
//
//   (default) dry-run  — render the plugin/marketplace/skill/agent/hook templates into an ephemeral
//                        temp dir, gate the rendered bytes, and print a deterministic candidate
//                        manifest. Zero writes to any live path.
//   --write            — strict-manual apply. Refuses unless the dry-run render + gate pass clean,
//                        then applies create-missing-only against the live HOME and records the
//                        ~/.loom-harness/applied-manifest.json marker. Idempotent: a second run is a
//                        clean no-op. Appliable writes only ever land on safe ~/ targets (the personal
//                        marketplace ~/.agents/plugins/marketplace.json and the co-located loom-nucleus
//                        plugin source); the gate rejects any cache/local-only/dangerous destination.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyCandidates,
  loadMarker,
  markerPath,
  renderAndGate,
  resolveHomeRoot,
  saveMarkerIfChanged,
} from "./render-harness-nucleus.mjs";
import {
  asArray,
  globPatternToRegex,
  isPatternPath,
  normalizePathText,
  pathMatchesLocalOnly,
} from "./lib/harness-safety.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

export const DEFAULTS = {
  plan: "docs/harness/plugin-bridge/plan.json",
  manifest: "docs/harness/resource-manifest.json",
  bridgeDir: "docs/harness/plugin-bridge",
};

const APPROVAL_POLICY =
  "strict-manual (dry-run rendered diff, dangerous-key validation, live-file backup, marker-tracked create-missing-only)";

const USAGE = [
  "Usage: node scripts/render-plugin-bridge.mjs [options]",
  "  --write                 apply appliable candidates (strict-manual, create-missing-only)",
  "  --json                  emit a machine-readable manifest instead of text",
  "  --home <dir>            resolve ~ live destinations under <dir> (default: $HOME)",
  "  --plan <path>           plugin-bridge plan json",
  "  --manifest <path>       resource manifest json",
  "  --bridge-dir <path>     directory holding the plugin-bridge templates",
  "  -h, --help              show this help",
].join("\n");

export function readArgs(argv) {
  const options = {
    write: false,
    json: false,
    home: null,
    plan: DEFAULTS.plan,
    manifest: DEFAULTS.manifest,
    bridgeDir: DEFAULTS.bridgeDir,
  };
  const valueFlags = new Map([
    ["--home", "home"],
    ["--plan", "plan"],
    ["--manifest", "manifest"],
    ["--bridge-dir", "bridgeDir"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      console.log(USAGE);
      process.exit(0);
    }
    if (arg === "--write") {
      options.write = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    const key = valueFlags.get(arg);
    if (!key) throw new Error(`Unknown option: ${arg}`);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) throw new Error(`${arg} requires a value`);
    options[key] = next;
    index += 1;
  }
  return options;
}

function repoPath(relative) {
  return path.isAbsolute(relative) ? relative : path.join(REPO_ROOT, relative);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

// Local-only destination patterns drawn from the resource manifest (the source of truth for ownership).
export function localOnlyPatterns(manifest) {
  const patterns = new Set();
  for (const resource of manifest.resources ?? []) {
    if (resource.disposition === "local-only") {
      for (const livePath of asArray(resource.currentLivePath)) patterns.add(livePath);
    }
  }
  return [...patterns].sort();
}

// Faithful mirror of render-harness-nucleus.resolveDisposition (which is not exported): local-only
// first, then the first non-local-only manifest resource for the disposition harness whose
// home-anchored currentLivePath prefix/glob-matches the destination, then a reference-only fallback.
export function resolveDisposition(destination, dispositionHarness, manifest, localOnly) {
  if (pathMatchesLocalOnly(destination, localOnly)) return "local-only";
  const normalized = normalizePathText(destination);
  for (const resource of manifest.resources ?? []) {
    if (dispositionHarness && resource.sourceHarness !== dispositionHarness) continue;
    if (resource.disposition === "local-only") continue;
    for (const livePath of asArray(resource.currentLivePath)) {
      if (typeof livePath !== "string" || livePath.startsWith("repo:")) continue;
      const pattern = normalizePathText(livePath);
      if (!pattern) continue;
      if (isPatternPath(pattern)) {
        if (globPatternToRegex(pattern).test(normalized)) return resource.disposition;
      } else {
        const base = pattern.replace(/\/$/u, "");
        if (normalized === base || normalized.startsWith(`${base}/`)) return resource.disposition;
      }
    }
  }
  return "reference-only";
}

export function buildPluginCandidates(plan, manifest, options) {
  const bridgeDir = repoPath(options.bridgeDir ?? DEFAULTS.bridgeDir);
  const localOnly = localOnlyPatterns(manifest);
  const candidates = [];

  for (const template of plan.templates ?? []) {
    const source = path.join(bridgeDir, template.template);
    const content = readFileSync(source, "utf8");
    const disposition = resolveDisposition(template.destination, template.dispositionHarness, manifest, localOnly);
    // Appliable = a tracked/adapted disposition AND a home-anchored destination. Project-scoped
    // catalogs (the repo Claude marketplace) are rendered + gated + reported, never written to HOME.
    const appliable =
      (disposition === "track" || disposition === "adapt") && template.destination.startsWith("~/");
    candidates.push({
      id: `${template.dispositionHarness}:${template.id}:${template.destination}`,
      harness: template.dispositionHarness,
      kind: template.kind,
      consumedBy: template.consumedBy,
      boundaryId: null,
      forbiddenKeys: template.forbiddenKeys ?? [],
      source: path.relative(REPO_ROOT, source),
      content,
      renderedRelPath: path.join("plugin-bridge", template.template),
      destination: template.destination,
      disposition,
      operation: "create-file",
      appliable,
    });
  }

  candidates.sort((left, right) => {
    if (left.destination !== right.destination) return left.destination.localeCompare(right.destination);
    return left.renderedRelPath.localeCompare(right.renderedRelPath);
  });
  return { candidates, localOnly };
}

// Refuses unless a clean preflight + render + gate, then applies create-missing-only and records the
// marker. Reuses the engine's renderAndGate + applyCandidates + saveMarkerIfChanged verbatim.
export function gateAndApply(candidates, localOnly, homeRoot, marker) {
  const findings = renderAndGate(candidates, localOnly);
  if (findings.length > 0) {
    return { refused: true, findings, actions: [], backups: [], markerChanged: false };
  }
  const { actions, backups } = applyCandidates(candidates, homeRoot, marker);
  const markerChanged = saveMarkerIfChanged(homeRoot, marker);
  return { refused: false, findings: [], actions, backups, markerChanged };
}

function buildManifest(plan, candidates, localOnly, mode) {
  const reported = candidates.map((candidate) => ({
    id: candidate.id,
    kind: candidate.kind,
    consumedBy: candidate.consumedBy,
    harness: candidate.harness,
    source: candidate.source,
    destination: candidate.destination,
    disposition: candidate.disposition,
    appliable: candidate.appliable,
  }));
  return {
    mode,
    approvalPolicy: "strict-manual",
    plugin: plan.pluginName,
    pluginVersion: plan.pluginVersion,
    renderedFiles: candidates.length,
    candidates: reported,
    skippedLocalOnly: localOnly,
    counts: {
      rendered: candidates.length,
      appliable: reported.filter((entry) => entry.appliable).length,
      reported: reported.filter((entry) => !entry.appliable).length,
    },
  };
}

function printTextManifest(manifest, findings) {
  const lines = [];
  lines.push("Plugin-bridge renderer");
  lines.push(`Mode: ${manifest.mode}`);
  lines.push(`Plugin: ${manifest.plugin}@${manifest.pluginVersion}`);
  lines.push(`Approval policy: ${APPROVAL_POLICY}`);
  lines.push(`Rendered files: ${manifest.renderedFiles} (temp only; no live path written in dry-run)`);
  lines.push("");
  lines.push("[appliable candidates] (track/adapt + home-anchored; eligible for --write create-missing-only)");
  for (const entry of manifest.candidates.filter((candidate) => candidate.appliable)) {
    lines.push(`- ${entry.destination}`);
    lines.push(`  kind: ${entry.kind} (consumedBy: ${entry.consumedBy})`);
    lines.push(`  source: ${entry.source}`);
    lines.push(`  disposition: ${entry.disposition}`);
  }
  lines.push("");
  lines.push("[reported candidates] (reference-only/project-scoped; rendered + validated, never written to HOME)");
  for (const entry of manifest.candidates.filter((candidate) => !candidate.appliable)) {
    lines.push(`- ${entry.destination}`);
    lines.push(`  kind: ${entry.kind} (consumedBy: ${entry.consumedBy})`);
    lines.push(`  disposition: ${entry.disposition}`);
  }
  lines.push("");
  lines.push("[skipped local-only surfaces] (never rendered as write targets)");
  for (const pattern of manifest.skippedLocalOnly) lines.push(`- ${pattern}`);
  lines.push("");
  if (findings.length > 0) {
    lines.push("[safety findings]");
    for (const finding of findings) lines.push(`- ${finding}`);
    lines.push("");
    lines.push("Result: failed");
  } else {
    lines.push("Result: passed");
  }
  return lines.join("\n");
}

function runDryRun(plan, candidates, localOnly, options) {
  const findings = renderAndGate(candidates, localOnly);
  const manifest = buildManifest(plan, candidates, localOnly, "dry-run");
  if (options.json) {
    console.log(JSON.stringify({ ...manifest, result: findings.length === 0 ? "pass" : "fail", findings }, null, 2));
  } else {
    console.log(printTextManifest(manifest, findings));
  }
  return findings.length === 0 ? 0 : 1;
}

function runWrite(plan, candidates, localOnly, options, homeRoot, marker) {
  const { refused, findings, actions, backups, markerChanged } = gateAndApply(candidates, localOnly, homeRoot, marker);
  if (refused) {
    if (options.json) {
      console.log(JSON.stringify({ mode: "write", result: "fail", refused: true, findings }, null, 2));
    } else {
      console.error("Refusing to write: dry-run safety gate failed:");
      for (const finding of findings) console.error(`- ${finding}`);
    }
    return 1;
  }
  if (options.json) {
    console.log(
      JSON.stringify(
        { mode: "write", result: "pass", approvalPolicy: "strict-manual", actions, backups, markerManifest: markerPath(homeRoot), markerChanged },
        null,
        2,
      ),
    );
  } else {
    const lines = ["Plugin-bridge renderer", "Mode: write", `Approval policy: ${APPROVAL_POLICY}`, "", "[write actions]"];
    for (const action of actions) {
      const suffix = action.backup ? ` (backup ${path.basename(action.backup)})` : action.reason ? ` (${action.reason})` : "";
      lines.push(`- ${action.action}: ${action.destination}${suffix}`);
    }
    lines.push("");
    lines.push("[backups]");
    if (backups.length === 0) lines.push("- none");
    for (const backup of backups) lines.push(`- ${backup}`);
    lines.push("");
    lines.push(`Marker manifest: ${markerPath(homeRoot)}${markerChanged ? "" : " (unchanged)"}`);
    lines.push("Result: passed");
    console.log(lines.join("\n"));
  }
  return 0;
}

function main() {
  const options = readArgs(process.argv.slice(2));
  const plan = readJson(repoPath(options.plan));
  const manifest = readJson(repoPath(options.manifest));
  const { candidates, localOnly } = buildPluginCandidates(plan, manifest, options);
  if (!options.write) return runDryRun(plan, candidates, localOnly, options);
  const homeRoot = resolveHomeRoot(options);
  const marker = loadMarker(homeRoot);
  return runWrite(plan, candidates, localOnly, options, homeRoot, marker);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(error.message);
    console.error(USAGE);
    process.exit(2);
  }
}

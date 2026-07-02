#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const CHECKS = [
  ["skills", ["node", "scripts/validate-skills.mjs"]],
  ["manifest", ["node", "scripts/validate-harness-manifest.mjs"]],
  ["factory-docs", ["node", "scripts/validate-factory-nucleus-docs.mjs"]],
  ["harness-gate", ["node", "scripts/dry-run-harness-safety-gate.mjs"]],
  ["plugin-bridge", ["node", "scripts/render-plugin-bridge.mjs"]],
];

function run(command, args) {
  return spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function git(args) {
  return run("git", args);
}

function line(label, value) {
  return `${label.padEnd(18)} ${value}`;
}

function statusSummary() {
  const status = git(["status", "--short", "--branch"]);
  if (status.status !== 0) return { ok: false, text: "git unavailable" };
  const lines = status.stdout.trim().split("\n").filter(Boolean);
  const branch = lines[0] || "unknown";
  const dirty = lines.slice(1);
  return { ok: dirty.length === 0, text: `${branch}; ${dirty.length} dirty path(s)` };
}

function trackerHint() {
  const result = run("node", ["scripts/factory-nucleus/factory.mjs", "choose-tracker", "--json"]);
  if (result.status !== 0) return "picker unavailable";
  const picker = JSON.parse(result.stdout);
  const github = picker.options.find((option) => option.provider === "github");
  return github?.detectedRepo ? `unbound; picker available; github repo detected ${github.detectedRepo}` : "unbound; picker available";
}

function envPresence() {
  const names = ["LOO_LIVE_SMOKE", "LOO_LIVE_LINEAR_TEAM", "LOO_LIVE_LINEAR_PROJECT", "LINEAR_API_KEY", "LOO_LIVE_GITHUB_REPO", "GITHUB_TOKEN"];
  return names.map((name) => `${name}=${process.env[name] ? "set" : "unset"}`).join(", ");
}

const OMP_LINKS = ["config.yml", "AGENTS.md", "RULES.md", "extensions"];

function ompLinkHealth() {
  const agentDir = path.join(os.homedir(), ".omp", "agent");
  const problems = [];
  for (const name of OMP_LINKS) {
    const live = path.join(agentDir, name);
    let stat;
    try {
      stat = lstatSync(live);
    } catch {
      problems.push(`${name}: missing`);
      continue;
    }
    if (!stat.isSymbolicLink()) continue; // plain file/dir is a valid non-symlink setup
    const target = path.resolve(agentDir, readlinkSync(live));
    if (!existsSync(target)) {
      problems.push(`${name}: dangling -> ${target}`);
    } else if (!target.includes(path.join("loom", "adapters", "omp", "source"))) {
      problems.push(`${name}: stale target -> ${target}`);
    }
  }
  return { ok: problems.length === 0, text: problems.length === 0 ? "all links resolve" : problems.join("; ") };
}

export function main() {
  const root = process.cwd();
  process.stdout.write("Loom doctor\n");
  process.stdout.write(`${line("repo", root)}\n`);
  const gitStatus = statusSummary();
  process.stdout.write(`${line("git", gitStatus.text)}\n`);
  process.stdout.write(`${line("tracker", trackerHint())}\n`);
  process.stdout.write(`${line("install-marker", existsSync(path.join(os.homedir(), ".loom-harness", "applied-manifest.json")) ? "present" : "missing")}\n`);
  process.stdout.write(`${line("live-smoke-env", envPresence())}\n`);
  const ompLinks = ompLinkHealth();
  process.stdout.write(`${line("omp-links", ompLinks.text)}\n`);
  process.stdout.write("\nChecks:\n");

  let failed = 0;
  for (const [name, [command, ...args]] of CHECKS) {
    const result = run(command, args);
    const ok = result.status === 0;
    if (!ok) failed += 1;
    process.stdout.write(`- ${name}: ${ok ? "ok" : "failed"}\n`);
    if (!ok) {
      const output = `${result.stderr}${result.stdout}`.trim().split("\n").slice(-8).join("\n");
      if (output) process.stdout.write(`${output}\n`);
    }
  }

  if (!ompLinks.ok) failed += 1;
  if (failed > 0 || !gitStatus.ok) process.exitCode = failed > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

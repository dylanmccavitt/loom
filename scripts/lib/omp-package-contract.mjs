// Contract seam for the @oh-my-pi/pi-coding-agent package's INTERNAL source layout.
//
// Everything the snapshot refresh scrapes from inside the installed package lives here:
// the package name, the internal source paths, and the registry marker. Upstream owes us
// none of this — any omp refactor can move these files, so a miss must fail loudly with
// what to re-verify instead of silently producing an empty snapshot.
//
// Observed upstream version: omp/16.0.5 (@oh-my-pi/pi-coding-agent 16.0.5).

import { existsSync } from "node:fs";
import path from "node:path";

export const OMP_PACKAGE_CONTRACT_VERSION = "omp/16.0.5";

export const PACKAGE_NAME = "@oh-my-pi/pi-coding-agent";

// Internal source files/roots the refresh scrapes, relative to the package root.
export const PACKAGE_LAYOUT = {
  commandRegistry: "src/slash-commands/builtin-registry.ts",
  availableCommands: "src/slash-commands/available-commands.ts",
  acpBuiltins: "src/slash-commands/acp-builtins.ts",
  promptsRoot: "src/prompts",
  builtinRulesRoot: "src/discovery/builtin-rules",
};

// Marker preceding the builtin slash-command array inside `commandRegistry`.
export const COMMAND_REGISTRY_MARKER = "const BUILTIN_SLASH_COMMAND_REGISTRY";

export function contractStaleError(missing) {
  return new Error(
    [
      `omp package contract may be stale (observed ${OMP_PACKAGE_CONTRACT_VERSION}; installed layout differs).`,
      `Missing inside the installed ${PACKAGE_NAME} package:`,
      ...missing.map(item => `  - ${item}`),
      "Re-verify scripts/lib/omp-package-contract.mjs against the installed package source",
      "(paths in PACKAGE_LAYOUT and the COMMAND_REGISTRY_MARKER), then update the contract.",
    ].join("\n"),
  );
}

// Assert every contract path exists under `packageRoot`; throw the actionable stale error
// listing each miss. Returns absolute paths keyed like PACKAGE_LAYOUT for the happy path.
export function assertPackageLayout(packageRoot) {
  const resolved = {};
  const missing = [];
  for (const [key, relative] of Object.entries(PACKAGE_LAYOUT)) {
    const absolute = path.join(packageRoot, relative);
    if (existsSync(absolute)) {
      resolved[key] = absolute;
    } else {
      missing.push(relative);
    }
  }
  if (missing.length > 0) throw contractStaleError(missing);
  return resolved;
}

// Locate the registry marker in the registry source; a miss is a contract miss, not a
// generic parse error.
export function assertRegistryMarker(registrySource) {
  if (!registrySource.includes(COMMAND_REGISTRY_MARKER)) {
    throw contractStaleError([`marker "${COMMAND_REGISTRY_MARKER}" in ${PACKAGE_LAYOUT.commandRegistry}`]);
  }
}

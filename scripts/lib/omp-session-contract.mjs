// Contract seam for the OMP session-file layout on disk.
//
// The runtime adapter derives session identity from FILENAMES + stat only (local-only
// boundary; contents are excludedRuntimeState). The naming scheme is an omp internal —
// upstream can change it — so the layout literal and regex live here, and an explicit
// session_file that does not match fails with an actionable "contract may be stale" error.
//
// Observed upstream version: omp/16.0.5.
// Layout: ~/.omp/agent/sessions/<sanitized-cwd>/<ISO-timestamp>_<UUIDv7>.jsonl

import { homedir } from "node:os";
import path from "node:path";

export const OMP_SESSION_CONTRACT_VERSION = "omp/16.0.5";

export const SESSION_LAYOUT = "~/.omp/agent/sessions/<sanitized-cwd>/<ISO-timestamp>_<UUIDv7>.jsonl";

export const SESSION_FILENAME = /^(.+)_([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.jsonl$/u;

export function defaultSessionsDir() {
  return path.join(process.env.HOME ?? homedir(), ".omp", "agent", "sessions");
}

// Parse `<timestamp>_<uuid>.jsonl`; null when the name is not a session file (normal while
// listing — directories mix in non-session files).
export function parseSessionFilename(name) {
  const match = SESSION_FILENAME.exec(name);
  if (!match) return null;
  return { timestamp: match[1], sessionId: match[2].toLowerCase() };
}

export function sessionContractStaleError(name) {
  return new Error(
    [
      `omp session contract may be stale (observed ${OMP_SESSION_CONTRACT_VERSION}).`,
      `"${name}" does not match the expected session layout ${SESSION_LAYOUT}.`,
      "Re-verify scripts/lib/omp-session-contract.mjs (SESSION_FILENAME and SESSION_LAYOUT)",
      "against the installed omp's session directory, then update the contract.",
    ].join("\n"),
  );
}

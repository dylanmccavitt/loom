// Policy / tier registry for the OMP runtime control adapter (LOO-7).
//
// Every adapter operation is declared here with its blast-radius tier and how it reaches OMP.
// The registry is the single source of truth for the deny-by-default allow-list and the
// tier → confirmation mapping. An operation that is not in this registry is refused; an
// operation flagged `denied` is refused unless the caller supplies an explicit approved path.
//
// Tiers (from docs/harness/omp-runtime-adapter-contract.md §4):
//   R — read-only inspection. Derived metadata only, no mutation, no content egress.
//   M — safe metadata / benign runtime update. Reversible, no data loss, no egress.
//   D — destructive or runtime-changing, or any content egress.
//
// Backends:
//   rpc:<command>  → newline-delimited JSON command to a spawned `omp --mode rpc` child.
//   fs:true        → resolved locally from the sessions directory (filenames/metadata only).
//   cli:<verb>     → the `omp` CLI for saved-file ops (supplementary).
//   unsupported    → no verified backend in omp/16.0.5; the adapter returns not_implemented.

export const TIERS = Object.freeze({ R: "R", M: "M", D: "D" });

// Confirmation requirement per situation:
//   none            — Tier R.
//   token           — Tier M (selector-bound lightweight token).
//   token+approval  — Tier D (selector-bound token + explicit human approval).
//   explicit        — denied set (token + approval + explicit override).
export const CONFIRMATION = Object.freeze({
  NONE: "none",
  TOKEN: "token",
  TOKEN_APPROVAL: "token+approval",
  EXPLICIT: "explicit",
});

// Operation registry. Keys are the adapter's stable op names (the MCP envelope `op`).
export const OPS = Object.freeze({
  // --- Tier R: read-only inspection (metadata only) ---
  "session.get": { tier: "R", rpc: "get_state", metadataOnly: true, summary: "Session metadata for the selected session." },
  "session.stats": { tier: "R", rpc: "get_session_stats", metadataOnly: true, summary: "Context accounting numbers (counts only)." },
  "session.list": { tier: "R", fs: true, metadataOnly: true, summary: "List sessions for a cwd (ids/names/timestamps; never contents)." },

  // --- Tier M: safe, reversible metadata update ---
  "session.rename": { tier: "M", rpc: "set_session_name", summary: "Rename the selected session (header metadata; reversible)." },

  // --- Tier D: destructive / runtime-changing ---
  "model.set": { tier: "D", rpc: "set_model", summary: "Change the model for the selected session." },
  "session.compact": { tier: "D", rpc: "compact", summary: "Compact the conversation context (irreversible)." },
  "session.branch": { tier: "D", rpc: "branch", summary: "Branch the session from a selected message." },
  "session.new": { tier: "D", rpc: "new_session", summary: "Start a new session." },
  "session.switch": { tier: "D", rpc: "switch_session", summary: "Switch the active session." },
  "session.move": { tier: "D", unsupported: true, summary: "Relocate the session file. No verified RPC command in omp/16.0.5." },

  // --- Denied by default: content egress + auth mutation ---
  "transcript.get": { tier: "D", rpc: "get_messages", egress: true, denied: true, summary: "Raw transcript egress." },
  "transcript.export": { tier: "D", cli: "export", egress: true, denied: true, summary: "Export the live session transcript." },
  "transcript.share": { tier: "D", egress: true, denied: true, summary: "Create a share link from the transcript." },
  "auth.login": { tier: "D", rpc: "login", denied: true, summary: "Provider OAuth login." },
  "auth.logout": { tier: "D", denied: true, summary: "Mutate provider auth state." },
  "debug.dumpRequest": { tier: "D", egress: true, denied: true, summary: "Dump the next provider request." },
});

export function getOp(name) {
  return Object.prototype.hasOwnProperty.call(OPS, name) ? OPS[name] : null;
}

export function isDenied(def) {
  return Boolean(def?.denied);
}

// The confirmation level an operation requires, given the registry. Denied ops escalate to
// `explicit`; Tier D → token+approval; Tier M → token; Tier R → none.
export function confirmationFor(def) {
  if (!def) return CONFIRMATION.EXPLICIT;
  if (def.denied) return CONFIRMATION.EXPLICIT;
  if (def.tier === "D") return CONFIRMATION.TOKEN_APPROVAL;
  if (def.tier === "M") return CONFIRMATION.TOKEN;
  return CONFIRMATION.NONE;
}

// Snapshot of the registry for tools/list discovery and tests (no behavior, just shape).
export function describeOps() {
  return Object.entries(OPS)
    .map(([name, def]) => ({
      op: name,
      tier: def.tier,
      confirmation: confirmationFor(def),
      denied: Boolean(def.denied),
      egress: Boolean(def.egress),
      backend: def.rpc ? `rpc:${def.rpc}` : def.fs ? "fs" : def.cli ? `cli:${def.cli}` : "unsupported",
      summary: def.summary,
    }))
    .sort((a, b) => a.op.localeCompare(b.op));
}

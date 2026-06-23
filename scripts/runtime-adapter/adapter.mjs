// Command-envelope handler for the OMP runtime control adapter (LOO-7).
//
// One typed entrypoint — `handle(envelope)` — enforces, in order:
//   1. deny-by-default: unknown op or `denied` op is refused.
//   2. mandatory session selector (no implicit "current" session); refuse zero/ambiguous.
//   3. tier → confirmation mapping: R none; M selector-bound token; D token + approval; denied
//      needs an explicit approved override.
//   4. dispatch: fs (list) / rpc (live, via a spawned `omp --mode rpc` host) / unsupported.
//   5. egress safety: Tier R returns derived metadata only; all returned strings are scrubbed
//      of secret-looking values and absolute private home paths.
//
// The adapter is transport-agnostic; server.mjs wraps it as an MCP tool.

import { createHash, randomBytes } from "node:crypto";
import {
  PRIVATE_HOME_PATH_PATTERN,
  SECRET_PATTERNS,
} from "../lib/harness-safety.mjs";
import { CONFIRMATION, confirmationFor, getOp } from "./policy.mjs";
import { defaultSessionsDir, listSessions, resolveSelector } from "./selectors.mjs";

const CONTENT_KEYS = new Set(["messages", "transcript", "content", "text", "entries", "history", "body", "prompt"]);

function scrubString(value) {
  let out = value;
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(out)) return "[redacted:secret]";
  }
  out = out.replace(new RegExp(PRIVATE_HOME_PATH_PATTERN, "gu"), "[redacted:home-path]");
  return out;
}

// Recursively scrub secret-looking strings / private home paths from any returned value.
function scrubSecrets(value) {
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map(scrubSecrets);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) out[key] = scrubSecrets(val);
    return out;
  }
  return value;
}

// Tier R projection: keep scalar metadata; drop content-bearing keys and large/array bodies.
function projectMetadata(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return { count: value.length };
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (CONTENT_KEYS.has(key)) {
      // Collapse only actual content (arrays/objects/strings); a scalar count/flag is metadata.
      if (Array.isArray(val)) out[`${key}_count`] = val.length;
      else if (typeof val === "string") out[`${key}_chars`] = val.length;
      else if (val && typeof val === "object") out[`${key}_count`] = Object.keys(val).length;
      else out[key] = val;
      continue;
    }
    if (val === null || ["string", "number", "boolean"].includes(typeof val)) {
      out[key] = val;
    } else if (Array.isArray(val)) {
      out[`${key}_count`] = val.length;
    } else if (typeof val === "object") {
      out[key] = projectMetadata(val);
    }
  }
  return out;
}

export class RuntimeAdapter {
  constructor(options = {}) {
    this.sessionsDir = options.sessionsDir ?? defaultSessionsDir();
    // Factory returning a started RPC host bound to a resolved session. Injected in tests.
    this.makeRpcHost = options.makeRpcHost ?? null;
    // Per-instance nonce makes confirmation tokens unguessable and non-replayable across runs.
    this.nonce = options.nonce ?? randomBytes(16).toString("hex");
  }

  mintToken(op, sessionId) {
    return createHash("sha256").update(`${op}:${sessionId}:${this.nonce}`).digest("hex").slice(0, 32);
  }

  verifyToken(op, sessionId, token) {
    return typeof token === "string" && token === this.mintToken(op, sessionId);
  }

  async handle(envelope = {}) {
    const op = envelope.op;
    const def = getOp(op);

    // 1. deny-by-default
    if (!def) {
      return { status: "refused", error: "unknown_op", message: `Operation "${op}" is not in the allow-list.` };
    }

    // session.list is the discovery primitive — it produces selectors, so it is selector-exempt.
    if (def.fs) {
      const sessions = listSessions(this.sessionsDir).map((s) => ({ sessionId: s.sessionId, timestamp: s.timestamp, bytes: s.bytes }));
      return { status: "ok", op, tier: def.tier, result: scrubSecrets({ sessions }) };
    }

    // 2. mandatory selector
    const resolved = resolveSelector(envelope.selector ?? {}, { sessionsDir: this.sessionsDir });
    if (!resolved.ok) {
      return { status: "refused", error: resolved.error, message: resolved.message, candidates: resolved.candidates };
    }
    const sessionId = resolved.sessionId;

    // 3. tier → confirmation
    const need = confirmationFor(def);
    const tokenOk = this.verifyToken(op, sessionId, envelope.confirmationToken);
    if (need === CONFIRMATION.EXPLICIT) {
      if (!(envelope.explicitApproval === true && envelope.approved === true && tokenOk)) {
        return {
          status: "refused",
          error: "denied_by_default",
          message: `"${op}" egresses content or mutates auth and is denied by default; requires explicitApproval + approved + a valid confirmationToken.`,
          tier: def.tier,
          confirmationToken: this.mintToken(op, sessionId),
        };
      }
    } else if (need === CONFIRMATION.TOKEN_APPROVAL) {
      if (!tokenOk) {
        return { status: "confirmation_required", op, tier: def.tier, session: { sessionId }, confirmationToken: this.mintToken(op, sessionId), needs: "token+approval" };
      }
      if (envelope.approved !== true) {
        return { status: "approval_required", op, tier: def.tier, session: { sessionId }, message: "Tier D requires explicit human approval (approved:true)." };
      }
    } else if (need === CONFIRMATION.TOKEN) {
      if (!tokenOk) {
        return { status: "confirmation_required", op, tier: def.tier, session: { sessionId }, confirmationToken: this.mintToken(op, sessionId), needs: "token" };
      }
    }

    // 4. dispatch
    if (def.unsupported || (!def.rpc && !def.fs)) {
      return { status: "not_implemented", op, tier: def.tier, message: def.summary ?? "No verified backend in omp/16.0.5." };
    }
    if (!this.makeRpcHost) {
      return { status: "unavailable", op, tier: def.tier, message: "No RPC host factory configured (set makeRpcHost)." };
    }

    let host;
    try {
      host = await this.makeRpcHost({ sessionFile: resolved.sessionFile, sessionId });
      const raw = await host.request(def.rpc, envelope.params ?? {});
      // 5. egress safety
      const shaped = def.metadataOnly ? projectMetadata(raw) : raw;
      return { status: "ok", op, tier: def.tier, session: { sessionId }, result: scrubSecrets(shaped) };
    } catch (error) {
      return { status: "error", op, tier: def.tier, session: { sessionId }, error: scrubString(String(error?.message ?? error)) };
    } finally {
      try {
        await host?.close();
      } catch {
        // ignore
      }
    }
  }
}

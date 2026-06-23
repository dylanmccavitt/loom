#!/usr/bin/env node
// Mock `omp --mode rpc` for hermetic LOO-7 tests. Conforms to scripts/runtime-adapter/rpc-host.mjs:
// emits one {type:"ready"} frame, then answers {id,command,params} with {id,result} or {id,error}.
// Intentionally returns a secret-looking string and a /Users/ path so the adapter's redaction is
// exercised. (tests/ is outside the safety-gate source-scan scope.)

import { createInterface } from "node:readline";

process.stdout.write(`${JSON.stringify({ type: "ready" })}\n`);

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }
  const { id, command, params = {} } = message;
  const reply = (result) => process.stdout.write(`${JSON.stringify({ id, result })}\n`);
  const fail = (error) => process.stdout.write(`${JSON.stringify({ id, error })}\n`);

  switch (command) {
    case "get_state":
      return reply({
        sessionId: params.sessionId ?? "mock",
        name: "Mock Session",
        model: "pi/default",
        cwd: "/Users/dev/project",
        note: "token = ABCDEFGHIJKLMNOP1234567890",
        messages: [{ role: "user" }, { role: "assistant" }],
      });
    case "get_session_stats":
      return reply({ messages: 12, tokens: 3456, contextUsedPct: 42 });
    case "set_session_name":
      return reply({ ok: true, name: params.name });
    case "set_model":
      return reply({ ok: true, model: params.model });
    case "compact":
      return reply({ ok: true });
    case "branch":
      return reply({ ok: true, branchedFrom: params.entryId ?? null });
    case "new_session":
      return reply({ ok: true, sessionId: "new-session" });
    case "switch_session":
      return reply({ ok: true });
    case "get_messages":
      return reply({ messages: [{ role: "user", content: "raw transcript" }] });
    default:
      return fail("unknown_command");
  }
});

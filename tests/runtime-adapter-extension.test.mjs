import assert from "node:assert/strict";
import { test } from "node:test";

import ompRuntimeExtension, { OMP_VERSION_PIN } from "../scripts/runtime-adapter/extension.mjs";

// A fake `pi` (ExtensionAPI) recorder. It captures every registration the factory performs so the
// tests can replay the recorded handlers in isolation — no omp, no network, no spawned child, no
// live session. This mirrors how OMP's loader would call the default factory, minus the runtime.
function makeFakePi() {
  const events = new Map(); // event name -> handler
  const commands = new Map(); // command name -> { description, handler }
  const labels = [];
  return {
    on(event, handler) {
      events.set(event, handler);
    },
    registerCommand(name, def) {
      commands.set(name, def);
    },
    setLabel(label) {
      labels.push(label);
    },
    // Recorder accessors (not part of the real ExtensionAPI).
    _events: events,
    _commands: commands,
    _labels: labels,
  };
}

// A minimal handler context for the command replay; only the fields benignMetadata() reads.
function makeFakeCtx(overrides = {}) {
  const notes = [];
  return {
    cwd: "/work/project",
    model: { id: "pi/default" },
    isIdle: () => true,
    hasPendingMessages: () => false,
    ui: { notify: (message, level) => notes.push({ message, level }) },
    _notes: notes,
    ...overrides,
  };
}

test("factory registers exactly the supplementary surface (tool_call guard + runtime-info command)", () => {
  const pi = makeFakePi();
  ompRuntimeExtension(pi);

  assert.ok(pi._events.has("tool_call"), "registers a tool_call handler");
  assert.equal(typeof pi._events.get("tool_call"), "function");

  assert.ok(pi._commands.has("runtime-info"), "registers the runtime-info command");
  const cmd = pi._commands.get("runtime-info");
  assert.equal(typeof cmd.handler, "function");
  assert.match(cmd.description, /read-only/i);

  assert.deepEqual(pi._labels, ["Runtime Adapter (supplementary)"], "sets a single label");

  // It is supplementary: it must NOT try to be a control plane (no extra events/commands).
  assert.equal(pi._events.size, 1, "only the tool_call event is registered");
  assert.equal(pi._commands.size, 1, "only the runtime-info command is registered");
});

test("tool_call guard blocks recursive force-delete with a reason", async () => {
  const pi = makeFakePi();
  ompRuntimeExtension(pi);
  const guard = pi._events.get("tool_call");

  const blocked = await guard({ toolName: "bash", input: { command: "rm -rf /" } });
  assert.equal(blocked.block, true);
  assert.match(blocked.reason, /runtime-adapter/);
  assert.match(blocked.reason, /recursive force-delete/i);

  // Flag-order and long-form variants are caught too.
  for (const command of ["rm -fr ~/data", "rm -r -f ./build", "rm --recursive --force /tmp/x"]) {
    const res = await guard({ toolName: "bash", input: { command } });
    assert.equal(res?.block, true, `should block: ${command}`);
  }
});

test("tool_call guard blocks raw block-device writes", async () => {
  const pi = makeFakePi();
  ompRuntimeExtension(pi);
  const guard = pi._events.get("tool_call");

  for (const command of ["dd if=/dev/zero of=/dev/disk2", "mkfs.ext4 /dev/sda1", "echo x > /dev/sda"]) {
    const res = await guard({ toolName: "bash", input: { command } });
    assert.equal(res?.block, true, `should block: ${command}`);
    assert.match(res.reason, /runtime-adapter/);
  }
});

test("tool_call guard allows safe commands and ignores non-bash / malformed events", async () => {
  const pi = makeFakePi();
  ompRuntimeExtension(pi);
  const guard = pi._events.get("tool_call");

  // Safe bash commands → allow (undefined, never an accidental block).
  for (const command of ["ls -la", "git status", "rm file.txt", "rm -i note.txt", "rmdir empty/"]) {
    const res = await guard({ toolName: "bash", input: { command } });
    assert.equal(res, undefined, `should allow: ${command}`);
  }

  // Conservative / fail-closed: the guard substring-matches (like the documented
  // `command.includes("rm -rf")` example), so it intentionally blocks even a benign command that
  // merely mentions the pattern. Blocking a false positive is acceptable; allowing a real
  // recursive delete is not. Shell-parsing to distinguish quoted text is deliberately out of scope.
  const mentioned = await guard({ toolName: "bash", input: { command: "echo 'rm -rf is just text'" } });
  assert.equal(mentioned?.block, true, "conservatively blocks commands that contain the pattern");

  // Non-bash tools and malformed inputs are passed through untouched (fail-open for unknowns).
  assert.equal(await guard({ toolName: "read", input: { command: "rm -rf /" } }), undefined);
  assert.equal(await guard({ toolName: "bash", input: {} }), undefined);
  assert.equal(await guard({ toolName: "bash" }), undefined);
  assert.equal(await guard(null), undefined);
});

test("runtime-info command returns and notifies benign read-only metadata", async () => {
  const pi = makeFakePi();
  ompRuntimeExtension(pi);
  const { handler } = pi._commands.get("runtime-info");
  const ctx = makeFakeCtx();

  const meta = await handler([], ctx);

  assert.deepEqual(meta, {
    label: "Runtime Adapter (supplementary)",
    ompVersionPin: OMP_VERSION_PIN,
    cwd: "/work/project",
    model: "pi/default",
    idle: true,
    pendingMessages: false,
  });

  // It pins the omp version explicitly (the API is consolidating; see LOO-1).
  assert.equal(meta.ompVersionPin, "omp/16.0.5");

  // It surfaces metadata via a UI notification, never raw transcript/secrets.
  assert.equal(ctx._notes.length, 1);
  assert.equal(ctx._notes[0].level, "info");
  assert.match(ctx._notes[0].message, /omp\/16\.0\.5/);

  // No content-egress fields leak through (deny-by-default stance of the adapter).
  for (const forbidden of ["messages", "transcript", "token", "auth", "apiKey"]) {
    assert.equal(forbidden in meta, false, `metadata must not expose ${forbidden}`);
  }
});

test("runtime-info command is defensive against a partial context", async () => {
  const pi = makeFakePi();
  ompRuntimeExtension(pi);
  const { handler } = pi._commands.get("runtime-info");

  // Empty ctx (no ui, no accessors) must not throw and must degrade to null fields.
  const meta = await handler([], {});
  assert.equal(meta.cwd, null);
  assert.equal(meta.model, null);
  assert.equal(meta.idle, null);
  assert.equal(meta.pendingMessages, null);
  assert.equal(meta.ompVersionPin, OMP_VERSION_PIN);

  // A string-typed model (some omp builds) is normalized through.
  const ctx = makeFakeCtx({ model: "anthropic/claude", ui: undefined });
  const meta2 = await handler([], ctx);
  assert.equal(meta2.model, "anthropic/claude");
});

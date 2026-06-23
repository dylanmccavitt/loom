// Minimal MCP stdio server exposing the OMP runtime adapter as a single tool (LOO-7).
//
// Dependency-free: newline-delimited JSON-RPC 2.0 over stdio (the MCP stdio transport shape).
// Handles `initialize`, `tools/list`, `tools/call`. The one tool, `omp_runtime`, forwards its
// arguments to RuntimeAdapter.handle, which owns selector/tier/deny-by-default/redaction policy.

import { createInterface } from "node:readline";
import { OPS } from "./policy.mjs";
import { RuntimeAdapter } from "./adapter.mjs";
import { RpcHost } from "./rpc-host.mjs";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "omp-runtime-adapter", version: "0.1.0" };

const TOOL = {
  name: "omp_runtime",
  description:
    "Control an OMP session via the runtime adapter. Deny-by-default, mandatory session selector, tiered (R/M/D) with selector-bound confirmation. Live ops drive a spawned `omp --mode rpc`.",
  inputSchema: {
    type: "object",
    properties: {
      op: { type: "string", enum: Object.keys(OPS).sort(), description: "Operation name." },
      selector: {
        type: "object",
        description: "Exactly one of session_id (UUIDv7 prefix) or session_file (.jsonl path). Omit for session.list.",
        properties: { session_id: { type: "string" }, session_file: { type: "string" } },
      },
      params: { type: "object", description: "Operation parameters passed to the RPC command." },
      confirmationToken: { type: "string", description: "Selector-bound token for Tier M/D ops." },
      approved: { type: "boolean", description: "Explicit human approval for Tier D ops." },
      explicitApproval: { type: "boolean", description: "Explicit override for denied-by-default ops." },
    },
    required: ["op"],
  },
};

function ok(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function fail(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export function createServer(options = {}) {
  const adapter =
    options.adapter ??
    new RuntimeAdapter({
      sessionsDir: options.sessionsDir,
      makeRpcHost:
        options.makeRpcHost ??
        (async ({ sessionFile }) => {
          const host = new RpcHost({ args: ["--mode", "rpc", "--resume", sessionFile] });
          await host.start();
          return host;
        }),
    });

  async function handleMessage(message) {
    if (!message || message.jsonrpc !== "2.0") return null;
    switch (message.method) {
      case "initialize":
        return ok(message.id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO });
      case "notifications/initialized":
        return null; // notification — no response
      case "tools/list":
        return ok(message.id, { tools: [TOOL] });
      case "tools/call": {
        const { name, arguments: args } = message.params ?? {};
        if (name !== TOOL.name) return fail(message.id, -32602, `unknown tool: ${name}`);
        const result = await adapter.handle(args ?? {});
        const isError = result.status === "error" || result.status === "refused" || result.status === "unavailable";
        return ok(message.id, { content: [{ type: "text", text: JSON.stringify(result) }], isError, structuredContent: result });
      }
      default:
        return message.id === undefined ? null : fail(message.id, -32601, `method not found: ${message.method}`);
    }
  }

  return { handleMessage, adapter, tool: TOOL };
}

export function runStdio(server = createServer()) {
  const rl = createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let message;
    try {
      message = JSON.parse(trimmed);
    } catch {
      return;
    }
    const response = await server.handleMessage(message);
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStdio();
}

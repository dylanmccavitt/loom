// RPC host for the OMP runtime control adapter (LOO-7).
//
// Spawns and OWNS an `omp --mode rpc` child process and speaks newline-delimited JSON over
// stdio. There is no attach-to-running-TUI and no control port (LOO-7 spike, omp://rpc.md).
//
// Wire shape used here: requests are `{id, command, params}`; the child emits a `{type:"ready"}`
// frame once, then responses `{id, result}` / `{id, error}`, plus unsolicited event frames.
// NOTE: the exact omp RPC field names (command vs type, response envelope, id correlation) must
// be reconciled against the real protocol in the live-omp integration sub-issue; the mock used
// by the tests conforms to this shape, so this module's machinery (ready-wait, correlation,
// timeouts, exit handling) is what gets exercised.

import { spawn as nodeSpawn } from "node:child_process";
import { createInterface } from "node:readline";

export class RpcHost {
  constructor(options = {}) {
    this.command = options.command ?? "omp";
    this.args = options.args ?? ["--mode", "rpc"];
    this.cwd = options.cwd;
    this.env = options.env;
    this.spawnFn = options.spawnFn ?? nodeSpawn;
    this.readyTimeoutMs = options.readyTimeoutMs ?? 10000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 15000;
    this.child = null;
    this.rl = null;
    this.nextId = 1;
    this.pending = new Map();
    this.ready = false;
    this.closed = false;
    this.events = [];
  }

  start() {
    return new Promise((resolve, reject) => {
      let settled = false;
      let child;
      try {
        child = this.spawnFn(this.command, this.args, {
          cwd: this.cwd,
          env: this.env,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (error) {
        reject(error);
        return;
      }
      this.child = child;

      const readyTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.terminate();
        reject(new Error(`omp --mode rpc did not signal ready within ${this.readyTimeoutMs}ms`));
      }, this.readyTimeoutMs);

      child.on("error", (error) => {
        if (settled) {
          this._failAll(error);
          return;
        }
        settled = true;
        clearTimeout(readyTimer);
        reject(error);
      });

      child.on("exit", (code) => {
        this.closed = true;
        this._failAll(new Error(`omp --mode rpc exited (code ${code})`));
      });

      this.rl = createInterface({ input: child.stdout });
      this.rl.on("line", (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let frame;
        try {
          frame = JSON.parse(trimmed);
        } catch {
          return; // ignore non-JSON noise on stdout
        }
        if (frame.type === "ready") {
          this.ready = true;
          if (!settled) {
            settled = true;
            clearTimeout(readyTimer);
            resolve(this);
          }
          return;
        }
        if (frame.id !== undefined && this.pending.has(frame.id)) {
          const { resolve: resolveReq, reject: rejectReq, timer } = this.pending.get(frame.id);
          this.pending.delete(frame.id);
          clearTimeout(timer);
          if (frame.error !== undefined && frame.error !== null) {
            rejectReq(new Error(typeof frame.error === "string" ? frame.error : JSON.stringify(frame.error)));
          } else {
            resolveReq(frame.result ?? frame);
          }
          return;
        }
        this.events.push(frame);
      });
    });
  }

  request(command, params = {}, options = {}) {
    if (this.closed) return Promise.reject(new Error("rpc host is closed"));
    if (!this.ready) return Promise.reject(new Error("rpc host is not ready"));
    const id = this.nextId;
    this.nextId += 1;
    const timeoutMs = options.timeoutMs ?? this.requestTimeoutMs;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`rpc request "${command}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ id, command, params })}\n`);
    });
  }

  _failAll(error) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
  }

  terminate() {
    try {
      this.rl?.close();
    } catch {
      // ignore
    }
    try {
      this.child?.kill();
    } catch {
      // ignore
    }
    this.closed = true;
  }

  async close() {
    this.terminate();
  }
}

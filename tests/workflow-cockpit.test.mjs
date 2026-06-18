import assert from "node:assert/strict";
import { test } from "node:test";
import workflowCockpit, {
  WorkflowCockpitPanel,
  cockpitOverlayOptions,
  gatherCockpitData,
  inferIssueNumber,
  isVerificationCommand,
  parseRepoSlug,
} from "../omp/.omp/agent/extensions/workflow-cockpit.js";

const GO_PROMPT = "Proceed with the current plan. Do not ask unless blocked by missing external information. Preserve unrelated changes. Use subagents for parallelizable work. Verify before yielding.";
const SHIP_PROMPT = "Finish the active issue end-to-end. Check acceptance criteria, implement missing work, verify behavior, and prepare closeout evidence. Ask only if the active issue or target repository is unknown.";

// Fully populated repo: every provider returns a real value via pi.exec.
const POPULATED = [
  ["gh repo view", { stdout: JSON.stringify({ nameWithOwner: "DylanMcCavitt/oh-my-pi-config" }) }],
  ["git branch --show-current", { stdout: "issue-22-native-cockpit" }],
  ["git rev-parse --show-toplevel", { stdout: "/Users/dylan/oh-my-pi-config" }],
  ["git status --porcelain", { stdout: " M omp/.omp/agent/extensions/workflow-cockpit.js\n M tests/workflow-cockpit.test.mjs" }],
  ["gh issue list", { stdout: JSON.stringify([{ number: 22, title: "Rebuild workflow cockpit", state: "OPEN", url: "https://x/22" }]) }],
  ["gh issue view 22", { stdout: JSON.stringify({ number: 22, title: "Rebuild workflow cockpit", state: "OPEN" }) }],
];

// Maps `<command> <args...>` prefixes to canned ExecResult values; anything
// unmatched fails with code 1, mirroring a command that is unavailable.
function repoExec(table = []) {
  return async (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    for (const [prefix, response] of table) {
      if (key.startsWith(prefix)) {
        return { stdout: response.stdout ?? "", stderr: response.stderr ?? "", code: response.code ?? 0, killed: false };
      }
    }
    return { stdout: "", stderr: "command unavailable", code: 1, killed: false };
  };
}

function install(options = {}) {
  const commands = new Map();
  const labels = [];
  const handlers = new Map();
  const execCalls = [];
  const exec = options.exec ?? repoExec();
  const pi = {
    setLabel(label) {
      labels.push(label);
    },
    registerCommand(name, command) {
      commands.set(name, command);
    },
    on(event, handler) {
      handlers.set(event, handler);
    },
    async exec(command, args, opts) {
      execCalls.push({ command, args, options: opts });
      return exec(command, args, opts);
    },
  };
  workflowCockpit(pi);
  return {
    commands,
    labels,
    execCalls,
    emit(event, payload) {
      return handlers.get(event)?.(payload);
    },
  };
}

// Documented ExtensionCommandContext shape: cwd, mode, hasUI, ui, getContextUsage.
function context(overrides = {}) {
  const widgets = [];
  const notifications = [];
  const customCalls = [];
  const renderRequests = [];
  const theme = {
    fg(_token, text) {
      return text;
    },
  };
  const ui = {
    async setWidget(key, lines, options) {
      widgets.push({ key, lines, options });
    },
    notify(message, level) {
      notifications.push({ message, level });
    },
    custom(factory, options) {
      const tui = {
        requestRender() {
          renderRequests.push("render");
        },
      };
      const call = { options, component: undefined, result: undefined, handle: undefined };
      customCalls.push(call);
      const promise = new Promise((resolve) => {
        const done = (result) => {
          call.result = result;
          resolve(result);
        };
        call.component = factory(tui, theme, undefined, done);
        options?.onHandle?.({
          focus() {
            call.focused = true;
          },
          hide() {
            call.hidden = true;
          },
        });
      });
      return promise;
    },
  };

  return {
    ctx: {
      cwd: "/Users/dylan/oh-my-pi-config",
      mode: "tui",
      hasUI: true,
      ui,
      getContextUsage: () => undefined,
      ...overrides,
    },
    widgets,
    notifications,
    customCalls,
    renderRequests,
  };
}

function panelSections(extraRows = []) {
  return [
    { title: "Repository", rows: ["repo: owner/repo", "branch: issue-22", "worktree: /repo"] },
    { title: "Issue state", rows: ["active issue: 22", "open issues: #22 Rebuild cockpit"] },
    { title: "Working context", rows: ["touched-file count: 2", "last verification: node --test", ...extraRows] },
  ];
}

function plainTheme() {
  return {
    fg(_token, text) {
      return text;
    },
  };
}

test("workflow cockpit registers visible commands", () => {
  const { commands, labels } = install();
  assert.deepEqual(labels, ["Workflow Cockpit"]);
  for (const command of ["ctx", "route", "new-thread", "spawn-recipe", "diff", "go", "ship"]) {
    assert.ok(commands.has(command), `${command} command missing`);
  }
});

test("provider helpers parse repo slugs, issue numbers, and verification commands", () => {
  assert.equal(parseRepoSlug("git@github.com:DylanMcCavitt/oh-my-pi-config.git"), "DylanMcCavitt/oh-my-pi-config");
  assert.equal(parseRepoSlug("https://github.com/DylanMcCavitt/oh-my-pi-config"), "DylanMcCavitt/oh-my-pi-config");
  assert.equal(inferIssueNumber("issue-22-native-cockpit"), 22);
  assert.equal(inferIssueNumber("main", "issue_19_split"), 19);
  assert.equal(inferIssueNumber("release/1.0"), undefined);
  assert.ok(isVerificationCommand("node --test tests/workflow-cockpit.test.mjs"));
  assert.ok(isVerificationCommand("node scripts/validate-skills.mjs"));
  assert.ok(!isVerificationCommand("git status"));
});

test("/ctx derives cockpit data from documented command-context providers", async () => {
  const { commands } = install({ exec: repoExec(POPULATED) });
  const state = context({ getContextUsage: () => ({ tokens: 102400, contextWindow: 128000, percent: 80 }) });

  const lines = await commands.get("ctx").handler("", state.ctx);
  assert.equal(state.widgets[0].key, "workflow-cockpit");
  assert.equal(state.widgets[0].lines, undefined);
  assert.equal(state.customCalls.length, 1);
  assert.equal(state.customCalls[0].options.overlay, true);
  assert.equal(typeof state.customCalls[0].options.overlayOptions, "function");
  assert.equal(state.customCalls[0].focused, true);

  const rendered = state.customCalls[0].component.render(58).join("\n");
  assert.match(rendered, /Workflow Cockpit/u);
  assert.match(rendered, /repo: DylanMcCavitt\/oh-my-pi-config/u);
  assert.match(rendered, /branch: issue-22-native-cockpit/u);
  assert.match(rendered, /worktree: \/Users\/dylan\/oh-my-pi-config/u);
  assert.match(rendered, /active issue: #22 Rebuild workflow cockpit · open/u);
  assert.match(rendered, /#22 Rebuild workflow cockpit · open/u);
  assert.match(rendered, /touched-file count: 2/u);
  assert.match(rendered, /context usage 80%/u);
  assert.match(rendered, /active agents: not exposed by OMP API/u);
  assert.match(rendered, /Esc close/u);

  // Returned fallback lines mirror the same provider-backed data.
  assert.match(lines.join("\n"), /repo: DylanMcCavitt\/oh-my-pi-config/u);
  assert.match(lines.join("\n"), /active issue: #22 Rebuild workflow cockpit/u);

  state.customCalls[0].component.handleInput("\u001b");
  await Promise.resolve();
});

test("/ctx renders every issue-22 row without unknown when providers return data", async () => {
  const { commands, emit } = install({ exec: repoExec(POPULATED) });
  emit("tool_result", { toolName: "bash", input: { command: "node --test tests/workflow-cockpit.test.mjs" }, isError: false });
  const state = context({ hasUI: false });

  const lines = await commands.get("ctx").handler("", state.ctx);
  const text = lines.join("\n");
  for (const row of ["repo:", "active issue:", "branch:", "worktree:", "touched-file count:", "last verification:", "active agents:", "context-risk flags:"]) {
    assert.match(text, new RegExp(row, "u"), `missing row ${row}`);
  }
  assert.match(text, /last verification: node --test tests\/workflow-cockpit\.test\.mjs · \d+s ago/u);
  assert.doesNotMatch(text, /unknown/u);
  assert.doesNotMatch(text, /no verification recorded/u);
});

test("/ctx ignores ad-hoc ctx fields and reads only documented providers", async () => {
  // Providers all fail (no git/gh). Ad-hoc fields the old code trusted are present
  // but must never surface — this fails if rendering falls back to ctx.* fields.
  const { commands } = install({ exec: repoExec([]) });
  const state = context({
    hasUI: false,
    git: { currentBranch: "issue-99-phantom", touchedFiles: ["a", "b", "c"] },
    activeIssue: 99,
    openIssues: [{ number: 99, title: "phantom issue", state: "open" }],
    lastVerification: "phantom verify",
    contextRiskFlags: ["phantom flag"],
  });

  const text = (await commands.get("ctx").handler("", state.ctx)).join("\n");
  assert.doesNotMatch(text, /issue-99-phantom/u);
  assert.doesNotMatch(text, /phantom/u);
  assert.doesNotMatch(text, /99/u);
  assert.match(text, /branch: unavailable \(not a git repo\)/u);
  assert.match(text, /active issue: none detected from branch\/worktree/u);
});

test("/ctx reports unavailable data explicitly when providers return nothing", async () => {
  const { commands } = install({ exec: repoExec([]) });
  const state = context({ hasUI: false });

  const text = (await commands.get("ctx").handler("", state.ctx)).join("\n");
  assert.match(text, /branch: unavailable \(not a git repo\)/u);
  assert.match(text, /touched-file count: unavailable \(not a git repo\)/u);
  assert.match(text, /active agents: not exposed by OMP API/u);
  assert.match(text, /last verification: none recorded this session/u);
  assert.doesNotMatch(text, /unknown/u);
});

test("gatherCockpitData surfaces last verification from bash tool_result events", async () => {
  let last;
  const providers = {
    repo: async () => "owner/repo",
    branch: async () => "issue-22-x",
    worktree: async () => "/repo",
    touchedCount: async () => 0,
    openIssues: async () => [],
    validateIssue: async () => ({ number: 22, title: "Rebuild", state: "OPEN" }),
    lastVerification: () => last,
  };
  const ctx = { cwd: "/repo", getContextUsage: () => undefined };

  let data = await gatherCockpitData(ctx, providers);
  assert.match(data.lastVerification, /none recorded this session/u);
  assert.ok(data.riskFlags.includes("no verification recorded"));

  last = { command: "npm run lint", at: Date.now() };
  data = await gatherCockpitData(ctx, providers);
  assert.match(data.lastVerification, /npm run lint · \d+s ago/u);
  assert.ok(!data.riskFlags.includes("no verification recorded"));
});

test("/ctx command returns immediately after opening overlay", async () => {
  const { commands } = install({ exec: repoExec(POPULATED) });
  const state = context();

  const lines = await commands.get("ctx").handler("", state.ctx);
  assert.equal(state.customCalls.length, 1);
  assert.match(lines.join("\n"), /repo: DylanMcCavitt\/oh-my-pi-config/u);
  assert.equal(state.customCalls[0].result, undefined);

  state.customCalls[0].component.handleInput("\u001b[27u");
  await Promise.resolve();
  assert.equal(state.customCalls[0].result, "closed");
});

test("/ctx renders fallback context without throwing outside TUI", async () => {
  const { commands } = install({ exec: repoExec(POPULATED) });
  const state = context({ hasUI: false });
  const lines = await commands.get("ctx").handler("", state.ctx);
  assert.equal(state.widgets.at(-1).key, "workflow-cockpit");
  assert.deepEqual(state.widgets.at(-1).options, { placement: "belowEditor" });
  assert.match(lines.join("\n"), /repo: DylanMcCavitt\/oh-my-pi-config/u);
  assert.match(lines.join("\n"), /branch: issue-22-native-cockpit/u);
  assert.match(lines.join("\n"), /touched-file count: 2/u);
  assert.equal(state.notifications.at(-1).message, "Workflow context shown");
});

test("workflow cockpit panel renders narrow terminal fallback", () => {
  const panel = new WorkflowCockpitPanel(panelSections(), plainTheme(), () => {});
  const lines = panel.render(24);
  assert.match(lines.join("\n"), /Terminal too narrow/u);
  assert.match(lines.join("\n"), /Esc close/u);
  for (const line of lines) assert.ok(line.length <= 24, line);
});

test("workflow cockpit panel scrolls and closes from keyboard input", () => {
  const extraRows = Array.from({ length: 20 }, (_value, index) => `extra row ${index}`);
  let closedWith;
  let renders = 0;
  const panel = new WorkflowCockpitPanel(panelSections(extraRows), plainTheme(), (result) => {
    closedWith = result;
  }, () => {
    renders += 1;
  });

  assert.doesNotMatch(panel.render(60).join("\n"), /extra row 19/u);
  panel.handleInput("end");
  assert.equal(renders, 1);
  assert.match(panel.render(60).join("\n"), /extra row 19/u);
  panel.handleInput("up");
  assert.equal(renders, 2);
  panel.handleInput("\u001b");
  assert.equal(closedWith, "closed");
});

test("/ctx replaces an active cockpit instead of stacking overlays", async () => {
  const { commands } = install({ exec: repoExec(POPULATED) });
  const state = context();
  const first = commands.get("ctx").handler("", state.ctx);
  await first;
  assert.equal(state.customCalls.length, 1);
  const firstCall = state.customCalls[0];

  const second = commands.get("ctx").handler("", state.ctx);
  await second;
  assert.equal(firstCall.result, "replaced");
  assert.equal(firstCall.hidden, true);
  assert.equal(state.customCalls.length, 2);

  state.customCalls[1].component.handleInput("escape");
  await Promise.resolve();
});

test("cockpit overlay options use a responsive native overlay surface", () => {
  const options = cockpitOverlayOptions();
  assert.match(["center", "right-center"].join(" "), new RegExp(options.anchor, "u"));
  assert.ok(options.width);
  assert.ok(options.maxHeight);
});

test("/route prefers existing specialized skills", async () => {
  const { commands } = install();
  const state = context();
  const lines = await commands.get("route").handler("debug this failing test", state.ctx);
  assert.match(lines.join("\n"), /Recommended: diagnose/u);
  assert.match(lines.join("\n"), /diagnose/u);
  assert.equal(state.widgets.at(-1).key, "workflow-cockpit");
  assert.equal(state.notifications.at(-1).message, "Route: diagnose");
});

test("/new-thread references handoff and does not write it", async () => {
  const exec = repoExec([
    ["git branch --show-current", { stdout: "issue-7-workflow" }],
    ["git rev-parse --show-toplevel", { stdout: "/repo" }],
  ]);
  const { commands } = install({ exec });
  const state = context();
  const lines = await commands.get("new-thread").handler("", state.ctx);
  assert.match(lines.join("\n"), /handoff skill/u);
  assert.match(lines.join("\n"), /resume #7/u);
  assert.equal(state.widgets.length, 1);
});

test("/spawn-recipe displays agent-recipes patterns", async () => {
  const { commands } = install();
  const state = context();
  const lines = await commands.get("spawn-recipe").handler("parallel implementation", state.ctx);
  assert.match(lines.join("\n"), /Parallel implementation recipe/u);
  assert.match(lines.join("\n"), /Role: Scoped implementation specialist/u);
  assert.equal(state.notifications.at(-1).message, "Spawn recipe shown");
});

test("invalid command args produce visible errors without throwing", async () => {
  const { commands } = install();
  const state = context();
  const route = await commands.get("route").handler("", state.ctx);
  const recipe = await commands.get("spawn-recipe").handler("unknown niche", state.ctx);
  assert.deepEqual(route, []);
  assert.deepEqual(recipe, []);
  assert.deepEqual(state.notifications.map((entry) => entry.level), ["error", "error"]);
});

test("/go displays the exact execute-plan prompt", async () => {
  const { commands } = install();
  const state = context();
  const lines = await commands.get("go").handler("", state.ctx);
  assert.deepEqual(lines, [GO_PROMPT]);
  assert.equal(state.widgets.at(-1).lines[0], GO_PROMPT);
});

test("/ship requires an active issue inferred from the branch", async () => {
  const exec = repoExec([
    ["git branch --show-current", { stdout: "main" }],
    ["git rev-parse --show-toplevel", { stdout: "/Users/dylan/oh-my-pi-config" }],
  ]);
  const { commands } = install({ exec });
  const state = context();
  const lines = await commands.get("ship").handler("", state.ctx);
  assert.deepEqual(lines, []);
  assert.equal(state.notifications.at(-1).message, "Active issue is unknown; set or provide one before /ship.");
});

test("/ship displays the exact issue-autopilot prompt with an active issue", async () => {
  const exec = repoExec([
    ["git branch --show-current", { stdout: "issue-8-payments" }],
    ["git rev-parse --show-toplevel", { stdout: "/repo" }],
  ]);
  const { commands } = install({ exec });
  const state = context();
  const lines = await commands.get("ship").handler("", state.ctx);
  assert.deepEqual(lines, [SHIP_PROMPT]);
  assert.equal(state.widgets.at(-1).lines[0], SHIP_PROMPT);
});

test("/go runs no shell and /ship issues only read-only git/gh commands", async () => {
  const exec = repoExec([
    ["git branch --show-current", { stdout: "issue-8-payments" }],
    ["git rev-parse --show-toplevel", { stdout: "/repo" }],
  ]);
  const { commands, execCalls } = install({ exec });
  const state = context();

  await commands.get("go").handler("", state.ctx);
  assert.equal(execCalls.length, 0, "/go must not run shell commands");

  await commands.get("ship").handler("", state.ctx);
  const mutation = /\b(?:push|commit|checkout|switch|reset|rebase|merge|stash)\b|gh\s+(?:issue|pr)\s+(?:create|edit|close|comment|reopen|merge)/u;
  for (const { command, args } of execCalls) {
    const key = `${command} ${args.join(" ")}`;
    assert.doesNotMatch(key, mutation, `unexpected mutating command: ${key}`);
  }
});

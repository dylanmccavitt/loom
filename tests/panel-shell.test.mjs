import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closeActivePanel,
  createPanelShell,
  panelFallbackLines,
  presentPanel,
  resolvePanelPrimitives,
} from "../omp/.omp/agent/extensions/panel-shell.js";

// Identity theme so accent()/dim styling is a no-op and assertions can match the
// literal text the shell threads through the native block options.
const theme = { fg: (_token, text) => text };

// Stub of the native `ScrollView`: a fixed-height window over `lines` with an
// offset clamped to [0, max] and the same `handleScrollKey(data)` seam the real
// component exposes. Mirrors the canonical CSI sequences used by the extensions.
class StubScrollView {
  constructor(lines, options = {}) {
    this.lines = [...lines];
    this.height = Math.max(0, Math.trunc(options.height ?? this.lines.length));
    this.offset = 0;
  }

  maxOffset() {
    return Math.max(0, this.lines.length - this.height);
  }

  clamp() {
    this.offset = Math.max(0, Math.min(this.offset, this.maxOffset()));
  }

  getScrollOffset() {
    return this.offset;
  }

  getMaxScrollOffset() {
    return this.maxOffset();
  }

  scrollBy(delta) {
    this.offset += delta;
    this.clamp();
  }

  handleScrollKey(data) {
    switch (data) {
      case "\u001b[A":
        this.scrollBy(-1);
        return true;
      case "\u001b[B":
        this.scrollBy(1);
        return true;
      case "\u001b[5~":
        this.scrollBy(-this.height);
        return true;
      case "\u001b[6~":
        this.scrollBy(this.height);
        return true;
      case "\u001b[H":
        this.offset = 0;
        return true;
      case "\u001b[F":
        this.offset = this.maxOffset();
        return true;
      default:
        return false;
    }
  }

  render() {
    if (this.height === 0) return [];
    this.clamp();
    const out = [];
    for (let row = 0; row < this.height; row += 1) out.push(this.lines[this.offset + row] ?? "");
    return out;
  }

  setLines(lines) {
    this.lines = [...lines];
    this.clamp();
  }

  setHeight(height) {
    this.height = Math.max(0, Math.trunc(height));
    this.clamp();
  }

  setScrollOffset(offset) {
    this.offset = Number.isFinite(offset) ? Math.trunc(offset) : 0;
    this.clamp();
  }
}

// Stub of the native `framedBlock`: calls `build(width)` and flattens the
// resulting block (header + headerMeta, labelled sections, lines) into the
// `readonly string[]` the Component contract returns.
function stubFramedBlock(_theme, build) {
  return {
    render(width) {
      const opts = build(width);
      const lines = [];
      if (opts.header) lines.push(`[${opts.header}${opts.headerMeta ? ` ${opts.headerMeta}` : ""}]`);
      for (const section of opts.sections ?? []) {
        if (section.label) lines.push(`<<${section.label}>>`);
        for (const line of section.lines ?? []) lines.push(line);
      }
      return lines;
    },
    invalidate() {},
  };
}

function deps() {
  return { framedBlock: stubFramedBlock, renderOutputBlock: () => [], ScrollView: StubScrollView };
}

function manyLines(count, prefix = "row") {
  return Array.from({ length: count }, (_value, index) => `${prefix} ${index + 1}`);
}

test("createPanelShell frames a title and renders every section label and its lines", () => {
  const shell = createPanelShell(deps(), {
    title: "Context",
    theme,
    sections: [
      { label: "Repo", lines: ["branch: main", "clean"] },
      { label: "Issue", lines: ["#24 panel shell"] },
    ],
    height: 20,
  });

  const lines = shell.render(60);
  const text = lines.join("\n");

  assert.ok(Array.isArray(lines));
  assert.ok(lines.some((line) => line.includes("Context")), "title in frame header");
  for (const expected of ["Repo", "branch: main", "clean", "Issue", "#24 panel shell"]) {
    assert.ok(text.includes(expected), `section content present: ${expected}`);
  }
});

test("createPanelShell scrolls the body within bounds via ScrollView", () => {
  const shell = createPanelShell(deps(), {
    title: "Scroll",
    theme,
    sections: [{ label: "Lines", lines: manyLines(12) }],
    height: 8,
  });
  const view = shell.scrollView;

  assert.ok(view.getMaxScrollOffset() > 0, "content overflows the viewport");
  assert.equal(view.getScrollOffset(), 0);

  // Clamped at the top: an "up" at offset 0 stays at 0.
  shell.handleInput("\u001b[A");
  assert.equal(view.getScrollOffset(), 0);

  // "down" increases, "up" decreases.
  shell.handleInput("\u001b[B");
  assert.equal(view.getScrollOffset(), 1);
  shell.handleInput("\u001b[B");
  assert.equal(view.getScrollOffset(), 2);
  shell.handleInput("\u001b[A");
  assert.equal(view.getScrollOffset(), 1);

  // Clamped at the bottom: never past the max offset.
  for (let i = 0; i < 50; i += 1) shell.handleInput("\u001b[B");
  assert.equal(view.getScrollOffset(), view.getMaxScrollOffset());
});

test("createPanelShell routes scroll keys (incl. vim/space aliases) to the body", () => {
  const shell = createPanelShell(deps(), {
    title: "Keys",
    theme,
    sections: [{ label: "Body", lines: manyLines(12) }],
    height: 8,
  });
  const view = shell.scrollView;

  shell.handleInput("j");
  assert.equal(view.getScrollOffset(), 1, "j scrolls down");
  shell.handleInput("k");
  assert.equal(view.getScrollOffset(), 0, "k scrolls up");
  shell.handleInput("G");
  assert.equal(view.getScrollOffset(), view.getMaxScrollOffset(), "G jumps to end");
  shell.handleInput("g");
  assert.equal(view.getScrollOffset(), 0, "g jumps to top");
  shell.handleInput(" ");
  assert.ok(view.getScrollOffset() > 0, "space pages down");
});

test("createPanelShell closes on Esc and Ctrl-C without scrolling", () => {
  for (const closeKey of ["\u001b", "\u0003"]) {
    const results = [];
    const shell = createPanelShell(deps(), {
      title: "Close",
      theme,
      sections: [{ label: "Body", lines: manyLines(12) }],
      height: 8,
      done: (result) => results.push(result),
    });

    const before = shell.scrollView.getScrollOffset();
    shell.handleInput(closeKey);
    assert.deepEqual(results, ["closed"], `close key ${JSON.stringify(closeKey)} -> done("closed")`);
    assert.equal(shell.scrollView.getScrollOffset(), before, "close key does not scroll");

    // After close, further input is inert (no second done() call).
    shell.handleInput("\u001b[B");
    assert.deepEqual(results, ["closed"]);
  }
});

test("createPanelShell renders short content without dead padding artifacts", () => {
  const shell = createPanelShell(deps(), {
    title: "Short",
    theme,
    sections: [
      { label: "A", lines: ["one"] },
      { label: "B", lines: ["two"] },
    ],
    height: 20,
  });

  const lines = shell.render(40);
  const text = lines.join("\n");

  // ScrollView is sized exactly to the body: no padded filler rows, no scrollbar.
  assert.equal(shell.bodyHeight, shell.body.length);
  assert.ok(shell.scrollView.getMaxScrollOffset() === 0, "fits without scrolling");
  assert.equal(shell.scrollView.render(38).length, shell.body.length);

  // No scroll-position indicator when everything is visible.
  assert.ok(!/\d+-\d+\/\d+/u.test(text), "no scroll meta for short content");
});

test("createPanelShell shows a scroll position indicator when content overflows", () => {
  const shell = createPanelShell(deps(), {
    title: "Tall",
    theme,
    sections: [{ label: "Lines", lines: manyLines(40) }],
    height: 8,
  });

  const lines = shell.render(40);
  assert.ok(lines.some((line) => /\d+-\d+\/\d+/u.test(line)), "scroll meta present for tall content");
});

test("panelFallbackLines flattens title and labelled sections to plain text", () => {
  const out = panelFallbackLines({
    title: "Fallback",
    sections: [
      { label: "Repo", lines: ["main"] },
      { label: "Issue", lines: ["#24", "open"] },
    ],
  });

  assert.deepEqual(out, ["Fallback", "Repo", "main", "", "Issue", "#24", "open"]);
});

test("presentPanel falls back to ui.setWidget when ui.custom is unavailable", async () => {
  const widgets = [];
  const sections = [
    { label: "Repo", lines: ["main"] },
    { label: "Issue", lines: ["#24"] },
  ];
  const ctx = {
    hasUI: false,
    ui: {
      async setWidget(lines, options) {
        widgets.push({ lines, options });
      },
    },
  };

  const result = await presentPanel(ctx, { title: "Fallback", sections });

  assert.equal(result, "setWidget");
  assert.equal(widgets.length, 1);
  assert.equal(widgets[0].options.placement, "belowEditor");
  assert.deepEqual(widgets[0].lines, panelFallbackLines({ title: "Fallback", sections }));
  for (const expected of ["Fallback", "Repo", "main", "Issue", "#24"]) {
    assert.ok(widgets[0].lines.includes(expected), `fallback line present: ${expected}`);
  }
});

test("presentPanel degrades to setWidget when native primitives cannot resolve", async () => {
  // Under plain node the @oh-my-pi/* primitives resolve to .ts sources and fail
  // to import, so the presenter must skip ui.custom and use the safe fallback
  // rather than throw or stack a broken overlay.
  const widgets = [];
  let customCalls = 0;
  const ctx = {
    hasUI: true,
    ui: {
      custom() {
        customCalls += 1;
        return Promise.resolve("noop");
      },
      async setWidget(lines, options) {
        widgets.push({ lines, options });
      },
    },
  };

  const result = await presentPanel(ctx, { title: "T", sections: [{ lines: ["x"] }] });

  assert.equal(customCalls, 0, "custom path skipped without primitives");
  assert.equal(result, "setWidget");
  assert.equal(widgets.length, 1);
});

test("presentPanel returns 'none' and never throws without a usable ui", async () => {
  assert.equal(await presentPanel({}, { title: "x", sections: [] }), "none");
  assert.equal(await presentPanel({ ui: {} }, { title: "x", sections: [] }), "none");
  assert.equal(await presentPanel(undefined, { title: "x", sections: [] }), "none");
});

test("closeActivePanel is a safe no-op when nothing is mounted", () => {
  assert.doesNotThrow(() => closeActivePanel({ ui: {} }));
  assert.doesNotThrow(() => closeActivePanel({}));
  assert.doesNotThrow(() => closeActivePanel(undefined));
});

test("createPanelShell lets onInput intercept a key and suppress the default scroll", () => {
  const seen = [];
  const shell = createPanelShell(deps(), {
    title: "Hook",
    theme,
    sections: [{ label: "Body", lines: manyLines(12) }],
    height: 8,
    onInput(data, controller) {
      seen.push(data);
      assert.ok(controller && typeof controller.refresh === "function", "controller passed to onInput");
      return data === "n"; // own the "n" key
    },
  });
  const view = shell.scrollView;

  // Intercepted key: onInput sees it and the default scroll is suppressed.
  shell.handleInput("n");
  assert.equal(view.getScrollOffset(), 0);
  assert.deepEqual(seen, ["n"]);

  // Non-intercepted scroll key: onInput returns false, default scroll runs.
  shell.handleInput("\u001b[B");
  assert.equal(view.getScrollOffset(), 1);
  assert.deepEqual(seen, ["n", "\u001b[B"]);
});

test("createPanelShell onInput can intercept close keys before the default handler", () => {
  let closed = 0;
  const shell = createPanelShell(deps(), {
    title: "Hook",
    theme,
    sections: [{ lines: ["a"] }],
    done: () => {
      closed += 1;
    },
    onInput: (data) => data === "\u001b", // swallow Esc, let everything else fall through
  });

  shell.handleInput("\u001b");
  assert.equal(closed, 0, "Esc suppressed by onInput");

  shell.handleInput("\u0003");
  assert.equal(closed, 1, "Ctrl-C not intercepted -> default close");
});

test("createPanelShell rebuilds a width-aware body on controller.refresh()", () => {
  const files = [
    { label: "fileA", lines: ["a1", "a2"] },
    { label: "fileB", lines: ["b1", "b2", "b3"] },
  ];
  let current = 0;
  const shell = createPanelShell(deps(), {
    title: "Diff",
    theme,
    height: 20,
    sections: (innerWidth) => {
      assert.ok(innerWidth > 0, "section builder receives a positive inner width");
      return [files[current]];
    },
  });

  let text = shell.render(40).join("\n");
  assert.ok(text.includes("fileA") && text.includes("a1") && text.includes("a2"));
  assert.ok(!text.includes("fileB"));

  // Consumer advances state then refreshes -> body recomposes from the builder.
  current = 1;
  shell.controller.refresh();
  text = shell.render(40).join("\n");
  assert.ok(text.includes("fileB") && text.includes("b3"));
  assert.ok(!text.includes("fileA"));
});

test("createPanelShell rebuilds a width-aware body when the render width changes", () => {
  const shell = createPanelShell(deps(), {
    title: "Responsive",
    theme,
    height: 20,
    sections: (innerWidth) => [{ label: "W", lines: [`width=${innerWidth}`] }],
  });

  assert.ok(shell.render(40).join("\n").includes("width=38"), "inner width = outer - 2 borders");
  assert.ok(shell.render(60).join("\n").includes("width=58"), "rebuilds for the new width");
});

test("controller.setSections swaps the section source and rebuilds", () => {
  const shell = createPanelShell(deps(), {
    title: "Swap",
    theme,
    height: 20,
    sections: [{ label: "Old", lines: ["old"] }],
  });
  assert.ok(shell.render(40).join("\n").includes("Old"));

  shell.controller.setSections([{ label: "New", lines: ["new"] }]);
  const text = shell.render(40).join("\n");
  assert.ok(text.includes("New") && text.includes("new"));
  assert.ok(!text.includes("Old"));
});

test("resolvePanelPrimitives resolves to null under plain node (never throws)", async () => {
  const result = await resolvePanelPrimitives();
  assert.equal(result, null);
});

test("presentPanel forwards a width-aware sections function to the fallback widget", async () => {
  const widgets = [];
  const ctx = {
    hasUI: false,
    ui: {
      async setWidget(lines, options) {
        widgets.push({ lines, options });
      },
    },
  };

  const result = await presentPanel(ctx, {
    title: "Fn",
    sections: () => [{ label: "Repo", lines: ["main"] }],
  });

  assert.equal(result, "setWidget");
  assert.equal(widgets.length, 1);
  assert.ok(widgets[0].lines.includes("Repo"));
  assert.ok(widgets[0].lines.includes("main"));
});

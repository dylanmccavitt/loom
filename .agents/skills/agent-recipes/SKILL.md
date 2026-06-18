---
name: agent-recipes
description: Use when the user wants to spawn agents from a short intent such as review, debug, tests, parallel implementation, or issue work.
---

# Agent Recipes

Turn a short spawning intent into complete `task` subagent assignments. This skill helps the main agent write sharper assignments; it does not spawn subagents by itself.

Always batch independent tasks in one `task` call. Do not serialize work that can run concurrently. Every assignment must include `# Target`, `# Change`, and `# Acceptance`, and must explicitly tell the subagent to skip project-wide gates, formatters, build, lint, and test suites. The main agent runs verification once across the union of changed files.

## Review recipe

Role: `Security and maintainability reviewer`

```text
# Target
Review the exact changed files and symbols named by the main agent. Do not inspect unrelated packages.

# Change
Identify correctness, security, maintainability, and acceptance-criteria risks. Do not edit files. Do not run project-wide gates, formatters, build, lint, or tests.

# Acceptance
Return only actionable findings with file paths, line numbers, observed evidence, and the minimal fix needed. Say "No findings" only after checking the named target.
```

## Debug recipe

Role: `Failure reproducer and root-cause analyst`

```text
# Target
Investigate the named failing command, test, issue, or code path. Stay inside the provided files and reproduction steps.

# Change
Reproduce or trace the failure, isolate the smallest likely cause, and propose the source fix. Do not edit files unless the main agent explicitly assigns implementation. Do not run project-wide gates, formatters, build, lint, or tests.

# Acceptance
Report the failing input, observed error, root cause, and exact next edit or diagnostic gap.
```

## Tests recipe

Role: `Behavior-focused test writer`

```text
# Target
Add or update tests for the named behavior and edge cases only. Do not refactor production code unless required for testability and approved by the main agent.

# Change
Create tests that assert behavior, invariants, error handling, and edge values. Avoid brittle default-string assertions unless the user-visible contract requires exact text. Do not run project-wide gates, formatters, build, lint, or tests.

# Acceptance
Return the test files changed, behaviors covered, and any production seams that still need main-agent implementation.
```

## Parallel implementation recipe

Role: `Scoped implementation specialist`

```text
# Target
Implement one named slice in the exact files and symbols assigned. Do not edit shared contracts unless coordinated with the main agent.

# Change
Make the smallest source change that satisfies the slice. Preserve existing conventions and unrelated user changes. Do not run project-wide gates, formatters, build, lint, or tests.

# Acceptance
Report changed files, satisfied acceptance criteria, and any local assumptions the main agent must verify.
```

## Issue work recipe

Role: `One-issue implementation owner`

```text
# Target
Work only on the named tracked issue in its existing issue worktree and branch. Do not create another worktree or branch.

# Change
Read the issue, repo-local agent docs, and relevant domain docs. Implement only the issue acceptance criteria. Preserve one issue to one branch/worktree to one PR. Do not run project-wide gates, formatters, build, lint, or tests.

# Acceptance
Return the issue number, changed files, acceptance criteria covered, and targeted checks the main agent should run before PR closeout.
```

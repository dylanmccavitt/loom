# Automation workflow issue packets

GitHub publication was not attempted because this checkout has no configured GitHub remote or target repository. These packets are saved locally for version-controlled handoff.

## 1. Add automation skill validation for version-controlled skills

**Type:** AFK

### What to build

Add a validation path that checks future automation skills under the version-controlled skill directory before they are installed or relied on.

### Acceptance criteria

- [ ] Every skill directory is exactly one level under `.agents/skills/<name>/SKILL.md` or the chosen repo-local equivalent.
- [ ] Every `SKILL.md` has frontmatter `name` and `description`.
- [ ] Every description contains concrete `Use when ...` trigger language.
- [ ] Validation fails on duplicate skill names, duplicate names that collide with existing global skills such as `handoff`, and API-key/token-looking strings.
- [ ] Validation does not require live network access.

### Non-goals

- Do not install, activate, or rewrite any automation skill as part of this slice.
- Do not require GitHub or any network-backed tracker to run validation.

### Relevant files / areas

- `~/.omp/agent/workflow-kit/README.md` for workflow-kit skill rules.
- `omp/.omp/agent/` for the current repo-local agent configuration tree.
- Existing global skills, especially `handoff`, for collision checks.

### Test / check expectations

- Run the validator against at least one good skill fixture and one bad fixture with missing frontmatter.
- Observe the good fixture pass and the bad fixture fail with a visible error.

### Risks / migration notes

- Keep validation deterministic and offline so it can run in AFK agent worktrees.
- Avoid hard-coding only the current global skill set; make collisions easy to extend as more global skills appear.

### Desired base branch

main

### Blocked by

None - can start immediately

## 2. Add automation routing fixtures that preserve existing skills

**Type:** AFK

### What to build

Add fixture-driven tests that prove new automation routing points to existing specialized skills instead of duplicating or stealing their work.

### Acceptance criteria

- [ ] Input like `tests are failing, debug it` routes to `diagnose`.
- [ ] Input like `start a fresh chat with this context` routes to `thread-control` plus existing `handoff` semantics.
- [ ] Input like `split this PRD into implementation tickets` routes to `to-issues`.
- [ ] Input like `inspect browser bug` routes to `chrome-devtools` or `computer-use` based on browser-vs-desktop wording.
- [ ] Fixtures explicitly assert forbidden routes where a new automation skill would steal work from `handoff`, `diagnose`, `tdd`, `to-issues`, or `to-prd`.

### Non-goals

- Do not implement the new automation skills in this slice.
- Do not change the behavior of existing global skills.

### Relevant files / areas

- Existing global skills: `handoff`, `diagnose`, `tdd`, `to-issues`, `to-prd`, `workflow-kit`, `computer-use`, `chrome-devtools`, and `openai-docs`.
- New automation skills introduced by later issues.
- Any route-selection fixtures or tests added by issue 1.

### Test / check expectations

- Run the routing fixture test.
- Observe all expected route assertions and forbidden route assertions pass.

### Risks / migration notes

- This suite should protect existing specialized skills from overlap as new automation skills are added.
- Keep fixture wording realistic enough to catch accidental trigger drift.

### Desired base branch

main

### Blocked by

- Add automation skill validation for version-controlled skills

## 3. Add thread-control skill as a router to handoff, not a replacement

**Type:** AFK

### What to build

Add a version-controlled `thread-control` skill that decides whether to continue in the current chat or start a new visible thread, then invokes or instructs use of the existing `handoff` skill when switching.

### Acceptance criteria

- [ ] The skill description has this concrete trigger: `Use when the user asks whether to continue in this chat, switch context, start a new thread, resume a handoff, or make context health visible.`
- [ ] The skill never claims to write handoffs itself; it delegates handoff creation to the existing `handoff` skill.
- [ ] The skill defines context-risk signals: many unrelated touched files, changed goal, stale verification, unresolved decisions, active subagents with divergent scope, issue/branch mismatch, and stale file assumptions.
- [ ] The skill emits a visible next-thread starter when switching is recommended.

### Non-goals

- Do not create a duplicate `handoff` skill.
- Do not implement Pi extension commands in this slice.

### Relevant files / areas

- Existing `handoff` skill at `skill://handoff`.
- Project-specific skill location under `.agents/skills/` or the chosen repo-local equivalent.
- Static skill validation from issue 1.

### Test / check expectations

- Static skill validation passes.
- Routing fixture for `start a fresh chat with this context` includes both `thread-control` and `handoff`.

### Risks / migration notes

- Thread switching must remain visible to the user; the skill should not silently discard context.
- Handoff content should stay owned by the existing `handoff` skill to avoid divergent templates.

### Desired base branch

main

### Blocked by

- Add automation skill validation for version-controlled skills

## 4. Add agent-recipes skill for high-quality subagent prompts

**Type:** AFK

### What to build

Add a version-controlled `agent-recipes` skill that turns short intents such as review, debug, tests, parallel implementation, and issue work into complete task-subagent assignments.

### Acceptance criteria

- [ ] The skill description has this concrete trigger: `Use when the user wants to spawn agents from a short intent such as review, debug, tests, parallel implementation, or issue work.`
- [ ] Every recipe includes target, change, acceptance, and explicit no-project-wide-gates instruction for subagents.
- [ ] Recipes are role-specific, not generic cloned workers.
- [ ] The skill tells the main agent to batch independent tasks in one `task` call.

### Non-goals

- Do not spawn subagents from the skill during validation.
- Do not replace the task tool contract or weaken its no-project-wide-gates rule for subagents.

### Relevant files / areas

- Active harness instructions for the `task` tool contract.
- Project-specific skill location under `.agents/skills/` or the chosen repo-local equivalent.
- Static skill validation from issue 1.

### Test / check expectations

- Static skill validation passes.
- Routing fixture for `/spawn review` or `spawn review agents` selects `agent-recipes`.

### Risks / migration notes

- Recipes should create sharper roles and complete assignments without encouraging agents to run project-wide gates.
- Keep examples small enough to maintain while still covering common intents.

### Desired base branch

main

### Blocked by

- Add automation skill validation for version-controlled skills

## 5. Add execute-plan skill for explicit go-ahead automation

**Type:** AFK

### What to build

Add a version-controlled `execute-plan` skill for moments where the user says to proceed with the current plan and stop discussing.

### Acceptance criteria

- [ ] The skill description has this concrete trigger: `Use when the user says go, execute, proceed, ship the current plan, or stop discussing and implement.`
- [ ] The skill requires converting any explicit checklist into todos before work starts.
- [ ] The skill requires delegation for parallelizable multi-file work.
- [ ] The skill requires verification before yielding.
- [ ] The skill asks only for missing external decisions that tools cannot answer.

### Non-goals

- Do not make this skill close issues or prepare PR closeout evidence.
- Do not bypass existing workflow instructions for todos, delegation, or verification.

### Relevant files / areas

- Existing workflow instructions that require todos, delegation, and verification.
- Routing fixtures from issue 2.
- Project-specific skill location under `.agents/skills/` or the chosen repo-local equivalent.

### Test / check expectations

- Static validation passes.
- Routing fixture for `go ahead and do the current plan` selects `execute-plan` and does not select `to-issues`.

### Risks / migration notes

- The trigger must distinguish execution from issue conversion; `go` should not route to `to-issues`.
- The skill should make missing external decisions explicit instead of asking for repo facts that tools can inspect.

### Desired base branch

main

### Blocked by

- Add automation skill validation for version-controlled skills
- Add automation routing fixtures that preserve existing skills

## 6. Add issue-autopilot skill for one issue to one PR workflow

> **Retired:** This packet proposed an `issue-autopilot` skill; it shipped as `issue-execution` (now the single issue-lifecycle skill) instead. Retained as a historical planning record — the `issue-autopilot` name below is superseded.

**Type:** AFK

### What to build

Add a version-controlled `issue-autopilot` skill that starts or finishes one issue using project conventions, active issue docs, branch/worktree rules, acceptance criteria, and verification.

### Acceptance criteria

- [ ] The skill description has this concrete trigger: `Use when the user asks to start, continue, or ship one tracked issue end-to-end.`
- [ ] The skill preserves the existing global rule: one issue/task to one branch/worktree to one PR unless repo docs say otherwise.
- [ ] The skill requires reading repo-local `.omp/AGENTS.md` and `docs/agents/*` when present.
- [ ] The skill uses existing `triage`, `diagnose`, `tdd`, or `handoff` skills when those triggers fit instead of duplicating them.

### Non-goals

- Do not create branches, worktrees, issues, or PRs in this slice.
- Do not replace specialized triage, diagnosis, TDD, or handoff workflows.

### Relevant files / areas

- `omp/.omp/agent/AGENTS.md` for the one issue/task to one branch/worktree to one PR rule and verification expectations.
- `~/.omp/agent/workflow-kit/README.md` for project-layer workflow-kit guidance.
- Routing fixtures from issue 2.

### Test / check expectations

- Static validation passes.
- Routing fixture for `start issue 42 and work it to PR` selects `issue-autopilot`.

### Risks / migration notes

- The skill must not assume a GitHub target when the checkout lacks tracker configuration.
- Keep closeout behavior tied to an active tracked issue, not a generic implementation plan.

### Desired base branch

main

### Blocked by

- Add automation skill validation for version-controlled skills
- Add automation routing fixtures that preserve existing skills

## 9. Add automation workflow benchmark suite

**Type:** AFK

### What to build

Add a separate benchmark suite for automation workflow friction so it does not get mixed with the existing/current `scripts/autoresearch.sh` traceability benchmark.

### Acceptance criteria

- [ ] Primary metric is `automation_workflow_friction`.
- [ ] Metrics include `route_accuracy_score`, `duplicate_skill_overlap_count`, `unsafe_autonomy_violations`, and `spawn_recipe_count`.
- [ ] Hard checks require `duplicate_skill_overlap_count=0` and `unsafe_autonomy_violations=0`.
- [ ] The suite is separate from the current `scripts/autoresearch.sh` unless execution explicitly chooses to replace that script.
- [ ] The current `scripts/autoresearch.sh` remains treated as a full-flow traceability benchmark, not the harness-friction benchmark described in `/tmp/oh-my-pi-harness-benchmark-handoff.md`.

### Non-goals

- Do not replace `scripts/autoresearch.sh` unless the issue implementer explicitly chooses and documents that migration.
- Do not optimize benchmark scores by weakening hard checks.

### Relevant files / areas

- `scripts/autoresearch.sh` for the current full-flow traceability benchmark boundary.
- `/tmp/oh-my-pi-harness-benchmark-handoff.md` for prior harness benchmark context.
- Skill validation and routing fixtures from issues 1 and 2.

### Test / check expectations

- Run the benchmark.
- Observe all hard checks pass and all metrics are finite.

### Risks / migration notes

- Keep automation workflow friction metrics separate from research traceability metrics so regressions are diagnosable.
- Hard checks should fail loudly on duplicate skill overlap or unsafe autonomy.

### Desired base branch

main

### Blocked by

- Add automation skill validation for version-controlled skills
- Add automation routing fixtures that preserve existing skills

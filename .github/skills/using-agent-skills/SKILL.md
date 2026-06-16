---
name: using-agent-skills
description: Discovers and invokes agent skills. Use when starting a session or when you need to discover which skill applies to the current task. This is the meta-skill that governs how all other skills are discovered and invoked.
---

# Using Agent Skills

## Overview

Agent Skills is a collection of engineering workflow skills organized by development phase. Each skill encodes a specific process that senior engineers follow. This meta-skill helps you discover and apply the right skill for your current task.

## Skill Discovery

When a task arrives, identify the development phase and apply the corresponding skill:

```
Task arrives
    │
    ├── Don't know what you want yet? ──────→ interview-me
    ├── Have a rough concept, need variants? → idea-refine
    ├── New project/feature/change? ──→ spec-driven-development
    ├── Have a spec, need tasks? ──────→ planning-and-task-breakdown
    ├── Implementing code? ────────────→ incremental-implementation
    │   ├── UI work? ─────────────────→ frontend-ui-engineering
    │   ├── API work? ────────────────→ api-and-interface-design
    │   ├── Need better context? ─────→ context-engineering
    │   ├── Need doc-verified code? ───→ source-driven-development
    │   └── Stakes high / unfamiliar code? ──→ doubt-driven-development
    ├── Writing/running tests? ────────→ test-driven-development
    │   └── Browser-based? ───────────→ browser-testing
    ├── Something broke? ──────────────→ debugging-and-error-recovery
    ├── Reviewing code? ───────────────→ code-review-and-quality
    │   ├── Too complex? ─────────────→ code-simplification
    │   ├── Security concerns? ───────→ security-and-hardening
    │   └── Performance concerns? ────→ performance-optimization
    ├── Committing/branching? ─────────→ git-workflow-and-versioning
    ├── CI/CD pipeline work? ──────────→ ci-cd-and-automation
    ├── Deprecating/migrating? ────────→ deprecation-and-migration
    ├── Writing docs/ADRs? ───────────→ documentation-and-adrs
    ├── Adding logs/metrics/alerts? ───→ observability-and-instrumentation
    └── Deploying/launching? ─────────→ shipping-and-launch
```

## Brainstorm Documentation Routing

When any loaded skill produces repository markdown for discovery, research, intent capture, ideation, specs, API/interface drafts, migration planning, launch planning, or other pre-implementation documentation, save it under the centralized brainstorm tree:

```text
docs/brainstorm/[name-slug]/
```

Always translate downstream skill doc paths into the corresponding feature folder under `docs/brainstorm/[name-slug]/`. If a skill mentions legacy root paths such as `docs/intent/`, `docs/ideas/`, `docs/specs/`, or `docs/plans/`, do not use those literal paths; save the artifact in the matching `docs/brainstorm/[name-slug]/...` location listed below. The only exception is the executable implementation plan, which belongs in `docs/plans/[name-slug]/implementation-plan.md`.

### Derive `[name-slug]`

- Derive the slug from the user's actual feature, idea, or problem statement after applying the appropriate intent/idea/spec skill.
- Use lowercase kebab-case with a concrete feature noun, e.g. `plex-oauth-feature` for "implement Plex auth" or `external-oauth-feature` for "support Google and other OAuth providers".
- Prefer the smallest slug that still distinguishes the idea from existing brainstorms.

### Check for Overlap First

Before creating a new brainstorm folder:

1. Inspect existing folders under `docs/brainstorm/` for the same feature area, provider, user problem, or architectural direction.
2. If the new idea clearly extends an existing brainstorm, use `vscode_askQuestions` to ask whether to update the existing folder as the next revision or create a separate `-v2` folder.
3. If the user chooses to update, append or revise the relevant files in the existing folder and clearly mark the new details as a revision.
4. If the user chooses a new branch of thinking, create `docs/brainstorm/[existing-slug]-v2/` or another user-approved slug.

### Standard Artifact Locations

- Intent/interview output: `docs/brainstorm/[name-slug]/intent/intent.md`
- Idea refinement output: `docs/brainstorm/[name-slug]/ideas/idea-one-pager.md`
- Research/source notes: `docs/brainstorm/[name-slug]/research/research.md`
- Feature spec: `docs/brainstorm/[name-slug]/spec/spec.md`
- API/interface contract draft: `docs/brainstorm/[name-slug]/spec/api-contract.md`
- Decision/ADR draft: `docs/brainstorm/[name-slug]/decisions/adr-draft.md`
- Migration/deprecation draft: `docs/brainstorm/[name-slug]/migration/migration-guide.md`
- Launch/rollback draft: `docs/brainstorm/[name-slug]/launch/launch-plan.md`

Create subfolders only when the corresponding artifact exists. Do not scatter pre-planning markdown across unrelated `docs/` folders.

Executable implementation plans are not brainstorm artifacts. When `planning-and-task-breakdown` produces the implementation source of truth, save it to `docs/plans/[name-slug]/implementation-plan.md` and keep its phase/task status current throughout execution.

## Core Operating Behaviors

These behaviors apply at all times, across all skills. They are non-negotiable.

### 0. Native User Input Gates

Whenever a workflow needs user input to proceed — clarification, confirmation, approval, a yes/no gate, a save/persist choice, a conflict resolution, or selecting between options — use VS Code's native `vscode_askQuestions` tool. Do not ask only in markdown/plain chat and wait for a reply.

- Put the actual question in `vscode_askQuestions` so it appears as an interactive VS Code chat question.
- Use concise headers, selectable options when the choices are known, and freeform input when useful.
- Ask one focused question at a time unless the skill explicitly requires a small batch.
- Stop until the tool returns the user's answer; do not proceed on silence, implied consent, or a markdown-only prompt.
- Never request secrets, API keys, tokens, passwords, or passphrases through `vscode_askQuestions`; ask the user to enter secrets directly in the terminal or secret manager.

### 1. Surface Assumptions

Before implementing anything non-trivial, explicitly state your assumptions:

```
ASSUMPTIONS I'M MAKING:
1. [assumption about requirements]
2. [assumption about architecture]
3. [assumption about scope]
→ Use `vscode_askQuestions` to ask whether to proceed with these assumptions or collect corrections.
```

Don't silently fill in ambiguous requirements. The most common failure mode is making wrong assumptions and running with them unchecked. Surface uncertainty early — it's cheaper than rework.

### 2. Manage Confusion Actively

When you encounter inconsistencies, conflicting requirements, or unclear specifications:

1. **STOP.** Do not proceed with a guess.
2. Name the specific confusion.
3. Present the tradeoff or clarifying question through `vscode_askQuestions`.
4. Wait for resolution before continuing.

**Bad:** Silently picking one interpretation and hoping it's right.
**Good:** "I see X in the spec but Y in the existing code. Which takes precedence?"

### 3. Push Back When Warranted

You are not a yes-machine. When an approach has clear problems:

- Point out the issue directly
- Explain the concrete downside (quantify when possible — "this adds ~200ms latency" not "this might be slower")
- Propose an alternative
- Accept the human's decision if they override with full information

Sycophancy is a failure mode. "Of course!" followed by implementing a bad idea helps no one. Honest technical disagreement is more valuable than false agreement.

### 4. Enforce Simplicity

Your natural tendency is to overcomplicate. Actively resist it.

Before finishing any implementation, ask:
- Can this be done in fewer lines?
- Are these abstractions earning their complexity?
- Would a staff engineer look at this and say "why didn't you just..."?

If you build 1000 lines and 100 would suffice, you have failed. Prefer the boring, obvious solution. Cleverness is expensive.

### 5. Maintain Scope Discipline

Touch only what you're asked to touch.

Do NOT:
- Remove comments you don't understand
- "Clean up" code orthogonal to the task
- Refactor adjacent systems as a side effect
- Delete code that seems unused without explicit approval
- Add features not in the spec because they "seem useful"

Your job is surgical precision, not unsolicited renovation.

### 6. Verify, Don't Assume

Every skill includes a verification step. A task is not complete until verification passes. "Seems right" is never sufficient — there must be evidence (passing tests, build output, runtime data).

## Failure Modes to Avoid

These are the subtle errors that look like productivity but create problems:

1. Making wrong assumptions without checking
2. Not managing your own confusion — plowing ahead when lost
3. Not surfacing inconsistencies you notice
4. Not presenting tradeoffs on non-obvious decisions
5. Being sycophantic ("Of course!") to approaches with clear problems
6. Overcomplicating code and APIs
7. Modifying code or comments orthogonal to the task
8. Removing things you don't fully understand
9. Building without a spec because "it's obvious"
10. Skipping verification because "it looks right"

## Skill Rules

1. **Check for an applicable skill before starting work.** Skills encode processes that prevent common mistakes.

2. **Skills are workflows, not suggestions.** Follow the steps in order. Don't skip verification steps.

3. **Multiple skills can apply.** A feature implementation might involve `idea-refine` → `spec-driven-development` → `planning-and-task-breakdown` → `incremental-implementation` → `test-driven-development` → `code-review-and-quality` → `code-simplification` → `shipping-and-launch` in sequence.

4. **When in doubt, start with a spec.** If the task is non-trivial and there's no spec, begin with `spec-driven-development`.

## Lifecycle Sequence

For a complete feature, the typical skill sequence is:

```
1.  interview-me                → Extract what the user actually wants
2.  idea-refine                 → Refine vague ideas
3.  spec-driven-development     → Define what we're building
4.  planning-and-task-breakdown → Break into verifiable chunks
5.  context-engineering         → Load the right context
6.  source-driven-development   → Verify against official docs
7.  incremental-implementation  → Build slice by slice
8.  observability-and-instrumentation → Instrument as you build (runs parallel with 7-9, not after)
9.  doubt-driven-development    → Cross-examine non-trivial decisions in-flight
10. test-driven-development     → Prove each slice works
11. code-review-and-quality     → Review before merge
12. code-simplification         → Reduce unnecessary complexity while preserving behavior
13. git-workflow-and-versioning → Clean commit history
14. documentation-and-adrs      → Document decisions
15. deprecation-and-migration   → Retire old systems and move users safely when needed
16. shipping-and-launch         → Deploy safely
```

Not every task needs every skill. A bug fix might only need: `debugging-and-error-recovery` → `test-driven-development` → `code-review-and-quality`.

## Quick Reference

| Phase | Skill | One-Line Summary |
|-------|-------|-----------------|
| Define | interview-me | Surface what the user actually wants before any plan, spec, or code exists |
| Define | idea-refine | Refine ideas through structured divergent and convergent thinking |
| Define | spec-driven-development | Requirements and acceptance criteria before code |
| Plan | planning-and-task-breakdown | Decompose into small, verifiable tasks |
| Build | incremental-implementation | Thin vertical slices, test each before expanding |
| Build | source-driven-development | Verify against official docs before implementing |
| Build | doubt-driven-development | Adversarial fresh-context review of every non-trivial decision |
| Build | context-engineering | Right context at the right time |
| Build | frontend-ui-engineering | Production-quality UI with accessibility |
| Build | api-and-interface-design | Stable interfaces with clear contracts |
| Verify | test-driven-development | Failing test first, then make it pass |
| Verify | browser-testing | VS Code integrated browser runtime verification |
| Verify | debugging-and-error-recovery | Reproduce → localize → fix → guard |
| Review | code-review-and-quality | Five-axis review with quality gates |
| Review | code-simplification | Preserve behavior while reducing unnecessary complexity |
| Review | security-and-hardening | OWASP prevention, input validation, least privilege |
| Review | performance-optimization | Measure first, optimize only what matters |
| Ship | git-workflow-and-versioning | Atomic commits, clean history |
| Ship | ci-cd-and-automation | Automated quality gates on every change |
| Ship | deprecation-and-migration | Remove old systems and migrate users safely |
| Ship | documentation-and-adrs | Document the why, not just the what |
| Ship | observability-and-instrumentation | Structured logs, RED metrics, traces, symptom-based alerts |
| Ship | shipping-and-launch | Pre-launch checklist, monitoring, rollback plan |

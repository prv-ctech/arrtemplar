---
name: planning-and-task-breakdown
description: Breaks work into ordered tasks and multi-agent-safe implementation phases. Use when you have a spec or clear requirements and need to break work into implementable tasks. Use when a task feels too large to start, when you need to estimate scope, or when parallel work is possible.
---

# Planning and Task Breakdown

## Overview

Decompose work into small, verifiable tasks with explicit acceptance criteria. Good task breakdown is the difference between an agent that completes work reliably and one that produces a tangled mess. Every task should be small enough to implement, test, and verify in a single focused session.

## When to Use

- You have a spec and need to break it into implementable units
- A task feels too large or vague to start
- Work needs to be parallelized across multiple agents or sessions
- You need to communicate scope to a human
- The implementation order isn't obvious

**When NOT to use:** Single-file changes with obvious scope, or when the spec already contains well-defined tasks.

## The Planning Process

## User Input Tooling

Every planning question, open-question resolution, phase approval, parallelization approval, and plan review gate must use VS Code's native `vscode_askQuestions` tool. Do not write the question only in markdown/plain chat and wait for a reply.

- Use options such as `Approve`, `Request changes`, `Parallel-safe`, `Sequential-only`, and `Needs rework` when the choices are known.
- Allow freeform input for corrections to scope, dependencies, file ownership, or phase order.
- Do not mark a plan approved until `vscode_askQuestions` returns explicit approval.

### Step 1: Enter Plan Mode

Before writing any code, operate in read-only mode:

- Read the spec and relevant codebase sections
- Identify existing patterns and conventions
- Map dependencies between components
- Note risks and unknowns

**Do NOT write code during planning.** The output is a plan, not implementation.

### Step 2: Identify the Dependency Graph

Map what depends on what:

```
Database schema
    │
    ├── API models/types
    │       │
    │       ├── API endpoints
    │       │       │
    │       │       └── Frontend API client
    │       │               │
    │       │               └── UI components
    │       │
    │       └── Validation logic
    │
    └── Seed data / migrations
```

Implementation order follows the dependency graph bottom-up: build foundations first.

Dependencies must point backward only. A task or phase may depend on a completed earlier phase, but it must never depend on a later phase. If Task 2 needs Task 6, the plan is invalid: reorder the tasks, split out a foundation phase, or merge the dependent work into one sequential phase.

### Step 3: Slice Vertically and Isolate Phases

Instead of building all the database, then all the API, then all the UI — build one complete feature path at a time:

**Bad (horizontal slicing):**
```
Task 1: Build entire database schema
Task 2: Build all API endpoints
Task 3: Build all UI components
Task 4: Connect everything
```

**Good (vertical slicing):**
```
Task 1: User can create an account (schema + API + UI for registration)
Task 2: User can log in (auth schema + API + UI for login)
Task 3: User can create a task (task schema + API + UI for creation)
Task 4: User can view task list (query + API + UI for list view)
```

Each vertical slice delivers working, testable functionality.

Then group slices into phases using this rule: **a phase is a concurrency boundary, not a theme.** Phases that can run at the same time must be independent in both dependency graph and file ownership.

Before marking phases as parallel-safe:

1. Every phase depends only on completed prior phases, never on future phases.
2. Every parallel-safe phase owns a disjoint set of source, test, config, migration, style, and generated files.
3. No two parallel-safe phases may edit the same file, directory-level index, route registry, shared schema, API contract, migration, global style, dependency file, or generated artifact.
4. If two phases need the same shared file, create an earlier sequential foundation phase that edits that file, or mark the phases sequential-only.
5. If file ownership is uncertain, classify the phase as sequential-only. Parallelism is allowed only when safety is proven, not hoped.

### Step 4: Write Tasks

Each task follows this structure:

```markdown
## Task [N]: [Short descriptive title]

**Description:** One paragraph explaining what this task accomplishes.

**Acceptance criteria:**
- [ ] [Specific, testable condition]
- [ ] [Specific, testable condition]

**Verification:**
- [ ] Tests pass: `npm test -- --grep "feature-name"`
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: [description of what to verify]

**Status:** `not_started` | `in_progress` | `blocked` | `completed` | `verified`

**Dependencies:** [Earlier task/phase IDs this depends on, or "None". Never reference later work.]

**Parallel safety:** `parallel-safe` | `sequential-only` | `coordination-required`

**Owned files:** [Exact files or narrow globs this task is allowed to edit]

**Forbidden files:** [Shared files or areas this task must not edit]

**Files likely touched:**
- `src/path/to/file.ts`
- `tests/path/to/test.ts`

**Estimated scope:** [Small: 1-2 files | Medium: 3-5 files | Large: 5+ files]
```

### Step 5: Order and Checkpoint

Arrange tasks so that:

1. Dependencies are satisfied (build foundation first)
2. Each task leaves the system in a working state
3. Verification checkpoints occur after every 2-3 tasks
4. High-risk tasks are early (fail fast)
5. Parallel-safe phases have disjoint file ownership
6. Sequential-only phases are clearly labeled and ordered

Add explicit checkpoints:

```markdown
## Checkpoint: After Tasks 1-3
- [ ] All tests pass
- [ ] Application builds without errors
- [ ] Core user flow works end-to-end
- [ ] Review with human before proceeding
```

### Step 6: Maintain Execution State

When a coordinator chooses to track execution state, keep status updates narrow and explicit:

- Before starting: mark the phase/task `in_progress`, record the agent/session, timestamp, and files being claimed.
- While working: if a task needs an unowned file or a future dependency, stop and mark the task as `blocked`; do not improvise around the conflict.
- After finishing: mark the task `completed`, record the exact verification performed, then mark the checkpoint `verified` only after its verification passes.
- Before resuming: use the latest approved plan state over prior conversation state.
- Never rewrite another active phase's status or owned-file list unless acting as the coordinator.

## Task Sizing Guidelines

| Size | Files | Scope | Example |
|------|-------|-------|---------|
| **XS** | 1 | Single function or config change | Add a validation rule |
| **S** | 1-2 | One component or endpoint | Add a new API endpoint |
| **M** | 3-5 | One feature slice | User registration flow |
| **L** | 5-8 | Multi-component feature | Search with filtering and pagination |
| **XL** | 8+ | **Too large — break it down further** | — |

If a task is L or larger, it should be broken into smaller tasks. An agent performs best on S and M tasks.

**When to break a task down further:**
- It would take more than one focused session (roughly 2+ hours of agent work)
- You cannot describe the acceptance criteria in 3 or fewer bullet points
- It touches two or more independent subsystems (e.g., auth and billing)
- You find yourself writing "and" in the task title (a sign it is two tasks)

## Plan Document Template

````markdown
# Implementation Plan: [Feature/Project Name]

**Status:** draft | approved | in_progress | blocked | completed
**Current phase:** Phase [N] — [Name]
**Last updated:** [ISO timestamp]
**Coordinator:** [agent/user/session]

## Overview
[One paragraph summary of what we're building]

## Architecture Decisions
- [Key decision 1 and rationale]
- [Key decision 2 and rationale]

## Execution Rules
- The plan is the source of truth for implementation state.
- Agents must update task status before starting and after verification.
- Parallel-safe phases must have disjoint owned files.
- If a task needs a shared or unowned file, stop and re-plan before editing.

## Phase Dependency Graph
```text
Phase 0: Shared foundation
    ├── Phase 1: [parallel-safe branch]
    └── Phase 2: [parallel-safe branch]
Phase 3: Integration checkpoint depends on Phase 1 + Phase 2
```

## Parallelization Matrix
| Phase | Status | Parallel safety | Can run with | Must wait for | Owned files | Forbidden files |
|-------|--------|-----------------|--------------|---------------|-------------|-----------------|
| Phase 0 | not_started | sequential-only | None | None | `path/a.ts` | Phase 1/2 files |
| Phase 1 | not_started | parallel-safe | Phase 2 | Phase 0 verified | `path/b.ts` | `path/a.ts`, `path/c.ts` |
| Phase 2 | not_started | parallel-safe | Phase 1 | Phase 0 verified | `path/c.ts` | `path/a.ts`, `path/b.ts` |

## File Ownership Matrix
| File or glob | Owner phase | Owner task | Shared? | Notes |
|--------------|-------------|------------|---------|-------|
| `src/example.ts` | Phase 1 | Task 1.1 | No | Only Phase 1 may edit |
| `src/shared.ts` | Phase 0 | Task 0.1 | Yes | Must be finalized before parallel phases start |

## Execution Status Log
| Timestamp | Agent/session | Phase/task | Status | Verification | Notes |
|-----------|---------------|------------|--------|--------------|-------|
| [ISO timestamp] | [agent] | Phase 0 / Task 0.1 | in_progress | Not run yet | Claimed files: ... |

## Task List

### Phase 0: Shared Foundation
**Status:** not_started
**Parallel safety:** sequential-only
**Can run with:** None
**Must wait for:** None
**Owned files:** [Exact files/globs]
**Forbidden files:** [Files/globs reserved for other phases]

#### Task 0.1: [Short title]
**Status:** not_started
**Description:** ...
**Acceptance criteria:**
- [ ] ...
**Verification:**
- [ ] ...
**Dependencies:** None
**Parallel safety:** sequential-only
**Owned files:** ...
**Forbidden files:** ...

### Checkpoint: Foundation
- [ ] Tests pass, builds clean

### Phase 1: [Parallel-Safe Branch]
**Status:** not_started
**Parallel safety:** parallel-safe
**Can run with:** Phase 2
**Must wait for:** Phase 0 verified
**Owned files:** [Exact files/globs disjoint from Phase 2]
**Forbidden files:** [Phase 0 and Phase 2 owned files]

#### Task 1.1: [Short title]
**Status:** not_started
**Description:** ...
**Acceptance criteria:**
- [ ] ...
**Verification:**
- [ ] ...
**Dependencies:** Phase 0 verified
**Parallel safety:** parallel-safe
**Owned files:** ...
**Forbidden files:** ...

### Phase 2: [Parallel-Safe Branch]
**Status:** not_started
**Parallel safety:** parallel-safe
**Can run with:** Phase 1
**Must wait for:** Phase 0 verified
**Owned files:** [Exact files/globs disjoint from Phase 1]
**Forbidden files:** [Phase 0 and Phase 1 owned files]

### Checkpoint: Core Features
- [ ] End-to-end flow works

### Phase 3: Integration
**Status:** not_started
**Parallel safety:** sequential-only
**Can run with:** None
**Must wait for:** Phase 1 verified, Phase 2 verified
**Owned files:** [Integration files]
**Forbidden files:** [Completed phase internals unless explicitly re-opened]

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Ready for review

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk] | [High/Med/Low] | [Strategy] |

## Open Questions
- [Question needing human input]
````

## Parallelization Opportunities

When multiple agents or sessions are available:

- **Safe to parallelize:** Phases with completed prerequisites, no dependency on each other, and disjoint owned files.
- **Must be sequential:** Database migrations, schema changes, API contract changes, shared state changes, dependency chains, generated artifacts, global config, route registries, shared components/utilities, package files, and any phase with uncertain file ownership.
- **Needs coordination:** Features that share an API contract, shared file, shared test fixture, global UI shell, database table, or generated artifact. Resolve these in a sequential foundation phase before parallel work starts.

### Parallel Safety Gate

Before approving parallel execution, answer yes to every question:

- [ ] Does each parallel phase depend only on completed prior phases?
- [ ] Are owned files/globs disjoint across the phases?
- [ ] Are shared files moved into a completed sequential foundation phase?
- [ ] Is every generated file owned by exactly one sequential phase?
- [ ] Can each phase be verified independently without another in-progress phase?
- [ ] Does the plan explicitly list which phases can run together?

If any answer is no, the phases are sequential-only. Do not run multiple agents on them.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll figure it out as I go" | That's how you end up with a tangled mess and rework. 10 minutes of planning saves hours. |
| "The tasks are obvious" | Write them down anyway. Explicit tasks surface hidden dependencies and forgotten edge cases. |
| "Planning is overhead" | Planning is the task. Implementation without a plan is just typing. |
| "I can hold it all in my head" | Context windows are finite. Written plans survive session boundaries and compaction. |

## Red Flags

- Starting implementation without a written task list
- Tasks that say "implement the feature" without acceptance criteria
- No verification steps in the plan
- All tasks are XL-sized
- No checkpoints between tasks
- Dependency order isn't considered
- A task depends on a later task or phase
- Parallel phases touch the same file, index, schema, migration, route registry, global style, or generated artifact
- Shared files are left for multiple agents to edit independently
- Plan status is stale or missing current phase/task ownership

## Verification

Before starting implementation, confirm:

- [ ] Every task has acceptance criteria
- [ ] Every task has a verification step
- [ ] Task dependencies are identified and ordered correctly
- [ ] No task touches more than ~5 files
- [ ] Checkpoints exist between major phases
- [ ] The human has reviewed and approved the plan through `vscode_askQuestions`
- [ ] Every phase is classified as `parallel-safe`, `sequential-only`, or `coordination-required`
- [ ] Parallel-safe phases have disjoint owned files and no cross-phase dependencies
- [ ] Sequential-only phases are ordered before dependents start
- [ ] The plan includes a current phase/task status log

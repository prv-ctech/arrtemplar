---
name: finishing-a-development-branch
description: Use when all implementation tasks complete to verify tests, present options, and clean up branch. ContextStream-first.
compatibility:
  - github-copilot
  - claude-code
  - openai-codex
license: MIT
metadata:
  author: arrbit
  version: "1.0"
---

# Finishing a Development Branch

When tasks complete, verify everything works and present options.

## Step 1: Final Verification

1. Run full test suite
2. Verify all `manage_todo_list` items completed
3. Check for uncommitted changes
4. Review git log for branch

## Step 2: Present Options

Use `vscode/askQuestions`:

```
questions:
  - header: "branch-complete"
    question: "All tasks complete. Tests pass. What would you like to do?"
    options:
      - label: "Create a pull request"
        description: "Push branch and create PR for review"
        recommended: true
      - label: "Merge to main"
        description: "Merge directly into main branch"
      - label: "Keep branch for now"
        description: "Leave branch, handle later"
      - label: "Discard changes"
        description: "Delete branch and all changes"
```

## Step 3: Execute Choice

### Create Pull Request
1. Push branch
2. Create PR with summary, tasks completed, test results, known issues

### Merge to Main
1. Ensure branch up to date with main
2. Merge with appropriate strategy
3. Push to main
4. Delete feature branch

### Keep Branch
1. Ensure everything committed
2. Report current branch name and status

### Discard
1. Confirm with user
2. Switch to main
3. Delete feature branch

## Step 4: Cleanup

- Remove temporary files
- Update documentation if needed
- Close related issues

## Summary Template

```
## Branch Summary
**Branch:** [name]
**Tasks completed:** N/M
**Tests:** All passing / X failures
**Files changed:** [list]
**Commit count:** N

### Changes Made
- [Task 1 summary]
- [Task 2 summary]
- ...

### Follow-ups
- [Items noted during implementation]
```

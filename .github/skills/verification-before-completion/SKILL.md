---
name: verification-before-completion
description: Use before declaring any task, fix, or feature complete — ensures it actually works end-to-end. ContextStream-first.
compatibility:
  - github-copilot
  - claude-code
  - openai-codex
license: MIT
metadata:
  author: arrbit
  version: "1.0"
---

# Verification Before Completion

**Ensure it's actually fixed/implemented. Evidence over claims.**

## Verification Checklist

Before saying "done," verify ALL:

### 1. Tests Pass
- Run full test suite (not just new tests)
- No skipped tests
- No flaky tests

### 2. Original Request Satisfied
- Re-read original request/bug report
- Verify each requirement met
- If bug: verify exact reproduction scenario now works

### 3. Edge Cases
- Empty input?
- Invalid input?
- Concurrent access?
- Boundary conditions?

### 4. No Regressions
- Existing functionality still works
- No new warnings or errors
- Performance not degraded

### 5. Code Quality
- No TODO/FIXME left behind (unless agreed)
- No debug logging left in
- Code follows project conventions

### 6. Browser Verification (UI Changes)
If change affects UI:
1. **Restart dev server** with `bun dev` — hot reload can produce stale state
2. Open app in integrated browser
3. Navigate to affected pages
4. Take screenshots to verify visual correctness
5. Interact with changed elements (click, type, hover)
6. Compare against design spec

## Verification Commands

For this project:
```bash
bun test              # Run all tests
bun run check         # Run linter/formatter (if configured)
```

## Red Flags

| Claim | Reality Check |
|-------|--------------|
| "Should work" | Run it and prove it |
| "Tests pass locally" | Run them now, in this environment |
| "Tested happy path" | Test error paths too |
| "Fix is simple" | Simple fixes can break other things |
| "Seen this before" | Verify it's same issue |

## The Rule

**If can't verify, not done.**

# CIA Test Plan


## Testing infrastructure

### Tool: Vitest
Add `vitest` as a dev dependency. No special config needed — it handles TSX/ESM out of the box.

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

### Directory layout
```
tests/
  unit/                    # Pure logic, no git/fs side effects
    app-state-reducer.test.ts
    cmd-helpers.test.ts
    config-user.test.ts
  integration/             # Real git operations using cia-test/ worktrees
    helpers.ts             # Shared setup/teardown (see below)
    worktree-lifecycle.test.ts
    worktree-status.test.ts
    sync-and-merge.test.ts
    delete-edge-cases.test.ts
```

### Integration test harness (`tests/integration/helpers.ts`)

All integration tests use the CIA repo itself. The harness provides:

```ts
const TEST_PREFIX = "cia-test/"

// beforeAll: prune any leftover cia-test/ worktrees and branches from prior crashed runs
// afterEach: clean up worktrees/branches created during the test
// afterAll: final cleanup sweep
```

Key helper functions:
- `createTestWorktree(name: string)` — creates a worktree under `cia-test/<name>`, returns `{ dir, branch }`. Tracks it for automatic cleanup.
- `makeCommit(dir: string, filename: string, content: string)` — creates a file, stages, commits. Returns commit hash.
- `cleanupAll()` — force-removes all `cia-test/*` worktrees and deletes their branches. Called in `afterAll` and `beforeAll` (safety net).
- `getBranch(dir: string)` — returns current branch name in a directory.

The harness uses raw `execa("git", ...)` calls, NOT the CIA functions under test. This avoids circular dependencies and ensures test setup is independent of the code being tested.

---

## Stage 0: Existing known bugs

Write tests for the following 2 bugs, showing that the test fails, then fix the code, then
show the test works. Make sure that the only change between test fail and test works is a code change,
not a test change.

### BUG-1: Hardcoded "main" in ahead/behind calculation
**File:** `src/cmd-helpers.ts:211`
**Issue:** `git rev-list --left-right --count main...${wt.branch}` hardcodes `main` instead of using `getBaseBranch()`. Repos using `master` or other default branches will get wrong/broken counts.
**Fix:** Call `await getBaseBranch()` (already imported) and use the result instead of the literal `"main"`.

### BUG-2: Ahead/behind counts are swapped
**File:** `src/cmd-helpers.ts:214-216`
**Issue:** `git rev-list --left-right --count main...branch` returns `[left, right]` where left = commits in main not in branch (behind) and right = commits in branch not in main (ahead). But the code assigns `ahead = parts[0]` and `behind = parts[1]` — reversed.
**Fix:** Swap the assignments: `behind = parts[0]; ahead = parts[1]`.

---


## Stage 1: Unit tests (pure logic)

These have zero git/fs dependencies. Mock or extract as needed.

### 1.1 `app-state-reducer.test.ts`

Tests for `appReducer`:

| Test | Why it matters |
|------|---------------|
| `move` down when `rows` is empty | idx becomes -1, causing crash on next render accessing `rows[-1]` |
| `move` up when idx is 0 | Should stay at 0 |
| `move` down when idx is at last row | Should stay at last index |
| `refresh-done` while in `worktree-detail` for a worktree that no longer exists | Should fall back to list mode, not crash |
| `refresh-done` while in `worktree-detail` for a worktree that still exists | Should stay in detail mode with updated data |
| `clamp-idx` when rows shrink below current idx | idx should clamp to new last index |
| `clamp-idx` when rows is empty | idx should be 0, not -1 |
| `dismiss` resets dialog to list mode | Basic state transition |

### 1.2 `cmd-helpers.test.ts` (pure parsing logic only)

Extract the parsing logic from `computeWorktrees` and `checkForConflicts` into testable functions, or test them via controlled git output.

| Test | Why it matters |
|------|---------------|
| `formatCommitAge` with timestamp 0 | Returns "---" but 0 is valid (Unix epoch). Document intended behavior. |
| `formatCommitAge` boundary: exactly 1 day, 7 days, 60 days | Off-by-one in day thresholds |
| `formatCommitAge` with future timestamp | Negative diff — what happens? |
| `formatCommitAge` with `NaN` / `undefined` | Defensive edge cases |
| Parse `git worktree list --porcelain` with detached HEAD entry | Branch is null — verify handling |
| Parse `git worktree list --porcelain` with prunable entry | Should set prunable flag |

### 1.3 `config-user.test.ts` (branch prefix normalization)

| Test | Why it matters |
|------|---------------|
| Prefix without trailing `/` gets one added | Basic normalization |
| Prefix with trailing `/` stays unchanged | No double slash |
| Empty string prefix | Should fall back to default, not create invalid branch |
| Prefix with git-unsafe characters (spaces, `..`, `~`, `^`, `:`) | Currently unvalidated — documents the gap |

---

## Stage 2: Integration tests (real worktrees)

These create actual worktrees in the CIA repo under the `cia-test/` prefix.

### 2.1 `worktree-lifecycle.test.ts` — Create and delete round trips

| Test | What it exercises |
|------|-------------------|
| Create worktree, verify directory and branch exist | `createWorktree` happy path |
| Delete worktree, verify directory and branch are gone | `deleteWorktree` happy path |
| Delete worktree with uncommitted changes (no force) | Should fail or require force |
| Force-delete worktree with uncommitted changes | `deleteWorktree(..., true)` |
| Delete worktree whose directory was already `rm -rf`'d | The prunable path — exercises the `!dirExists` branch in `deleteWorktree` |
| Create worktree when `.worktrees/` dir doesn't exist yet | Directory creation logic |

### 2.2 `worktree-status.test.ts` — Status computation

These test `computeWorktrees` and the ahead/behind/dirty logic end-to-end.

| Test | What it exercises |
|------|-------------------|
| Worktree with 0 commits ahead, 0 behind | Clean status |
| Worktree with N commits ahead of base | After `makeCommit` in worktree, ahead count is correct |
| Worktree with uncommitted (dirty) files | dirtyCount reflects actual count |
| Worktree with manually deleted directory (prunable) | Listed with prunable flag, hasBranch false |
| Worktree whose branch was checked out to something else (`git checkout` inside worktree) | `validateWorktree` detects mismatch |
| **Ahead/behind uses actual base branch, not hardcoded "main"** | Regression test for BUG-1 (after fix) |
| **Ahead/behind values are not swapped** | Regression test for BUG-2 (after fix): make 2 commits in worktree, 0 in base. Verify ahead=2, behind=0 — not the reverse. |

### 2.3 `sync-and-merge.test.ts` — Rebase and merge operations

| Test | What it exercises |
|------|-------------------|
| Sync (rebase) with non-conflicting divergence | Create worktree, commit in worktree, commit on base (via second worktree). `syncBranch` should succeed. Verify worktree has both commits. |
| Sync (rebase) with conflicting changes | Same file edited in both. `syncBranch` should fail. Verify repo is NOT left in a broken rebase state (no `rebase-merge` dir). |
| `checkForConflicts` predicts conflict correctly | Run before attempting sync. Verify it returns `hasConflicts: true` with the right filenames. |
| `checkForConflicts` returns clean for non-conflicting case | Verify false positive rate is zero for simple cases. |
| Merge (FF-only) when fast-forward is possible | Linear history. `mergeIntoMain` should succeed. |
| Merge (FF-only) when fast-forward is NOT possible | Diverged history. Should fail with clear error, not corrupt state. |

### 2.4 `delete-edge-cases.test.ts` — Delete validation

| Test | What it exercises |
|------|-------------------|
| `checkDeleteIssues` on clean worktree (no unmerged, no dirty) | Returns `isClean: true` |
| `checkDeleteIssues` on worktree with unmerged commits | Lists the commits |
| `checkDeleteIssues` on worktree with dirty files | Lists the files |
| `checkDeleteIssues` on worktree whose directory is gone | Reports "prunable" issue |
| Delete worktree, verify remote branch is also deleted (if pushed) | The `git push origin --delete` path |

---

## Stage 3: Optional / future

These are lower priority — add if the above stages are solid.

- **Service lifecycle tests**: Spawn `sleep 30` as a service, verify PID tracking, kill, verify cleanup. Exercises the TOCTOU races in `service.ts`.
- **Bash script injection test**: Generate a service script with adversarial branch names (backticks, `$()`, quotes). Verify the script is safe. This is a unit test on the script generation function once extracted.
- **Config read/write round trip**: Write config, read it back, verify values survive JSONC serialization.
- **`computeWorktrees` with in-progress merge/rebase state**: Start a rebase, leave it mid-conflict, verify `inProgress` field is set correctly.

---

## Implementation notes for the test author

1. **Fix BUG-1 and BUG-2 first** (or in the same PR). The Stage 2 status tests serve as regression tests for both.

2. **The integration harness cleanup is critical.** If `afterAll` doesn't run (process killed), the `beforeAll` safety net must catch it next run. Use `git worktree list` filtered by `cia-test/` and `git branch --list 'cia-test/*'` to find stragglers.

3. **Don't import from `src/config.ts` in integration tests** — it depends on `process.cwd()` being the project root and reads `.cia-repo.jsonc`. Use `getRepoRoot()` and `getBaseBranch()` from `src/repo.ts` which are safe, or call git directly.

4. **The `computeWorktrees` function is hard to test directly** because it calls `getConfig()` which reads config files. For Stage 2.2, either:
   - Test `listWorktrees` + the ahead/behind/dirty logic separately
   - Or create a `.cia-repo.jsonc` with `branchPrefix: "cia-test/"` in a temp location

   The former is simpler.

5. **For sync/merge tests (Stage 2.3)**, you need a second worktree to make commits "on the base branch" without affecting the main working tree. Create `cia-test/base-helper` as a utility worktree for this purpose.

6. **Keep tests sequential within each file** (not parallel) since they share git state. Vitest runs files in parallel by default, which is fine as long as each file uses unique branch names.

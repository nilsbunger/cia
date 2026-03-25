# CIA Overview
CIA is a multi-worktree Git agent helper. It implements a TUI to show and manage a set of
worktrees. The user can create one or more worktrees, and CIA helps keep track of them,
run dev tools and running web preview in them, and ultimately create and track a pull request.

## Tech notes

* Typecheck: `pnpm typecheck` -- accepts tsc command line args.
* Lint: `pnpm lint`

## Development

During development, we run this project from the directory of a git repo we're working on.
We run the command:
`pnpm --dir ~/code/cia start`  (where code/cia is the directory containing this repo).

In production, we will just run 'cia' after installing the package.

## Implementation notes

* All code lives in src/ . The top React component is src/App.tsx.
* CIA has a 'CIA project root' directory, which is the project this tool is working on. Paths are relative to that directory, which is somewhere in a git tree (not THIS project's git tree). Files in a CIA project root:
* `.cia/cia-repo.jsonc` : Configuration for the repo. Committed to git.
* `.cia/cia-user.jsonc` : Configuration specific to this user. gitignored. Contains user-specific settings including worktree location.
* Worktree location is configurable via `worktreeDir` in `.cia/cia-user.jsonc`. Default is `.worktrees/` but can be set to `../wt/` or any relative path.
* `.cia/tmp/` : temp directory, use for any temp files needed.
* `onCreateScript` in repo config: path is resolved relative to the project root, but executes with cwd in the new worktree. The `.cia/` directory only exists in the project root, not in worktrees.
* `src/vars.ts` defines CIA variables (`CiaVars`, `buildVars`, `makeCiaEnv`, `VAR_DESCRIPTIONS`) — these are the `CIA_*` env vars passed to scripts and used for command interpolation across the app.
* Config is split: `config-repo.ts` (cia-repo.jsonc, committed) vs `config-user.ts` (cia-user.jsonc, gitignored). `branchPrefix` and `worktreeDir` live in user config; `baseBranch`, `runCommand`, `onCreateScript`, `editCommand` live in repo config. `config.ts` merges both.
* TUI state (`AppState` in `app-state-reducer.ts`) holds the merged config values. Command execution in `worktree-list/execute-command.ts` receives state and threads config values to `cmd-ops.ts` and `service.ts`.


## Testing

We use vitest. Run tests with `pnpm test`. All tests live in the `tests/` folder.
When fixing a bug, write a test FIRST, confirm the test fails, then fix the code.
When adding a new feature, write tests for risky scenarios as part of development.

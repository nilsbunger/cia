# CIA Overview
CIA is a multi-worktree Git agent helper. It implements a TUI to show and manage a set of
worktrees. The user can create one or more worktrees, and CIA helps keep track of them,
run dev tools and running web preview in them, and ultimately create and track a pull request.

## Tech notes

* Typecheck: `pnpm typecheck` -- accepts tsc command line args.
* Lint: `pnpm lint`

## Implementation notes

* All code lives in src/ . The top React component is src/App.tsx.
* CIA has a 'CIA project root' directory, which is where it's run. Paths are relative to that
directory, which is somewhere in a git tree. Files in a CIA project root:
* `.cia-repo.jsonc` : Configuration for the repo. Committed to git.
* `.cia-user.jsonc` : Configuration specific to this user. gitignored
* `.worktrees/<name>` : Folder containing worktrees, with folder hierarchy matching worktree
    and branch name. gitignored.
* `.cia-tmp/` : temp directory, use for any temp files needed.



export type Worktree = {
  /** Name of worktree (from which branch can be inferred) */
  name: string
  /** Whether this worktree has a usable branch (false if detached HEAD or prunable) */
  hasBranch: boolean
  /** Whether this worktree is prunable (directory missing) */
  prunable?: boolean
  status: string // short status (e.g., ahead/behind/dirty)
  worktreeDir: string
  /** Whether the service is running for this worktree */
  serviceRunning?: boolean
  /** Crash info if the service recently exited non-zero */
  serviceCrash?: { exitCode: number; stderr: string; stdout?: string }
  /** Human-readable age of last commit (e.g. "today", "3 days ago") */
  lastCommitAge?: string
  /** Commits ahead of main */
  ahead?: number
  /** Commits behind main */
  behind?: number
  /** Number of dirty (uncommitted) files */
  dirtyCount?: number
  /** Merge or rebase in progress */
  inProgress?: "MERGE" | "REBASE"
  /** Pull request number if one exists */
  prNumber?: number
  /** Pull request URL */
  prUrl?: string
  /** Pull request state (open, closed, merged) */
  prState?: "open" | "closed" | "merged"
}

export type DeleteCandidate = {
  name: string
  worktreeDir: string
  hasBranch: boolean
  unmergedCommits: string[]
  uncommittedFiles: string[]
  worktreeIssues: string[]
}

export type OperationCandidate = {
  name: string
  operation: "sync"
  conflictingFiles: string[]
}

export type WorktreeCommand = {
  key: string
  label: string
  description: string
}

export type CommandMenu = {
  key: string
  label: string
  description: string
  commands: WorktreeCommand[]
  /** If true, pressing this key executes immediately (no submenu) */
  direct?: boolean
}

export function getWorktreeMenus(worktree: Worktree): CommandMenu[] {
  return [
    {
      key: "e",
      label: "Edit",
      description: "Open in editor",
      commands: [],
      direct: true,
    },
    {
      key: "g",
      label: "Git",
      description: "Commit, sync, push, delete",
      commands: [
        { key: "c", label: "Commit", description: "Stage all & commit in terminal" },
        { key: "s", label: "Sync", description: "Rebase onto main" },
        worktree.prNumber
          ? { key: "p", label: "Push", description: "Push to remote" }
          : { key: "p", label: "Create PR", description: "Create GitHub pull request" },
        { key: "d", label: "Delete", description: "Delete worktree + branch" },
      ],
    },
    {
      key: "s",
      label: "Service",
      description: "Run & manage services",
      commands: [
        { key: "r", label: "Run", description: "Start service in new terminal" },
        { key: "x", label: "Kill", description: "Stop running service" },
      ],
    },
  ]
}

export type EditCommandInfo = {
  worktreeName: string
  command: string
  dir: string
  env: Record<string, string>
  source: "configured" | "auto-detected"
}

export type Dialog =
  | { mode: "list" }
  | { mode: "help" }
  | { mode: "create" }
  | { mode: "slash-command" }
  | { mode: "config" }
  | { mode: "init" }
  | { mode: "worktree-detail"; worktree: Worktree }
  | { mode: "confirm-delete"; candidate: DeleteCandidate }
  | { mode: "confirm-sync"; candidate: OperationCandidate }
  | { mode: "confirm-kill-service"; worktree: string }
  | { mode: "confirm-cleanup-failed-create"; branch: string; existingBranch: boolean; error: string }
  | { mode: "confirm-edit"; info: EditCommandInfo }

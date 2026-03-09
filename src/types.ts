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
}

export type DeleteCandidate = {
  name: string
  worktreeDir: string
  hasBranch: boolean
  unmergedCommits: string[]
  uncommittedFiles: string[]
  worktreeIssues: string[]
}

export type ForceDeleteCandidate = {
  name: string
  worktreeDir: string
  hasBranch: boolean
}

export type OperationCandidate = {
  name: string
  operation: "merge" | "sync"
  conflictingFiles: string[]
}

type WorktreeCommand = {
  key: string
  label: string
  description: string
}

export const WORKTREE_COMMANDS: WorktreeCommand[] = [
  { key: "c", label: "Code", description: "Open in editor" },
  { key: "r", label: "Run", description: "Start service in new terminal" },
  { key: "x", label: "Kill", description: "Stop running service" },
  { key: "s", label: "Sync", description: "Rebase onto main" },
  { key: "p", label: "Push", description: "Backup to remote" },
  { key: "m", label: "Merge", description: "Merge into main" },
  { key: "d", label: "Delete", description: "Delete worktree + branch" },
  { key: "D", label: "Force Delete", description: "Force delete worktree + branch (skip checks)" },
]

export type Dialog =
  | { mode: "list" }
  | { mode: "help" }
  | { mode: "create" }
  | { mode: "slash-command" }
  | { mode: "config" }
  | { mode: "init" }
  | { mode: "worktree-detail"; worktree: Worktree }
  | { mode: "confirm-delete"; candidate: DeleteCandidate }
  | { mode: "confirm-force-delete"; candidate: ForceDeleteCandidate }
  | { mode: "confirm-merge"; candidate: OperationCandidate }
  | { mode: "confirm-sync"; candidate: OperationCandidate }
  | { mode: "confirm-kill-service"; worktree: string }

export type Row = {
  branch: string
  status: string // short status (e.g., ahead/behind/dirty)
  worktreeDir: string | null
  selected?: boolean
  /** Whether the service is running for this branch */
  serviceRunning?: boolean
  /** Human-readable age of last commit (e.g. "today", "3 days ago") */
  lastCommitAge?: string
}
export type Mode =
  | "list"
  | "help"
  | "create"
  | "slash-command"
  | "config"
  | "init"
  | "confirm-delete"
  | "confirm-force-delete"
  | "confirm-merge"
  | "confirm-sync"
  | "confirm-kill-service"

export type Row = {
  branch: string
  status: string // short status (e.g., ahead/behind/dirty)
  worktreeDir: string | null
  selected?: boolean
  /** Whether the service is running for this branch */
  serviceRunning?: boolean
}
export type Mode =
  | "list"
  | "help"
  | "create"
  | "command"
  | "config"
  | "init"
  | "confirm-delete"
  | "confirm-force-delete"
  | "confirm-merge"
  | "confirm-sync"
  | "confirm-kill-service"

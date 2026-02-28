export type Row = {
  branch: string
  status: string // short status (e.g., ahead/behind/dirty)
  worktreeDir: string | null
  selected?: boolean
}
export type Mode = "list" | "help" | "create" | "confirm-delete" | "confirm-merge" | "confirm-sync"

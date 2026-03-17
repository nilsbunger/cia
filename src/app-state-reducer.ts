import type { EditorType } from "./config-user"
import { BRANCH_PREFIX } from "./constants"
import type { Dialog, Worktree } from "./types"

export type AppState = {
  branchPrefix: string
  editor: EditorType
  baseBranch: string
  runCommand: string
  runDir: string
  repoRoot: string
  rows: Worktree[]
  idx: number
  loading: boolean
  msg: string
  dialog: Dialog
}

export type Action =
  | {
      type: "loaded-config"
      branchPrefix: string
      editor: EditorType
      baseBranch: string
      runCommand: string
      runDir: string
      repoRoot: string
    }
  | { type: "refresh-done"; rows: Worktree[] }
  | { type: "set-msg"; msg: string }
  | { type: "move"; dir: "up" | "down" }
  | { type: "open-dialog"; dialog: Dialog }
  | { type: "dismiss"; msg?: string }
  | { type: "clamp-idx" }

export const initialState: AppState = {
  branchPrefix: BRANCH_PREFIX,
  editor: "auto",
  baseBranch: "",
  runCommand: "",
  runDir: "",
  repoRoot: "",
  rows: [],
  idx: 0,
  loading: true,
  msg: "",
  dialog: { mode: "list" },
}

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "loaded-config":
      return {
        ...state,
        branchPrefix: action.branchPrefix,
        editor: action.editor,
        baseBranch: action.baseBranch,
        runCommand: action.runCommand,
        runDir: action.runDir,
        repoRoot: action.repoRoot,
      }
    case "refresh-done": {
      // If viewing a worktree detail, update it with fresh data from the new rows
      const currentDialog = state.dialog
      if (currentDialog.mode === "worktree-detail") {
        const updated = action.rows.find((r) => r.name === currentDialog.worktree.name)
        // in case worktree was deleted externally, fallback to list mode.
        const dialog = updated
          ? { mode: "worktree-detail" as const, worktree: updated }
          : { mode: "list" as const }
        return { ...state, loading: false, rows: action.rows, dialog }
      }
      return { ...state, loading: false, rows: action.rows }
    }
    case "set-msg":
      return { ...state, msg: action.msg }
    case "move":
      if (action.dir === "up") return { ...state, idx: Math.max(0, state.idx - 1) }
      return { ...state, idx: Math.min(state.rows.length - 1, state.idx + 1) }
    case "open-dialog":
      return { ...state, dialog: action.dialog, msg: "" }
    case "dismiss":
      return { ...state, dialog: { mode: "list" }, msg: action.msg ?? "" }
    case "clamp-idx":
      return { ...state, idx: Math.min(state.idx, Math.max(0, state.rows.length - 1)) }
  }
}

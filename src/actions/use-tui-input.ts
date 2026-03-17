import chalk from "chalk"
import { useInput } from "ink"
import type { Action, AppState } from "../app-state-reducer"
import { deleteWorktree } from "../cmd-ops"
import { createProject, getConfig } from "../config"
import { mergeIntoMain, syncBranch } from "../git-ops"
import { killService } from "../service"
import type { OperationCandidate } from "../types"
import { log } from "../utils"

async function handleDeleteConfirm(
  candidate: { name: string; worktreeDir: string; hasBranch: boolean },
  dispatch: React.Dispatch<Action>,
  refresh: () => Promise<void>,
) {
  const { name, worktreeDir, hasBranch } = candidate
  log(`User confirmed delete for worktree: ${name}`)
  dispatch({ type: "dismiss", msg: `Deleting ${name}…` })
  try {
    await deleteWorktree(worktreeDir, hasBranch ? name : null, true)
    log(`Delete completed successfully for worktree: ${name}`)
    dispatch({ type: "set-msg", msg: `Deleted ${name}` })
    await refresh()
    dispatch({ type: "clamp-idx" })
    // biome-ignore lint/suspicious/noExplicitAny: ok in catch
  } catch (e: any) {
    log(`Delete failed for worktree: ${name}`, {
      error: e.message,
      shortMessage: e.shortMessage,
    })
    dispatch({ type: "set-msg", msg: chalk.red(`Delete failed: ${e.shortMessage || e.message}`) })
  }
}

async function handleOperationConfirm(
  candidate: OperationCandidate,
  dispatch: React.Dispatch<Action>,
  refresh: () => Promise<void>,
) {
  const { name, operation } = candidate
  const isMerge = operation === "merge"
  log(`User confirmed ${operation} for worktree: ${name}`)
  dispatch({
    type: "dismiss",
    msg: `${isMerge ? "Merging" : "Syncing"} ${name}${isMerge ? " -> main" : ""}…`,
  })
  try {
    if (isMerge) await mergeIntoMain(name)
    else await syncBranch(name)
    dispatch({
      type: "set-msg",
      msg: `${isMerge ? "Merged" : "Synced"} ${name}${isMerge ? " into main" : ""}`,
    })
    // biome-ignore lint/suspicious/noExplicitAny: ok in catch
  } catch (e: any) {
    const errorMsg = e.shortMessage || e.message
    if (errorMsg.toLowerCase().includes("conflict")) {
      dispatch({
        type: "set-msg",
        msg: chalk.red(
          `${isMerge ? "Merge" : "Rebase"} conflict in ${name}. Resolve in editor, status will update.`,
        ),
      })
    } else {
      dispatch({
        type: "set-msg",
        msg: chalk.red(`${isMerge ? "Merge" : "Rebase"} failed: ${errorMsg}`),
      })
    }
  }
  await refresh()
}

export function useTuiInput(
  state: AppState,
  dispatch: React.Dispatch<Action>,
  refresh: () => Promise<void>,
  exit: () => void,
) {
  const { dialog } = state
  const selected = state.rows[state.idx]

  const handleCreateProject = async () => {
    const config = await createProject()
    const result = await getConfig()
    if (result.ok) {
      dispatch({
        type: "loaded-config",
        branchPrefix: result.config.branchPrefix,
        editor: result.config.editor,
        baseBranch: result.config.baseBranch ?? "",
        runCommand: result.config.runCommand ?? "",
        runDir: result.config.runDir ?? "",
        repoRoot: result.repoRoot,
      })
    }
    dispatch({
      type: "dismiss",
      msg: `Created cia-repo.jsonc and cia-user.jsonc with prefix ${config.branchPrefix}`,
    })
    await refresh()
  }

  useInput(async (input, key) => {
    if (dialog.mode === "help") {
      if (input === "?" || input === "q" || key.escape) dispatch({ type: "dismiss" })
      return
    }
    if (dialog.mode === "create" || dialog.mode === "slash-command" || dialog.mode === "config")
      return

    // Detail view handles its own input
    if (dialog.mode === "worktree-detail") return

    if (dialog.mode === "init") {
      if (input === "y") {
        await handleCreateProject()
        return
      }
      if (input === "n" || key.escape) {
        exit()
      }
      return
    }

    if (dialog.mode === "confirm-delete" || dialog.mode === "confirm-force-delete") {
      if (input === "y") {
        await handleDeleteConfirm(dialog.candidate, dispatch, refresh)
      } else if (input === "n" || key.escape) {
        log(`User cancelled delete for worktree: ${dialog.candidate.name}`)
        dispatch({ type: "dismiss" })
      }
      return
    }

    if (dialog.mode === "confirm-merge" || dialog.mode === "confirm-sync") {
      if (input === "y") {
        await handleOperationConfirm(dialog.candidate, dispatch, refresh)
      } else if (input === "n" || key.escape) {
        log(`User cancelled ${dialog.candidate.operation} for worktree: ${dialog.candidate.name}`)
        dispatch({ type: "dismiss" })
      }
      return
    }

    if (dialog.mode === "confirm-kill-service") {
      if (input === "y") {
        log(`User confirmed kill service for worktree: ${dialog.worktree}`)
        dispatch({ type: "dismiss", msg: "Killing service…" })
        try {
          await killService(dialog.worktree)
          dispatch({ type: "set-msg", msg: `Service killed for ${dialog.worktree}` })
          // biome-ignore lint/suspicious/noExplicitAny: ok in catch
        } catch (e: any) {
          dispatch({
            type: "set-msg",
            msg: chalk.red(`Kill failed: ${e.shortMessage || e.message}`),
          })
        }
        await refresh()
      } else if (input === "n" || key.escape) {
        log("User cancelled kill service")
        dispatch({ type: "dismiss" })
      }
      return
    }

    // list mode
    if (key.upArrow || input === "k") {
      dispatch({ type: "move", dir: "up" })
      return
    }
    if (key.downArrow || input === "j") {
      dispatch({ type: "move", dir: "down" })
      return
    }
    if (input === "?") {
      dispatch({ type: "open-dialog", dialog: { mode: "help" } })
      return
    }
    if (input === "q" || key.escape || (key.ctrl && input === "c")) {
      exit()
      return
    }
    if (input === "/") {
      dispatch({ type: "open-dialog", dialog: { mode: "slash-command" } })
      return
    }
    if (input === "n") {
      dispatch({ type: "open-dialog", dialog: { mode: "create" } })
      return
    }
    if (key.return && selected) {
      dispatch({
        type: "open-dialog",
        dialog: { mode: "worktree-detail", worktree: selected },
      })
      return
    }
  })
}

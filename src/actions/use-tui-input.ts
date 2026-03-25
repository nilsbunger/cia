import chalk from "chalk"
import { useInput } from "ink"
import type { Action, AppState } from "../app-state-reducer"
import { deleteWorktree, cleanupFailedCreate, openEditor } from "../cmd-ops"
import { createProject, getConfig } from "../config"
import { syncBranch } from "../git-ops"
import { killService } from "../service"
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

async function handleSyncConfirm(
  candidate: { name: string },
  dispatch: React.Dispatch<Action>,
  refresh: () => Promise<void>,
) {
  const { name } = candidate
  log(`User confirmed sync for worktree: ${name}`)
  dispatch({ type: "dismiss", msg: `Syncing ${name}…` })
  try {
    await syncBranch(name)
    dispatch({ type: "set-msg", msg: `Synced ${name}` })
    // biome-ignore lint/suspicious/noExplicitAny: ok in catch
  } catch (e: any) {
    const errorMsg = e.shortMessage || e.message
    if (errorMsg.toLowerCase().includes("conflict")) {
      dispatch({
        type: "set-msg",
        msg: chalk.red(
          `Rebase conflict in ${name}. Resolve in editor, status will update.`,
        ),
      })
    } else {
      dispatch({
        type: "set-msg",
        msg: chalk.red(`Rebase failed: ${errorMsg}`),
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
        baseBranch: result.config.baseBranch ?? "",
        runCommand: result.config.runCommand ?? "",
        runDir: result.config.runDir ?? "",
        onCreateScript: result.config.onCreateScript ?? "",
        editCommand: result.config.editCommand ?? "",
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

    if (dialog.mode === "confirm-delete") {
      if (input === "y") {
        await handleDeleteConfirm(dialog.candidate, dispatch, refresh)
      } else if (input === "n" || key.escape) {
        log(`User cancelled delete for worktree: ${dialog.candidate.name}`)
        dispatch({ type: "dismiss" })
      }
      return
    }

    if (dialog.mode === "confirm-sync") {
      if (input === "y") {
        await handleSyncConfirm(dialog.candidate, dispatch, refresh)
      } else if (input === "n" || key.escape) {
        log(`User cancelled sync for worktree: ${dialog.candidate.name}`)
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

    if (dialog.mode === "confirm-cleanup-failed-create") {
      if (input === "y" || key.return) {
        const { branch, existingBranch } = dialog
        log(`User confirmed cleanup of failed create for branch: ${branch}`)
        dispatch({ type: "dismiss", msg: `Cleaning up ${branch}…` })
        try {
          await cleanupFailedCreate(branch, existingBranch)
          dispatch({ type: "set-msg", msg: `Cleaned up failed worktree ${branch}` })
        // biome-ignore lint/suspicious/noExplicitAny: ok in catch
        } catch (e: any) {
          dispatch({
            type: "set-msg",
            msg: chalk.red(`Cleanup failed: ${e.shortMessage || e.message}`),
          })
        }
        await refresh()
      } else if (input === "n" || key.escape) {
        log(`User skipped cleanup of failed create for branch: ${dialog.branch}`)
        dispatch({ type: "dismiss", msg: chalk.red(`Create failed: ${dialog.error}`) })
      }
      return
    }

    if (dialog.mode === "confirm-edit") {
      if (key.return) {
        const { info } = dialog
        log(`User confirmed edit for worktree: ${info.worktreeName}`)
        dispatch({ type: "dismiss", msg: `Opening ${info.worktreeName}…` })
        try {
          await openEditor(info.dir, info.worktreeName, state.branchPrefix)
          dispatch({ type: "set-msg", msg: `Opened ${info.worktreeName}` })
        // biome-ignore lint/suspicious/noExplicitAny: ok in catch
        } catch (e: any) {
          dispatch({ type: "set-msg", msg: chalk.red(e.message) })
        }
      } else if (key.escape) {
        log(`User cancelled edit for worktree: ${dialog.info.worktreeName}`)
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

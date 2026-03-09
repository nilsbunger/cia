import chalk from "chalk"
import { mergeIntoMain, pushBranch, syncBranch } from "../git-ops"
import { deleteWorktree, openEditor } from "../cmd-ops"
import { checkDeleteIssues, checkForConflicts, ensureWorktree } from "../cmd-helpers"
import { runService, isServiceRunning } from "../service"
import { log } from "../utils"
import * as path from "node:path"
import type { AppState, Action } from "../app-state-reducer"
import type { Worktree } from "../types"

export async function executeWorktreeCommand(
  commandKey: string,
  wt: Worktree,
  state: AppState,
  dispatch: React.Dispatch<Action>,
  refresh: () => Promise<void>,
) {

  if (commandKey === "c") {
    dispatch({ type: "set-msg", msg: `Opening ${wt.name}…` })
    const dir = await ensureWorktree(wt.name)
    await openEditor(dir)
    dispatch({ type: "set-msg", msg: `Opened ${wt.name}` })
    return
  }

  if (commandKey === "r") {
    if (!state.repoRoot) return
    if (!state.runCommand) {
      dispatch({ type: "set-msg", msg: chalk.red("No run command configured. Use /config to set it.") })
      return
    }
    dispatch({ type: "set-msg", msg: `Starting service for ${wt.name}…` })
    try {
      const dir = await ensureWorktree(wt.name)
      const runDir = state.runDir ? path.join(dir, state.runDir) : dir
      await runService(wt.name, runDir, state.runCommand)
      dispatch({ type: "set-msg", msg: `Service started for ${wt.name} (new terminal)` })
    // biome-ignore lint/suspicious/noExplicitAny: ok in catch
    } catch (e: any) {
      dispatch({ type: "set-msg", msg: chalk.red(`Failed: ${e.shortMessage || e.message}`) })
    }
    await refresh()
    return
  }

  if (commandKey === "x") {
    if (!isServiceRunning(wt.name)) {
      dispatch({ type: "set-msg", msg: chalk.red(`No service running for ${wt.name}`) })
      return
    }
    dispatch({ type: "open-dialog", dialog: { mode: "confirm-kill-service", worktree: wt.name } })
    return
  }

  if (commandKey === "s") {
    await executeSyncOrMerge("sync", wt, dispatch, refresh)
    return
  }

  if (commandKey === "p") {
    dispatch({ type: "dismiss", msg: `Pushing ${wt.name} to remote for backup…` })
    try {
      await pushBranch(wt.name)
      dispatch({ type: "set-msg", msg: `Pushed ${wt.name} to remote` })
    // biome-ignore lint/suspicious/noExplicitAny: ok in catch
    } catch (e: any) {
      dispatch({ type: "set-msg", msg: chalk.red(`Push failed: ${e.shortMessage || e.message}`) })
    }
    await refresh()
    return
  }

  if (commandKey === "m") {
    await executeSyncOrMerge("merge", wt, dispatch, refresh)
    return
  }

  if (commandKey === "D") {
    log(`User chose force delete for worktree: ${wt.name}`)
    dispatch({
      type: "open-dialog",
      dialog: {
        mode: "confirm-force-delete",
        candidate: {
          name: wt.name,
          worktreeDir: wt.worktreeDir,
          hasBranch: wt.hasBranch,
        },
      },
    })
    return
  }

  if (commandKey === "d") {
    log(`User chose delete for worktree: ${wt.name}`)
    dispatch({ type: "dismiss", msg: "Checking for issues…" })
    const { isClean, unmergedCommits, uncommittedFiles, worktreeIssues } =
      await checkDeleteIssues(wt.worktreeDir, wt.hasBranch ? wt.name : null)
    log(`Delete check completed for ${wt.name}`, {
      isClean,
      unmergedCount: unmergedCommits.length,
      uncommittedCount: uncommittedFiles.length,
      worktreeIssues,
    })
    if (isClean) {
      log(`Worktree ${wt.name} is clean, proceeding with safe delete`)
      dispatch({ type: "set-msg", msg: `Deleting ${wt.name}…` })
      try {
        await deleteWorktree(
          wt.worktreeDir,
          wt.hasBranch ? wt.name : null,
          false,
        )
        log(`Safe delete completed successfully for worktree: ${wt.name}`)
        dispatch({ type: "set-msg", msg: `Deleted ${wt.name}` })
        await refresh()
        dispatch({ type: "clamp-idx" })
      // biome-ignore lint/suspicious/noExplicitAny: ok in catch
      } catch (e: any) {
        log(`Safe delete failed for worktree: ${wt.name}`, {
          error: e.message,
          shortMessage: e.shortMessage,
        })
        const errMsg = e.shortMessage || e.message || ""
        const isBranchNotClean =
          /not fully merged|not merged|checked out|Cannot delete/i.test(errMsg)
        if (isBranchNotClean) {
          dispatch({ type: "set-msg", msg: chalk.red(`Delete failed: ${errMsg}. Use D to force delete.`) })
        } else {
          dispatch({ type: "set-msg", msg: chalk.red(`Delete failed: ${errMsg}`) })
        }
      }
    } else {
      log(`Worktree ${wt.name} has issues, showing confirmation prompt`, {
        unmergedCount: unmergedCommits.length,
        uncommittedCount: uncommittedFiles.length,
        worktreeIssues,
      })
      dispatch({
        type: "open-dialog",
        dialog: {
          mode: "confirm-delete",
          candidate: {
            name: wt.name,
            worktreeDir: wt.worktreeDir,
            hasBranch: wt.hasBranch,
            unmergedCommits,
            uncommittedFiles,
            worktreeIssues,
          },
        },
      })
    }
    return
  }
}


async function executeSyncOrMerge(
  operation: "sync" | "merge",
  wt: Worktree,
  dispatch: React.Dispatch<Action>,
  refresh: () => Promise<void>,
) {
  const isMerge = operation === "merge"
  const gitOp = isMerge ? "merge" : "rebase"
  const dialogMode = isMerge ? "confirm-merge" as const : "confirm-sync" as const

  dispatch({ type: "dismiss", msg: "Checking for conflicts…" })
  try {
    const { hasConflicts, conflictingFiles } = await checkForConflicts(wt.name, gitOp)
    if (hasConflicts) {
      log(`Conflicts predicted for ${operation} of ${wt.name}`, { conflictingFiles })
      dispatch({
        type: "open-dialog",
        dialog: {
          mode: dialogMode,
          candidate: { name: wt.name, operation, conflictingFiles },
        },
      })
    } else {
      dispatch({ type: "set-msg", msg: `${isMerge ? "Merging" : "Syncing"} ${wt.name}${isMerge ? " -> main" : ""}…` })
      if (isMerge) await mergeIntoMain(wt.name)
      else await syncBranch(wt.name)
      dispatch({ type: "set-msg", msg: `${isMerge ? "Merged" : "Synced"} ${wt.name}${isMerge ? " into main" : ""}` })
      await refresh()
    }
  // biome-ignore lint/suspicious/noExplicitAny: ok in catch
  } catch (e: any) {
    const errorMsg = e.shortMessage || e.message
    if (errorMsg.toLowerCase().includes("conflict")) {
      dispatch({ type: "set-msg", msg: chalk.red(`${isMerge ? "Merge" : "Rebase"} conflict in ${wt.name}. Resolve in editor, status will update.`) })
    } else {
      dispatch({ type: "set-msg", msg: chalk.red(`${isMerge ? "Merge" : "Rebase"} failed: ${errorMsg}`) })
    }
    await refresh()
  }
}

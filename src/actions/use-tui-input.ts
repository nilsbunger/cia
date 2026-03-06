import { useInput } from "ink"
import chalk from "chalk"
import { mergeIntoMain, pushBranch, syncBranch } from "../git-ops"
import { deleteBranchAndWorktree, openEditor } from "../cmd-ops"
import { checkDeleteIssues, checkForConflicts, ensureWorktree } from "../cmd-helpers"
import { resolveRunCommand } from "../config"
import { runService, killService, getRunningService } from "../service"
import { log } from "../utils"
import { Mode, Row } from "../types"

export type DeleteCandidate = {
  branch: string
  unmergedCommits: string[]
  uncommittedFiles: string[]
  worktreeIssues: string[]
}

export type OperationCandidate = {
  branch: string
  operation: "merge" | "sync"
  conflictingFiles: string[]
}

export type TuiInputContext = {
  mode: Mode
  rows: Row[]
  idx: number
  selected: Row | undefined
  deleteCandidate: DeleteCandidate | null
  forceDeleteCandidate: string | null
  operationCandidate: OperationCandidate | null
  killCandidate: string | null
  setMode: (m: Mode) => void
  setMsg: (m: string) => void
  setDeleteCandidate: (d: DeleteCandidate | null) => void
  setForceDeleteCandidate: (b: string | null) => void
  setOperationCandidate: (o: OperationCandidate | null) => void
  setKillCandidate: (k: string | null) => void
  setIdx: (fn: (i: number) => number) => void
  refresh: () => Promise<void>
  exit: () => void
  repoRoot: string
  runCommand: string
  onCreateProject?: () => Promise<void>
}

export function useTuiInput(ctx: TuiInputContext) {
  const {
    mode,
    rows,
    idx,
    selected,
    deleteCandidate,
    forceDeleteCandidate,
    operationCandidate,
    killCandidate,
    setMode,
    setMsg,
    setDeleteCandidate,
    setForceDeleteCandidate,
    setOperationCandidate,
    setKillCandidate,
    setIdx,
    refresh,
    exit,
    repoRoot,
    runCommand,
    onCreateProject,
  } = ctx

  useInput(async (input, key) => {
    if (mode === "help") {
      if (input === "?" || input === "q" || key.escape) setMode("list")
      return
    }
    if (mode === "create" || mode === "command" || mode === "config") return

    if (mode === "init") {
      if (input === "y" && onCreateProject) {
        onCreateProject()
        return
      }
      if (input === "n" || key.escape) {
        exit()
      }
      return
    }

    if (mode === "confirm-force-delete") {
      if (input === "y" && forceDeleteCandidate) {
        log(`User confirmed force delete (D) for branch: ${forceDeleteCandidate}`)
        setMode("list")
        setMsg(`Force deleting ${forceDeleteCandidate}…`)
        setForceDeleteCandidate(null)
        try {
          await deleteBranchAndWorktree(forceDeleteCandidate, true)
          log(`Force delete completed successfully for branch: ${forceDeleteCandidate}`)
          setMsg(`Deleted ${forceDeleteCandidate}`)
          await refresh()
          setIdx((i) => Math.min(i, Math.max(0, rows.length - 2)))
        } catch (e: any) {
          log(`Force delete failed for branch: ${forceDeleteCandidate}`, {
            error: e.message,
            shortMessage: e.shortMessage,
          })
          setMsg(chalk.red(`Delete failed: ${e.shortMessage || e.message}`))
        }
      } else if (input === "n" || key.escape) {
        log(`User cancelled force delete for branch: ${forceDeleteCandidate}`)
        setMode("list")
        setForceDeleteCandidate(null)
        setMsg("")
      }
      return
    }

    if (mode === "confirm-delete") {
      if (input === "y" && deleteCandidate) {
        log(`User confirmed force delete for branch: ${deleteCandidate.branch}`)
        setMode("list")
        setMsg(`Force deleting ${deleteCandidate.branch}…`)
        try {
          await deleteBranchAndWorktree(deleteCandidate.branch, true)
          log(`Force delete completed successfully for branch: ${deleteCandidate.branch}`)
          setMsg(`Deleted ${deleteCandidate.branch}`)
          setDeleteCandidate(null)
          await refresh()
          setIdx((i) => Math.min(i, Math.max(0, rows.length - 2)))
        } catch (e: any) {
          log(`Force delete failed for branch: ${deleteCandidate.branch}`, {
            error: e.message,
            shortMessage: e.shortMessage,
          })
          setMsg(chalk.red(`Delete failed: ${e.shortMessage || e.message}`))
        }
      } else if (input === "n" || key.escape) {
        log(`User cancelled force delete for branch: ${deleteCandidate?.branch}`)
        setMode("list")
        setDeleteCandidate(null)
        setMsg("")
      }
      return
    }

    if (mode === "confirm-merge") {
      if (input === "y" && operationCandidate) {
        log(`User confirmed merge for branch: ${operationCandidate.branch}`)
        setMode("list")
        setMsg(`Merging ${operationCandidate.branch} -> main…`)
        const branch = operationCandidate.branch
        setOperationCandidate(null)
        try {
          await mergeIntoMain(branch)
          setMsg(`Merged ${branch} into main`)
        } catch (e: any) {
          const errorMsg = e.shortMessage || e.message
          if (errorMsg.toLowerCase().includes("conflict")) {
            setMsg(chalk.red(`Merge conflict in ${branch}. Resolve in editor, status will update.`))
          } else {
            setMsg(chalk.red(`Merge failed: ${errorMsg}`))
          }
        }
        await refresh()
      } else if (input === "n" || key.escape) {
        log(`User cancelled merge for branch: ${operationCandidate?.branch}`)
        setMode("list")
        setOperationCandidate(null)
        setMsg("")
      }
      return
    }

    if (mode === "confirm-sync") {
      if (input === "y" && operationCandidate) {
        log(`User confirmed sync for branch: ${operationCandidate.branch}`)
        setMode("list")
        setMsg(`Syncing ${operationCandidate.branch}…`)
        const branch = operationCandidate.branch
        setOperationCandidate(null)
        try {
          await syncBranch(branch)
          setMsg(`Synced ${branch}`)
        } catch (e: any) {
          const errorMsg = e.shortMessage || e.message
          if (errorMsg.toLowerCase().includes("conflict")) {
            setMsg(chalk.red(`Rebase conflict in ${branch}. Resolve in editor, status will update.`))
          } else {
            setMsg(chalk.red(`Rebase failed: ${errorMsg}`))
          }
        }
        await refresh()
      } else if (input === "n" || key.escape) {
        log(`User cancelled sync for branch: ${operationCandidate?.branch}`)
        setMode("list")
        setOperationCandidate(null)
        setMsg("")
      }
      return
    }

    if (mode === "confirm-kill-service") {
      if (input === "y" && killCandidate) {
        log(`User confirmed kill service for branch: ${killCandidate}`)
        setMode("list")
        setMsg(`Killing service…`)
        setKillCandidate(null)
        try {
          await killService(repoRoot)
          setMsg(`Service killed`)
        } catch (e: any) {
          setMsg(chalk.red(`Kill failed: ${e.shortMessage || e.message}`))
        }
        await refresh()
      } else if (input === "n" || key.escape) {
        log(`User cancelled kill service`)
        setMode("list")
        setKillCandidate(null)
        setMsg("")
      }
      return
    }

    // list mode
    if (key.upArrow) {
      setIdx((i) => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setIdx((i) => Math.min(rows.length - 1, i + 1))
      return
    }
    if (input === "?") {
      setMode("help")
      return
    }
    if (input === "q" || (key.ctrl && input === "c")) {
      exit()
      return
    }
    if (input === "r") {
      if (!repoRoot) return
      if (!runCommand) {
        setMsg(chalk.red("No run command configured. Use /config to set it."))
        return
      }
      if (!selected) {
        setMsg(chalk.red("Select a branch first"))
        return
      }
      setMsg(`Starting service for ${selected.branch}…`)
      try {
        const dir = await ensureWorktree(selected.branch)
        await runService(repoRoot, selected.branch, dir, resolveRunCommand(runCommand))
        setMsg(`Service started for ${selected.branch} (new terminal)`)
      } catch (e: any) {
        setMsg(chalk.red(`Failed: ${e.shortMessage || e.message}`))
      }
      await refresh()
      return
    }


    if (input === "x") {
      if (!repoRoot) return
      const running = await getRunningService(repoRoot)
      if (!running) {
        setMsg(chalk.red("No service is running"))
        return
      }
      setKillCandidate(running.branch)
      setMode("confirm-kill-service")
      setMsg("")
      return
    }

    if (!selected && input !== "n" && input !== "/") return

    if (input === "/") {
      setMode("command")
      return
    }

    if (input === "n") {
      setMode("create")
      return
    }

    if (!selected) return

    if (key.return) {
      setMsg(`Opening ${selected.branch}…`)
      const dir = await ensureWorktree(selected.branch)
      await openEditor(dir)
      setMsg(`Opened ${selected.branch}`)
      return
    }

    if (input === "s") {
      setMsg(`Checking for conflicts…`)
      try {
        const { hasConflicts, conflictingFiles } = await checkForConflicts(selected.branch, "rebase")
        if (hasConflicts) {
          log(`Conflicts predicted for sync of ${selected.branch}`, { conflictingFiles })
          setOperationCandidate({
            branch: selected.branch,
            operation: "sync",
            conflictingFiles,
          })
          setMode("confirm-sync")
          setMsg("")
        } else {
          setMsg(`Syncing ${selected.branch}…`)
          await syncBranch(selected.branch)
          setMsg(`Synced ${selected.branch}`)
          await refresh()
        }
      } catch (e: any) {
        const errorMsg = e.shortMessage || e.message
        if (errorMsg.toLowerCase().includes("conflict")) {
          setMsg(chalk.red(`Rebase conflict in ${selected.branch}. Resolve in editor, status will update.`))
        } else {
          setMsg(chalk.red(`Rebase failed: ${errorMsg}`))
        }
        await refresh()
      }
      return
    }

    if (input === "p") {
      setMsg(`Pushing ${selected.branch} to remote for backup…`)
      try {
        await pushBranch(selected.branch)
        setMsg(`Pushed ${selected.branch} to remote`)
      } catch (e: any) {
        setMsg(chalk.red(`Push failed: ${e.shortMessage || e.message}`))
      }
      await refresh()
      return
    }

    if (input === "m") {
      setMsg(`Checking for conflicts…`)
      try {
        const { hasConflicts, conflictingFiles } = await checkForConflicts(selected.branch, "merge")
        if (hasConflicts) {
          log(`Conflicts predicted for merge of ${selected.branch}`, { conflictingFiles })
          setOperationCandidate({
            branch: selected.branch,
            operation: "merge",
            conflictingFiles,
          })
          setMode("confirm-merge")
          setMsg("")
        } else {
          setMsg(`Merging ${selected.branch} -> main…`)
          await mergeIntoMain(selected.branch)
          setMsg(`Merged ${selected.branch} into main`)
          await refresh()
        }
      } catch (e: any) {
        const errorMsg = e.shortMessage || e.message
        if (errorMsg.toLowerCase().includes("conflict")) {
          setMsg(chalk.red(`Merge conflict in ${selected.branch}. Resolve in editor, status will update.`))
        } else {
          setMsg(chalk.red(`Merge failed: ${errorMsg}`))
        }
        await refresh()
      }
      return
    }

    if (input === "D") {
      log(`User pressed 'D' to force delete branch: ${selected.branch}`)
      setForceDeleteCandidate(selected.branch)
      setMode("confirm-force-delete")
      setMsg("")
      return
    }

    if (input === "d") {
      log(`User pressed 'd' to delete branch: ${selected.branch}`)
      setMsg(`Checking for issues…`)
      const { isClean, unmergedCommits, uncommittedFiles, worktreeIssues } =
        await checkDeleteIssues(selected.branch)
      log(`Delete check completed for ${selected.branch}`, {
        isClean,
        unmergedCount: unmergedCommits.length,
        uncommittedCount: uncommittedFiles.length,
        worktreeIssues,
      })
      if (isClean) {
        log(`Branch ${selected.branch} is clean, proceeding with safe delete`)
        setMsg(`Deleting ${selected.branch}…`)
        try {
          await deleteBranchAndWorktree(selected.branch, false)
          log(`Safe delete completed successfully for branch: ${selected.branch}`)
          setMsg(`Deleted ${selected.branch}`)
          await refresh()
          setIdx((i) => Math.min(i, Math.max(0, rows.length - 2)))
        } catch (e: any) {
          log(`Safe delete failed for branch: ${selected.branch}`, {
            error: e.message,
            shortMessage: e.shortMessage,
          })
          const errMsg = e.shortMessage || e.message || ""
          const isBranchNotClean =
            /not fully merged|not merged|checked out|Cannot delete/i.test(errMsg)
          if (isBranchNotClean) {
            setMsg(chalk.red(`Delete failed: ${errMsg}. Use D to force delete.`))
          } else {
            setMsg(chalk.red(`Delete failed: ${errMsg}`))
          }
        }
      } else {
        log(`Branch ${selected.branch} has issues, showing confirmation prompt`, {
          unmergedCount: unmergedCommits.length,
          uncommittedCount: uncommittedFiles.length,
          worktreeIssues,
        })
        setDeleteCandidate({
          branch: selected.branch,
          unmergedCommits,
          uncommittedFiles,
          worktreeIssues,
        })
        setMode("confirm-delete")
        setMsg("")
      }
      return
    }
  })
}

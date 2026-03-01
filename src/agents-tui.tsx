#!/usr/bin/env node
import React, { useEffect, useRef, useState } from "react"
import { render, Box, Text, useApp, useInput } from "ink"
import chalk from "chalk"
import { mergeIntoMain, pushBranch, syncBranch } from "./git-ops"
import { createWorktree, deleteBranchAndWorktree, openEditor } from "./cmd-ops"
import { CreatePrompt } from "./components/create-prompt"
import { log, LOG_FILE } from "./utils"
import { checkDeleteIssues, checkForConflicts, computeRows, ensureWorktree } from "./cmd-helpers"
import { BRANCH_PREFIX } from "./constants"
import { Header, Help, RowView } from "./components/ui-helpers"
import { Mode, Row } from "./types"
import { ConfirmDeletePrompt } from "./components/confirm-delete-prompt"
import { ConfirmOperationPrompt } from "./components/confirm-operation-prompt"

// When invoked via `pnpm --dir`, cwd is the package dir, not the caller's.
// pnpm sets INIT_CWD to the original invoking directory.
if (process.env.INIT_CWD) {
  process.chdir(process.env.INIT_CWD)
}

// Log startup
log("=== Application started ===")

function useInterval(callback: () => void, ms: number) {
  const saved = useRef(callback)
  useEffect(() => {
    saved.current = callback
  }, [callback])
  useEffect(() => {
    const id = setInterval(() => saved.current(), ms)
    return () => clearInterval(id)
  }, [ms])
}

const App: React.FC = () => {
  const { exit } = useApp()
  const [mode, setMode] = useState<Mode>("list")
  const [rows, setRows] = useState<Row[]>([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string>("")
  const [deleteCandidate, setDeleteCandidate] = useState<{
    branch: string
    unmergedCommits: string[]
    uncommittedFiles: string[]
    worktreeIssues: string[]
  } | null>(null)
  const [operationCandidate, setOperationCandidate] = useState<{
    branch: string
    operation: "merge" | "sync"
    conflictingFiles: string[]
  } | null>(null)
  const selected = rows[idx]

  const refresh = async () => {
    setLoading(true)
    const list = await computeRows()
    setRows(list)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])
  useInterval(() => {
    if (mode === "list") refresh()
  }, 5000)

  useInput(async (input, key) => {
    if (mode === "help") {
      if (input === "?" || input === "q" || key.escape) {
        setMode("list")
      }
      return
    }
    if (mode === "create") {
      // input handled by CreatePrompt component
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
        setOperationCandidate(null)
        try {
          await mergeIntoMain(operationCandidate.branch)
          setMsg(`Merged ${operationCandidate.branch} into main`)
        } catch (e: any) {
          const errorMsg = e.shortMessage || e.message
          if (errorMsg.toLowerCase().includes("conflict")) {
            setMsg(
              chalk.red(
                `Merge conflict in ${operationCandidate.branch}. Resolve in editor, status will update.`,
              ),
            )
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
        setOperationCandidate(null)
        try {
          await syncBranch(operationCandidate.branch)
          setMsg(`Synced ${operationCandidate.branch}`)
        } catch (e: any) {
          const errorMsg = e.shortMessage || e.message
          if (errorMsg.toLowerCase().includes("conflict")) {
            setMsg(
              chalk.red(
                `Rebase conflict in ${operationCandidate.branch}. Resolve in editor, status will update.`,
              ),
            )
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
    // list mode:
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
      refresh()
      return
    }

    if (!selected && input !== "n") return

    if (key.return) {
      // open
      setMsg(`Opening ${selected.branch}…`)
      const dir = await ensureWorktree(selected.branch)
      await openEditor(dir)
      setMsg(`Opened ${selected.branch}`)
      return
    }

    if (input === "n") {
      setMode("create")
      return
    }

    if (input === "s") {
      setMsg(`Checking for conflicts…`)
      try {
        const { hasConflicts, conflictingFiles } = await checkForConflicts(
          selected.branch,
          "rebase",
        )
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
          setMsg(
            chalk.red(
              `Rebase conflict in ${selected.branch}. Resolve in editor, status will update.`,
            ),
          )
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
          setMsg(
            chalk.red(
              `Merge conflict in ${selected.branch}. Resolve in editor, status will update.`,
            ),
          )
        } else {
          setMsg(chalk.red(`Merge failed: ${errorMsg}`))
        }
        await refresh()
      }
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
        // Safe to delete without confirmation
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
          setMsg(chalk.red(`Delete failed: ${e.shortMessage || e.message}`))
        }
      } else {
        // Show confirmation prompt with all issues
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

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{chalk.bold("Agents TUI")}</Text>
        <Text>
          {" "}
          {chalk.dim("(")}
          {BRANCH_PREFIX}
          {chalk.dim("… branches) – press ? for help")}
        </Text>
      </Box>
      <Box>
        <Text dimColor>Log: {LOG_FILE}</Text>
      </Box>

      {mode === "help" && (
        <Box borderStyle="round" paddingX={1} paddingY={0} marginTop={1}>
          <Help />
        </Box>
      )}

      {mode === "create" && (
        <CreatePrompt
          prefix={BRANCH_PREFIX}
          onSubmit={async (branchName) => {
            if (!branchName.startsWith(BRANCH_PREFIX)) {
              setMsg(chalk.red(`Branch must start with ${BRANCH_PREFIX}`))
              setMode("list")
              return
            }
            setMode("list")
            setMsg(`Creating ${branchName}…`)
            try {
              const dir = await createWorktree(branchName)
              await openEditor(dir)
              setMsg(`Created and opened ${branchName}`)
              await refresh()
            } catch (e: any) {
              setMsg(chalk.red(`Failed: ${e.shortMessage || e.message}`))
            }
          }}
          onCancel={() => {
            setMode("list")
            setMsg("")
          }}
        />
      )}

      {mode === "confirm-delete" && deleteCandidate && (
        <ConfirmDeletePrompt
          branch={deleteCandidate.branch}
          unmergedCommits={deleteCandidate.unmergedCommits}
          uncommittedFiles={deleteCandidate.uncommittedFiles}
          worktreeIssues={deleteCandidate.worktreeIssues}
        />
      )}

      {(mode === "confirm-merge" || mode === "confirm-sync") && operationCandidate && (
        <ConfirmOperationPrompt
          branch={operationCandidate.branch}
          operation={operationCandidate.operation}
          conflictingFiles={operationCandidate.conflictingFiles}
        />
      )}

      {mode === "list" && (
        <Box flexDirection="column" marginTop={1}>
          <Header />
          <Box flexDirection="column">
            {loading && <Text dimColor>Loading…</Text>}
            {!loading && rows.length === 0 && (
              <Text dimColor>No {BRANCH_PREFIX} branches yet. Press “n” to create one.</Text>
            )}
            {!loading &&
              rows.map((r, i) => <RowView key={r.branch} row={r} selected={i === idx} />)}
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>{msg || " "}</Text>
      </Box>
      <Box>
        <Text dimColor>
          Hints: ↑/↓ select • enter open • n new • s sync • p backup • m merge • d delete • r
          refresh • ? help • q quit
        </Text>
      </Box>
    </Box>
  )
}

render(<App />)

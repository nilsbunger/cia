import React, { useEffect, useState } from "react"
import { Box, Text, useApp } from "ink"
import chalk from "chalk"
import { createWorktree, openEditor } from "./cmd-ops"
import { computeRows } from "./cmd-helpers"
import { getConfig, setBranchPrefix } from "./config"
import { BRANCH_PREFIX } from "./constants"
import { LOG_FILE } from "./utils"
import { ConfirmDeletePrompt } from "./components/confirm-delete-prompt"
import { ConfirmOperationPrompt } from "./components/confirm-operation-prompt"
import { Header, RowView } from "./branch-list/view"
import { useTuiInput } from "./actions/use-tui-input"
import { SlashCommandView, ConfigView } from "./commands/view"
import { CreateView } from "./create/view"
import { HelpView } from "./help/view"
import { useInterval } from "./hooks/use-interval"
import { Mode, Row } from "./types"

const App: React.FC = () => {
  const { exit } = useApp()
  const [branchPrefix, setBranchPrefixState] = useState<string>(BRANCH_PREFIX)
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
    getConfig().then((c) => setBranchPrefixState(c.branchPrefix))
  }, [])
  useEffect(() => {
    refresh()
  }, [])
  useInterval(() => {
    if (mode === "list") refresh()
  }, 5000)

  useTuiInput({
    mode,
    rows,
    idx,
    selected,
    deleteCandidate,
    operationCandidate,
    setMode,
    setMsg,
    setDeleteCandidate,
    setOperationCandidate,
    setIdx,
    refresh,
    exit,
  })

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{chalk.bold("Agents TUI")}</Text>
        <Text>
          {" "}
          {chalk.dim("(")}
          {branchPrefix}
          {chalk.dim("… branches) – press ? for help")}
        </Text>
      </Box>
      <Box>
        <Text dimColor>Log: {LOG_FILE}</Text>
      </Box>

      {mode === "help" && <HelpView branchPrefix={branchPrefix} />}

      {mode === "command" && (
        <SlashCommandView
          onSubmit={(result) => {
            if (result === "config") {
              setMode("config")
              setMsg("")
            } else if (typeof result === "object" && "unknown" in result) {
              setMsg(chalk.red(`Unknown command: /${result.unknown}`))
              setMode("list")
            } else {
              setMode("list")
              setMsg("")
            }
          }}
          onCancel={() => {
            setMode("list")
            setMsg("")
          }}
        />
      )}

      {mode === "config" && (
        <ConfigView
          currentPrefix={branchPrefix}
          onSubmit={async (prefix) => {
            await setBranchPrefix(prefix)
            const config = await getConfig()
            setBranchPrefixState(config.branchPrefix)
            setMode("list")
            setMsg(`Branch prefix set to ${config.branchPrefix}`)
            await refresh()
          }}
          onCancel={() => {
            setMode("list")
            setMsg("")
          }}
        />
      )}

      {mode === "create" && (
        <CreateView
          prefix={branchPrefix}
          onSubmit={async (branchName) => {
            if (!branchName.startsWith(branchPrefix)) {
              setMsg(chalk.red(`Branch must start with ${branchPrefix}`))
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
              <Text dimColor>No {branchPrefix} branches yet. Press "n" to create one.</Text>
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
          Hints: ↑/↓ select • enter open • n new • / commands • s sync • p backup • m merge • d
          delete • r refresh • ? help • q quit
        </Text>
      </Box>
    </Box>
  )
}

export default App

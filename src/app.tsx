import type React from "react"
import { useEffect, useState } from "react"
import { Box, Text, useApp } from "ink"
import chalk from "chalk"
import { createWorktree, openEditor } from "./cmd-ops"
import { computeRows } from "./cmd-helpers"
import { createProject, getConfig, setBranchPrefix, setRunCommand } from "./config"
import { BRANCH_PREFIX } from "./constants"
import { LOG_FILE } from "./utils"
import { ConfirmDeletePrompt } from "./components/confirm-delete-prompt"
import { ConfirmForceDeletePrompt } from "./components/confirm-force-delete-prompt"
import { ConfirmKillPrompt } from "./components/confirm-kill-prompt"
import { ConfirmOperationPrompt } from "./components/confirm-operation-prompt"
import { InitPrompt } from "./components/init-prompt"
import { Header, RowView, Warnings } from "./branch-list/view"
import { useTuiInput } from "./actions/use-tui-input"
import { SlashCommandView, ConfigView } from "./slash-commands/view"
import { CreateView } from "./create/view"
import { HelpView } from "./help/view"
import { useInterval } from "./hooks/use-interval"
import type { Mode, Row } from "./types"

const App: React.FC = () => {
  const { exit } = useApp()
  const [branchPrefix, setBranchPrefixState] = useState<string>(BRANCH_PREFIX)
  const [runCommand, setRunCommandState] = useState<string>("")
  const [repoRoot, setRepoRoot] = useState<string>("")
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
  const [forceDeleteCandidate, setForceDeleteCandidate] = useState<string | null>(null)
  const [operationCandidate, setOperationCandidate] = useState<{
    branch: string
    operation: "merge" | "sync"
    conflictingFiles: string[]
  } | null>(null)
  const [killCandidate, setKillCandidate] = useState<string | null>(null)
  const selected = rows[idx]

  const refresh = async () => {
    setLoading(true)
    const list = await computeRows()
    setRows(list)
    setLoading(false)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh is not a dependency
  useEffect(() => {
    getConfig().then((r) => {
      if (r.ok) {
        setBranchPrefixState(r.config.branchPrefix)
        setRunCommandState(r.config.runCommand ?? "")
        setRepoRoot(r.repoRoot)
        refresh()
      } else {
        setMode("init")
      }
    })
  }, [])
  useInterval(() => {
    if (mode === "list") refresh()
  }, 5000)

  useTuiInput({
    mode,
    rows,
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
    onCreateProject: async () => {
      const config = await createProject()
      const result = await getConfig()
      if (result.ok) {
        setBranchPrefixState(result.config.branchPrefix)
        setRunCommandState(result.config.runCommand ?? "")
        setRepoRoot(result.repoRoot)
      }
      setMode("list")
      setMsg(`Created cia-repo.jsonc and cia-user.jsonc with prefix ${config.branchPrefix}`)
      await refresh()
    },
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

      {mode === "slash-command" && (
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

      {mode === "init" && <InitPrompt />}

      {mode === "config" && (
        <ConfigView
          currentPrefix={branchPrefix}
          currentRunCommand={runCommand}
          onSubmit={async (prefix, cmd) => {
            await setBranchPrefix(prefix)
            await setRunCommand(cmd)
            const result = await getConfig()
            const config = result.ok ? result.config : { branchPrefix, runCommand }
            setBranchPrefixState(config.branchPrefix)
            setRunCommandState(config.runCommand ?? "")
            setMode("list")
            setMsg(`Config saved`)
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
            // biome-ignore lint/suspicious/noExplicitAny: ok for exceptions
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

      {mode === "confirm-force-delete" && forceDeleteCandidate && (
        <ConfirmForceDeletePrompt branch={forceDeleteCandidate} />
      )}

      {(mode === "confirm-merge" || mode === "confirm-sync") && operationCandidate && (
        <ConfirmOperationPrompt
          branch={operationCandidate.branch}
          operation={operationCandidate.operation}
          conflictingFiles={operationCandidate.conflictingFiles}
        />
      )}

      {mode === "confirm-kill-service" && killCandidate && (
        <ConfirmKillPrompt branch={killCandidate} />
      )}

      {mode === "list" && <>
        <Box flexDirection="column" marginTop={1}>
          <Header />
          <Box flexDirection="column">
            {loading && <Text dimColor>Loading…</Text>}
            {!loading && rows.length === 0 && (
              <Text dimColor>No {branchPrefix} worktrees yet. Press "n" to create one.</Text>
            )}
            {!loading &&
              rows.map((r, i) => <RowView key={r.branch} row={r} selected={i === idx} />)}
          </Box>
        </Box>
        <Warnings rows={rows} />
      </>}


      <Box marginTop={1}>
        <Text dimColor>{msg || " "}</Text>
      </Box>
      <Box>
        <Text dimColor>
          Hints: ↑/↓ select • enter open • n new • / commands • r run service • x kill service • s
          sync • p backup • m merge • d delete • D force delete • ? help • q quit
        </Text>
      </Box>
    </Box>
  )
}

export default App
